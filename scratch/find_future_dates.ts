import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets['BAJIO USD'];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

data.forEach((row, i) => {
    [0, 10].forEach(colIdx => {
        const val = row[colIdx];
        if (typeof val === 'number') {
            const d = new Date((val - 25569) * 86400000);
            if (d.getFullYear() >= 2026 && d.getMonth() >= 11) {
                console.log(`FUTURE DATE FOUND: Row ${i} Col ${colIdx}: ${d.toISOString()} (Excel: ${val})`);
                console.log('Row:', row);
            }
        }
    });
});
