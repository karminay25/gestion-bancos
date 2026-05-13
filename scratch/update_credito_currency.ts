import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function updateCurrency() {
    const { error } = await supabase
        .from('cuentas_bancarias')
        .update({ moneda: 'USD' })
        .eq('id', '8299de99-89fb-4a93-9b27-b91a0ceeaea6');

    if (error) console.error('Error updating currency:', error);
    else console.log('CREDITO BAJIO updated to USD successfully.');
}

updateCurrency();
