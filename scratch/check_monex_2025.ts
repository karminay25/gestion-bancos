import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCOUNT_ID = '62d2bb5c-5f31-4f33-835d-6939e92f8485';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check2025() {
    const { count } = await supabase
        .from('movimientos')
        .select('*', { count: 'exact', head: true })
        .eq('cuenta_id', ACCOUNT_ID)
        .lt('fecha', '2026-01-01');
    
    console.log(`Found ${count} movements before 2026 for Bosbes Monex USD.`);
}

check2025();
