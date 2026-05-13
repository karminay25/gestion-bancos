import { parseMonex } from '../src/lib/importers/monex';
import fs from 'fs';

const buffer = fs.readFileSync('c:/proyectoResidencias/MovimientosContrato (8).xls');
const result = parseMonex(buffer);

console.log(`Total movements parsed: ${result.movements.length}`);
console.log('\n--- FIRST 10 ---');
result.movements.slice(0, 10).forEach(m => {
    console.log(`[${m.fecha}] ${m.tipo} | $${m.monto} | Nombre: "${m.descripcion}" | Concepto: "${m.concepto.substring(0, 60)}..."`);
});
console.log('\n--- LAST 5 ---');
result.movements.slice(-5).forEach(m => {
    console.log(`[${m.fecha}] ${m.tipo} | $${m.monto} | "${m.descripcion}"`);
});
