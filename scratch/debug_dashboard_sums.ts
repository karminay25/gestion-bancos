import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ACCOUNTS = [
  { name: 'LOLA BBVA PESOS', id: '92e326e1-77a6-4426-95f6-505f0b36d852' },
  { name: 'BOSBES BBVA PESOS', id: 'cccb5951-8232-4ab7-b9cf-47b918677999' }
];

async function check() {
    for (const acc of ACCOUNTS) {
        const { data, error, count } = await supabase
            .from('movimientos')
            .select('*', { count: 'exact' })
            .eq('cuenta_id', acc.id);
        
        if (error) { console.error(error); continue; }

        let sum = 0;
        data.forEach(m => {
            const amount = parseFloat(m.monto);
            sum += (m.tipo === 'Ingreso' ? amount : -amount);
        });

        console.log(`${acc.name}: Count=${count}, Sum=${sum.toFixed(2)}`);
        
        // Check if "SALDO INICIAL" movement exists
        const start = data.find(m => m.nombre_tercero === 'SALDO INICIAL');
        console.log(`   Start Movement:`, start ? `${start.monto} on ${start.fecha}` : 'NOT FOUND');
    }
}

check();
