import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkEmpresas() {
    const { data, error } = await supabase.from('empresas').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Empresas sample:', data?.[0]);
}

checkEmpresas();
