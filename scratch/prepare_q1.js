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
    return null; 
};

const cleanNum = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = val.toString().replace(/[^\d.-]/g, '');
    return parseFloat(str) || 0;
};

const toInsert = [];

for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;

    const fechaRaw = row[0];
    const fecha = parseDate(fechaRaw);

    if (!fecha) continue;

    // We only want Q1 2026
    if (fecha.getFullYear() !== 2026) continue;
    if (fecha.getMonth() >= 3) continue; // April is 3

    const ingreso = Math.abs(cleanNum(row[3]));
    const egreso = Math.abs(cleanNum(row[4]));
    
    if (ingreso === 0 && egreso === 0) continue;

    const monto = ingreso || egreso;
    const tipo = ingreso > 0 ? 'Ingreso' : 'Egreso';

    let conceptoRaw = row[2]?.toString() || "";
    if (row[8]) {
        conceptoRaw += ` - ${row[8]}`;
    }
    
    const parts = conceptoRaw.split(' - ');
    const nombre_tercero = parts.length > 1 ? parts[0].trim() : conceptoRaw.trim();

    toInsert.push({
        cuenta_id: '92e326e1-77a6-4426-95f6-505f0b36d852', // BBVA PESOS
        fecha: fecha.toISOString().split('T')[0],
        nombre_tercero: nombre_tercero.substring(0, 50),
        concepto: conceptoRaw.trim().replace(/\s+/g, ' '),
        monto: monto,
        tipo: tipo,
        factura: row[7]?.toString() || null,
        centro_costo_id: null,
        temporada_id: null
    });
}

console.log("Total records to insert:", toInsert.length);
if (toInsert.length > 0) {
    console.log("First record:", toInsert[0]);
    console.log("Last record:", toInsert[toInsert.length - 1]);
}
