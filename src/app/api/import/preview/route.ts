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

        // El formato del banco se decide por la cuenta que el usuario ya
        // seleccionó en el formulario (Empresa + Banco + Cuenta), NO por el
        // nombre del archivo. Adivinar por el nombre fallaba en cuanto alguien
        // renombraba el Excel (p. ej. "BOSBES JUL 26 MONEX USD.xlsx" en vez del
        // nombre de fábrica "MovimientosContrato..."), cayendo en el intento
        // equivocado de parser y arruinando las fechas.
        const { data: cuentaInfo, error: cuentaError } = await withRetry(() =>
            supabase.from('cuentas_bancarias').select('banco').eq('id', cuentaId).single()
        );
        if (cuentaError || !cuentaInfo) {
            return NextResponse.json({ error: 'No se pudo identificar el banco de la cuenta seleccionada' }, { status: 400 });
        }
        const banco = (cuentaInfo.banco || '').toUpperCase();

        let result: { detectedCompany: any; movements: any[]; suggestedInitialBalance?: number | null };
        let isBBVA = false;

        if (banco.includes('BBVA')) {
            result = parseBBVA(buffer);
            isBBVA = true;
        } else if (banco.includes('MONEX')) {
            result = parseMonex(buffer);
        } else if (banco.includes('BAJIO')) {
            result = parseBajio(buffer);
        } else {
            return NextResponse.json({ error: `No hay un lector de Excel configurado para el banco "${cuentaInfo.banco}" de esta cuenta.` }, { status: 400 });
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
        // Se evalúan en orden; gana la primera regla que coincida.
        const PRIORITY_CC_RULES: { keywords: string[]; ccName: string }[] = [
            { keywords: ['TIP AUTO', 'ABC LEASING'], ccName: 'SOCIO CARLOS' },
            { keywords: ['GASOLINA', 'COMBUSTIBLE', 'ECO ESTACION', 'DIESEL'], ccName: 'GASOLINA' },
            { keywords: ['IMSS', 'SAT', 'FINANZAS DEL ESTADO'], ccName: 'IMPUESTOS' },
            { keywords: ['TARJETA'], ccName: 'CAJA CHICA / TARJETAS' },
            { keywords: ['CFE'], ccName: 'LUZ' },
            { keywords: ['DISPERSION'], ccName: 'NOMINA' },
            { keywords: ['RADIO MOVIL DIPSA'], ccName: 'PRORRATEO' },
        ];

        // "TRASPASO A TERCEROS" es un pago normal a un tercero (el banco solo usa
        // esa leyenda genérica en vez del nombre del beneficiario) y NO debe
        // tratarse como traspaso entre cuentas propias. Solo "TRASPASO ENTRE
        // CUENTAS" y variantes sin "TERCEROS" (p. ej. "TRASPASO MONEX") cuentan
        // como traspaso real.
        const isRealTraspaso = (text: string) => text.includes('TRASPASO') && !text.includes('TERCEROS');

        // Coincidencia de palabra clave sobre el texto ya normalizado (mayúsculas, sin acentos).
        // Palabras cortas y riesgosas (<=4 letras: SAT, CFE, IMSS) exigen coincidencia de
        // palabra COMPLETA con \b, para que "SAT" no dispare dentro de "SATURNO".
        // Las más largas usan coincidencia parcial (así "TARJETA" atrapa "TARJETAS" y
        // "DIESEL" atrapa "BIODIESEL").
        const escapeRegExpKw = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const keywordMatches = (kw: string, ...texts: string[]) => {
            if (kw.replace(/\s/g, '').length <= 4) {
                const re = new RegExp(`\\b${escapeRegExpKw(kw)}\\b`);
                return texts.some(t => re.test(t));
            }
            return texts.some(t => t.includes(kw));
        };

        // Use the selected account for ALL movements
        // (user explicitly selects which account they're importing into)
        const movementsWithAccounts = allMovements.map(m => {
            let tipo = m.tipo;
            let monto = parseFloat(m.monto);
            let centro_costo_id = null;
            let conceptoUpper = (m.concepto || '').toUpperCase();

            // Auto-detect Traspasos (excluye "TRASPASO A TERCEROS", que es un Ingreso/Egreso normal)
            const esTraspasoReal = isRealTraspaso(conceptoUpper);
            if (esTraspasoReal) {
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

            // Centro de Costo "TRASPASO": se asigna directo cuando es traspaso real
            // entre cuentas propias. No pasa por las reglas genéricas de abajo porque
            // el nombre "TRASPASO" haría match parcial también en "TRASPASO A TERCEROS".
            if (esTraspasoReal && centrosCosto) {
                const cc = centrosCosto.find(c => removeAccents(c.nombre.toUpperCase()) === 'TRASPASO');
                if (cc) centro_costo_id = cc.id;
            }

            // Auto-detect Centro de Costo
            if (!esTraspasoReal && centrosCosto) {
                // Priority keyword rules (gasolina/combustible, etc.)
                for (const rule of PRIORITY_CC_RULES) {
                    const matches = rule.keywords.some(kw =>
                        keywordMatches(kw, conceptoNormal, refNormal, nombreNormal)
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
            if (!esTraspasoReal && centrosCosto && !centro_costo_id) {
                // We order CCs by length descending to match more specific names first.
                // Excluye el CC "TRASPASO": su nombre haría match parcial en textos como
                // "TRASPASO A TERCEROS", que ya no cuentan como traspaso (ver esTraspasoReal arriba).
                const sortedCCs = [...centrosCosto]
                    .filter(c => removeAccents(c.nombre.toUpperCase()) !== 'TRASPASO')
                    .sort((a, b) => b.nombre.length - a.nombre.length);

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
        const existingMovements: { id: string; fecha: string; tipo: string; monto: number; concepto: string | null }[] = [];
        {
            const PAGE_SIZE = 1000;
            let cursor: string | null = null;
            while (true) {
                const cursorForPage = cursor;
                console.time(`[Preview] existingMovements page cursor=${cursorForPage}`);
                const { data: page, error: pageError } = await withRetry(() => {
                    let pageQuery = supabase
                        .from('movimientos')
                        .select('id, fecha, tipo, monto, concepto')
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

        // fecha+tipo+monto por si solo no basta: no es raro que dos movimientos
        // genuinamente distintos compartan esos tres datos el mismo dia (p. ej.
        // varias recargas de TAG de $1,000 el mismo dia para choferes distintos).
        // Se agrega el concepto (normalizado) a la huella para no marcar esos
        // casos como falsos duplicados.
        const dupKey = (fecha: string, tipo: string, monto: number | string, concepto: string | null | undefined) =>
            `${fecha}|${tipo}|${Number(monto).toFixed(2)}|${(concepto || '').trim().toUpperCase()}`;

        const existingKeys = new Set(
            (existingMovements || []).map(e => dupKey(e.fecha, e.tipo, e.monto, e.concepto))
        );

        const finalMovements = movementsWithAccounts.map(m => ({
            ...m,
            isDuplicate: existingKeys.has(dupKey(m.fecha, m.tipo, m.monto, m.concepto))
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
