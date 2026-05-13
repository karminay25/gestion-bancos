import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ACCOUNT_ID = '3690f38f-6ea9-46de-b8cc-e183e0542ab5';

async function check() {
    const { data } = await supabase.from('movimientos').select('monto, tipo').eq('cuenta_id', ACCOUNT_ID);
    let sum = 0;
    data?.forEach(m => sum += (m.tipo === 'Ingreso' ? parseFloat(m.monto) : -parseFloat(m.monto)));
    console.log(`FINAL_SUM: ${sum.toFixed(2)}`);
}

check();
