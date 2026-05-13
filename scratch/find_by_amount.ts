import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function findByAmount() {
    const { data, error } = await supabase
        .from('movimientos')
        .select('*')
        .eq('monto', 4649.8);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data?.length} movements with amount 4649.8:`);
    data?.forEach(m => {
        console.log(`- [${m.fecha}] ${m.nombre_tercero}: $${m.monto} (Concepto: ${m.concepto})`);
    });
}

findByAmount();
