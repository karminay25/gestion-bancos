import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
});
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function checkZeroInvoices() {
    console.log('=== FACTURAS CON MONTO $0 o MONEDA XXX ===\n');

    const { data: zeroFact } = await supabase
        .from('facturas')
        .select('*')
        .or('monto_total.eq.0,moneda.eq.XXX')
        .limit(5);

    console.log(`Muestra de facturas problemáticas:`);
    zeroFact?.forEach(f => {
        console.log(`\n  UUID: ${f.uuid_sat}`);
        console.log(`  Emisor: ${f.emisor_nombre}`);
        console.log(`  Monto: ${f.monto_total} | Moneda: ${f.moneda}`);
        console.log(`  Fecha: ${f.fecha_emision}`);
        console.log(`  Archivo: ${f.archivo_xml}`);
        console.log(`  Estado: ${f.estado}`);
    });

    // Count totals
    const { data: allZero } = await supabase
        .from('facturas')
        .select('moneda, monto_total')
        .or('monto_total.eq.0,moneda.eq.XXX');

    const byMoneda: Record<string, number> = {};
    allZero?.forEach(f => {
        byMoneda[f.moneda] = (byMoneda[f.moneda] || 0) + 1;
    });

    console.log(`\nTotal facturas con $0 o XXX: ${allZero?.length}`);
    console.log('Desglose por moneda:', JSON.stringify(byMoneda, null, 2));

    // Check if any have non-zero monto_total but XXX currency
    const withAmount = allZero?.filter(f => f.monto_total > 0) || [];
    console.log(`\nFacturas con monto > 0 pero moneda XXX: ${withAmount.length}`);
    withAmount.slice(0, 5).forEach(f => {
        console.log(`  $${f.monto_total} ${f.moneda}`);
    });
}

checkZeroInvoices().catch(console.error);
