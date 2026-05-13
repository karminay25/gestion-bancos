import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkSchema() {
    const { data } = await supabase
        .from('movimientos')
        .select('*')
        .limit(1);
    
    if (data && data[0]) {
        console.log('Columns in movimientos:', Object.keys(data[0]));
    }
}

checkSchema();
