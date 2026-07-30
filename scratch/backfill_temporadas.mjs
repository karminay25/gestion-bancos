// Reasigna temporada_id segun la fecha del movimiento.
//
// POLITICA DE SEGURIDAD:
//   - Solo escribe el campo temporada_id. NUNCA toca saldoo, monto, fecha,
//     tipo, concepto, nombre_tercero ni centro_costo_id.
//   - Solo rellena movimientos cuya temporada_id esta VACIA. Jamas sobrescribe
//     una temporada ya asignada a mano.
//   - Sin el argumento --aplicar solo simula y no escribe nada.
//
// Uso:
//   node scratch/backfill_temporadas.mjs            (simulacion, no escribe)
//   node scratch/backfill_temporadas.mjs --aplicar  (aplica los cambios)

import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const env = {};
for (const linea of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const APLICAR = process.argv.includes('--aplicar');

async function traerTodo(tabla, select = '*') {
  let out = [], from = 0;
  for (;;) {
    const { data, error } = await supabase.from(tabla).select(select).range(from, from + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    if (!data?.length) break;
    out = out.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}

// Misma regla que src/lib/temporadas.ts
function temporadaParaFecha(fecha, temporadas) {
  const t = temporadas.find(t => {
    if (!t.fecha_inicio) return false;
    if (fecha < t.fecha_inicio) return false;
    if (t.fecha_fin && fecha > t.fecha_fin) return false;
    return true;
  });
  return t ? t.id : null;
}

console.log(APLICAR ? '=== APLICANDO CAMBIOS ===\n' : '=== SIMULACION (no se escribe nada) ===\n');

const [movs, temps] = await Promise.all([
  traerTodo('movimientos', 'id, fecha, temporada_id'),
  traerTodo('temporadas'),
]);

const nombreTemp = new Map(temps.map(t => [String(t.id), t.nombre]));

const aRellenar = [];   // temporada vacia -> se le asigna una
const yaCorrectos = []; // temporada ya asignada y coincide con la fecha
const discrepantes = []; // temporada asignada pero NO coincide (no se tocan)
const sinTemporada = []; // la fecha no cae en ninguna temporada

for (const m of movs) {
  const esperada = temporadaParaFecha(m.fecha, temps);
  const actual = m.temporada_id == null ? null : String(m.temporada_id);

  if (actual == null) {
    if (esperada == null) sinTemporada.push(m);
    else aRellenar.push({ id: m.id, fecha: m.fecha, temporada_id: esperada });
  } else if (esperada != null && String(esperada) === actual) {
    yaCorrectos.push(m);
  } else {
    discrepantes.push({ ...m, esperada });
  }
}

console.log(`Total de movimientos:                    ${movs.length}`);
console.log(`  ya tenian la temporada correcta:       ${yaCorrectos.length}`);
console.log(`  se les asignara temporada (estaba vacia): ${aRellenar.length}`);
console.log(`  su fecha no cae en ninguna temporada:   ${sinTemporada.length}  (se quedan sin temporada)`);
console.log(`  tienen una temporada distinta a su fecha: ${discrepantes.length}  (NO se tocan)\n`);

const porTemporada = {};
aRellenar.forEach(r => {
  const n = nombreTemp.get(String(r.temporada_id)) || String(r.temporada_id);
  porTemporada[n] = (porTemporada[n] || 0) + 1;
});
console.log('Reparto de los que se van a asignar:');
Object.entries(porTemporada).forEach(([n, c]) => console.log(`  ${n}: ${c} movimientos`));

if (discrepantes.length) {
  console.log('\nMovimientos con temporada distinta a su fecha (se respetan tal cual):');
  discrepantes.slice(0, 10).forEach(d => {
    console.log(`  ${d.fecha}  tiene "${nombreTemp.get(String(d.temporada_id))}"  vs fecha sugiere "${d.esperada ? nombreTemp.get(String(d.esperada)) : '(ninguna)'}"`);
  });
}

if (sinTemporada.length) {
  const años = {};
  sinTemporada.forEach(m => { const a = m.fecha.slice(0, 4); años[a] = (años[a] || 0) + 1; });
  console.log('\nSin temporada por año (anteriores a la primera temporada):', JSON.stringify(años));
}

if (!APLICAR) {
  console.log('\nSimulacion terminada. No se escribio nada.');
  console.log('Para aplicar: node scratch/backfill_temporadas.mjs --aplicar');
  process.exit(0);
}

// --- Respaldo antes de escribir ---
const respaldo = `scratch/respaldo_temporadas_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(new URL(`../${respaldo}`, import.meta.url),
  JSON.stringify(movs.map(m => ({ id: m.id, temporada_id: m.temporada_id })), null, 2));
console.log(`\nRespaldo del estado anterior guardado en: ${respaldo}`);
console.log('(permite revertir asignando de vuelta esos valores)\n');

// --- Aplicar: una sola operacion por temporada, con candados de seguridad ---
// Se filtra por rango de fechas Y por temporada_id vacia. Ese segundo filtro es
// el candado: aunque el rango abarcara un movimiento ya clasificado, la consulta
// no lo tocaria. Ademas update() solo lleva temporada_id, asi que ningun otro
// campo puede modificarse.
let hechos = 0, errores = 0;

for (const t of temps) {
  const cuantos = aRellenar.filter(r => String(r.temporada_id) === String(t.id)).length;
  if (cuantos === 0) continue;
  if (!t.fecha_inicio) continue;

  let q = supabase
    .from('movimientos')
    .update({ temporada_id: t.id })   // UNICO campo que se escribe
    .is('temporada_id', null)          // candado: nunca sobrescribe
    .gte('fecha', t.fecha_inicio);
  if (t.fecha_fin) q = q.lte('fecha', t.fecha_fin);

  const { data, error } = await q.select('id');
  if (error) {
    errores++;
    console.error(`  error en "${t.nombre}": ${error.message}`);
  } else {
    hechos += data?.length || 0;
    console.log(`  "${t.nombre}": ${data?.length || 0} movimientos actualizados (se esperaban ${cuantos})`);
  }
}

console.log(`\nListo: ${hechos} movimientos actualizados, ${errores} errores.`);
if (hechos !== aRellenar.length) {
  console.log(`AVISO: se esperaban ${aRellenar.length} y se actualizaron ${hechos}. Revisa el detalle de arriba.`);
}
