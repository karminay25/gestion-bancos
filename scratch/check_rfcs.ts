import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkRFCs() {
    const { data, error } = await supabase
        .from('facturas')
        .select('receptor_rfc');
    
    if (error) {
        console.error('Error:', error);
        return;
    }

    const unique = Array.from(new Set(data.map(d => d.receptor_rfc)));
    console.log('RFCs found in invoices:');
    unique.forEach(u => console.log(u));
}

checkRFCs();
