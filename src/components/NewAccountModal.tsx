"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Building2, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function NewAccountModal({ isOpen, onClose, onSaved, empresas }: { isOpen: boolean, onClose: () => void, onSaved: () => void, empresas: any[] }) {
  const [banco, setBanco] = useState("");
  const [moneda, setMoneda] = useState("MXN");
  const [descripcion, setDescripcion] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!banco || !empresaId) return toast.error("El banco y la empresa son obligatorios");
    
    setSaving(true);
    const { error } = await supabase.from('cuentas_bancarias').insert({
      banco: banco.trim().toUpperCase(),
      moneda,
      descripcion: descripcion.trim(),
      empresa_id: parseInt(empresaId)
    });

    setSaving(false);
    if (error) {
      toast.error("Error al crear cuenta: " + error.message);
    } else {
      toast.success("Cuenta creada con éxito");
      onSaved();
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md overflow-hidden bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800/50">
            <div>
              <h2 className="text-xl font-black text-zinc-900 dark:text-white">Nueva Cuenta</h2>
              <p className="text-sm font-medium text-zinc-500">Registra un nuevo banco o caja chica</p>
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Empresa</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <select
                    value={empresaId}
                    onChange={(e) => setEmpresaId(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white appearance-none"
                    required
                  >
                    <option value="">Selecciona una empresa...</option>
                    {empresas.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.codigo} - {e.nombre_completo}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Banco</label>
                  <input
                    type="text"
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    placeholder="Ej. BBVA, CAJA CHICA"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Moneda</label>
                  <select
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white appearance-none"
                  >
                    <option value="MXN">MXN - Pesos</option>
                    <option value="USD">USD - Dólares</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Descripción / Uso</label>
                <input
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Reembolsos Juan, Gastos Gdl..."
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors flex justify-center items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {saving ? (
                  <span className="animate-pulse">Guardando...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Crear Cuenta
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
