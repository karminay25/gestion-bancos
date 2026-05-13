import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkFacturas() {
    const { data, count, error } = await supabase
        .from('facturas')
        .select('*', { count: 'exact' })
        .gte('fecha_emision', '2026-04-01')
        .lte('fecha_emision', '2026-04-30')
        .order('fecha_emision', { ascending: false });

    if (error) {
        console.error('Error fetching facturas:', error);
        return;
    }

    console.log(`Total facturas in DB: ${count}`);
    if (data && data.length > 0) {
        console.log('Last 5 facturas:');
        data.forEach(f => {
            console.log(`- [${f.fecha_emision}] ${f.emisor_nombre}: $${f.monto_total} (${f.uuid_sat?.slice(0,8)}...)`);
        });
    } else {
        console.log('No facturas found in DB.');
    }
}

checkFacturas();
