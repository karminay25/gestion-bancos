-- Row Level Security para el sistema de cuentas de usuario (admin / viewer).
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (Dashboard del proyecto -> SQL Editor).
-- No borra ni modifica ningún registro existente: solo agrega reglas de acceso.
--
-- Efecto:
--   - Cualquier usuario autenticado (admin o viewer) puede LEER estas tablas.
--   - Solo un usuario con app_metadata.role = 'admin' puede INSERTAR, ACTUALIZAR o BORRAR.
--   - Un usuario "viewer" que intente escribir directamente (incluso saltándose la
--     interfaz, por ejemplo desde la consola del navegador) será rechazado por la
--     base de datos, no solo por la app.

do $$
declare
  t text;
begin
  foreach t in array array['empresas', 'cuentas_bancarias', 'centros_costo', 'temporadas', 'terceros', 'facturas', 'movimientos']
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "authenticated_can_read" on public.%I;', t);
    execute format(
      'create policy "authenticated_can_read" on public.%I for select using (auth.role() = ''authenticated'');',
      t
    );

    execute format('drop policy if exists "admin_can_write" on public.%I;', t);
    execute format(
      'create policy "admin_can_write" on public.%I for all using ((auth.jwt() -> ''app_metadata'' ->> ''role'') = ''admin'') with check ((auth.jwt() -> ''app_metadata'' ->> ''role'') = ''admin'');',
      t
    );
  end loop;
end $$;
