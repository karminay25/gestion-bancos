import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function getTemporadasSchema() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`
    }
  });
  
  if (!res.ok) {
    console.error('Error fetching openapi:', await res.text());
  } else {
    const spec = await res.json();
    const table = spec.definitions?.temporadas;
    console.log(JSON.stringify(table, null, 2));
  }
}
getTemporadasSchema();
