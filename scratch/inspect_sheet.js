const XLSX = require('xlsx');

const workbook = XLSX.readFile('C:\\proyectoResidencias\\BANCOS 2026.xlsx');
const worksheet = workbook.Sheets['BBVA PESOS'];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Top 30 rows of BBVA PESOS:");
for (let i = 0; i < 30; i++) {
    console.log(`Row ${i}:`, data[i]);
}
