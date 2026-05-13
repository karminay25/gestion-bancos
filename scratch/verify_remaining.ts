import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function verify() {
    const { data: movs } = await supabase
        .from('movimientos')
        .select('fecha, concepto, monto, tipo, cuentas_bancarias(descripcion)')
        .order('fecha', { ascending: false })
        .limit(20);

    console.table(movs?.map(m => ({
        fecha: m.fecha,
        cuenta: (m.cuentas_bancarias as any)?.descripcion,
        monto: m.monto,
        tipo: m.tipo,
        concepto: m.concepto.substring(0, 50)
    })));
}

verify();
