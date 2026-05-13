const XLSX = require('xlsx');

const workbook = XLSX.readFile('C:\\proyectoResidencias\\BANCOS 2026.xlsx');
const worksheet = workbook.Sheets['BBVA PESOS'];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

let totalIngresosOriginal = 0;
let totalEgresosOriginal = 0;

for (let i = 0; i < 500; i++) {
    const row = data[i];
    if (row && row.join(' ').toLowerCase().includes('total')) {
        console.log(`Found summary text at row ${i}:`, row);
    }
}
