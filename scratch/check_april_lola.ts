import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCOUNT_ID = '92e326e1-77a6-4426-95f6-505f0b36d852';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkApril() {
    const { data } = await supabase
        .from('movimientos')
        .select('*')
        .eq('cuenta_id', ACCOUNT_ID)
        .gte('fecha', '2026-04-01')
        .order('fecha', { ascending: true });
    
    console.log(`Found ${data?.length} movements in April for Lola BBVA Pesos.`);
    data?.forEach(d => {
        console.log(`[${d.fecha}] ${d.nombre_tercero} | ${d.tipo} ${d.monto} | Factura: ${d.factura}`);
    });
}

checkApril();
