import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function findFuture() {
    const { data } = await supabase
        .from('movimientos')
        .select('*, cuentas_bancarias(descripcion)')
        .gte('fecha', '2026-07-01');
    
    const rows = data ?? [];
    console.table(rows.map(d => ({
        fecha: d.fecha,
        cuenta: d.cuentas_bancarias.descripcion,
        monto: d.monto,
        nombre: d.nombre_tercero
    })));
}

findFuture();
