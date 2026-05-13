import XLSX from 'xlsx';

const FILE_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(FILE_PATH);

console.log('Sheets in BANCOS 2026:');
console.log(wb.SheetNames);

const monexSheets = wb.SheetNames.filter(s => s.toLowerCase().includes('monex'));
console.log('\nMonex Sheets:', monexSheets);

monexSheets.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n--- ${sheetName} ---`);
    console.log('Total rows:', data.length);
    // Find the last row with data to get the balance
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i] && data[i].length > 0 && data[i].some(v => v !== null && v !== '')) {
            console.log(`Last data row (${i}):`, JSON.stringify(data[i]));
            break;
        }
    }
});
