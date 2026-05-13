import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function debugData() {
  console.log('Querying Supabase...');
  const { data, count, error } = await supabase
    .from('movimientos')
    .select('fecha, monto, tipo', { count: 'exact' })
    .order('fecha', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total Records:', count);
  if (data && data.length > 0) {
    console.log('First record date:', data[0].fecha);
    console.log('Last record date:', data[data.length - 1].fecha);
    
    const jan2026 = data.filter(m => m.fecha.startsWith('2026-01'));
    console.log('Records in Jan 2026:', jan2026.length);
  }
}

debugData();
