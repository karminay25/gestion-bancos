import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ACCOUNT_ID = '3690f38f-6ea9-46de-b8cc-e183e0542ab5';

async function check() {
    const { data, error } = await supabase
        .from('movimientos')
        .select('*')
        .eq('cuenta_id', ACCOUNT_ID);
    
    if (error) { console.error(error); return; }

    let sum = 0;
    data.forEach(m => {
        const amount = parseFloat(m.monto);
        sum += (m.tipo === 'Ingreso' ? amount : -amount);
    });

    console.log(`Monex Lola DB Sum: ${sum.toFixed(2)} (${data.length} movements)`);
    
    // Check for high value movements
    const high = data.filter(m => parseFloat(m.monto) > 100000);
    if (high.length > 0) {
        console.log('High value movements:');
        console.table(high);
    }
}

check();
