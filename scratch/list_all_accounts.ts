import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function listAllAccounts() {
    const { data: accounts } = await supabase.from('cuentas_bancarias').select('*, empresas(id, nombre_completo)');
    console.table(accounts?.map(a => ({ 
        id: a.id, 
        banco: a.banco, 
        descripcion: a.descripcion, 
        empresa: (a as any).empresas?.nombre_completo || 'N/A' 
    })));
}

listAllAccounts();
