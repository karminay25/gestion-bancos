async function checkMath() {
    const url = "https://icyqvfamfyhdyexarozu.supabase.co/rest/v1/movimientos?cuenta_id=eq.92e326e1-77a6-4426-95f6-505f0b36d852&fecha=lt.2026-04-01&select=monto,tipo";
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeXF2ZmFtZnloZHlleGFyb3p1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1NDY1NCwiZXhwIjoyMDkxODMwNjU0fQ.6GQ6-58_EcG19IrLXt-vCztlzti-msNWwmLm4JodFGQ";

    const res = await fetch(url, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });

    const data = await res.json();
    let balance = 0;

    let ingresos = 0;
    let egresos = 0;

    data.forEach(m => {
        if (m.tipo === 'Ingreso') {
            balance += m.monto;
            ingresos += m.monto;
        } else {
            balance -= m.monto;
            egresos += m.monto;
        }
    });

    console.log("Total Ingresos:", ingresos);
    console.log("Total Egresos:", egresos);
    console.log("Net calculated balance (INCLUDING SALDO INICIAL):", balance);
}

checkMath();
