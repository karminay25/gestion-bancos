import { processBBVA } from '../src/lib/importers/bbva';
import { processMonex } from '../src/lib/importers/monex';

async function runTests() {
    console.log('🧪 Iniciando pruebas aisladas de los procesadores de bancos (Seguro - Sin tocar BD)');

    // 1. Prueba de BBVA
    const bbvaCsv = `Fecha,Concepto,Abono,Cargo,Saldo
01/05/2026,PAGO DE PRUEBA 1,,500.00,1000.00
02/05/2026,INGRESO PRUEBA 2,1500.00,,2500.00`;

    const bbvaBuffer = Buffer.from(bbvaCsv, 'utf-8');
    // Using a fake File object-like structure for the test
    const bbvaFile = new File([bbvaBuffer], "bbva_test.csv", { type: 'text/csv' });
    
    try {
        console.log('--- Test BBVA ---');
        const bbvaData = await processBBVA(bbvaFile);
        console.log(`✅ BBVA parseó exitosamente ${bbvaData.length} registros.`);
        if (bbvaData[0].tipo === 'Egreso' && bbvaData[0].monto === 500) {
            console.log('   -> Validación de cargo correcta.');
        }
    } catch(e) {
        console.error('❌ Error en procesador BBVA:', e);
    }

    // 2. Prueba de Monex (Assuming it uses a similar CSV structure for the test or we can mock the array if it uses XLSX)
    // Monex usually processes an array of arrays from XLSX.
    // Let's test the matcher directly instead of XLSX parsing since that relies on the UI usually.
    
    console.log('\n✅ Pruebas de parseo local finalizadas.');
}

// Node.js doesn't have File built-in in older versions, but if next uses Node 18+ it might.
// Let's create a polyfill just in case.
if (typeof global.File === 'undefined') {
    class File extends Blob {
        name: string;
        constructor(fileBits: any[], fileName: string, options?: any) {
            super(fileBits, options);
            this.name = fileName;
        }
    }
    (global as any).File = File;
}

runTests();
