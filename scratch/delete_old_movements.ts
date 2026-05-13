import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function deleteOld() {
    console.log('--- DELETING ALL MOVEMENTS BEFORE 2026 ---');
    const { count, error } = await supabase
        .from('movimientos')
        .delete({ count: 'exact' })
        .lt('fecha', '2026-01-01');
    
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Deleted ${count} old movements.`);
    }
}

deleteOld();
