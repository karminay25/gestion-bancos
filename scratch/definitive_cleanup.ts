import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function cleanUp() {
    console.log('Cleaning EVERYTHING...');
    // Delete all movements
    const { count: mCount } = await supabase.from('movimientos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log(`Deleted all movements.`);

    // Find duplicate accounts
    const { data: accounts } = await supabase.from('cuentas_bancarias').select('*');
    if (!accounts) return;

    const seen = new Set();
    for (const acc of accounts) {
        const key = `${acc.banco}-${acc.moneda}-${acc.descripcion}`;
        if (seen.has(key)) {
            console.log(`Deleting duplicate account: ${acc.banco} ${acc.moneda} ${acc.descripcion} (${acc.id})`);
            await supabase.from('cuentas_bancarias').delete().eq('id', acc.id);
        } else {
            seen.add(key);
        }
    }
    console.log('Cleanup done.');
}

cleanUp();
