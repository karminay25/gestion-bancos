import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { parseBBVA } from '@/lib/importers/bbva';
import { parseMonex } from '@/lib/importers/monex';
import { parseBajio } from '@/lib/importers/bajio';

export async function POST(req: NextRequest) {
    try {
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
        const { data: centrosCosto } = await supabase.from('centros_costo').select('id, nombre');

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

            // Auto-detect Centro de Costo
            if (centrosCosto) {
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

        // DEDUPLICATION LOGIC PER ACCOUNT (Multi-stage fallback)
        const finalMovements = await Promise.all(movementsWithAccounts.map(async (m) => {
            // Stage 1: Try exact match including balance fingerprint
            let query = supabase
                .from('movimientos')
                .select('id')
                .eq('cuenta_id', m.targetAccountId)
                .eq('fecha', m.fecha)
                .eq('tipo', m.tipo)
                .eq('monto', m.monto);

            if (m.saldo_excel != null) {
                const balanceTag = `[BANCO: ${parseFloat(m.saldo_excel).toFixed(2)}]`;
                query.ilike('factura', `%${balanceTag}%`);
            } else {
                query.ilike('concepto', `%${m.concepto.substring(0, 15)}%`);
            }

            let { data: existing } = await query.limit(1);

            // Stage 2: AGGRESSIVE FALLBACK
            // If Stage 1 (Balance/Concept) failed, try matching ONLY by Date + Amount
            // This is necessary because old records might have very different concepts (e.g. "TRASPASO" vs "Detailed Bank Desc")
            if (!existing || existing.length === 0) {
                const { data: globalMatch } = await supabase
                    .from('movimientos')
                    .select('id')
                    .eq('cuenta_id', m.targetAccountId)
                    .eq('fecha', m.fecha)
                    .eq('tipo', m.tipo)
                    .eq('monto', m.monto)
                    .limit(1);
                existing = globalMatch;
            }

            return {
                ...m,
                isDuplicate: (existing && existing.length > 0)
            };
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
