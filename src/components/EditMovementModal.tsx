"use client";

import { useState } from "react";
import { X, Save, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

interface EditMovementModalProps {
  movement: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditMovementModal({ movement, onClose, onSuccess }: EditMovementModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fecha: movement.fecha || "",
    tipo: movement.tipo || "Egreso",
    monto: Math.abs(parseFloat(movement.monto)).toString(),
    saldoo: movement.saldoo !== null && movement.saldoo !== undefined ? movement.saldoo.toString() : "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const parsedMonto = parseFloat(formData.monto);
      if (isNaN(parsedMonto) || parsedMonto <= 0) {
        throw new Error("El monto debe ser mayor a 0");
      }

      const parsedSaldoo = formData.saldoo !== "" ? parseFloat(formData.saldoo) : null;
      if (formData.saldoo !== "" && isNaN(parsedSaldoo as number)) {
         throw new Error("El saldo debe ser numérico");
      }

      // Convert monto depending on tipo
      let finalMonto = parsedMonto;
      if (formData.tipo === 'Egreso') {
          finalMonto = -Math.abs(parsedMonto);
      } else if (formData.tipo === 'Ingreso') {
          finalMonto = Math.abs(parsedMonto);
      }

      const updates = {
        fecha: formData.fecha,
        tipo: formData.tipo,
        monto: finalMonto,
        saldoo: parsedSaldoo,
      };

      const { error: updateError } = await supabase
        .from('movimientos')
        .update(updates)
        .eq('id', movement.id);

      if (updateError) throw updateError;

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al actualizar el movimiento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div>
              <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                Editar Movimiento
              </h2>
              <p className="text-xs font-medium text-zinc-500 mt-0.5">
                Modificar detalles financieros
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
                  {error}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Fecha
                </label>
                <input
                  type="date"
                  required
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm font-medium transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Tipo
                </label>
                <select
                  required
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm font-medium transition-all cursor-pointer"
                >
                  <option value="Ingreso">Ingreso</option>
                  <option value="Egreso">Egreso</option>
                  <option value="Traspaso">Traspaso</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Monto ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.monto}
                  onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm font-medium transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Saldo Registrado ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.saldoo}
                  onChange={(e) => setFormData({ ...formData, saldoo: e.target.value })}
                  placeholder="Dejar vacío para auto"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm font-medium transition-all"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-900">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 text-sm font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Guardar Cambios
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
