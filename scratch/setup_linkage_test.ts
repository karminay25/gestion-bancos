import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function setupTest() {
    console.log('--- Configurando Prueba de Vinculación ---');

    // 1. Find the target invoice
    const { data: inv, error: invError } = await supabase
        .from('facturas')
        .select('*')
        .ilike('emisor_nombre', '%EDUARDO JIMENEZ%')
        .eq('estado', 'PENDIENTE_VINCULO')
        .limit(1)
        .single();

    if (invError || !inv) {
        console.error('No se encontró la factura de prueba.', invError);
        return;
    }

    console.log(`Factura objetivo encontrada:`);
    console.log(`- Emisor: ${inv.emisor_nombre}`);
    console.log(`- Monto: $${inv.monto_total}`);
    console.log(`- Fecha: ${inv.fecha_emision}`);

    // 2. Get a valid account ID
    const { data: acc } = await supabase.from('cuentas_bancarias').select('id').limit(1).single();
    
    if (!acc) {
        console.log('Error: No hay cuentas bancarias para asociar el movimiento.');
        return;
    }

    // 3. Create mock movement exactly matching the invoice
    const mockMove = {
        cuenta_id: acc.id,
        fecha: inv.fecha_emision,
        tipo: 'Egreso',
        monto: inv.monto_total,
        nombre_tercero: 'EDUARDO JIMENEZ V', // Slightly different name to test fuzzy matching!
        concepto: 'PAGO FACTURA DEMO',
        factura: null
    };

    console.log('\nInsertando movimiento bancario simulado...');
    const { data: move, error: moveError } = await supabase
        .from('movimientos')
        .insert(mockMove)
        .select()
        .single();
    
    if (moveError) {
        console.error('Error al insertar movimiento:', moveError);
        return;
    }

    console.log(`¡Movimiento insertado con éxito! (ID: ${move.id})`);
    console.log(`- Tercero: ${mockMove.nombre_tercero}`);
    console.log(`- Monto: $${mockMove.monto}`);
    
    console.log('\n--- PRUEBA LISTA ---');
    console.log('Ve a tu navegador y haz clic en "Sincronizar Facturas".');
}

setupTest();
