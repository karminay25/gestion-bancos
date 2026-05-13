import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCOUNT_ID = '62d2bb5c-5f31-4f33-835d-6939e92f8485';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check2026() {
    const { data } = await supabase
        .from('movimientos')
        .select('*')
        .eq('cuenta_id', ACCOUNT_ID)
        .gte('fecha', '2026-01-01')
        .order('fecha', { ascending: true });
    
    console.log(`Found ${data?.length} movements in 2026 for Bosbes Monex USD.`);
    data?.slice(0, 5).forEach(d => {
        console.log(`[${d.fecha}] ${d.nombre_tercero} | ${d.monto} | Factura: ${d.factura}`);
    });
}

check2026();
