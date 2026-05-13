import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';

function inspectBBVA() {
    try {
        const wb = XLSX.readFile(EXCEL_PATH);
        const sheet = wb.Sheets['BBVA PESOS'];
        if (!sheet) {
            console.log('Sheet BBVA PESOS not found');
            return;
        }
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log('Mapping for BBVA PESOS: [0,3,4,2,7,8,9,5]');
        console.log('Cols: 0:Fecha, 3:Ing, 4:Egr, 2:Tercero, 7:Fact, 8:Conc, 9:CC, 5:Saldo');
        
        // Header
        console.table(data.slice(0, 20).map((row, i) => {
            return {
                index: i,
                Fecha: row[0],
                Tercero: row[2],
                Ingreso: row[3],
                Egreso: row[4],
                Saldo: row[5],
                Factura: row[7],
                Concepto: row[8]
            };
        }));
    } catch (e) {
        console.error('Error:', e);
    }
}

inspectBBVA();
