// Test seguro y aislado del motor de Inteligencia Artificial de Nombres
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

console.log('🧪 Iniciando prueba de estrés del Motor de Reconocimiento de Nombres (Sin conexión a BD)\n');

const testCases = [
    { banco: 'EDUARDO JIMENEZ V', factura: 'EDUARDO JIMENEZ VILLASEÑOR', expected: true },
    { banco: 'PAGO F3709 EDUARDO JIMEN', factura: 'EDUARDO JIMENEZ VILLASEÑOR', expected: true },
    { banco: 'LOLA BERRIES SPR', factura: 'LOLA BERRIES SPR DE RL DE CV', expected: true },
    { banco: 'STARLINK INTERNET', factura: 'STARLINK SATELLITE SYSTEMS MEXICO', expected: true },
    { banco: 'CFE M02', factura: 'SUMINISTRADOR DE SERVICIOS BASICOS CFE', expected: true },
    { banco: 'JUAN PEREZ', factura: 'EDUARDO JIMENEZ', expected: false }
];

let passed = 0;
testCases.forEach((tc, i) => {
    const result = isSimilar(tc.banco, tc.factura);
    const icon = result === tc.expected ? '✅' : '❌';
    if (result === tc.expected) passed++;
    console.log(`${icon} Caso ${i+1}: Banco [${tc.banco}] vs Factura [${tc.factura}] -> ¿Coinciden? ${result}`);
});

console.log(`\nResultado: ${passed}/${testCases.length} pruebas pasadas.`);
