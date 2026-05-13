const XLSX = require('xlsx');

const workbook = XLSX.readFile('C:\\proyectoResidencias\\BANCOS 2026.xlsx');
const worksheet = workbook.Sheets['BBVA PESOS'];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const parseDate = (val) => {
    if (!val) return null;
    if (typeof val === 'number') {
        const date = XLSX.SSF.parse_date_code(val);
        if(date) return new Date(date.y, date.m - 1, date.d);
        return null;
    }
    return null; // For safety, only process numeric excel dates
};

let validRecords = 0;
let highestDateBeforeApril = null;

for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;

    const fechaRaw = row[0];
    const fecha = parseDate(fechaRaw);

    if (!fecha) {
        // console.log(`Row ${i} skipped: Invalid date ${fechaRaw}`);
        continue;
    }

    // Skip April and beyond
    if (fecha.getFullYear() >= 2026 && fecha.getMonth() >= 3) {
        // Month 3 is April (0-indexed)
        continue;
    }

    const ingreso = row[3];
    const egreso = row[4];
    
    if (!ingreso && !egreso) continue;

    validRecords++;
    if (!highestDateBeforeApril || fecha > highestDateBeforeApril) {
        highestDateBeforeApril = fecha;
    }
}

console.log("Total valid records BEFORE April 2026:", validRecords);
console.log("Highest date found:", highestDateBeforeApril);
