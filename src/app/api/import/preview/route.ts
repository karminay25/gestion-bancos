import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseBBVA } from '@/lib/importers/bbva';
import { parseMonex } from '@/lib/importers/monex';
import { parseBajio } from '@/lib/importers/bajio';

export const dynamic = 'force-dynamic';

// Build a per-request client scoped to the caller's session so RLS policies
// (which restrict writes to the admin role) apply the same way here as they
// do for direct client-side calls. Without this, this route would act as an
// anonymous request and get blocked (or bypass RLS entirely) regardless of
// who is actually signed in.
function getScopedSupabase(req: NextRequest) {
    const authHeader = req.headers.get('authorization') || undefined;
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined
    );
}

// Supabase queries occasionally fail with a transient "fetch failed" network
// error (seen locally, but network blips can happen in production too).
// Retry those a couple of times with a short backoff before giving up.
async function withRetry<T>(fn: () => PromiseLike<{ data: T; error: any }>, attempts = 3): Promise<{ data: T; error: any }> {
    let last: { data: T; error: any } = { data: null as any, error: null };
    for (let i = 0; i < attempts; i++) {
        last = await fn();
        if (!last.error) return last;
        const msg = String(last.error?.message || '');
        const isTransient = /fetch failed|network|ECONNRESET|ETIMEDOUT|socket/i.test(msg);
        if (!isTransient) return last;
        if (i < attempts - 1) await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
    return last;
}

export async function POST(req: NextRequest) {
    try {
        const supabase = getScopedSupabase(req);
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const cuentaId = formData.get('cuentaId') as string;

        if (!file || !cuentaId) {
            return NextResponse.json({ error: 'Faltan datos requeridos (archivo o cuenta)' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = file.name.toUpperCase();
        
        let result: { detectedCompany: any; movements: any[]; suggestedInitialBalance?: number | null } = { detectedCompany: null as any, movements: [] as any[] };
        let isBBVA = false;

        // Auto-detect bank format
        if (fileName.includes('RSM')) {
            result = parseBBVA(buffer);
            isBBVA = true;
        } else if (fileName.includes('MOVIMIENTOSCONTRATO')) {
            result = parseMonex(buffer);
        } else if (fileName.includes('BAJIO')) {
            result = parseBajio(buffer);
        } else {
            // Fallback trial
            try {
                result = parseBBVA(buffer);
                if (result.movements.length === 0) throw new Error();
                isBBVA = true;
            } catch {
                try {
                    result = parseMonex(buffer);
                    if (result.movements.length === 0) throw new Error();
                } catch {
                    result = parseBajio(buffer);
                }
            }
        }

        const { movements: allMovements } = result;

        console.log(`[Preview] File: ${file.name} | Parser returned ${allMovements.length} movements | cuentaId: ${cuentaId}`);

        if (allMovements.length === 0) {
            return NextResponse.json({ error: 'No se encontraron movimientos en el archivo. Verifica que sea un Excel bancario válido.' }, { status: 400 });
        }

        // Fetch centros de costo for auto-classification
        console.time('[Preview] centros_costo fetch');
        const { data: centrosCosto } = await withRetry(() => supabase.from('centros_costo').select('id, nombre'));
        console.timeEnd('[Preview] centros_costo fetch');

        // Keyword-based rules, checked before the generic name-matching loop.
        // These take priority regardless of how the cost center itself is named.
        const PRIORITY_CC_RULES: { keywords: string[]; ccName: string }[] = [
            { keywords: ['GASOLINA', 'COMBUSTIBLE'], ccName: 'GASOLINA' },
            { keywords: ['TRASPASO'], ccName: 'TRASPASO' },
        ];

        // Use the selected account for ALL movements
        // (user explicitly selects which account they're importing into)
        const movementsWithAccounts = allMovements.map(m => {
            let tipo = m.tipo;
            let monto = parseFloat(m.monto);
            let centro_costo_id = null;
            let conceptoUpper = (m.concepto || '').toUpperCase();

            // Auto-detect Traspasos
            if (conceptoUpper.includes('TRASPASO')) {
                tipo = 'Traspaso';
                // If it was parsed as Egreso, the money left, so the traspaso is outgoing (-)
                if (m.tipo === 'Egreso') monto = -Math.abs(monto);
                else monto = Math.abs(monto); // Ingreso -> incoming (+)
            }

            // Función para normalizar texto (quitar acentos)
            const removeAccents = (str: string) => {
                return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            };

            let conceptoNormal = removeAccents(conceptoUpper);
            let refNormal = removeAccents((m.referencia || '').toUpperCase());
            let nombreNormal = removeAccents((m.proveedor || m.descripcion || '').toUpperCase());

            // Auto-detect Centro de Costo
            if (centrosCosto) {
                // Priority keyword rules (gasolina/combustible, traspaso, etc.)
                for (const rule of PRIORITY_CC_RULES) {
                    const matches = rule.keywords.some(kw =>
                        conceptoNormal.includes(kw) || refNormal.includes(kw) || nombreNormal.includes(kw)
                    );
                    if (matches) {
                        const cc = centrosCosto.find(c => removeAccents(c.nombre.toUpperCase()) === rule.ccName);
                        if (cc) {
                            centro_costo_id = cc.id;
                            break;
                        }
                    }
                }
            }

            // Fallback: generic match against every cost center's own name
            if (centrosCosto && !centro_costo_id) {
                // We order CCs by length descending to match more specific names first
                const sortedCCs = [...centrosCosto].sort((a, b) => b.nombre.length - a.nombre.length);
                
                const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                
                for (const cc of sortedCCs) {
                    const ccNameRaw = cc.nombre.toUpperCase();
                    const ccName = removeAccents(ccNameRaw);
                    
                    let isMatch = false;
                    
                    if (ccName.length <= 4) {
                        // Use strict word boundaries \b to avoid "OBA" matching "RECIBIDOBAJIO"
                        const regex = new RegExp(`\\b${escapeRegExp(ccName)}\\b`);
                        isMatch = regex.test(conceptoNormal) || regex.test(refNormal);
                    } else {
                        // For longer words like "NOMINA" or "ARANDANO", allow partial matches
                        // like "NOMINAS" or "ARANDANOS" by removing the strict \b
                        isMatch = conceptoNormal.includes(ccName) || refNormal.includes(ccName);
                    }
                    
                    if (isMatch) {
                        centro_costo_id = cc.id;
                        break;
                    }
                }
            }

            return {
                ...m,
                tipo,
                monto: monto.toString(), // Keep as string format for consistency
                centro_costo_id,
                targetAccountId: cuentaId
            };
        });

        // DEDUPLICATION LOGIC PER ACCOUNT
        // Previously this fired one (or two) Supabase requests PER movement via
        // Promise.all — for a 130-row file that's 260+ simultaneous requests,
        // which overwhelmed the connection and caused silent "fetch failed"
        // errors (isDuplicate ended up null instead of true/false, so duplicates
        // were never actually detected). It was also extremely slow even when
        // throttled (minutes for a single file), risking a timeout in production.
        // A movement only ever needs to match an existing one on cuenta + fecha +
        // tipo + monto (the old "balance fingerprint" stage never added real
        // selectivity — its broader fallback stage already covered the same
        // cases), so we fetch the account's existing movements ONCE and compare
        // in memory instead.
        // Supabase/PostgREST caps a single request at 1000 rows, and accounts can
        // easily hold several thousand movements, so this has to be paged.
        // NOTE: intentionally uses id-keyset pagination (.gt('id', cursor)) rather
        // than .range() — .range() sends an HTTP "Range" header which the Next.js
        // dev server's fetch instrumentation fails to parse in this project
        // ("invalid type: unit value, expected usize"), crashing the route.
        const existingMovements: { id: string; fecha: string; tipo: string; monto: number }[] = [];
        {
            const PAGE_SIZE = 1000;
            let cursor: string | null = null;
            while (true) {
                const cursorForPage = cursor;
                console.time(`[Preview] existingMovements page cursor=${cursorForPage}`);
                const { data: page, error: pageError } = await withRetry(() => {
                    let pageQuery = supabase
                        .from('movimientos')
                        .select('id, fecha, tipo, monto')
                        .eq('cuenta_id', cuentaId)
                        .order('id', { ascending: true })
                        .limit(PAGE_SIZE);
                    if (cursorForPage) pageQuery = pageQuery.gt('id', cursorForPage);
                    return pageQuery;
                });
                console.timeEnd(`[Preview] existingMovements page cursor=${cursorForPage}`);

                if (pageError) {
                    throw new Error(`No se pudo verificar duplicados: ${pageError.message}`);
                }
                if (!page || page.length === 0) break;
                existingMovements.push(...page);
                if (page.length < PAGE_SIZE) break;
                cursor = page[page.length - 1].id;
            }
        }

        const dupKey = (fecha: string, tipo: string, monto: number | string) =>
            `${fecha}|${tipo}|${Number(monto).toFixed(2)}`;

        const existingKeys = new Set(
            (existingMovements || []).map(e => dupKey(e.fecha, e.tipo, e.monto))
        );

        const finalMovements = movementsWithAccounts.map(m => ({
            ...m,
            isDuplicate: existingKeys.has(dupKey(m.fecha, m.tipo, m.monto))
        }));

        // Reverse to get Oldest First (BBVA comes newest-first; Monex and Bajio already oldest-first)
        const sortedMovements = isBBVA ? finalMovements.reverse() : finalMovements;

        return NextResponse.json({
            detectedCompany: result.detectedCompany,
            movements: sortedMovements,
            suggestedInitialBalance: (result as any).suggestedInitialBalance
        });

    } catch (error: any) {
        console.error('Import Preview Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
