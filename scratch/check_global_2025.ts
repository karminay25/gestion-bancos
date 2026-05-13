import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkGlobal2025() {
    const { count } = await supabase
        .from('movimientos')
        .select('*', { count: 'exact', head: true })
        .lt('fecha', '2026-01-01');
    
    console.log(`Found ${count} movements total before 2026 in the entire system.`);
}

checkGlobal2025();
