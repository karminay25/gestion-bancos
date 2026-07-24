export interface TemporadaRange {
  id: string | number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

// Compara fechas como texto ISO (YYYY-MM-DD), lo cual funciona correctamente
// porque ese formato ordena lexicográficamente igual que cronológicamente.
// Usa los getters LOCALES (no toISOString, que es UTC) para que "hoy" no se
// adelante un dia en husos horarios detras de UTC como el de México durante
// las horas de la tarde/noche.
function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Formatea una fecha guardada como texto "YYYY-MM-DD" sin pasar por el
// constructor de Date (que la interpreta como medianoche UTC y puede mostrar
// el dia anterior en husos horarios detras de UTC, como México).
export function formatFechaLocal(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
}

// Una temporada esta "activa" si ya inicio (fecha_inicio <= hoy) y, si tiene
// fecha_fin definida, esta aun no ha pasado (fecha_fin >= hoy). Una temporada
// puede tener su fecha_fin ya definida de antemano (para permitir la
// clasificacion automatica de movimientos futuros) sin que eso la marque como
// finalizada antes de tiempo.
export function isTemporadaActiva(t: TemporadaRange): boolean {
  const hoy = today();
  if (!t.fecha_inicio || t.fecha_inicio > hoy) return false;
  if (t.fecha_fin && t.fecha_fin < hoy) return false;
  return true;
}

// Encuentra la temporada a la que pertenece una fecha de movimiento, segun el
// rango [fecha_inicio, fecha_fin] de cada temporada (fecha_fin null = sin
// limite superior aun). Si ninguna temporada define un rango que la cubra,
// regresa null (el movimiento queda sin temporada, igual que el historico
// previo a este sistema).
export function findTemporadaForFecha<T extends TemporadaRange>(
  fecha: string,
  temporadas: T[]
): T["id"] | null {
  const match = temporadas.find(t => {
    if (!t.fecha_inicio) return false;
    if (fecha < t.fecha_inicio) return false;
    if (t.fecha_fin && fecha > t.fecha_fin) return false;
    return true;
  });
  return match ? match.id : null;
}
