import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
});
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function diagnose() {
    console.log('=== DIAGNÓSTICO COMPLETO DEL SISTEMA ===\n');

    // 1. Estado de facturas
    const { data: allFacturas, count: totalFact } = await supabase
        .from('facturas')
        .select('*', { count: 'exact' });

    console.log(`Total facturas en DB: ${allFacturas?.length || 0}`);

    const byEstado: Record<string, number> = {};
    allFacturas?.forEach(f => {
        byEstado[f.estado] = (byEstado[f.estado] || 0) + 1;
    });
    console.log('Por estado:', JSON.stringify(byEstado, null, 2));

    // 2. Facturas más recientes
    const { data: recentFact } = await supabase
        .from('facturas')
        .select('fecha_emision, emisor_nombre, monto_total, moneda, estado')
        .order('fecha_emision', { ascending: false })
        .limit(10);
    
    console.log('\n=== 10 FACTURAS MÁS RECIENTES ===');
    recentFact?.forEach(f => {
        console.log(`  ${f.fecha_emision} | ${f.estado} | $${f.monto_total} ${f.moneda} | ${f.emisor_nombre}`);
    });

    // 3. Facturas de 2026
    const { data: facturas2026 } = await supabase
        .from('facturas')
        .select('fecha_emision, emisor_nombre, monto_total, moneda, estado')
        .gte('fecha_emision', '2026-01-01')
        .order('fecha_emision', { ascending: true });
    
    console.log(`\n=== FACTURAS DE 2026: ${facturas2026?.length || 0} ===`);
    facturas2026?.forEach(f => {
        console.log(`  ${f.fecha_emision} | ${f.estado} | $${f.monto_total} ${f.moneda} | ${f.emisor_nombre}`);
    });

    // 4. Facturas pendientes de vínculo
    const pendientes = allFacturas?.filter(f => f.estado === 'PENDIENTE_VINCULO') || [];
    console.log(`\n=== FACTURAS PENDIENTE_VINCULO: ${pendientes.length} ===`);

    // 5. Movimientos sin factura
    const { data: movSinFactura, count: movCount } = await supabase
        .from('movimientos')
        .select('*', { count: 'exact' })
        .is('factura', null)
        .gte('fecha', '2026-01-01');
    
    console.log(`\nMovimientos de 2026 sin factura vinculada: ${movSinFactura?.length || 0}`);

    // 6. Para las primeras 5 facturas pendientes, buscar movimientos candidatos
    if (pendientes.length > 0) {
        console.log('\n=== BÚSQUEDA DE CANDIDATOS (primeras 5 facturas pendientes) ===');
        for (const fac of pendientes.slice(0, 5)) {
            const minDate = addDays(fac.fecha_emision, -30);
            const maxDate = addDays(fac.fecha_emision, 30);

            const { data: movs } = await supabase
                .from('movimientos')
                .select('fecha, monto, nombre_tercero, concepto, cuentas_bancarias(moneda)')
                .gte('fecha', minDate)
                .lte('fecha', maxDate)
                .is('factura', null);

            const candidates = movs?.filter(m => {
                const cleanMonto = m.monto?.toString().replace(/,/g, '') || '0';
                const numMonto = parseFloat(cleanMonto);
                return Math.abs(numMonto - fac.monto_total) <= 0.05;
            }) || [];

            console.log(`\nFactura: ${fac.fecha_emision} | $${fac.monto_total} ${fac.moneda} | ${fac.emisor_nombre}`);
            console.log(`  Ventana fecha: ${minDate} -> ${maxDate}`);
            console.log(`  Movimientos en ventana: ${movs?.length || 0}`);
            console.log(`  Candidatos por monto: ${candidates.length}`);
            if (candidates.length > 0) {
                candidates.slice(0, 3).forEach(c => {
                    console.log(`    -> ${c.fecha} | $${c.monto} | ${c.nombre_tercero || c.concepto}`);
                });
            } else if (movs && movs.length > 0) {
                console.log(`  Montos disponibles en ventana:`);
                movs.slice(0, 5).forEach(m => {
                    const cleanMonto = m.monto?.toString().replace(/,/g, '') || '0';
                    console.log(`    -> $${cleanMonto} (raw: ${m.monto}) | ${m.nombre_tercero || m.concepto}`);
                });
            }
        }
    }

    console.log('\n=== FIN DIAGNÓSTICO ===');
}

function addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

diagnose().catch(console.error);
