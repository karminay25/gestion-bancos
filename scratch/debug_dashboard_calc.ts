import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function debugDashboard() {
    // BOSBES USD MONEX
    const accountId = '62d2bb5c-5f31-4f33-835d-6939e92f8485';
    
    const { data: movements } = await supabase
        .from('movimientos')
        .select('fecha, factura, created_at, id')
        .eq('cuenta_id', accountId)
        .order('fecha', { ascending: true })
        .order('id', { ascending: true });

    console.log(`Total movements for account ${accountId}: ${movements?.length}`);
    if (movements && movements.length > 0) {
        console.log('First 3:');
        console.table(movements.slice(0, 3));
        console.log('Last 3:');
        console.table(movements.slice(-3));
    }
}

debugDashboard();
