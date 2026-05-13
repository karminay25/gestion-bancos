import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function findPerez() {
    const { data, error } = await supabase
        .from('movimientos')
        .select('*')
        .eq('monto', 151.33);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data?.length} movements with 151.33:`);
    data?.forEach(m => {
        console.log(`- [${m.fecha}] ${m.nombre_tercero}: $${m.monto}`);
    });
}

findPerez();
