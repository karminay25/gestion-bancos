import XLSX from 'xlsx';

const EXCEL_PATH = 'c:/proyectoResidencias/BANCOS 2026.xlsx';
const wb = XLSX.readFile(EXCEL_PATH);

wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    let minDate = 99999;
    let maxDate = 0;
    data.forEach(row => {
        const d = row[0];
        if (typeof d === 'number') {
            if (d < minDate) minDate = d;
            if (d > maxDate) maxDate = d;
        }
    });
    if (minDate !== 99999) {
        console.log(`Sheet [${sheetName}] Date Range:`, 
            new Date((minDate - 25569) * 86400000).toISOString().split('T')[0],
            'to',
            new Date((maxDate - 25569) * 86400000).toISOString().split('T')[0]
        );
    }
});
