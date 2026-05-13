import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function addColumn() {
    console.log('Trying to add saldo_excel column to movimientos table...');
    
    // We try to run a simple SQL via RPC if it exists
    const { error } = await supabase.rpc('execute_sql', {
        sql_query: 'ALTER TABLE public.movimientos ADD COLUMN IF NOT EXISTS saldo_excel DECIMAL(14,2);'
    });

    if (error) {
        console.error('RPC Error:', error.message);
        console.log('Falling back to a different method or asking user...');
    } else {
        console.log('Successfully added saldo_excel column!');
    }
}

addColumn();
