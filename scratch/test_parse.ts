function parseNum(v: any) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
        const cleaned = v.replace(/[\$,\s]/g, '');
        // Check for parentheses
        if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
            return -parseFloat(cleaned.slice(1, -1)) || 0;
        }
        return parseFloat(cleaned) || 0;
    }
    return 0;
}

console.log('100.00 ->', parseNum('100.00'));
console.log('$100.00 ->', parseNum('$100.00'));
console.log('(100.00) ->', parseNum('(100.00)'));
console.log('($100.00) ->', parseNum('($100.00)'));
console.log('-100.00 ->', parseNum('-100.00'));
