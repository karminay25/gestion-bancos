export function cleanTerceroName(rawName: string): string {
    if (!rawName) return 'POR IDENTIFICAR';

    let cleaned = rawName.toUpperCase().trim();

    // 1. Manejo de IVA y Comisiones explícitas
    if (/^16%$/.test(cleaned) || cleaned.includes('IVA COM.CH') || cleaned.includes('COMISION') || cleaned.includes('COM A CARGO')) {
        return 'COMISIONES BANCARIAS';
    }

    // 2. Limpieza de prefijos de pago de facturas, notas y cotizaciones
    // PAGO F610, PAGO F467, PAGO FACTURA, PAGO FAC CREDITO LOLA B 41, PAGO NOTA SAY..., PAGO COT A13751...
    cleaned = cleaned.replace(/PAGO\s+(F|FAC\s+CREDITO|FACTURA[A-Z]?|NOTA\s+SAY|COT|COTIZACION)\s*([A-Z0-9]+)?\s*/g, '');
    
    // Sometimes it just says "PAGO F62 CBM", "PAGO F9A5 KYCC"
    cleaned = cleaned.replace(/^PAGO\s+F[A-Z0-9]+\s+/g, '');
    // Clean trailing specific patterns like CBM or BMRC
    cleaned = cleaned.replace(/CBM\s+BMRC.*/g, '');

    // 3. Eliminar prefijos de banco genéricos
    const genericPrefixes = [
        'SPEI ENVIADO BANAMEX',
        'SPEI ENVIADO HSBC',
        'SPEI ENVIADO SANTANDER',
        'SPEI ENVIADO BAJIO',
        'SPEI ENVIADO',
        'SPEI RECIBIDOBANORTE',
        'SPEI RECIBIDOBAJIO',
        'SPEI RECIBIDOSANTANDER',
        'SPEI RECIBIDOBMONEX',
        'SPEI RECIBIDO',
        'TRASPASO A TERCEROS',
        'TRASPASO BBVA PESOS',
        'TRASPASO',
        'EMISION LIBRAMIE CHQ',
        'DEPOSITO EN CUENTA',
        'ABONO POR TRANSFERENCIA',
        'PAGO DE NOMINA',
        'COMPENSACIONES',
        'DEVOLUCION PAGO ERRONEO',
        'DEV MOV ERRONEO',
        'DEVOLUCION'
    ];

    // "SPEI RECIBIDO" viene pegado al banco emisor (SPEI RECIBIDOBANORTE). Se
    // cubre cualquier banco, no solo los listados abajo. Solo aplica a la forma
    // PEGADA: si viene separado por espacio, esa palabra es el beneficiario y no
    // debe borrarse.
    cleaned = cleaned.replace(/^\s*SPEI\s+RECIBIDO[A-Z]*\s*/, '');

    // Los prefijos se anclan al inicio (^) y exigen límite de palabra (\b) para
    // no mutilar nombres legítimos que empiezan con esas letras: sin el \b,
    // "TRASPASOS LOGISTICOS SA" quedaba como "S LOGISTICOS SA" y
    // "DEVOLUCIONES DEL NORTE" como "ES DEL NORTE".
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const prefix of genericPrefixes) {
        cleaned = cleaned.replace(new RegExp(`^\\s*${escapeRegExp(prefix)}\\b\\s*`), '');
    }

    // 4. Fechas basura como "DEL 01MAR26 AL 31MAR26"
    if (/DEL\s+\d{2}[A-Z]{3}\d{2}\s+AL\s+\d{2}[A-Z]{3}\d{2}/.test(cleaned)) {
        cleaned = cleaned.replace(/DEL\s+\d{2}[A-Z]{3}\d{2}\s+AL\s+\d{2}[A-Z]{3}\d{2}/g, '');
    }

    // 5. Cleanup residual spaces and dashes
    cleaned = cleaned.replace(/^[-\s]+|[-\s]+$/g, ''); // trim start/end dashes and spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' '); // remove multiple spaces

    // Si después de toda la limpieza queda vacío, intentamos usar el string original
    // o lo marcamos como POR IDENTIFICAR si el original era pura basura (como "SPEI ENVIADO BANAMEX")
    if (!cleaned) {
        // If it was just "SPEI ENVIADO BANAMEX" it is really POR IDENTIFICAR
        const wasGeneric = genericPrefixes.some(p => rawName.toUpperCase().includes(p));
        const wasDate = /DEL\s+\d{2}[A-Z]{3}\d{2}/.test(rawName.toUpperCase());
        if (wasGeneric || wasDate || /^[0-9A-Z\s]*$/.test(rawName)) {
            return 'POR IDENTIFICAR';
        }
        return rawName.trim().substring(0, 100); // fallback
    }

    return cleaned.substring(0, 100);
}
