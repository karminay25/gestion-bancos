import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function dumpStart(id: string, name: string) {
    console.log(`\n--- Movements for ${name} (${id}) ---`);
    const { data, error } = await supabase
        .from('movimientos')
        .select('*')
        .eq('cuenta_id', id)
        .order('fecha', { ascending: true })
        .limit(50);
    
    if (error) { console.error(error); return; }
    if (!data) return;

    let balance = 0;
    data.forEach(m => {
        const amt = parseFloat(m.monto);
        balance += (m.tipo === 'Ingreso' ? amt : -amt);
        console.log(`${m.fecha} | ${m.tipo.padEnd(7)} | ${amt.toFixed(2).padStart(10)} | Bal: ${balance.toFixed(2).padStart(10)} | ${m.nombre_tercero} | ${m.concepto}`);
    });
}

async function run() {
    await dumpStart('8299de99-89fb-4a93-9b27-b91a0ceeaea6', 'CREDITO BAJIO');
    await dumpStart('16806e60-2b77-48c8-98b6-3e40c0505247', 'BAJIO USD');
}

run();
