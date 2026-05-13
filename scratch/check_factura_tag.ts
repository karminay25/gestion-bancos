import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkNoDisp() {
    const { data } = await supabase
        .from('movimientos')
        .select('id, factura, saldo_excel')
        .eq('cuenta_id', 'cccb5951-8232-4ab7-b9cf-47b918677999')
        .limit(20);
    
    console.log('Sample Factura fields:');
    data?.forEach(d => {
        console.log(`ID: ${d.id} | Factura: "${d.factura}" | SaldoExcel: ${d.saldo_excel}`);
    });
}

checkNoDisp();
