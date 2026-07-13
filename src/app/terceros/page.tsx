"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Users, Search, Plus, Loader2, X, Tag, Edit2, Check, ChevronDown,
  AlertCircle, BookUser, ArrowUpDown, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

const ARCHIVED_COST_CENTERS = new Set([
  'ACTIVO LOLA',
  'AGRICOLA OBA',
  'AOO',
  'BOSBEA',
  'BOSBSES',
  'CFRV',
  'CRFV',
  'JFV',
  'LACM',
  'LOA',
  'LOLA',
  'LOLA/BOSBES',
  'LOLA/BOSBES/OBA',
  'LOLA/OBA',
  'OBA/BOSBES',
  'OBA/LOLA',
  'PRO',
  'PROCESO',
  'SOCIIO JFV',
  'SOCIO',
  'SOCIO CARLOS',
  'SOCIO JOSE',
  'SOCIO LUIS',
  'SOCIOS CARLOS',
  'NOMINA',
  'TRASPASOS',
  'GASOLINA'
]);

export default function TercerosPage() {
  const [terceros, setTerceros] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCC, setFilterCC] = useState("");
  const [sortBy, setSortBy] = useState<"nombre" | "actividad">("nombre");

  // Movement stats per tercero
  const [stats, setStats] = useState<Record<string, { count: number; total: number }>>({});

  // New tercero modal
  const [showNew, setShowNew] = useState(false);
  const [newRaw, setNewRaw] = useState("");
  const [newCanon, setNewCanon] = useState("");
  const [newCC, setNewCC] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCanon, setEditCanon] = useState("");
  const [editCC, setEditCC] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    const [{ data: t, error: te }, { data: cc }, { data: empRes }, movRes] = await Promise.all([
      supabase.from('terceros').select('*, centros_costo(id, nombre), empresas(id, codigo, nombre_completo)').order('nombre_canonico'),
      supabase.from('centros_costo').select('*').order('nombre'),
      supabase.from('empresas').select('*'),
      supabase.from('movimientos').select('nombre_tercero, monto, tipo')
    ]);
    if (te) { setError(te.message); setLoading(false); return; }
    setTerceros(t || []);
    setCostCenters(cc || []);
    setCompanies(empRes || []);

    // Build stats map
    const statsMap: Record<string, { count: number; total: number }> = {};
    (movRes.data || []).forEach((m: any) => {
      const k = m.nombre_tercero;
      if (!k) return;
      if (!statsMap[k]) statsMap[k] = { count: 0, total: 0 };
      statsMap[k].count++;
      if (m.tipo === 'Egreso') statsMap[k].total += parseFloat(m.monto);
    });
    setStats(statsMap);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let data = terceros;
    if (searchTerm) data = data.filter(t =>
      t.nombre_canonico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.nombre_raw?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filterCC) data = data.filter(t => t.centro_costo_id?.toString() === filterCC);
    if (sortBy === "actividad") {
      data = [...data].sort((a, b) => (stats[b.nombre_raw]?.count || 0) - (stats[a.nombre_raw]?.count || 0));
    }
    return data;
  }, [terceros, searchTerm, filterCC, sortBy, stats]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const { error: insErr } = await supabase.from('terceros').insert([{
      nombre_raw: newRaw, nombre_canonico: newCanon || newRaw,
      centro_costo_id: newCC || null, notas: newNotes || null
    }]);
    if (insErr) setError(insErr.message);
    else { setShowNew(false); setNewRaw(""); setNewCanon(""); setNewCC(""); setNewNotes(""); fetchAll(); }
    setIsSaving(false);
  };

  const handleUpdate = async (id: number) => {
    setIsSaving(true);
    const { error: upErr } = await supabase.from('terceros').update({
      nombre_canonico: editCanon,
      centro_costo_id: editCC || null,
      notas: editNotes || null,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    if (upErr) setError(upErr.message);
    else { setEditingId(null); fetchAll(); }
    setIsSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este tercero del directorio?')) return;
    const { error: delErr } = await supabase.from('terceros').delete().eq('id', id);
    if (delErr) setError(delErr.message);
    else fetchAll();
  };

  // Auto-populate from movements
  const handleAutoPopulate = async () => {
    setLoading(true);
    const { data: movs } = await supabase.from('movimientos').select('nombre_tercero').not('nombre_tercero', 'is', null).neq('nombre_tercero', '');
    if (!movs) { setLoading(false); return; }
    const uniqueNames = [...new Set(movs.map((m: any) => m.nombre_tercero))];
    const existingRaw = new Set(terceros.map(t => t.nombre_raw));
    const toInsert = uniqueNames.filter(n => !existingRaw.has(n));
    if (toInsert.length === 0) { alert('Todos los terceros ya están en el directorio.'); setLoading(false); return; }
    const rows = toInsert.map(n => ({ nombre_raw: n, nombre_canonico: n }));
    const { error: insErr } = await supabase.from('terceros').insert(rows);
    if (insErr) setError(insErr.message);
    else { alert(`✅ ${toInsert.length} terceros agregados del historial de movimientos.`); fetchAll(); }
    setLoading(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh]">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="mt-4 text-zinc-500 font-medium italic">Cargando directorio de terceros...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Directorio de Terceros</h1>
          <p className="text-zinc-500 mt-1 dark:text-zinc-400">Proveedores y beneficiarios normalizados para reportes consistentes.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAutoPopulate}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:border-primary/50 transition-all"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            Auto-poblar del historial
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-zinc-50 shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
          >
            <Plus className="w-5 h-5" />
            Nuevo Tercero
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-bold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Terceros</p>
          <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50 mt-1">{terceros.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Con Centro de Costo</p>
          <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50 mt-1">{terceros.filter(t => t.centro_costo_id).length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sin Clasificar</p>
          <p className="text-3xl font-black text-rose-500 mt-1">{terceros.filter(t => !t.centro_costo_id).length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text" placeholder="Buscar tercero..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-primary/20 transition-all dark:text-zinc-50"
          />
        </div>
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <select
            value={filterCC} onChange={e => setFilterCC(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-zinc-50 appearance-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Todos los Centros</option>
            <option value="__none__">Sin clasificar</option>
            {costCenters.filter(cc => !ARCHIVED_COST_CENTERS.has(cc.nombre.toUpperCase().trim())).map(cc => <option key={cc.id} value={cc.id}>{cc.nombre}</option>)}
          </select>
        </div>
        <button
          onClick={() => setSortBy(s => s === 'nombre' ? 'actividad' : 'nombre')}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-zinc-50 hover:border-primary/30 transition-all"
        >
          <ArrowUpDown className="w-4 h-4 text-primary" />
          {sortBy === 'nombre' ? 'A-Z' : 'Más Activos'}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
              <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Nombre en Banco</th>
              <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Nombre Canónico</th>
              <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Empresa</th>
              <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Centro de Costo</th>
              <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Movimientos</th>
              <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Total Egresos</th>
              <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
            {filtered.map(t => {
              const movStats = stats[t.nombre_raw] || { count: 0, total: 0 };
              const isEditing = editingId === t.id;
              return (
                <tr key={t.id} className={`hover:bg-zinc-50/30 dark:hover:bg-zinc-900/30 transition-colors ${isEditing ? 'bg-primary/[0.02]' : ''}`}>
                  <td className="px-5 py-4">
                    <p className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 max-w-[200px] truncate" title={t.nombre_raw}>{t.nombre_raw}</p>
                  </td>
                  <td className="px-5 py-4">
                    {isEditing ? (
                      <input
                        type="text" value={editCanon} onChange={e => setEditCanon(e.target.value)}
                        className="w-full text-sm font-bold bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-1.5 border-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                        autoFocus
                      />
                    ) : (
                      <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">{t.nombre_canonico}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {t.empresas ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-950 text-zinc-50 w-fit">
                            <span className="text-[9px] font-black">{t.empresas.codigo}</span>
                        </div>
                    ) : (
                        <span className="text-[10px] text-zinc-300 dark:text-zinc-600 italic">Global</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {isEditing ? (
                      <select
                        value={editCC} onChange={e => setEditCC(e.target.value)}
                        className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-1.5 border-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                      >
                        <option value="">Sin clasificar</option>
                        {costCenters.filter(cc => !ARCHIVED_COST_CENTERS.has(cc.nombre.toUpperCase().trim()) || cc.id.toString() === editCC).map(cc => <option key={cc.id} value={cc.id}>{cc.nombre}</option>)}
                      </select>
                    ) : (
                      t.centros_costo ? (
                        <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider">{t.centros_costo.nombre}</span>
                      ) : (
                        <span className="text-[10px] text-zinc-300 dark:text-zinc-600 italic">Sin clasificar</span>
                      )
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-sm font-black text-zinc-700 dark:text-zinc-300">{movStats.count}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-sm font-black text-rose-600">{movStats.total > 0 ? `$${movStats.total.toLocaleString('es-MX', { minimumFractionDigits: 0 })}` : '-'}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {isEditing ? (
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => handleUpdate(t.id)} disabled={isSaving} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => { setEditingId(t.id); setEditCanon(t.nombre_canonico); setEditCC(t.centro_costo_id?.toString() || ''); setEditNotes(t.notas || ''); }}
                          className="p-2 rounded-lg hover:bg-primary/10 text-zinc-400 hover:text-primary transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="p-2 rounded-lg hover:bg-rose-500/10 text-zinc-300 hover:text-rose-500 transition-all">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-16 text-center text-zinc-400 italic">No se encontraron terceros</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Tercero Modal */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2rem] p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">Nuevo Tercero</h2>
                <button onClick={() => setShowNew(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs font-black uppercase text-zinc-500 ml-1">Nombre en banco / raw</label>
                  <input type="text" required value={newRaw} onChange={e => { setNewRaw(e.target.value); if (!newCanon) setNewCanon(e.target.value); }}
                    className="w-full mt-1 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-primary text-sm" placeholder="Ej. OXXO GAS S DE RL DE CV" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-zinc-500 ml-1">Nombre canónico (para reportes)</label>
                  <input type="text" value={newCanon} onChange={e => setNewCanon(e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-primary text-sm" placeholder="Ej. OXXO Gas" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-zinc-500 ml-1">Centro de Costo</label>
                  <select value={newCC} onChange={e => setNewCC(e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-primary text-sm appearance-none">
                    <option value="">Sin clasificar</option>
                    {costCenters.filter(cc => !ARCHIVED_COST_CENTERS.has(cc.nombre.toUpperCase().trim())).map(cc => <option key={cc.id} value={cc.id}>{cc.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-zinc-500 ml-1">Notas</label>
                  <textarea rows={2} value={newNotes} onChange={e => setNewNotes(e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-primary text-sm" placeholder="Opcional..." />
                </div>
                <button disabled={isSaving} type="submit" className="w-full mt-2 py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar Tercero"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
