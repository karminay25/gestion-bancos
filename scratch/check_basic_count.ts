import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkBasic() {
    const { count, error } = await supabase.from('movimientos').select('*', { count: 'exact', head: true });
    if (error) console.error('Error:', error);
    else console.log('Total movements:', count);
}

checkBasic();
