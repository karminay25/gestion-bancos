import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function updateEmpresas() {
    // 1. Add RFC column if not exists
    // (Actually I can't do ALTER TABLE via standard REST API easily without a custom function)
    // But I can update the rows if the column exists.
    
    const { error: e1 } = await supabase.from('empresas').update({ rfc: 'LBE140327491' }).eq('codigo', 'LOLA');
    const { error: e2 } = await supabase.from('empresas').update({ rfc: 'BBE161029DHA' }).eq('codigo', 'BOSBES');
    const { error: e3 } = await supabase.from('empresas').update({ rfc: 'OBA' }).eq('codigo', 'OBA'); // Need OBA's RFC
    
    console.log('Update results:', { e1, e2, e3 });
}

updateEmpresas();
