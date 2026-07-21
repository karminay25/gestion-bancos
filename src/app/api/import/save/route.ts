import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { cleanTerceroName } from '@/lib/nameCleaner';

export const dynamic = 'force-dynamic';

// Scoped to the caller's session so RLS (writes restricted to admin role)
// applies here the same way it does for direct client-side inserts.
function getScopedSupabase(req: NextRequest) {
    const authHeader = req.headers.get('authorization') || undefined;
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined
    );
}

export async function POST(req: NextRequest) {
    try {
        const supabase = getScopedSupabase(req);
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
            let saldoo = null;
            
            if (m.saldo_excel != null) {
                // BBVA logic: use the provided balance
                const b = parseFloat(m.saldo_excel);
                factura = `${factura} [BANCO: ${b.toFixed(2)}]`.trim();
                saldoo = b;
            } else if (currentBalance !== null) {
                // Monex logic: calculate running balance
                if (m.tipo === 'Egreso') {
                    currentBalance -= Math.abs(m.monto);
                } else {
                    currentBalance += m.monto; // Ingreso is positive, Traspaso already has its proper sign
                }
                factura = `${factura} [BANCO: ${currentBalance.toFixed(2)}]`.trim();
                saldoo = currentBalance;
            }

            return {
                id: crypto.randomUUID(),
                cuenta_id: cuentaId, 
                fecha: m.fecha,
                // Si el usuario editó manualmente el beneficiario en la vista previa,
                // se respeta tal cual lo escribió (sin pasarlo por el limpiador
                // automático, que podría recortar o alterar el texto). Si no lo tocó,
                // se deriva/limpia automáticamente como antes.
                nombre_tercero: m._descripcionEdited
                    ? ((m.descripcion || '').trim() || 'POR IDENTIFICAR')
                    : cleanTerceroName(m.descripcion || m.concepto),
                concepto: m.concepto,
                monto: m.monto,
                tipo: m.tipo,
                factura: factura || null,
                centro_costo_id: m.centro_costo_id || centroCostoId || null,
                temporada_id: temporadaId || null,
                saldoo: saldoo
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
