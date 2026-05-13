import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We need to run raw SQL — use Supabase's SQL endpoint via service role
async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const sql = `
CREATE TABLE IF NOT EXISTS terceros (
  id SERIAL PRIMARY KEY,
  nombre_raw TEXT NOT NULL,
  nombre_canonico TEXT NOT NULL,
  centro_costo_id UUID REFERENCES centros_costo(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_terceros_nombre_raw ON terceros (nombre_raw);
  `;

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);

  if (!res.ok) {
    console.log('\n⚠️  Cannot run raw SQL via REST API without a custom RPC function.');
    console.log('\nPlease run this SQL manually in your Supabase dashboard > SQL Editor:\n');
    console.log(sql);
    console.log('\nThen re-run: npx tsx scratch\\setup_terceros.ts');
  }
}

main().catch(console.error);
