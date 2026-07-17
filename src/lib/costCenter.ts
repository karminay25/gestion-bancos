export function formatCostCenter(cc?: { numero?: number | string | null; nombre: string } | null): string {
  if (!cc) return '';
  return cc.numero != null && cc.numero !== '' ? `${cc.numero} - ${cc.nombre}` : cc.nombre;
}

// Ordena centros de costo por su número identificador ascendente.
// Los que no tienen número (por ejemplo recién creados) van al final,
// ordenados alfabéticamente entre ellos.
export function compareCostCenters(
  a: { numero?: number | string | null; nombre: string },
  b: { numero?: number | string | null; nombre: string }
): number {
  const na = a.numero == null || a.numero === '' ? null : Number(a.numero);
  const nb = b.numero == null || b.numero === '' ? null : Number(b.numero);
  if (na != null && nb != null) return na - nb;
  if (na != null) return -1; // a tiene número, b no -> a primero
  if (nb != null) return 1;  // b tiene número, a no -> b primero
  return a.nombre.localeCompare(b.nombre);
}
