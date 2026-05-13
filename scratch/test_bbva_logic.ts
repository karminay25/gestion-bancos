import * as fs from 'fs';
import { parseBBVA } from '../src/lib/importers/bbva';

const FILE_PATH = 'C:/proyectoResidencias/RSM_20260421131702180_00908290_ADMIN1.xls';
const buffer = fs.readFileSync(FILE_PATH);

const result = parseBBVA(buffer);

console.log('Parsed movements:', result.movements.length);
const traspaso = result.movements.filter(m => m.concepto.includes('TRASPASO ENTRE CUENTAS'));
console.log('Traspaso from Excel extracted:', traspaso.length > 0 ? 'YES' : 'NO', traspaso);
console.log('Suggested Initial Balance:', result.suggestedInitialBalance);

// Find the sum of cargos and abonos
const sumAbonos = result.movements.filter(m => m.tipo === 'Ingreso').reduce((sum, m) => sum + m.monto, 0);
const sumCargos = result.movements.filter(m => m.tipo === 'Egreso').reduce((sum, m) => sum + m.monto, 0);

console.log('Sum Abonos:', sumAbonos);
console.log('Sum Cargos:', sumCargos);
console.log('Calculated ending balance based on initial:', (result.suggestedInitialBalance || 0) + sumAbonos - sumCargos);

