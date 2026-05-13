import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function findPerezAnywhere() {
    const { data, error } = await supabase
        .from('movimientos')
        .select('*')
        .or('nombre_tercero.ilike.%perez%,concepto.ilike.%perez%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data?.length} movements with "perez":`);
    data?.forEach(m => {
        console.log(`- [${m.fecha}] ${m.nombre_tercero}: $${m.monto} (Concepto: ${m.concepto})`);
    });
}

findPerezAnywhere();
