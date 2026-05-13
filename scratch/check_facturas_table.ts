import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkTables() {
    const { data, error } = await supabase.rpc('get_tables'); // This might not work if the RPC doesn't exist
    
    // Alternative: check if a 'facturas' table exists by trying to select from it
    const { error: fError } = await supabase.from('facturas').select('id').limit(1);
    
    if (fError) {
        console.log('Facturas table does not exist or is inaccessible:', fError.message);
    } else {
        console.log('Facturas table exists.');
    }
}

checkTables();
