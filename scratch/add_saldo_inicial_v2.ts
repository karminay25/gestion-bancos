import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use Service Role Key
);

async function setup() {
  console.log('--- Updating Database Schema with Service Role ---');
  
  // 1. Add column saldo_inicial to cuentas_bancarias
  const { error: err1 } = await supabase.rpc('execute_sql', { 
    sql: 'ALTER TABLE public.cuentas_bancarias ADD COLUMN IF NOT EXISTS saldo_inicial DECIMAL(14,2) DEFAULT 0;' 
  });
  if (err1) {
    console.error('Error adding column saldo_inicial:', err1);
  } else {
    console.log('Column "saldo_inicial" ensured in "cuentas_bancarias".');
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
  const { data, error: err3 } = await supabase.from('cuentas_bancarias').select('saldo_inicial').limit(1);
  if (err3) {
    console.error('Final check failed:', err3.message);
  } else {
    console.log('SUCCESS: Column "saldo_inicial" is now visible to the API.');
  }
}

setup();
