import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function inspectColumns() {
    const { data, error } = await supabase.from('movimientos').select('*').limit(1);
    if (error) { console.error(error); return; }
    console.log('Columnas:', Object.keys(data[0]));
    console.log('Muestra:', data[0]);
}

inspectColumns().catch(console.error);
