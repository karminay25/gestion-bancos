import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkEverything() {
  const { data: accounts } = await supabase.from('cuentas_bancarias').select('*');
  if (!accounts) return;

  for (const acc of accounts) {
    // Correctly fetch all movements using pagination if necessary, or just sum them
    let allMovs: any[] = [];
    let from = 0;
    let to = 999;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('movimientos')
            .select('monto, tipo')
            .eq('cuenta_id', acc.id)
            .order('id', { ascending: true }) // Added stable sort
            .range(from, to);
        
        if (error || !data || data.length === 0) {
            hasMore = false;
        } else {
            allMovs = allMovs.concat(data);
            from += 1000;
            to += 1000;
        }
    }

    let balance = 0;
    allMovs.forEach(m => {
        const amt = parseFloat(m.monto);
        balance += (m.tipo === 'Ingreso' ? amt : -amt);
    });
    console.log(`Account: ${acc.banco} ${acc.moneda} (${acc.descripcion}) | ${allMovs.length} movements | Total Balance: ${balance.toFixed(2)}`);
  }
}

checkEverything();
