import { supabaseAdmin } from './supabase';
const supabase = supabaseAdmin!; // non-null assertion for server usage

/**
 * Determines if a movement's "factura" field already has a real invoice linked.
 * Movements imported from Excel have values like "[BANCO: 163041.89]" (just the bank balance).
 * A movement is considered "unlinked" if its factura field is null, empty, or only contains
 * the bank balance marker "[BANCO:".
 */
function isUnlinkedMovement(facturaField: string | null): boolean {
    if (facturaField === null || facturaField === undefined || facturaField.trim() === '') return true;
    // Trim and check if it ONLY contains the bank balance info (no real folio)
    const trimmed = facturaField.trim();
    // If the whole string is just the [BANCO: ...] marker, it's unlinked
    if (/^\[BANCO:\s*[\d,.-]+\]$/.test(trimmed)) return true;
    // If it contains only the marker possibly surrounded by whitespace, it's unlinked
    if (/^\s*\[BANCO:\s*[\d,.-]+\]\s*$/.test(facturaField)) return true;
    // Any other non‑empty string is considered linked
    return false;
}

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
        // 2. Search for movements in a date window (±30 days of invoice date)
        const dateWindow = 30;
        const minDate = addDays(factura.fecha_emision, -dateWindow);
        const maxDate = addDays(factura.fecha_emision, dateWindow);

        if (!minDate || !maxDate) continue;

        // Fetch ALL movements in the date window (we filter "unlinked" in JS
        // because the DB field may contain "[BANCO: xxx]" instead of NULL)
        const { data: allMovements } = await supabase
            .from('movimientos')
            .select('*, cuentas_bancarias(moneda, empresa_id)')
            .gte('fecha', minDate)
            .lte('fecha', maxDate);

        if (!allMovements || allMovements.length === 0) continue;

        // Filter to only unlinked movements
        const unlinkedMovements = allMovements.filter(m => isUnlinkedMovement(m.factura));

        if (unlinkedMovements.length === 0) continue;

        // 3. Filter by currency and amount in JS to avoid DB type-casting issues
        const amountTolerance = Math.max(0.05, factura.monto_total * 0.001); // 0.1% tolerance
        let filteredMovs = unlinkedMovements.filter(m => {
            // Currency check (skip if no currency info)
            const movCurrency = m.cuentas_bancarias?.moneda;
            const currencyMatch = !movCurrency || !factura.moneda || factura.moneda === 'XXX' ||
                movCurrency === factura.moneda;

            // Amount check — strip commas from Excel-imported amounts like "1,500.00"
            const cleanMonto = m.monto ? m.monto.toString().replace(/,/g, '') : '0';
            const numMonto = parseFloat(cleanMonto);

            const amountMatch = Math.abs(numMonto - factura.monto_total) <= amountTolerance;
            return currencyMatch && amountMatch;
        });

        if (filteredMovs.length === 0) continue;

        // Sort candidates by date proximity to the invoice (closest first)
        // This is key to properly link recurring monthly/weekly charges of the same amount.
        filteredMovs.sort((a, b) => {
            const timeA = a.fecha ? new Date(a.fecha).getTime() : 0;
            const timeB = b.fecha ? new Date(b.fecha).getTime() : 0;
            const timeFact = factura.fecha_emision ? new Date(factura.fecha_emision).getTime() : 0;

            const diffA = Math.abs(timeA - timeFact);
            const diffB = Math.abs(timeB - timeFact);
            return diffA - diffB;
        });

        // 4. Try to find best match by name similarity
        const bestMatch = filteredMovs.find(m => {
            // Prefer match on provider if present
            if (m.proveedor && isSimilar(m.proveedor, factura.emisor_nombre)) return true;
            // Fallback to existing checks
            return isSimilar(m.nombre_tercero, factura.emisor_nombre) ||
                isSimilar(m.concepto, factura.emisor_nombre);
        });

        if (bestMatch) {
            await linkInvoiceToMovement(factura.id, bestMatch.id, factura, bestMatch);
            perfectMatches++;
        } else {
            // Movements exist with the right amount but name doesn't match — suggest to user
            await supabase
                .from('facturas')
                .update({ estado: 'CON_SUGERENCIAS' })
                .eq('id', factura.id);
            suggestedMatches++;
        }
    }

    return { matched: perfectMatches, suggested: suggestedMatches };
}

function addDays(dateStr: string, days: number): string {
    try {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    } catch {
        return '';
    }
}

function isSimilar(s1: string, s2: string): boolean {
    // Simple wrapper that uses scoreSimilarity with a threshold of 0.6
    return scoreSimilarity(s1, s2) >= 0.6;
}

/**
 * Compute a similarity score between two strings (0‑1).
 * Uses token Jaccard similarity after removing stop‑words and accents.
 */
function scoreSimilarity(s1: string, s2: string): number {
    if (!s1 || !s2) return 0;
    const stopWords = new Set([
        'grupo', 'servicios', 'corporativo', 'mexico', 'comercial', 'comercializadora',
        'distribuidora', 'soluciones', 'tecnologia', 'asociados', 'compania', 'cia',
        'industrias', 'sapi', 'srl', 'cv', 'sa', 'de', 'rl', 'cooperativa', 'internacional',
        'nacional', 'operadora', 'administradora', 'consultores', 'consultoria', 'logistica'
    ]);
    const clean = (s: string) => s.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, '')
        .split(' ')
        .filter(w => w.length > 2 && !stopWords.has(w));
    const set1 = new Set(clean(s1));
    const set2 = new Set(clean(s2));
    const intersect = [...set1].filter(w => set2.has(w)).length;
    const union = new Set([...set1, ...set2]).size;
    return union === 0 ? 0 : intersect / union;
}

async function linkInvoiceToMovement(
    facturaId: string,
    movimientoId: string,
    factura: Record<string, unknown>,
    movement: Record<string, unknown>
) {
    // Build the new label: preserve the existing [BANCO: ...] portion + add the folio
    const existingField = (movement.factura as string) || '';
    const bancoMatch = existingField.match(/\[BANCO:\s*[\d,.-]+\]/);
    const bancoSuffix = bancoMatch ? ` ${bancoMatch[0]}` : '';
    const folioLabel = `${factura.folio || 'FAC'} - ${factura.emisor_nombre}${bancoSuffix}`;

    // Update the movement with the invoice label (preserving bank balance info)
    await supabase
        .from('movimientos')
        .update({ factura: folioLabel })
        .eq('id', movimientoId);

    // Mark the invoice as linked
    await supabase
        .from('facturas')
        .update({ movimiento_id: movimientoId, estado: 'VINCULADA' })
        .eq('id', facturaId);
}
