import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ACCOUNT_ID = '92e326e1-77a6-4426-95f6-505f0b36d852';

async function check() {
    const { data } = await supabase
        .from('movimientos')
        .select('*')
        .eq('cuenta_id', ACCOUNT_ID)
        .order('fecha', { ascending: true })
        .order('created_at', { ascending: true });
    
    if (!data || data.length === 0) { console.log('No movements.'); return; }

    let balance = 0;
    data.forEach(m => balance += (m.tipo === 'Ingreso' ? parseFloat(m.monto) : -parseFloat(m.monto)));
    
    const last = data[data.length - 1];
    console.log(`Last movement in DB: ${last.fecha} - ${last.nombre_tercero}`);
    console.log(`Current Balance: $${balance.toFixed(2)}`);
}

check();
