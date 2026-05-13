import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ACCOUNT_ID = '92e326e1-77a6-4426-95f6-505f0b36d852';

async function cleanup() {
    console.log('--- CLEANING UP EXPERIMENTAL IMPORTS ---');
    // Delete all movements I added via scripts (IDs starting with bb1 or the adjustment IDs)
    await supabase.from('movimientos').delete().eq('cuenta_id', ACCOUNT_ID).like('id', '00000000-0000-0000-bb1%');
    await supabase.from('movimientos').delete().eq('cuenta_id', ACCOUNT_ID).eq('nombre_tercero', 'AJUSTE ESTADO DE CUENTA');
    await supabase.from('movimientos').delete().eq('cuenta_id', ACCOUNT_ID).eq('nombre_tercero', 'AJUSTE APERTURA ESTADO CUENTA');
    
    // Also fix the 2025/2026 confusion - move Saldo Inicial back if needed? 
    // No, user said "excel es de enero 2026 en adelante", so 2026-01-01 is better. I'll leave it as 2026-01-01.

    console.log('Cleanup done.');
}

cleanup();
