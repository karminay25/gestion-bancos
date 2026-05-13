import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function listAll() {
    const { data } = await supabase.from('cuentas_bancarias').select('*, empresas(nombre_completo)');
    console.table(data.map(d => ({
        id: d.id,
        empresa: d.empresas.nombre_completo,
        banco: d.banco,
        moneda: d.moneda,
        desc: d.descripcion
    })));
}

listAll();
