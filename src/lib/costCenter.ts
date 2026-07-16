export function formatCostCenter(cc?: { numero?: number | string | null; nombre: string } | null): string {
  if (!cc) return '';
  return cc.numero != null && cc.numero !== '' ? `${cc.numero} - ${cc.nombre}` : cc.nombre;
}
