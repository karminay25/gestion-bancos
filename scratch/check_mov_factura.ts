import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
});
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function checkMovements() {
    console.log('=== DIAGNÓSTICO DE MOVIMIENTOS 2026 ===\n');

    // Total de movimientos de 2026
    const { data: allMovs } = await supabase
        .from('movimientos')
        .select('fecha, monto, factura, nombre_tercero')
        .gte('fecha', '2026-01-01')
        .order('fecha', { ascending: false })
        .limit(200);

    console.log(`Total movimientos de 2026 (muestra): ${allMovs?.length}`);

    // Clasificar por estado del campo 'factura'
    const conNull = allMovs?.filter(m => m.factura === null) || [];
    const conVacio = allMovs?.filter(m => m.factura === '') || [];
    const conTexto = allMovs?.filter(m => m.factura !== null && m.factura !== '') || [];
    
    console.log(`  - factura IS NULL: ${conNull.length}`);
    console.log(`  - factura = '' (string vacío): ${conVacio.length}`);
    console.log(`  - factura tiene texto: ${conTexto.length}`);

    // Contar con IS NULL en base de datos
    const { data: nullMovs, error: nullErr } = await supabase
        .from('movimientos')
        .select('id, fecha, monto, factura, nombre_tercero', { count: 'exact' })
        .is('factura', null)
        .gte('fecha', '2026-01-01');
    
    console.log(`\nConsulta DB .is('factura', null) en 2026: ${nullMovs?.length || 0}`);
    if (nullErr) console.log('Error:', nullErr.message);

    // Muestra de los primeros 10 movimientos de 2026
    console.log('\n=== MUESTRA DE MOVIMIENTOS DE 2026 (últimos 10) ===');
    allMovs?.slice(0, 10).forEach(m => {
        console.log(`  ${m.fecha} | $${m.monto} | factura="${m.factura}" | ${m.nombre_tercero}`);
    });

    // Buscar movimientos de abril 2026 en específico
    const { data: aprilMovs } = await supabase
        .from('movimientos')
        .select('fecha, monto, factura, nombre_tercero')
        .gte('fecha', '2026-04-01')
        .lte('fecha', '2026-04-30');
    
    console.log(`\nMovimientos de Abril 2026: ${aprilMovs?.length || 0}`);
    if (aprilMovs && aprilMovs.length > 0) {
        console.log('Muestra:');
        aprilMovs.slice(0, 5).forEach(m => {
            const facturaVal = m.factura === null ? 'NULL' : `"${m.factura}"`;
            console.log(`  ${m.fecha} | $${m.monto} | factura=${facturaVal} | ${m.nombre_tercero}`);
        });
    }

    // Intentar con .or para capturar null o vacío
    const { data: unlinked } = await supabase
        .from('movimientos')
        .select('fecha, monto, factura, nombre_tercero')
        .gte('fecha', '2026-01-01')
        .or('factura.is.null,factura.eq.');
    
    console.log(`\nMovimientos de 2026 sin vincular (null OR vacío): ${unlinked?.length || 0}`);
}

checkMovements().catch(console.error);
