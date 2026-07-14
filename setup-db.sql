-- Nota: La tabla 'empresas' ya existe con ID entero.
-- Ajustaremos las nuevas tablas para que sean compatibles.

-- Tabla de Temporadas (Ciclos de Cosecha)
CREATE TABLE IF NOT EXISTS public.temporadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Cuentas Bancarias
CREATE TABLE IF NOT EXISTS public.cuentas_bancarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id INT REFERENCES public.empresas(id) ON DELETE CASCADE,
    banco TEXT NOT NULL, -- BBVA, Monex, Bajio
    moneda TEXT NOT NULL CHECK (moneda IN ('MXN', 'USD')),
    descripcion TEXT, -- Nombre de la cuenta o número
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (empresa_id, banco, moneda, descripcion)
);

-- Tabla de Centros de Costo
CREATE TABLE IF NOT EXISTS public.centros_costo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Movimientos (Bancos)
CREATE TABLE IF NOT EXISTS public.movimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id UUID REFERENCES public.cuentas_bancarias(id) ON DELETE CASCADE,
    temporada_id UUID REFERENCES public.temporadas(id) ON DELETE SET NULL,
    fecha DATE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Ingreso', 'Egreso', 'Traspaso')),
    monto DECIMAL(14,2) NOT NULL,
    nombre_tercero TEXT, -- Quién recibe o manda el dinero
    concepto TEXT,
    factura TEXT,
    centro_costo_id UUID REFERENCES public.centros_costo(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Perfiles (Roles)
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Asegurar que OBA exista en empresas si no está
-- Nota: Usamos el código 'OBA'
INSERT INTO public.empresas (codigo, nombre_completo, razon_social) 
VALUES ('OBA', 'OBA BERRIES', 'OBA BERRIES') 
ON CONFLICT (codigo) DO NOTHING;

-- RLS Policies
ALTER TABLE public.temporadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centros_costo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todo el mundo autenticado puede ver" ON public.temporadas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Todo el mundo autenticado puede ver" ON public.cuentas_bancarias FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Todo el mundo autenticado puede ver" ON public.centros_costo FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir insertar centros de costo a autenticados" ON public.centros_costo FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permitir actualizar centros de costo a autenticados" ON public.centros_costo FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Todo el mundo autenticado puede ver" ON public.movimientos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Todo el mundo autenticado puede ver" ON public.perfiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Solo Admin puede modificar movimientos" ON public.movimientos 
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND role = 'admin')
);
