import { parseBajio } from '../src/lib/importers/bajio';
import fs from 'fs';

const FILE_PATH = 'c:/proyectoResidencias/MOV CUENTAS BAJIO LOLA DE FEB A MARZO 26 (1).xlsx';
const buffer = fs.readFileSync(FILE_PATH);

try {
    const result = parseBajio(buffer);
    console.log(`Parsed ${result.movements.length} movements.`);
    console.log('\n--- FIRST 5 ---');
    result.movements.slice(0, 5).forEach(m => {
        console.log(`[${m.fecha}] ${m.tipo} | $${m.monto} | Nombre: "${m.descripcion}" | Concepto: "${m.concepto.substring(0, 40)}..."`);
    });

    console.log('\n--- LAST 5 ---');
    result.movements.slice(-5).forEach(m => {
        console.log(`[${m.fecha}] ${m.tipo} | $${m.monto} | Nombre: "${m.descripcion}" | Concepto: "${m.concepto.substring(0, 40)}..."`);
    });
} catch (e) {
    console.error('Error parsing:', e);
}
