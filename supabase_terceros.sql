-- Tabla de Directorio de Terceros/Proveedores
-- Crea la tabla si no existe
CREATE TABLE IF NOT EXISTS terceros (
  id SERIAL PRIMARY KEY,
  nombre_raw TEXT NOT NULL,        -- Como aparece en el banco/Excel
  nombre_canonico TEXT NOT NULL,   -- Nombre limpio/normalizado
  centro_costo_id UUID REFERENCES centros_costo(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda rápida por nombre_raw
CREATE INDEX IF NOT EXISTS idx_terceros_nombre_raw ON terceros (nombre_raw);

-- Poblar con terceros únicos existentes en movimientos
-- (ejecutar manualmente si se desea migrar datos históricos)
-- INSERT INTO terceros (nombre_raw, nombre_canonico)
-- SELECT DISTINCT nombre_tercero, nombre_tercero
-- FROM movimientos
-- WHERE nombre_tercero IS NOT NULL AND nombre_tercero != ''
-- ON CONFLICT DO NOTHING;

-- RLS Policies
ALTER TABLE public.terceros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todo el mundo autenticado puede ver terceros" ON public.terceros FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir insertar terceros a autenticados" ON public.terceros FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permitir actualizar terceros a autenticados" ON public.terceros FOR UPDATE USING (auth.role() = 'authenticated');
