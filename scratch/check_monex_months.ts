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
        .select('fecha')
        .eq('cuenta_id', ACCOUNT_ID);
    
    if (error) { console.error(error); return; }

    const months: Record<string, number> = {};
    data.forEach(m => {
        const month = m.fecha.slice(0, 7);
        months[month] = (months[month] || 0) + 1;
    });

    console.log('Movements per month in DB:', months);
}

check();
