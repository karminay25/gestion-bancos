import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ACCOUNT_ID = '92e326e1-77a6-4426-95f6-505f0b36d852';

async function check() {
    const { data } = await supabase
        .from('movimientos')
        .select('id, fecha, nombre_tercero, monto')
        .eq('cuenta_id', ACCOUNT_ID)
        .gte('fecha', '2026-04-01')
        .order('fecha', { ascending: true });
    
    console.table(data);
}

check();
