import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function findMovements() {
    const { data, error } = await supabase
        .from('movimientos')
        .select('*')
        .or('nombre_tercero.ilike.%starlink%,monto.eq.1305')
        .order('fecha', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data?.length} movements:`);
    data?.forEach(m => {
        console.log(`- [${m.fecha}] ${m.nombre_tercero}: $${m.monto} (Factura: ${m.factura})`);
    });
}

findMovements();
