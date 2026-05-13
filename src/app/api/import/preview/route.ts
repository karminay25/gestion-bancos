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
        
        let result = { detectedCompany: null as any, movements: [] as any[] };

        // Auto-detect bank format
        if (fileName.includes('RSM')) {
            result = parseBBVA(buffer);
        } else if (fileName.includes('MOVIMIENTOSCONTRATO')) {
            result = parseMonex(buffer);
        } else if (fileName.includes('BAJIO')) {
            result = parseBajio(buffer);
        } else {
            // Fallback trial
            try {
                result = parseBBVA(buffer);
                if (result.movements.length === 0) throw new Error();
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

        // Use the selected account for ALL movements
        // (user explicitly selects which account they're importing into)
        const movementsWithAccounts = allMovements.map(m => ({
            ...m,
            targetAccountId: cuentaId
        }));

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

        // Reverse to get Oldest First (BBVA comes newest-first; Monex already oldest-first)
        const isMonex = file.name.toUpperCase().includes('MOVIMIENTOSCONTRATO');
        const sortedMovements = isMonex ? finalMovements : finalMovements.reverse();

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
