import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkCC() {
    const { data } = await supabase
        .from('centros_costo')
        .select('id, nombre');
    
    console.log('--- SYSTEM COST CENTERS ---');
    console.log(data);
}

checkCC();
