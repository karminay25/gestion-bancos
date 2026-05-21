import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function cleanupMock() {
    console.log('--- Limpiando Prueba ---');

    // 1. Find the mock movement
    const { data: move, error: moveError } = await supabase
        .from('movimientos')
        .select('id')
        .eq('concepto', 'PAGO FACTURA DEMO')
        .single();

    if (moveError || !move) {
        console.log('No se encontró el movimiento falso.');
    } else {
        // 2. Unlink the invoice
        console.log('Restaurando estado de la factura...');
        await supabase
            .from('facturas')
            .update({ estado: 'PENDIENTE_VINCULO', movimiento_id: null })
            .eq('movimiento_id', move.id);

        // 3. Delete the movement
        console.log('Eliminando movimiento falso...');
        await supabase
            .from('movimientos')
            .delete()
            .eq('id', move.id);
            
        console.log('✅ Limpieza completada. Tus cuentas están exactas como antes.');
    }
}

cleanupMock();
