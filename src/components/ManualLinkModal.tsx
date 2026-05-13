"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  Search, 
  Check, 
  Calendar, 
  DollarSign, 
  User,
  Info,
  Loader2,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ManualLinkModalProps {
    invoice: any;
    onClose: () => void;
    onSuccess: () => void;
}

export function ManualLinkModal({ invoice, onClose, onSuccess }: ManualLinkModalProps) {
    const [loading, setLoading] = useState(true);
    const [movements, setMovements] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [linking, setLinking] = useState<string | null>(null);

    async function fetchPotentialMovements() {
        setLoading(true);
        // Search for movements with similar amount or similar name
        const { data, error } = await supabase
            .from('movimientos')
            .select('*, cuentas_bancarias(banco, moneda)')
            .is('factura', null) // Only unlinked
            .order('fecha', { ascending: false })
            .limit(100);

        if (data) {
            // Sort by "Potential Score"
            const scored = data.map(m => {
                let score = 0;
                // Perfect amount match
                if (Math.abs(parseFloat(m.monto) - parseFloat(invoice.monto_total)) < 0.05) score += 50;
                // Name similarity
                if (m.nombre_tercero?.toLowerCase().includes(invoice.emisor_nombre.toLowerCase().split(' ')[0])) score += 30;
                if (invoice.emisor_nombre.toLowerCase().includes(m.nombre_tercero?.toLowerCase().split(' ')[0])) score += 30;
                // Date proximity (within 30 days)
                const diffDays = Math.abs(new Date(m.fecha).getTime() - new Date(invoice.fecha_emision).getTime()) / (1000 * 3600 * 24);
                if (diffDays <= 30) score += (30 - diffDays);
                
                return { ...m, score };
            });
            
            setMovements(scored.sort((a, b) => b.score - a.score));
        }
        setLoading(false);
    }

    useEffect(() => {
        fetchPotentialMovements();
    }, [invoice]);

    const handleLink = async (moveId: string, moveLabel: string) => {
        setLinking(moveId);
        try {
            // 1. Update movement
            const label = `${invoice.folio || 'FAC'} - ${invoice.emisor_nombre}`;
            await supabase
                .from('movimientos')
                .update({ factura: label })
                .eq('id', moveId);

            // 2. Update invoice
            await supabase
                .from('facturas')
                .update({ 
                    movimiento_id: moveId, 
                    estado: 'VINCULADA' 
                })
                .eq('id', invoice.id);

            onSuccess();
            onClose();
        } catch (e) {
            alert("Error al vincular");
        } finally {
            setLinking(null);
        }
    };

    const filteredMovements = movements.filter(m => 
        m.nombre_tercero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.concepto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.monto.toString().includes(searchTerm)
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
                    <div>
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
                            Vincular Factura Manualmente
                        </h2>
                        <p className="text-zinc-500 text-sm font-medium mt-1">Busca el movimiento bancario que corresponde a este comprobante.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                        <X className="w-6 h-6 text-zinc-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 flex flex-col md:flex-row gap-8">
                    {/* Left: Invoice Summary */}
                    <div className="w-full md:w-80 space-y-6">
                        <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">Datos de la Factura</h4>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <User className="w-4 h-4 text-zinc-400 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-black text-zinc-400 uppercase">Emisor</p>
                                        <p className="text-xs font-black text-zinc-900 dark:text-zinc-50 uppercase">{invoice.emisor_nombre}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <DollarSign className="w-4 h-4 text-zinc-400 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-black text-zinc-400 uppercase">Monto Total</p>
                                        <p className="text-lg font-black text-primary">${parseFloat(invoice.monto_total).toLocaleString()} <span className="text-[10px]">{invoice.moneda}</span></p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Calendar className="w-4 h-4 text-zinc-400 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-black text-zinc-400 uppercase">Fecha Emisión</p>
                                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                            {format(new Date(invoice.fecha_emision), "dd 'de' MMMM, yyyy", { locale: es })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 pt-2">
                                    <Info className="w-4 h-4 text-zinc-400 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-black text-zinc-400 uppercase">Folio / UUID</p>
                                        <p className="text-[10px] font-mono text-zinc-500 break-all">{invoice.folio || invoice.uuid_sat}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                                <span className="font-bold">Nota:</span> Al vincular, el movimiento se marcará con el folio de la factura y el estado cambiará a "Vinculada".
                            </p>
                        </div>
                    </div>

                    {/* Right: Movement List */}
                    <div className="flex-1 flex flex-col gap-4 min-h-[400px]">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input 
                                type="text"
                                placeholder="Buscar movimientos por nombre, concepto o monto..."
                                className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                    <p className="mt-4 text-xs font-medium text-zinc-400 italic">Buscando candidatos...</p>
                                </div>
                            ) : filteredMovements.length === 0 ? (
                                <div className="text-center py-20">
                                    <p className="text-zinc-400 text-sm font-medium">No se encontraron movimientos disponibles.</p>
                                </div>
                            ) : (
                                filteredMovements.map((move) => (
                                    <div 
                                        key={move.id}
                                        className="group p-4 rounded-[2rem] bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 hover:border-primary/30 hover:shadow-lg transition-all flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-[10px] font-black text-zinc-400">
                                                {move.score > 50 ? '🔥' : '💰'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-black text-zinc-900 dark:text-zinc-50 uppercase truncate max-w-[200px]">
                                                        {move.nombre_tercero || "Sin Nombre"}
                                                    </p>
                                                    {move.score > 70 && (
                                                        <span className="text-[8px] font-black uppercase bg-emerald-500 text-white px-1.5 py-0.5 rounded">Alta Probabilidad</span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-zinc-400 font-medium truncate max-w-[250px]">{move.concepto}</p>
                                                <div className="flex items-center gap-3 mt-1 text-[9px] font-bold uppercase tracking-widest">
                                                    <span className="text-zinc-500">{move.fecha}</span>
                                                    <span className="text-zinc-300">•</span>
                                                    <span className="text-primary">{move.cuentas_bancarias?.banco}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                                                ${parseFloat(move.monto).toLocaleString()}
                                                <span className="text-[10px] ml-1 text-zinc-400">{move.cuentas_bancarias?.moneda}</span>
                                            </p>
                                            <button 
                                                onClick={() => handleLink(move.id, move.nombre_tercero)}
                                                disabled={linking === move.id}
                                                className="p-3 rounded-2xl bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                {linking === move.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
