import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function cleanupMonex() {
    // 1. Find Monex accounts
    const { data: accounts } = await supabase
        .from('cuentas_bancarias')
        .select('id, descripcion, banco')
        .or('descripcion.ilike.%monex%,banco.ilike.%monex%');

    if (!accounts || accounts.length === 0) {
        console.log('No Monex accounts found.');
        return;
    }

    console.log('Found Monex accounts:', accounts.map(a => `${a.descripcion} (${a.id})`));

    for (const acc of accounts) {
        // 2. Find movements in these accounts
        // We look for the ones that have specific amounts or were recently imported
        const { data: movs } = await supabase
            .from('movimientos')
            .select('id, concepto, monto, fecha')
            .eq('cuenta_id', acc.id);

        if (!movs || movs.length === 0) continue;

        console.log(`Checking ${movs.length} movements for account ${acc.descripcion}`);
        
        // Let's delete movements that match the Monex patterns (like $413640 or $5.8 or specific concepts)
        // Or simply delete all if they are from the recent import session.
        // To be safe, I will delete those that are in the screenshot: $413640, $5.8, $116622.92
        const toDelete = movs.filter(m => 
            m.monto === 413640 || 
            m.monto === 5.8 || 
            m.monto === 116622.92 ||
            m.concepto.toLowerCase().includes('monex') ||
            m.concepto.toLowerCase().includes('venta de divisas')
        );

        if (toDelete.length > 0) {
            console.log(`Deleting ${toDelete.length} movements from ${acc.descripcion}`);
            const { error } = await supabase
                .from('movimientos')
                .delete()
                .in('id', toDelete.map(m => m.id));
            
            if (error) console.error('Error deleting:', error);
            else console.log('Deleted successfully.');
        }
    }
}

cleanupMonex();
