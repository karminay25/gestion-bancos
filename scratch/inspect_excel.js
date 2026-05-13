const XLSX = require('xlsx');

const workbook = XLSX.readFile('C:\\proyectoResidencias\\BANCOS 2026.xlsx');
console.log("Sheet Names:", workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log("Total rows:", data.length);
    if (data.length > 0) {
        console.log("Sample top row:", data[0]);
    }
}
