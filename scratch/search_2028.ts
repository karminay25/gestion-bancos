import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function search2028() {
    const { data, error } = await supabase
        .from('movimientos')
        .select('*, cuentas_bancarias(descripcion)')
        .gte('fecha', '2028-01-01');
    
    if (error) { console.error(error); return; }

    console.log(`Found ${data.length} movements in 2028:`);
    console.table(data.map(m => ({
        id: m.id,
        cuenta: (m.cuentas_bancarias as any)?.descripcion,
        fecha: m.fecha,
        nombre: m.nombre_tercero,
        monto: m.monto
    })));
}

search2028();
