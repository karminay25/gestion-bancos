import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function findNegatives() {
  console.log('Searching for negative amounts or suspicious balances...');
  const { data, error } = await supabase
    .from('movimientos')
    .select('id, fecha, monto, tipo, nombre_tercero, concepto')
    .or('monto.lt.0');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data?.length || 0} records with negative monto.`);
  if (data && data.length > 0) {
    console.table(data.slice(0, 20));
  }

  // Also check some records with tipo 'Egreso' to see if they are negative
  const { data: egresos, error: err2 } = await supabase
    .from('movimientos')
    .select('id, monto, tipo')
    .eq('tipo', 'Egreso')
    .limit(10);
  
  console.log('\nSample Egresos:');
  console.table(egresos);
}

findNegatives();
