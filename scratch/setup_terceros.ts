import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  // 1. Create terceros table via RPC if available, otherwise check if it exists
  const { data: existing, error: checkError } = await supabase
    .from('terceros')
    .select('id')
    .limit(1);

  if (checkError && checkError.message.includes('does not exist')) {
    console.log('Table terceros does not exist. Please run supabase_terceros.sql in Supabase dashboard.');
    console.log('\nSQL to run:\n');
    console.log(`
CREATE TABLE IF NOT EXISTS terceros (
  id SERIAL PRIMARY KEY,
  nombre_raw TEXT NOT NULL,
  nombre_canonico TEXT NOT NULL,
  centro_costo_id INTEGER REFERENCES centros_costo(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_terceros_nombre_raw ON terceros (nombre_raw);
    `);
    return;
  }
  
  console.log('Table terceros exists. Checking current data...');
  const { data: terceros, count } = await supabase.from('terceros').select('*', { count: 'exact' });
  console.log(`Current terceros count: ${count}`);

  // 2. Get unique nombres from movimientos that are not yet in terceros
  const { data: movs } = await supabase
    .from('movimientos')
    .select('nombre_tercero')
    .not('nombre_tercero', 'is', null)
    .neq('nombre_tercero', '');

  if (!movs) { console.log('No movements found'); return; }
  
  const uniqueNames = [...new Set(movs.map(m => m.nombre_tercero))];
  const existingRaw = new Set((terceros || []).map((t: any) => t.nombre_raw));
  const toInsert = uniqueNames.filter(n => !existingRaw.has(n));
  
  console.log(`Unique terceros in movements: ${uniqueNames.length}`);
  console.log(`Already in terceros table: ${existingRaw.size}`);
  console.log(`To insert: ${toInsert.length}`);

  if (toInsert.length > 0) {
    const rows = toInsert.map(n => ({ nombre_raw: n, nombre_canonico: n }));
    const { error: insError } = await supabase.from('terceros').insert(rows);
    if (insError) console.error('Insert error:', insError.message);
    else console.log(`✅ Inserted ${toInsert.length} terceros from movement history.`);
  } else {
    console.log('✅ No new terceros to insert.');
  }
}

main().catch(console.error);
