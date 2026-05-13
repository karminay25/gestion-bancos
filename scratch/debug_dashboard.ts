import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function debugDashboard() {
    console.log('Fetching data for dashboard debug...');
    const [
        { data: companies },
        { data: accounts },
        { data: movements }
    ] = await Promise.all([
        supabase.from('empresas').select('*'),
        supabase.from('cuentas_bancarias').select('*'),
        supabase.from('movimientos').select('*, cuentas_bancarias(*, empresas(*))')
    ]);

    if (!companies || !accounts || !movements) {
        console.error('Failed to fetch data');
        return;
    }

    console.log(`Companies: ${companies.length}, Accounts: ${accounts.length}, Movements: ${movements.length}`);

    // Calculate Global Stats
    let mxnTotal = 0;
    let usdTotal = 0;

    movements.forEach(m => {
        const amount = parseFloat(m.monto);
        const isIngreso = m.tipo === 'Ingreso';
        const currency = m.cuentas_bancarias?.moneda;

        if (currency === 'MXN') {
            mxnTotal += isIngreso ? amount : -amount;
        } else if (currency === 'USD') {
            usdTotal += isIngreso ? amount : -amount;
        }
    });

    console.log(`Global Stats -> MXN: ${mxnTotal}, USD: ${usdTotal}`);

    // Company breakdown
    companies.forEach(company => {
        const companyAccounts = accounts.filter(a => a.empresa_id === company.id);
        console.log(`\nCompany: ${company.nombre_completo} (${company.codigo})`);

        let companyMXN = 0;
        let companyUSD = 0;

        companyAccounts.forEach(acc => {
            const accMoves = movements.filter(m => m.cuenta_id === acc.id);
            const balance = accMoves.reduce((sum, m) => {
                const amount = parseFloat(m.monto);
                return sum + (m.tipo === 'Ingreso' ? amount : -amount);
            }, 0);
            
            console.log(`  Account: ${acc.banco} ${acc.moneda} (${acc.descripcion}) | Balance: ${balance}`);
            
            if (acc.moneda === 'MXN') companyMXN += balance;
            else companyUSD += balance;
        });

        console.log(`  Total Company -> MXN: ${companyMXN}, USD: ${companyUSD}`);
    });

    // Check for movements with ORPHAN accounts or companies
    const orphans = movements.filter(m => !m.cuentas_bancarias);
    if (orphans.length > 0) {
        console.log(`\nFound ${orphans.length} movements with NO account link!`);
        console.table(orphans.slice(0, 5));
    }
}

debugDashboard();
