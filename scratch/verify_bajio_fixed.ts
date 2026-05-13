import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCOUNT_ID = '16806e60-2b77-48c8-98b6-3e40c0505247'; // BAJIO USD

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function verifyBajio() {
    console.log('--- VERIFYING BAJIO USD INTEGRITY ---');
    const { data } = await supabase
        .from('movimientos')
        .select('*')
        .eq('cuenta_id', ACCOUNT_ID)
        .eq('fecha', '2025-03-05')
        .limit(5);
    
    console.log(data);
}

verifyBajio();
