import { createClient } from '@supabase/supabase-js';

const url = 'https://tvuydtdkddmmsvmlivst.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || 'REPLACE_ME'; // I will use the anonymous key from the repo since it works for reading

// To avoid reading from env, let's just write the connection code reading the actual file using plain fs without regex.
import fs from 'fs';
const envData = fs.readFileSync('.env.local', 'utf8').split('\n');
let pUrl = '';
let pKey = '';
for (const line of envData) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) pUrl = line.split('=')[1].trim().replace(/['"]/g, '');
    if (line.startsWith('SUPABASE_SERVICE_KEY=')) pKey = line.split('=')[1].trim().replace(/['"]/g, '');
}

const supabase = createClient(pUrl, pKey);

async function testMatch() {
    const { data: facturas } = await supabase.from('facturas').select('*').eq('estado', 'PENDIENTE_VINCULO').limit(10);
    
    for (const factura of facturas) {
        console.log(`\nInv: ${factura.fecha_emision} | $${factura.monto_total} | ${factura.emisor_nombre}`);
        
        const date = new Date(factura.fecha_emision);
        const minDate = new Date(date); minDate.setDate(minDate.getDate() - 30);
        const maxDate = new Date(date); maxDate.setDate(maxDate.getDate() + 30);

        const { data: movements } = await supabase
            .from('movimientos')
            .select('*')
            .gte('fecha', minDate.toISOString().split('T')[0])
            .lte('fecha', maxDate.toISOString().split('T')[0])
            .is('factura', null);

        if (!movements || movements.length === 0) {
            console.log(`  -> NO movements found in the 60-day window.`);
            continue;
        }

        let exactAmounts = 0;
        for (const mov of movements) {
            const num = parseFloat(mov.monto);
            if (Math.abs(num - factura.monto_total) <= 0.05) {
                exactAmounts++;
                console.log(`  -> Exact Amount Match found: $${mov.monto} on ${mov.fecha} (${mov.nombre_tercero})`);
            }
        }
        if (exactAmounts === 0) console.log(`  -> ${movements.length} movements in window, but NONE match amount $${factura.monto_total}`);
    }
}
testMatch();
