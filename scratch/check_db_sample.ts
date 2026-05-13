import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCOUNT_ID = 'cccb5951-8232-4ab7-b9cf-47b918677999';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkSample() {
    const { data } = await supabase
        .from('movimientos')
        .select('*')
        .eq('cuenta_id', ACCOUNT_ID)
        .limit(5);
    
    console.log('Sample DB rows for BOSBES PESOS BBVA:');
    console.log(data);
}

checkSample();
