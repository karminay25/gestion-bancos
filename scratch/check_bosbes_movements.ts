import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ACCOUNT_ID = 'cccb5951-8232-4ab7-b9cf-47b918677999'; // BOSBES BBVA PESOS

async function check() {
    const { data, error } = await supabase
        .from('movimientos')
        .select('*')
        .eq('cuenta_id', ACCOUNT_ID)
        .order('fecha', { ascending: false })
        .limit(20);
    
    if (error) { console.error(error); return; }

    console.log('Last 20 movements for Bosbes BBVA Pesos:');
    data.forEach(m => {
        console.log(`${m.fecha} - ${m.nombre_tercero}: ${m.tipo === 'Ingreso' ? '+' : '-'}${m.monto}`);
    });

    const { data: all } = await supabase.from('movimientos').select('monto, tipo').eq('cuenta_id', ACCOUNT_ID);
    let sum = 0;
    all?.forEach(m => sum += (m.tipo === 'Ingreso' ? parseFloat(m.monto) : -parseFloat(m.monto)));
    console.log('Total Sum in DB:', sum);
}

check();
