import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkCount() {
    const { count } = await supabase
        .from('movimientos')
        .select('*', { count: 'exact', head: true });
    
    console.log('Total movements in DB:', count);
}

checkCount();
