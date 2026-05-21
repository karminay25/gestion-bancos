import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
});
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

function isUnlinkedMovement(facturaField: string | null): boolean {
    if (facturaField === null || facturaField === undefined || facturaField.trim() === '') return true;
    const trimmed = facturaField.trim();
    if (/^\[BANCO:\s*[\d,.-]+\]$/.test(trimmed)) return true;
    if (/^\s*\[BANCO:\s*[\d,.-]+\]$/.test(facturaField)) return true;
    return false;
}

function addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function isSimilar(s1: string, s2: string): boolean {
    if (!s1 || !s2) return false;
    const clean = (s: string) => s.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, '')
        .split(' ')
        .filter(word => word.length > 2);
    const words1 = clean(s1);
    const words2 = clean(s2);
    if (words1.length === 0 || words2.length === 0) return false;
    const matches = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
    return matches.length >= 2 || (matches.length / Math.min(words1.length, words2.length)) >= 0.5;
}

async function testMatcher() {
    console.log('=== TEST DEL MATCHER CORREGIDO (MODO SIMULACIÓN) ===\n');

    const { data: facturas } = await supabase
        .from('facturas')
        .select('*')
        .eq('estado', 'PENDIENTE_VINCULO');

    console.log(`Facturas pendientes: ${facturas?.length || 0}\n`);

    let perfectCount = 0;
    let suggestedCount = 0;
    let noMatchCount = 0;

    for (const factura of (facturas || [])) {
        const minDate = addDays(factura.fecha_emision, -30);
        const maxDate = addDays(factura.fecha_emision, 30);

        const { data: allMovements } = await supabase
            .from('movimientos')
            .select('*, cuentas_bancarias(moneda, empresa_id)')
            .gte('fecha', minDate)
            .lte('fecha', maxDate);

        if (!allMovements || allMovements.length === 0) {
            noMatchCount++;
            continue;
        }

        const unlinked = allMovements.filter(m => isUnlinkedMovement(m.factura));

        if (unlinked.length === 0) {
            noMatchCount++;
            continue;
        }

        const amountTol = Math.max(0.05, factura.monto_total * 0.001);
        const filtered = unlinked.filter(m => {
            const movCurrency = m.cuentas_bancarias?.moneda;
            const currencyMatch = !movCurrency || !factura.moneda || factura.moneda === 'XXX' ||
                movCurrency === factura.moneda;
            const cleanMonto = m.monto ? m.monto.toString().replace(/,/g, '') : '0';
            const numMonto = parseFloat(cleanMonto);
            return currencyMatch && Math.abs(numMonto - factura.monto_total) <= amountTol;
        });

        if (filtered.length === 0) {
            noMatchCount++;
            continue;
        }

        const bestMatch = filtered.find(m =>
            isSimilar(m.nombre_tercero, factura.emisor_nombre) ||
            isSimilar(m.concepto, factura.emisor_nombre)
        );

        if (bestMatch) {
            perfectCount++;
            console.log(`[✓ PERFECTO] $${factura.monto_total} ${factura.moneda} | ${factura.fecha_emision}`);
            console.log(`   Factura: ${factura.emisor_nombre}`);
            console.log(`   Movimiento: ${bestMatch.nombre_tercero || bestMatch.concepto} | $${bestMatch.monto} | ${bestMatch.fecha}`);
        } else {
            suggestedCount++;
            console.log(`[~ SUGERENCIA] $${factura.monto_total} ${factura.moneda} | ${factura.fecha_emision}`);
            console.log(`   Factura: ${factura.emisor_nombre}`);
            console.log(`   Candidatos (${filtered.length}): ${filtered[0].nombre_tercero || filtered[0].concepto}`);
        }
    }

    console.log(`\n=============================`);
    console.log(`✓ Vínculos perfectos encontrados: ${perfectCount}`);
    console.log(`~ Sugerencias (monto coincide pero nombre no): ${suggestedCount}`);
    console.log(`✗ Sin coincidencia: ${noMatchCount}`);
    console.log(`Total facturas analizadas: ${(facturas?.length || 0)}`);
}

testMatcher().catch(console.error);
