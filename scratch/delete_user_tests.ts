import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function deleteUserTests() {
    console.log('--- Eliminando pruebas manuales ---');

    const { data: moves, error } = await supabase
        .from('movimientos')
        .select('id, concepto')
        .ilike('concepto', '%PRUEBA VINCULO%');

    if (error) {
        console.error('Error buscando:', error);
        return;
    }

    if (moves && moves.length > 0) {
        console.log(`Encontrados ${moves.length} movimientos de prueba. Eliminando...`);
        for (const m of moves) {
            // Unlink invoice first if linked
            await supabase.from('facturas').update({ estado: 'PENDIENTE_VINCULO', movimiento_id: null }).eq('movimiento_id', m.id);
            // Delete
            await supabase.from('movimientos').delete().eq('id', m.id);
            console.log(`- Eliminado: ${m.concepto}`);
        }
        console.log('✅ Listo. Limpieza completada.');
    } else {
        console.log('No se encontraron movimientos con concepto PRUEBA VINCULO.');
    }
}

deleteUserTests();
