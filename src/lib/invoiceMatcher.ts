import { supabaseAdmin as supabase } from './supabase';

export async function matchInvoicesWithMovements() {
    // 1. Fetch pending invoices
    const { data: facturas } = await supabase
        .from('facturas')
        .select('*')
        .eq('estado', 'PENDIENTE_VINCULO');

    if (!facturas || facturas.length === 0) return { matched: 0, suggested: 0 };

    let perfectMatches = 0;
    let suggestedMatches = 0;

    for (const factura of facturas) {
        // 2. Search for movements with similar amount (+- 0.05 for rounding)
        // Expanded window: 30 days before or after invoice date
        const dateWindow = 30;
        const minDate = addDays(factura.fecha_emision, -dateWindow);
        const maxDate = addDays(factura.fecha_emision, dateWindow);

        const { data: movements } = await supabase
            .from('movimientos')
            .select('*, cuentas_bancarias(moneda, empresa_id)')
            .gte('monto', factura.monto_total - 0.05)
            .lte('monto', factura.monto_total + 0.05)
            .gte('fecha', minDate)
            .lte('fecha', maxDate)
            .is('factura', null);

        if (movements && movements.length > 0) {
            // Filter by currency
            let filteredMovs = movements.filter(m => 
                !m.cuentas_bancarias?.moneda || m.cuentas_bancarias.moneda === factura.moneda
            );

            if (filteredMovs.length === 0) continue;

            // Check for match (Name similarity or Amount+Date as fallback)
            const bestMatch = filteredMovs.find(m => 
                isSimilar(m.nombre_tercero, factura.emisor_nombre) ||
                isSimilar(m.concepto, factura.emisor_nombre)
            );

            if (bestMatch) {
                const label = `${factura.folio || 'FAC'} - ${factura.emisor_nombre}`;
                await linkInvoiceToMovement(factura.id, bestMatch.id, label);
                perfectMatches++;
            } else if (filteredMovs.length === 1) {
                // If only one movement in the whole month matches this exact amount
                // we might want to suggest it or even auto-link it if it's very unique
                suggestedMatches++;
            }
        }
    }

    return { matched: perfectMatches, suggested: suggestedMatches };
}

function addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function isSimilar(s1: string, s2: string): boolean {
    if (!s1 || !s2) return false;
    
    const clean = (s: string) => s.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9 ]/g, '') // Keep spaces
        .split(' ')
        .filter(word => word.length > 2); // Only words with 3+ letters

    const words1 = clean(s1);
    const words2 = clean(s2);

    if (words1.length === 0 || words2.length === 0) return false;

    // Count how many words from s1 are in s2
    const matches = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
    
    // If they share at least 2 significant words or 50% of the words
    return matches.length >= 2 || (matches.length / Math.min(words1.length, words2.length)) >= 0.5;
}

async function linkInvoiceToMovement(facturaId: string, movimientoId: string, label: string) {
    // Update movement - we keep the existing "factura" text field for display
    // but the real link is in the facturas table
    await supabase
        .from('movimientos')
        .update({ factura: label })
        .eq('id', movimientoId);

    // Update invoice
    await supabase
        .from('facturas')
        .update({ movimiento_id: movimientoId, estado: 'VINCULADA' })
        .eq('id', facturaId);
}

