import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkAccount() {
    const { data } = await supabase
        .from('cuentas_bancarias')
        .select('*, empresas(*)')
        .eq('moneda', 'USD')
        .ilike('banco', '%BBVA%');
    
    console.table(data);
}

checkAccount();
