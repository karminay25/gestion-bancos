import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ACCOUNT_ID = '92e326e1-77a6-4426-95f6-505f0b36d852'; // LOLA BBVA PESOS

async function check() {
    const { data } = await supabase.from('movimientos').select('monto, tipo').eq('cuenta_id', ACCOUNT_ID);
    let balance = 0;
    data?.forEach(m => balance += (m.tipo === 'Ingreso' ? parseFloat(m.monto) : -parseFloat(m.monto)));
    console.log(`Final Balance for LOLA BBVA PESOS: $${balance.toFixed(2)}`);
}

check();
