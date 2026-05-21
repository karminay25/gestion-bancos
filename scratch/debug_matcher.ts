import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_KEY']);

async function debugMatcher() {
    console.log('Fetching pending invoices...');
    const { data: facturas } = await supabase.from('facturas').select('*').eq('estado', 'PENDIENTE_VINCULO').limit(5);
    
    if (!facturas || facturas.length === 0) {
        console.log('No pending invoices found.');
        return;
    }

    for (const factura of facturas) {
        console.log(`\nInvoice: ${factura.emisor_nombre} - $${factura.monto_total} (${factura.fecha_emision})`);
        
        // Let's just fetch all movements and find it manually in memory to see what's wrong with the DB query
        const { data: allMovs } = await supabase.from('movimientos').select('id, monto, fecha, nombre_tercero, concepto').limit(10000);
        
        let possibleMatches = [];
        for (const mov of allMovs) {
            const numMonto = parseFloat(mov.monto);
            if (Math.abs(numMonto - factura.monto_total) < 0.05) {
                possibleMatches.push(mov);
            }
        }
        
        console.log(`Found ${possibleMatches.length} possible matches in memory by amount:`);
        possibleMatches.forEach(m => {
            console.log(`  - Movement: ${m.nombre_tercero} | $${m.monto} | ${m.fecha}`);
        });

        // Test the original DB query
        const { data: dbMovs, error } = await supabase
            .from('movimientos')
            .select('id, monto, fecha, nombre_tercero, concepto')
            .gte('monto', factura.monto_total - 0.05)
            .lte('monto', factura.monto_total + 0.05);

        if (error) console.error('DB Query Error:', error);
        else console.log(`DB Query returned ${dbMovs.length} matches.`);
    }
}

debugMatcher();
