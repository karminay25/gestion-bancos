import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function deepSearch() {
    console.log('Searching for amount 2936.44 in ALL movements...');
    const { data, error } = await supabase
        .from('movimientos')
        .select('*')
        .eq('monto', 2936.44);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log(`Found ${data.length} matches:`);
        data.forEach(m => {
            console.log(`- [${m.fecha}] ${m.nombre_tercero}: $${m.monto} (Concepto: ${m.concepto})`);
        });
    } else {
        console.log('No movements found with amount 2936.44 in the entire database.');
    }
}

deepSearch();
