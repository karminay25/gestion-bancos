import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function finalCheck() {
    const accIds = [
        '62d2bb5c-5f31-4f33-835d-6939e92f8485', // BOSBES USD MONEX
        '3690f38f-6ea9-46de-b8cc-e183e0542ab5'  // MONEX USD
    ];

    const { data } = await supabase
        .from('movimientos')
        .select('fecha, concepto, monto, tipo, factura')
        .in('cuenta_id', accIds)
        .order('fecha', { ascending: false })
        .limit(10);

    console.log('Most recent Monex movements in DB:');
    console.table(data);
}

finalCheck();
