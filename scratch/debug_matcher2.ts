import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
      env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
  }
});

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['SUPABASE_SERVICE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!url || !key) {
    console.error('Missing Supabase URL or Key in .env.local');
    process.exit(1);
}

const supabase = createClient(url, key);

async function runDebug() {
    console.log('--- DEBUG MATCHER ---');
    const { data: facturas } = await supabase.from('facturas').select('*').eq('estado', 'PENDIENTE_VINCULO').limit(3);
    
    if (!facturas || facturas.length === 0) {
        console.log('No pending invoices found');
        return;
    }

    const { data: movimientos } = await supabase.from('movimientos').select('id, monto, fecha, nombre_tercero').limit(5000);
    console.log(`Loaded ${movimientos?.length || 0} movements from DB`);

    for (const fac of facturas) {
        console.log(`\nInvoice: ${fac.emisor_nombre} | $${fac.monto_total} | ${fac.fecha_emision} | ${fac.moneda}`);
        
        let found = false;
        if (movimientos) {
            for (const mov of movimientos) {
                const movMonto = parseFloat(mov.monto);
                if (Math.abs(movMonto - fac.monto_total) <= 0.05) {
                    console.log(`  => MATCH BY AMOUNT: Mov: ${mov.nombre_tercero} | $${mov.monto} | ${mov.fecha}`);
                    found = true;
                }
            }
        }
        if (!found) {
            console.log('  => NO matches found in the entire DB by amount.');
        }
    }
}
runDebug();
