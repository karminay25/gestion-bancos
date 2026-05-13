import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCOUNT_ID = '92e326e1-77a6-4426-95f6-505f0b36d852';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function verifyOne() {
    const { data } = await supabase
        .from('movimientos')
        .select('nombre_tercero, concepto, factura')
        .eq('cuenta_id', ACCOUNT_ID)
        .eq('monto', 703.5)
        .limit(1);
    
    console.log(data);
}

verifyOne();
