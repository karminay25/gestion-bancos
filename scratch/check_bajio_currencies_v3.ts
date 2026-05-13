import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
    const { data, error } = await supabase.from('cuentas_bancarias').select('id, nombre, moneda, banco');
    if (error) {
        console.error('SUPABASE ERROR:', error);
    } else {
        console.log('DATA:', JSON.stringify(data, null, 2));
    }
}

check();
