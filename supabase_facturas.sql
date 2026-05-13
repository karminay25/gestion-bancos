-- Create facturas table
CREATE TABLE IF NOT EXISTS facturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uuid_sat TEXT UNIQUE,
    emisor_rfc TEXT,
    emisor_nombre TEXT,
    receptor_rfc TEXT,
    monto_total DECIMAL(12,2),
    moneda TEXT,
    fecha_emision DATE,
    folio TEXT,
    archivo_xml TEXT,
    archivo_pdf TEXT,
    movimiento_id UUID REFERENCES movimientos(id) ON DELETE SET NULL,
    estado TEXT DEFAULT 'PENDIENTE_VINCULO', -- 'PENDIENTE_VINCULO', 'VINCULADA', 'DESCARTADA'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_facturas_monto ON facturas(monto_total);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON facturas(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_facturas_movimiento ON facturas(movimiento_id);
