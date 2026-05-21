import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testLinkage() {
    // 1. Get an unlinked invoice
    const { data: inv } = await supabase
        .from('facturas')
        .select('*')
        .eq('estado', 'PENDIENTE_VINCULO')
        .limit(1)
        .single();

    if (!inv) {
        console.log('No unlinked invoices found.');
        return;
    }

    console.log(`Testing with Invoice: ${inv.emisor_nombre} - $${inv.monto_total} (${inv.fecha_emision})`);

    // 2. Create a mock movement
    // First, get a valid account ID
    const { data: acc } = await supabase.from('cuentas_bancarias').select('id').limit(1).single();
    
    if (!acc) {
        console.log('No bank accounts found.');
        return;
    }

    const mockMove = {
        cuenta_id: acc.id,
        fecha: inv.fecha_emision,
        tipo: 'Egreso',
        monto: inv.monto_total,
        nombre_tercero: inv.emisor_nombre,
        concepto: 'PAGO FACTURA TEST',
        factura: null
    };

    console.log('Creating mock movement...');
    const { data: move, error } = await supabase.from('movimientos').insert(mockMove).select().single();
    
    if (error) {
        console.error('Error creating movement:', error);
        return;
    }

    console.log('Movement created! ID:', move.id);

    // 3. Trigger Sync
    console.log('Triggering match engine...');
    const { matchInvoicesWithMovements } = await import('../src/lib/invoiceMatcher');
    const result = await matchInvoicesWithMovements();
    console.log('Sync result:', result);

    // 4. Verify Link
    const { data: updatedInv } = await supabase.from('facturas').select('estado, movimiento_id').eq('id', inv.id).single();
    const { data: updatedMove } = await supabase.from('movimientos').select('factura').eq('id', move.id).single();

    console.log('Verification:');
    console.log(`- Invoice Status: ${updatedInv.estado} (Expected: VINCULADA)`);
    console.log(`- Linked Move ID: ${updatedInv.movimiento_id}`);
    console.log(`- Movement Label: ${updatedMove.factura}`);

    if (updatedInv.estado === 'VINCULADA') {
        console.log('✅ TEST PASSED: Automatic linkage successful!');
    } else {
        console.log('❌ TEST FAILED: Not linked.');
    }
}

testLinkage();
