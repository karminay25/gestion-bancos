import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkCurrency() {
    const { data } = await supabase.from('cuentas_bancarias').select('moneda').eq('id', '8299de99-89fb-4a93-9b27-b91a0ceeaea6').single();
    console.log('Currency for CREDITO BAJIO:', data?.moneda);
}

checkCurrency();
