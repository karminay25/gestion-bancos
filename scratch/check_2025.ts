import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check2025() {
    const { data } = await supabase
        .from('movimientos')
        .select('*, cuentas_bancarias(descripcion)')
        .gte('fecha', '2025-01-01')
        .lt('fecha', '2026-01-01');
    
    console.log(`Found ${data?.length} movements in 2025.`);
    if (data && data.length > 0) {
        console.table(data.slice(0, 10).map(m => ({
            id: m.id,
            cuenta: (m.cuentas_bancarias as any)?.descripcion,
            fecha: m.fecha,
            nombre: m.nombre_tercero,
            monto: m.monto
        })));
    }
}

check2025();
