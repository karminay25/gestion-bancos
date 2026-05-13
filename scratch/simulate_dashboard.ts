import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function simulateDashboard() {
    const { data: companies } = await supabase.from('empresas').select('*');
    const { data: accounts } = await supabase.from('cuentas_bancarias').select('*');
    const { data: allMovements } = await supabase.from('movimientos').select('monto, tipo, cuenta_id, fecha, factura');

    if (!companies || !accounts || !allMovements) return;

    const summary = companies.map(company => {
        const companyAccounts = accounts.filter(a => a.empresa_id === company.id);
        const banks = ['BBVA', 'MONEX', 'BAJIO'];
        let rows: any[] = [];

        banks.forEach(bank => {
            const bankAccounts = companyAccounts.filter(a => {
                const matchesBank = a.banco.toUpperCase().includes(bank) || (a.descripcion && a.descripcion.toUpperCase().includes(bank));
                if (bank === 'BAJIO') {
                    return matchesBank && !a.descripcion?.toUpperCase().includes('CREDITO');
                }
                return matchesBank;
            });

            if (bankAccounts.length > 0) {
                const mxn = bankAccounts.filter(a => a.moneda === 'MXN').length;
                const usd = bankAccounts.filter(a => a.moneda === 'USD').length;
                rows.push({ bank, mxn_count: mxn, usd_count: usd });
            }
        });

        const creditoAccounts = companyAccounts.filter(a => a.descripcion?.toUpperCase().includes('CREDITO BAJIO'));
        if (creditoAccounts.length > 0) {
            rows.push({ bank: 'BAJIO CREDITO', mxn_count: 0, usd_count: creditoAccounts.length });
        }

        return { company: company.nombre_completo, rows };
    });

    console.log(JSON.stringify(summary, null, 2));
}

simulateDashboard();
