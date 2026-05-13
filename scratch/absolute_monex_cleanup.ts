import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function absoluteCleanup() {
    // Monex accounts
    const accIds = [
        '62d2bb5c-5f31-4f33-835d-6939e92f8485', // BOSBES USD MONEX
        '3690f38f-6ea9-46de-b8cc-e183e0542ab5'  // MONEX USD
    ];

    console.log('Deleting all movements from Monex accounts to start fresh...');
    
    const { error, count } = await supabase
        .from('movimientos')
        .delete({ count: 'exact' })
        .in('cuenta_id', accIds);

    if (error) console.error('Error:', error);
    else console.log(`Deleted ${count} movements.`);
}

absoluteCleanup();
