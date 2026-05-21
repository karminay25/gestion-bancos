import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
});
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_KEY']);

function addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function isSimilar(s1: string, s2: string): boolean {
    if (!s1 || !s2) return false;
    const clean = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, '').split(' ').filter(word => word.length > 2);
    const words1 = clean(s1);
    const words2 = clean(s2);
    if (words1.length === 0 || words2.length === 0) return false;
    const matches = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
    return matches.length >= 2 || (matches.length / Math.min(words1.length, words2.length)) >= 0.5;
}

async function debugFullMatch() {
    console.log('Fetching pending invoices...');
    const { data: facturas } = await supabase.from('facturas').select('*').eq('estado', 'PENDIENTE_VINCULO');
    
    let perfectCount = 0;
    let suggestedCount = 0;
    let noMatchCount = 0;

    for (const factura of facturas) {
        const minDate = addDays(factura.fecha_emision, -30);
        const maxDate = addDays(factura.fecha_emision, 30);

        const { data: movements } = await supabase
            .from('movimientos')
            .select('*, cuentas_bancarias(moneda)')
            .gte('fecha', minDate)
            .lte('fecha', maxDate)
            .is('factura', null);

        let filteredMovs = movements?.filter(m => {
            const numMonto = parseFloat(m.monto);
            return Math.abs(numMonto - factura.monto_total) <= 0.05;
        }) || [];

        if (filteredMovs.length === 0) {
            noMatchCount++;
        } else {
            const bestMatch = filteredMovs.find(m => isSimilar(m.nombre_tercero, factura.emisor_nombre) || isSimilar(m.concepto, factura.emisor_nombre));
            if (bestMatch) {
                perfectCount++;
                console.log(`[PERFECT] $${factura.monto_total} | Fac: ${factura.emisor_nombre} == Mov: ${bestMatch.nombre_tercero}`);
            } else {
                suggestedCount++;
                console.log(`[SUGGEST] $${factura.monto_total} | Fac: ${factura.emisor_nombre} != Mov: ${filteredMovs[0].nombre_tercero}`);
            }
        }
    }
    console.log(`\nRESULTS:\nPerfect: ${perfectCount}\nSuggested: ${suggestedCount}\nNo Match: ${noMatchCount}`);
}
debugFullMatch();
