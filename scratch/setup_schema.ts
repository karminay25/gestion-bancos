import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function setup() {
  console.log('--- Updating Database Schema ---');
  
  // 1. Add column
  const { error: err1 } = await supabase.rpc('execute_sql', { 
    sql: 'ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS orden_excel INTEGER;' 
  });
  if (err1) {
    console.error('Error adding column:', err1);
  } else {
    console.log('Column "orden_excel" ensured.');
  }

  // 2. Reload schema
  const { error: err2 } = await supabase.rpc('execute_sql', { 
    sql: "NOTIFY pgrst, 'reload schema';" 
  });
  if (err2) {
    console.error('Error reloading schema:', err2);
  } else {
    console.log('Schema reload notified.');
  }

  // 3. Verify column presence
  const { data, error: err3 } = await supabase.from('movimientos').select('orden_excel').limit(1);
  if (err3) {
    console.error('Final check failed:', err3.message);
  } else {
    console.log('SUCCESS: Column is now visible to the API.');
  }
}

setup();
