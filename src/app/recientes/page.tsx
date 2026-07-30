"use client";

// Pantalla de SOLO LECTURA: muestra lo último que se dio de alta en el sistema,
// ordenado por created_at (cuándo se capturó/importó), que es distinto de la
// fecha del movimiento. No modifica ni elimina nada.

import { useEffect, useState, useMemo } from "react";
import {
  Clock, Loader2, Upload, Hash, Calendar, ChevronDown,
  ArrowUpRight, ArrowDownRight, ArrowLeftRight, Inbox
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { formatCostCenter } from "@/lib/costCenter";
import { formatFechaLocal } from "@/lib/temporadas";

type Periodo = "hoy" | "7" | "30" | "todo";

const PERIODOS: { id: Periodo; label: string; dias: number | null }[] = [
  { id: "hoy", label: "Hoy", dias: 0 },
  { id: "7", label: "7 días", dias: 7 },
  { id: "30", label: "30 días", dias: 30 },
  { id: "todo", label: "Todo", dias: null },
];

// Inicio del día local, en ISO, para comparar contra created_at (timestamptz).
function desdeHaceDias(dias: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

function tiempoRelativo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "hace 1 mes" : `hace ${meses} meses`;
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

// Los movimientos cargados de una misma importación entran con segundos de
// diferencia. Se agrupan en "cargas" cortando cuando pasan más de 2 minutos
// entre uno y otro, para poder distinguir una importación masiva de una
// captura suelta.
const CORTE_CARGA_MS = 2 * 60 * 1000;

interface Carga {
  inicio: string;
  fin: string;
  movimientos: any[];
}

function agruparEnCargas(movs: any[]): Carga[] {
  const cargas: Carga[] = [];
  for (const m of movs) {
    const ultima = cargas[cargas.length - 1];
    const t = new Date(m.created_at).getTime();
    if (ultima && Math.abs(new Date(ultima.fin).getTime() - t) <= CORTE_CARGA_MS) {
      ultima.movimientos.push(m);
      ultima.fin = m.created_at;
    } else {
      cargas.push({ inicio: m.created_at, fin: m.created_at, movimientos: [m] });
    }
  }
  return cargas;
}

const PAGINA = 100;

export default function RecientesPage() {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("7");
  const [limite, setLimite] = useState(PAGINA);
  const [totales, setTotales] = useState({ hoy: 0, semana: 0, total: 0 });

  // Conteos para las tarjetas de resumen (consultas de solo conteo, muy ligeras)
  useEffect(() => {
    (async () => {
      const [hoy, semana, total] = await Promise.all([
        supabase.from("movimientos").select("id", { count: "exact", head: true }).gte("created_at", desdeHaceDias(0)),
        supabase.from("movimientos").select("id", { count: "exact", head: true }).gte("created_at", desdeHaceDias(7)),
        supabase.from("movimientos").select("id", { count: "exact", head: true }),
      ]);
      setTotales({ hoy: hoy.count || 0, semana: semana.count || 0, total: total.count || 0 });
    })();
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      setError(null);

      let q = supabase
        .from("movimientos")
        .select("id, fecha, tipo, monto, nombre_tercero, concepto, created_at, cuentas_bancarias(banco, moneda, empresas(codigo)), centros_costo(nombre, numero)")
        .order("created_at", { ascending: false })
        .limit(limite);

      const def = PERIODOS.find(p => p.id === periodo);
      if (def && def.dias !== null) q = q.gte("created_at", desdeHaceDias(def.dias));

      const { data, error } = await q;
      if (cancelado) return;
      if (error) setError(error.message);
      else setMovimientos(data || []);
      setLoading(false);
    })();
    return () => { cancelado = true; };
  }, [periodo, limite]);

  useEffect(() => { setLimite(PAGINA); }, [periodo]);

  const cargas = useMemo(() => agruparEnCargas(movimientos), [movimientos]);
  const hayMas = movimientos.length >= limite;

  return (
    <div className="space-y-8 pb-20">
      {/* Encabezado */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter uppercase italic">
            Movimientos Recientes
          </h1>
          <p className="text-zinc-500 mt-1 dark:text-zinc-300 font-medium">
            Lo último que se dio de alta en el sistema, agrupado por carga.
          </p>
        </div>
        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          {PERIODOS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                periodo === p.id
                  ? "bg-primary text-white shadow-lg"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TarjetaResumen titulo="Agregados hoy" valor={totales.hoy} icono={<Clock className="text-emerald-500" />} />
        <TarjetaResumen titulo="Últimos 7 días" valor={totales.semana} icono={<Upload className="text-primary" />} />
        <TarjetaResumen titulo="Total en el sistema" valor={totales.total} icono={<Hash className="text-amber-500" />} />
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-600 text-sm font-bold">
          No se pudieron cargar los movimientos: {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="mt-4 text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando altas recientes...</p>
        </div>
      )}

      {!loading && cargas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem]">
          <Inbox className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
          <p className="mt-4 text-zinc-500 font-bold">No se agregaron movimientos en este periodo.</p>
          <p className="text-xs text-zinc-400 mt-1">Prueba con un rango más amplio.</p>
        </div>
      )}

      {/* Cargas */}
      {!loading && cargas.map((carga, i) => (
        <motion.div
          key={carga.inicio + i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
          className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm"
        >
          {/* Cabecera de la carga */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-zinc-50/70 dark:bg-zinc-900/40 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                {carga.movimientos.length > 1
                  ? <Upload className="w-4 h-4 text-primary" />
                  : <Calendar className="w-4 h-4 text-primary" />}
              </div>
              <div>
                <p className="text-sm font-black text-zinc-900 dark:text-zinc-50 capitalize">
                  {fechaLarga(carga.inicio)}
                </p>
                <p className="text-[11px] font-bold text-zinc-400">
                  {carga.movimientos.length > 1
                    ? `${hora(carga.fin)} – ${hora(carga.inicio)}`
                    : hora(carga.inicio)}
                  {" · "}{tiempoRelativo(carga.inicio)}
                </p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
              {carga.movimientos.length === 1
                ? "1 movimiento"
                : `${carga.movimientos.length} movimientos`}
            </span>
          </div>

          {/* Tabla de la carga */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">Hora</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">Fecha mov.</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">Cuenta</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">Tercero</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">Concepto</th>
                  <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">C. Costo</th>
                  <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900 text-xs">
                {carga.movimientos.map((m: any) => {
                  const monto = parseFloat(m.monto);
                  const esEgreso = m.tipo === "Egreso";
                  const esTraspaso = m.tipo === "Traspaso";
                  const salida = esEgreso || (esTraspaso && monto < 0);
                  const moneda = m.cuentas_bancarias?.moneda;
                  return (
                    <tr key={m.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors">
                      <td className="px-6 py-3 font-bold text-zinc-400 whitespace-nowrap">{hora(m.created_at)}</td>
                      <td className="px-4 py-3 font-bold text-zinc-500 dark:text-zinc-300 whitespace-nowrap">
                        {formatFechaLocal(m.fecha)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-black uppercase text-zinc-900 dark:text-zinc-50">
                          {m.cuentas_bancarias?.empresas?.codigo || "—"}
                        </span>
                        <span className="text-zinc-400 ml-1.5">
                          {m.cuentas_bancarias?.banco} {moneda}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-200 max-w-[200px] truncate" title={m.nombre_tercero || ""}>
                        {m.nombre_tercero || "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 max-w-[220px] truncate" title={m.concepto || ""}>
                        {m.concepto || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {m.centros_costo ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                            {formatCostCenter(m.centros_costo)}
                          </span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {esTraspaso
                            ? <ArrowLeftRight className="w-3 h-3 text-blue-500" />
                            : salida
                              ? <ArrowDownRight className="w-3 h-3 text-rose-500" />
                              : <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
                          <span className={`font-black text-sm ${
                            esTraspaso ? "text-blue-500" : salida ? "text-rose-500" : "text-emerald-500"
                          }`}>
                            {salida ? "-" : "+"}${Math.abs(monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[9px] font-black text-zinc-400">{moneda}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      ))}

      {!loading && hayMas && (
        <div className="flex justify-center">
          <button
            onClick={() => setLimite(l => l + PAGINA)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-300 hover:border-primary/50 hover:text-primary transition-all"
          >
            <ChevronDown className="w-4 h-4" />
            Ver más
          </button>
        </div>
      )}
    </div>
  );
}

function TarjetaResumen({ titulo, valor, icono }: { titulo: string; valor: number; icono: any }) {
  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8 rounded-[2.5rem] relative overflow-hidden group">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 dark:text-zinc-400">{titulo}</p>
        <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl group-hover:scale-110 transition-transform">{icono}</div>
      </div>
      <h2 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50">
        {valor.toLocaleString("es-MX")}
      </h2>
      <p className="text-xs text-zinc-400 mt-1 font-bold uppercase tracking-widest">registros</p>
    </div>
  );
}
