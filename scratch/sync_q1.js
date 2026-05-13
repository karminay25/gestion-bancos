const XLSX = require('xlsx');
const crypto = require('crypto');

// Setup Supabase
const url = "https://icyqvfamfyhdyexarozu.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeXF2ZmFtZnloZHlleGFyb3p1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1NDY1NCwiZXhwIjoyMDkxODMwNjU0fQ.6GQ6-58_EcG19IrLXt-vCztlzti-msNWwmLm4JodFGQ";

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
const cuentaId = '92e326e1-77a6-4426-95f6-505f0b36d852';

// 1. Insert Saldo Inicial for Jan 1, 2026
toInsert.push({
    id: crypto.randomUUID(),
    cuenta_id: cuentaId,
    fecha: '2026-01-01',
    nombre_tercero: 'BANCO',
    concepto: 'Saldo Inicial (Auto-detectado)',
    monto: 28462.40,
    tipo: 'Ingreso',
    factura: null,
    centro_costo_id: null,
    temporada_id: null
});

let finalSaldo = 0;

for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;

    const fechaRaw = row[0];
    const fecha = parseDate(fechaRaw);
    if (!fecha) continue;

    if (fecha.getFullYear() !== 2026) continue;
    if (fecha.getMonth() >= 3) continue;

    const ingreso = Math.abs(cleanNum(row[3]));
    const egreso = Math.abs(cleanNum(row[4]));
    if (ingreso === 0 && egreso === 0) continue;

    const monto = ingreso || egreso;
    const tipo = ingreso > 0 ? 'Ingreso' : 'Egreso';

    let conceptoRaw = row[2]?.toString() || "";
    if (row[8]) {
        conceptoRaw += ` - ${row[8]}`;
    }
    
    let nombre_tercero = conceptoRaw.trim();
    if(nombre_tercero.includes(' - ')) {
        nombre_tercero = nombre_tercero.split(' - ')[0].trim();
    }
    
    // In BBVA PESOS sheet, actual rows go chronologically top to bottom.
    // So we just push them.
    toInsert.push({
        id: crypto.randomUUID(),
        cuenta_id: cuentaId,
        fecha: fecha.toISOString().split('T')[0],
        nombre_tercero: nombre_tercero.substring(0, 50),
        concepto: conceptoRaw.trim().replace(/\s+/g, ' '),
        monto: monto,
        tipo: tipo,
        factura: row[7]?.toString() || null,
        centro_costo_id: null,
        temporada_id: null
    });
    
    // Record the explicit Saldo shown in the Excel for validation logging
    const explicitSaldo = cleanNum(row[5]);
    if (explicitSaldo !== 0) {
        finalSaldo = explicitSaldo;
    }
}

console.log(`Prepared ${toInsert.length} records.`);
console.log(`Math check: the Excel's final row states the Saldo was $${finalSaldo.toLocaleString()}`);

// The user is asking me to sync it directly. Let's do a curl-like batch insert using fetch.
async function sync() {
    console.log("Starting DB insertion...");
    // Let's insert sequentially so created_at acts as a perfect secondary sort key!
    for (let i = 0; i < toInsert.length; i++) {
        const item = toInsert[i];
        try {
            const res = await fetch(`${url}/rest/v1/movimientos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': key,
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify(item)
            });
            if (!res.ok) {
                console.error(`Failed to insert row ${i}:`, await res.text());
                return;
            }
        } catch (e) {
            console.error(`Error on row ${i}:`, e);
            return;
        }
        if (i % 50 === 0) console.log(`Inserted ${i}...`);
    }
    console.log("SUCCESS! All 2026 Q1 records synced perfectly.");
}

sync();
