import { supabaseAdmin } from '../src/lib/supabase.ts';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runTest() {
  // Get a sample account id (first one) to associate the test movement
  const { data: accounts, error: accErr } = await supabaseAdmin!
    .from('cuentas_bancarias')
    .select('id')
    .limit(1);
  if (accErr) {
    console.error('Error fetching accounts:', accErr);
    return;
  }
  if (!accounts || accounts.length === 0) {
    console.error('No accounts found in DB.');
    return;
  }
  const cuentaId = accounts[0].id;

  const testConcept = `TEST_MOVEMENT_${Date.now()}`;

  // Insert test movement
  const { data: inserted, error: insertErr } = await supabaseAdmin!
    .from('movimientos')
    .insert({
      cuenta_id: cuentaId,
      fecha: new Date().toISOString(),
      tipo: 'INGRESO',
      monto: 1234,
      concepto: testConcept,
      saldo_excel: null,
      factura: null,
      nombre_tercero: 'Prueba Proveedor',
    })
    .select();
  console.log('Inserted:', inserted, insertErr);

  // Verify the movement exists
  const { data: fetched, error: fetchErr } = await supabaseAdmin!
    .from('movimientos')
    .select('*')
    .eq('concepto', testConcept);
  console.log('Fetched:', fetched, fetchErr);

  // Clean up: delete the test movement
  const { error: deleteErr } = await supabaseAdmin!
    .from('movimientos')
    .delete()
    .eq('concepto', testConcept);
  console.log('Deleted error (if any):', deleteErr);
}

runTest();
