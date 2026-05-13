import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function fix2028() {
    const { data: m } = await supabase
        .from('movimientos')
        .select('id')
        .gte('fecha', '2028-01-01')
        .limit(1);
    
    if (m && m.length > 0) {
        console.log(`Fixing movement ${m[0].id}...`);
        const { error } = await supabase
            .from('movimientos')
            .update({ fecha: '2026-03-23' })
            .eq('id', m[0].id);
        
        if (error) console.error(error);
        else console.log('Successfully fixed date to 2026-03-23.');
    } else {
        console.log('No movement found in 2028.');
    }
}

fix2028();
