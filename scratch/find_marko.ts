import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function findMarko() {
    const { data, error } = await supabase
        .from('movimientos')
        .select('*')
        .ilike('nombre_tercero', '%marko%')
        .gte('fecha', '2026-04-01')
        .lte('fecha', '2026-04-30');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data?.length} Marko movements in April:`);
    data?.forEach(m => {
        console.log(`- [${m.fecha}] ${m.nombre_tercero}: $${m.monto}`);
    });
}

findMarko();
