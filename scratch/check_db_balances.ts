import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ACCOUNTS = [
  { name: 'BAJIO PESOS', id: 'dbc8cc6e-b89a-4b37-ac42-919bce678ea8' },
  { name: 'BAJIO DOLARES', id: '16806e60-2b77-48c8-98b6-3e40c0505247' },
  { name: 'CREDITO BAJIO', id: '8299de99-89fb-4a93-9b27-b91a0ceeaea6' }
];

async function check() {
    for (const acc of ACCOUNTS) {
        const { data, error } = await supabase
            .from('movimientos')
            .select('monto, tipo, fecha')
            .eq('cuenta_id', acc.id)
            .order('fecha', { ascending: true });
        
        if (error) { console.error(error); continue; }

        let balance = 0;
        data.forEach(m => {
            const amount = parseFloat(m.monto as any);
            balance += (m.tipo === 'Ingreso' ? amount : -amount);
        });

        console.log(`${acc.name}: Count=${data.length}, DB Balance=${balance.toFixed(2)}`);
    }
}

check();
