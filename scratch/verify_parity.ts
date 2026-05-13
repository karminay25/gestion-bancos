import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { calculateAccountBalance, sortMovements } from '../src/lib/balances';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function verifyParity() {
    console.log('--- VALIDACIÓN DE PARIDAD MATEMÁTICA ---');
    
    const { data: accounts } = await supabase.from('cuentas_bancarias').select('*, empresas(codigo)');
    if (!accounts) return;

    for (const acc of accounts) {
        let allMovs: any[] = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        while (hasMore) {
            const { data } = await supabase
                .from('movimientos')
                .select('*')
                .eq('cuenta_id', acc.id)
                .order('fecha', { ascending: true })
                .range(from, to);
            
            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                allMovs = [...allMovs, ...data];
                if (data.length < 1000) hasMore = false;
                else {
                    from += 1000;
                    to += 1000;
                }
            }
        }

        if (allMovs.length === 0) {
            console.log(`[${acc.empresas.codigo}] ${acc.banco} ${acc.moneda}: Sin movimientos.`);
            continue;
        }

        const sorted = sortMovements(allMovs);
        const calculatedBalance = calculateAccountBalance(sorted);
        
        // Find latest excel/bank balance
        let lastCertified: any = null;
        let certifiedVal = 0;
        
        for (let i = sorted.length - 1; i >= 0; i--) {
            const m = sorted[i];
            let val = m.saldo_excel;
            if (!val && m.factura?.includes('[BANCO:')) {
                const match = m.factura.match(/\[BANCO:\s*([0-9,.-]+)\]/);
                if (match) val = match[1].replace(/,/g, '');
            }

            if (val !== null && val !== undefined && val !== '') {
                lastCertified = m;
                certifiedVal = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : parseFloat(String(val));
                if (!isNaN(certifiedVal)) break;
            }
        }

        console.log(`[${acc.empresas.codigo}] ${acc.banco} ${acc.descripcion || acc.moneda}`);
        console.log(`   - Movimientos: ${allMovs.length}`);
        console.log(`   - Saldo Calculado: $${calculatedBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
        
        if (lastCertified) {
            const isLast = sorted.indexOf(lastCertified) === sorted.length - 1;
            if (isLast) {
                const diff = Math.abs(calculatedBalance - certifiedVal);
                if (diff < 0.01) {
                    console.log(`   - ✅ COINCIDE con Banco: $${certifiedVal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
                } else {
                    console.log(`   - ❌ DISCREPANCIA: Banco=$${certifiedVal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} | Dif=$${diff.toFixed(2)}`);
                }
            } else {
                console.log(`   - ℹ️ Último saldo certificado: $${certifiedVal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} (en movimiento ${lastCertified.fecha})`);
                console.log(`   - ℹ️ Saldo final proyectado: $${calculatedBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
            }
        } else {
            console.log(`   - ⚠️ Sin registros de saldo certificado para contrastar.`);
        }
    }
}

verifyParity().catch(console.error);
