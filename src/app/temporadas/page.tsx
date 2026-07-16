"use client";

import { useEffect, useState } from "react";
import { Leaf, Plus, Play, Square, CalendarDays, Loader2, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export default function TemporadasPage() {
  const { isAdmin } = useAuth();
  const [temporadas, setTemporadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showNewModal, setShowNewModal] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Status Action Modal
  const [actionModal, setActionModal] = useState<{
    type: "iniciar" | "finalizar";
    temporada: any;
  } | null>(null);
  const [actionDate, setActionDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchTemporadas();
  }, []);

  const fetchTemporadas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('temporadas')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) setError(error.message);
    else setTemporadas(data || []);
    setLoading(false);
  };

  const getStatus = (t: any) => {
    if (t.fecha_fin) return { label: "Finalizada", color: "bg-zinc-500 text-white", status: "finalizada" };
    if (t.fecha_inicio) return { label: "Activa", color: "bg-emerald-500 text-white", status: "activa" };
    return { label: "Programada", color: "bg-amber-500 text-white", status: "programada" };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    const { error: insError } = await supabase.from('temporadas').insert([{
      nombre: newNombre,
      descripcion: newDesc
    }]);

    if (insError) {
      setError(insError.message);
    } else {
      setShowNewModal(false);
      setNewNombre("");
      setNewDesc("");
      fetchTemporadas();
    }
    setIsSaving(false);
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;
    setIsSaving(true);
    
    const updates = actionModal.type === 'iniciar' 
        ? { fecha_inicio: actionDate }
        : { fecha_fin: actionDate };

    const { error: updError } = await supabase
        .from('temporadas')
        .update(updates)
        .eq('id', actionModal.temporada.id);

    if (updError) {
        setError(updError.message);
    } else {
        setActionModal(null);
        fetchTemporadas();
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Temporadas</h1>
          <p className="text-zinc-500 mt-1 dark:text-zinc-400">Gestión de periodos de operación y análisis.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-zinc-50 shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
          >
            <Plus className="w-5 h-5" />
            Nueva Temporada
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
           <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {temporadas.map((t, i) => {
                const status = getStatus(t);
                return (
                    <motion.div
                        key={t.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-8 rounded-[2rem] border border-zinc-200 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 relative overflow-hidden group"
                    >
                        <div className={`absolute top-0 left-0 w-full h-1 ${status.color}`}></div>
                        
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-4 rounded-2xl bg-primary/10 text-primary">
                                <Leaf className="w-6 h-6" />
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${status.color}`}>
                                {status.label}
                            </span>
                        </div>
                        
                        <div className="space-y-2">
                            <h3 className="font-black text-2xl text-zinc-900 dark:text-zinc-50 tracking-tight">{t.nombre}</h3>
                            <p className="text-sm text-zinc-500 line-clamp-2">{t.descripcion || 'Sin descripción'}</p>
                        </div>

                        <div className="mt-6 space-y-3 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3 text-sm text-zinc-500">
                                <CalendarDays className="w-4 h-4 text-zinc-400" />
                                <span className="font-medium">Inicio:</span> 
                                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t.fecha_inicio ? new Date(t.fecha_inicio).toLocaleDateString() : 'Pendiente'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-500">
                                <CalendarDays className="w-4 h-4 text-zinc-400" />
                                <span className="font-medium">Fin:</span> 
                                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t.fecha_fin ? new Date(t.fecha_fin).toLocaleDateString() : 'Pendiente'}</span>
                            </div>
                        </div>

                        <div className="mt-8">
                            {!isAdmin && (status.status === 'programada' || status.status === 'activa') && (
                                <p className="text-center text-[10px] font-black uppercase text-zinc-300">Solo lectura</p>
                            )}
                            {isAdmin && status.status === 'programada' && (
                                <button onClick={() => { setActionDate(new Date().toISOString().split('T')[0]); setActionModal({ type: 'iniciar', temporada: t }); }} className="w-full py-3 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white text-sm font-bold transition-all">
                                    <Play className="w-4 h-4" /> Iniciar Temporada
                                </button>
                            )}
                            {isAdmin && status.status === 'activa' && (
                                <button onClick={() => { setActionDate(new Date().toISOString().split('T')[0]); setActionModal({ type: 'finalizar', temporada: t }); }} className="w-full py-3 flex items-center justify-center gap-2 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white text-sm font-bold transition-all">
                                    <Square className="w-4 h-4" /> Finalizar Temporada
                                </button>
                            )}
                            {status.status === 'finalizada' && (
                                <button disabled className="w-full py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-sm font-bold cursor-not-allowed">
                                    Temporada Concluida
                                </button>
                            )}
                        </div>
                    </motion.div>
                );
            })}
        </div>
      )}

      {/* Nuevo Modal */}
      <AnimatePresence>
        {showNewModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2rem] p-8 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black text-zinc-900 dark:text-white">Nueva Temporada</h2>
                        <button onClick={() => setShowNewModal(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                            <X className="w-5 h-5 text-zinc-500" />
                        </button>
                    </div>
                    {error && (
                        <div className="mb-6 p-3 rounded-xl bg-rose-500/10 text-rose-500 text-sm font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="text-xs font-black uppercase text-zinc-500 ml-1">Nombre</label>
                            <input type="text" required value={newNombre} onChange={e => setNewNombre(e.target.value)} className="w-full mt-1 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-primary" placeholder="Ej. Temporada 2026" />
                        </div>
                        <div>
                            <label className="text-xs font-black uppercase text-zinc-500 ml-1">Descripción</label>
                            <textarea rows={3} value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full mt-1 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-primary" placeholder="Opcional..." />
                        </div>
                        <button disabled={isSaving} type="submit" className="w-full mt-4 py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center">
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar Temporada"}
                        </button>
                    </form>
                </motion.div>
            </motion.div>
        )}

        {/* Action Modal */}
        {actionModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[2rem] p-8 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black text-zinc-900 dark:text-white capitalize">{actionModal.type} Temporada</h2>
                        <button onClick={() => setActionModal(null)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                            <X className="w-5 h-5 text-zinc-500" />
                        </button>
                    </div>
                    {error && (
                        <div className="mb-6 p-3 rounded-xl bg-rose-500/10 text-rose-500 text-sm font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}
                    <form onSubmit={handleAction} className="space-y-6">
                        <div>
                            <p className="text-sm text-zinc-500 mb-4">
                                {actionModal.type === 'iniciar' 
                                    ? `Estás a punto de iniciar la "${actionModal.temporada.nombre}". Confirma la fecha de inicio.`
                                    : `Estás a punto de finalizar la "${actionModal.temporada.nombre}". Confirma la fecha de fin.`}
                            </p>
                            <label className="text-xs font-black uppercase text-zinc-500 ml-1">Fecha</label>
                            <input type="date" required value={actionDate} onChange={e => setActionDate(e.target.value)} className="w-full mt-1 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-primary" />
                        </div>
                        <button disabled={isSaving} type="submit" className={`w-full py-3 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center ${actionModal.type === 'iniciar' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Acción"}
                        </button>
                    </form>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
