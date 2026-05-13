import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkAnon() {
    console.log('Checking with Anon Key...');
    const { data, error } = await supabase.from('movimientos').select('id').limit(1);
    if (error) console.error('Anon Error:', error);
    else console.log('Anon Success, found:', data?.length);
}

checkAnon();
