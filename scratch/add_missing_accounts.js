import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('--- Registering Missing Accounts ---');
  
  // 1. LOLA - CREDITO BAJIO (ID 3)
  const { data: d1, error: e1 } = await supabase
    .from('cuentas_bancarias')
    .insert([{
      empresa_id: 3,
      banco: 'BAJIO',
      moneda: 'MXN',
      descripcion: 'CREDITO BAJIO'
    }])
    .select();
  
  if (e1) console.error('Error Lola:', e1);
  else console.log('Added Lola:', d1);

  // 2. BOSBES - BBVA PESOS (ID 4)
  const { data: d2, error: e2 } = await supabase
    .from('cuentas_bancarias')
    .insert([{
      empresa_id: 4,
      banco: 'BBVA',
      moneda: 'MXN',
      descripcion: 'BBVA PESOS'
    }])
    .select();

  if (e2) console.error('Error Bosbes:', e2);
  else console.log('Added Bosbes:', d2);
  
  console.log('--- Process Finished ---');
}

run();
