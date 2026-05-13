import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    try {
        const { movements, cuentaId, temporadaId, centroCostoId, suggestedBalance } = await req.json();

        if (!movements || !Array.isArray(movements) || !cuentaId) {
            return NextResponse.json({ error: 'Datos de importación inválidos' }, { status: 400 });
        }

        // Movements are already in chronological order from the preview
        const chronologicalMovements = movements;

        // Calculate running balance for banks that don't provide it (like Monex)
        let currentBalance: number | null = null;
        const needsCalculation = chronologicalMovements.some(m => m.saldo_excel == null);

        if (needsCalculation) {
            const { data: lastMov } = await supabase
                .from('movimientos')
                .select('factura')
                .eq('cuenta_id', cuentaId)
                .order('fecha', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (lastMov && lastMov.length > 0 && lastMov[0].factura) {
                const match = lastMov[0].factura.match(/\[BANCO: ([\-0-9\.]+)\]/);
                if (match) {
                    currentBalance = parseFloat(match[1]);
                }
            }
        }

        const toInsert = chronologicalMovements.map((m: any) => {
            let factura = m.factura || '';
            
            if (m.saldo_excel != null) {
                // BBVA logic: use the provided balance
                const b = parseFloat(m.saldo_excel);
                factura = `${factura} [BANCO: ${b.toFixed(2)}]`.trim();
            } else if (currentBalance !== null) {
                // Monex logic: calculate running balance
                if (m.tipo === 'Ingreso') {
                    currentBalance += m.monto;
                } else {
                    currentBalance -= m.monto;
                }
                factura = `${factura} [BANCO: ${currentBalance.toFixed(2)}]`.trim();
            }

            return {
                id: crypto.randomUUID(),
                cuenta_id: cuentaId, 
                fecha: m.fecha,
                nombre_tercero: (m.descripcion || m.concepto).substring(0, 100),
                concepto: m.concepto,
                monto: m.monto,
                tipo: m.tipo,
                factura: factura || null,
                centro_costo_id: centroCostoId || null,
                temporada_id: temporadaId || null
            };
        });

        // Insertar uno por uno secuencialmente para garantizar el orden de created_at
        for (const move of toInsert) {
            const { error } = await supabase.from('movimientos').insert(move);
            if (error) throw error;
        }

        return NextResponse.json({ success: true, count: toInsert.length });

    } catch (error: any) {
        console.error('Import Save Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
