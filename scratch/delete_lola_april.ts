import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCOUNT_ID = '92e326e1-77a6-4426-95f6-505f0b36d852';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function deleteApril() {
    console.log('--- DELETING APRIL MOVEMENTS FOR LOLA BBVA PESOS ---');
    const { count, error } = await supabase
        .from('movimientos')
        .delete({ count: 'exact' })
        .eq('cuenta_id', ACCOUNT_ID)
        .gte('fecha', '2026-04-01');
    
    if (error) {
        console.error('Error deleting:', error.message);
    } else {
        console.log(`Successfully deleted ${count} movements from April 2026.`);
    }
}

deleteApril();
