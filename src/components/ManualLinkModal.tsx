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
  AlertCircle,
  Sparkles
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

    // Advanced search states
    const [dateWindow, setDateWindow] = useState<"7" | "30" | "90" | "365" | "all">("30");
    const [amountTolerance, setAmountTolerance] = useState<"exact" | "approx" | "any">("approx");
    const [currencyMatch, setCurrencyMatch] = useState(true);
    const [showOnlySuggestions, setShowOnlySuggestions] = useState(true);

    async function fetchPotentialMovements() {
        setLoading(true);
        try {
            // Fetch unlinked movements (null or containing the Excel [BANCO: ... ] marker)
            let query = supabase
                .from('movimientos')
                .select('*, cuentas_bancarias(banco, moneda)')
                .or('factura.is.null,factura.ilike.%[BANCO:%');

            if (dateWindow !== 'all') {
                const days = parseInt(dateWindow);
                const invoiceDate = new Date(invoice.fecha_emision);
                const minDate = new Date(invoiceDate);
                minDate.setDate(minDate.getDate() - days);
                const maxDate = new Date(invoiceDate);
                maxDate.setDate(maxDate.getDate() + days);

                query = query
                    .gte('fecha', minDate.toISOString().split('T')[0])
                    .lte('fecha', maxDate.toISOString().split('T')[0]);
            }

            const { data, error } = await query
                .order('fecha', { ascending: false })
                .limit(200);

            if (data) {
                // Calculate scores dynamically
                const scored = data.map(m => {
                    let score = 0;
                    
                    const cleanMonto = m.monto ? m.monto.toString().replace(/,/g, '') : '0';
                    const numMonto = parseFloat(cleanMonto);
                    const invoiceMonto = parseFloat(invoice.monto_total || '0');
                    const diffAmount = Math.abs(numMonto - invoiceMonto);
                    
                    // Amount Match Score
                    if (diffAmount < 0.05) {
                        score += 50;
                    } else if (diffAmount <= 1.00) {
                        score += 45;
                    } else if (invoiceMonto > 0) {
                        if (diffAmount <= invoiceMonto * 0.05) {
                            score += 30;
                        } else if (diffAmount <= invoiceMonto * 0.10) {
                            score += 15;
                        }
                    }

                    // Common corporate & generic stop words in Mexico/Spanish business names
                    const stopWords = new Set([
                        'grupo', 'servicios', 'corporativo', 'mexico', 'comercial', 'comercializadora', 
                        'distribuidora', 'soluciones', 'tecnologia', 'asociados', 'compania', 'cia', 
                        'industrias', 'sapi', 'srl', 'cv', 'sa', 'de', 'rl', 'cooperativa', 'internacional',
                        'nacional', 'operadora', 'administradora', 'consultores', 'consultoria', 'logistica'
                    ]);

                    // Name/Concept Similarity Score
                    const cleanName = (name: string) => name ? name.toLowerCase()
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9 ]/g, '')
                        .split(' ')
                        .filter(w => w.length > 2 && !stopWords.has(w)) : [];
                    
                    const mWords = cleanName(m.nombre_tercero || '');
                    const iWords = cleanName(invoice.emisor_nombre || '');
                    const mConceptWords = cleanName(m.concepto || '');

                    let hasNameMatch = false;
                    if (mWords.length > 0 && iWords.length > 0) {
                        const matches = mWords.filter(w => iWords.some(w2 => w2.includes(w) || w.includes(w2)));
                        if (matches.length > 0) {
                            score += Math.min(30, matches.length * 15);
                            hasNameMatch = true;
                        }
                    }
                    if (!hasNameMatch && mConceptWords.length > 0 && iWords.length > 0) {
                        const matches = mConceptWords.filter(w => iWords.some(w2 => w2.includes(w) || w.includes(w2)));
                        if (matches.length > 0) {
                            score += Math.min(15, matches.length * 7);
                        }
                    }

                    // Date Proximity Score
                    const timeM = m.fecha ? new Date(m.fecha).getTime() : 0;
                    const timeFact = invoice.fecha_emision ? new Date(invoice.fecha_emision).getTime() : 0;
                    if (timeM && timeFact) {
                        const diffDays = Math.abs(timeM - timeFact) / (1000 * 3600 * 24);
                        if (diffDays <= 7) {
                            score += 25;
                        } else if (diffDays <= 15) {
                            score += 15;
                        } else if (diffDays <= 30) {
                            score += (30 - diffDays) * 0.5;
                        }
                    }
                    
                    return { ...m, score, numMonto };
                });
                
                setMovements(scored.sort((a, b) => b.score - a.score));
            }
        } catch (e) {
            console.error("Error loading potential movements:", e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchPotentialMovements();
    }, [invoice, dateWindow]);

    const handleLink = async (moveId: string) => {
        setLinking(moveId);
        try {
            // Find selected movement to extract and preserve Excel's [BANCO: ... ] marker
            const movement = movements.find(m => m.id === moveId);
            const existingField = movement?.factura || '';
            const bancoMatch = existingField.match(/\[BANCO:\s*[\d,.-]+\]/);
            const bancoSuffix = bancoMatch ? ` ${bancoMatch[0]}` : '';
            const label = `${invoice.folio || 'FAC'} - ${invoice.emisor_nombre}${bancoSuffix}`;

            // Build update payload — also enrich nombre_tercero if it's empty or unidentified
            const movUpdatePayload: Record<string, any> = { factura: label };
            const currentName = movement?.nombre_tercero || '';
            if (invoice.emisor_nombre && (!currentName || currentName === 'POR IDENTIFICAR')) {
                movUpdatePayload.nombre_tercero = invoice.emisor_nombre;
            }

            // 1. Update movement
            await supabase
                .from('movimientos')
                .update(movUpdatePayload)
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

    const filteredMovements = movements.filter(m => {
        // 1. Search filter
        const matchesSearch = 
            m.nombre_tercero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.concepto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.monto.toString().includes(searchTerm);
        
        if (!matchesSearch) return false;

        // 2. Currency filter
        const movCurrency = m.cuentas_bancarias?.moneda;
        if (currencyMatch && movCurrency && invoice.moneda && invoice.moneda !== 'XXX') {
            if (movCurrency !== invoice.moneda) return false;
        }

        // 3. Amount tolerance filter
        const invoiceMonto = parseFloat(invoice.monto_total);
        const diffAmount = Math.abs(m.numMonto - invoiceMonto);
        if (amountTolerance === "exact") {
            if (diffAmount > 1.00) return false;
        } else if (amountTolerance === "approx") {
            if (diffAmount > (invoiceMonto * 0.10) && diffAmount > 1.00) return false;
        }

        // 4. Suggestions filter
        if (showOnlySuggestions) {
            if (m.score < 20) return false;
        }

        return true;
    });

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
                                <span className="font-bold">Nota:</span> Al vincular, el movimiento se marcará con el folio de la factura y el estado cambiará a "Vinculada" preservando el saldo bancario.
                            </p>
                        </div>
                    </div>

                    {/* Right: Movement List */}
                    <div className="flex-1 flex flex-col gap-4 min-h-[400px]">
                        <div className="space-y-3">
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

                            {/* Filtros avanzados rápidos */}
                            <div className="flex flex-wrap gap-2 items-center p-2 bg-zinc-50/50 dark:bg-zinc-950/30 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 text-xs">
                                {/* Fecha */}
                                <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-2 mr-1">
                                    <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Fecha:</span>
                                    {(["7", "30", "90", "all"] as const).map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => setDateWindow(opt)}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                                dateWindow === opt
                                                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                            }`}
                                        >
                                            {opt === "all" ? "Todo" : `±${opt}d`}
                                        </button>
                                    ))}
                                </div>

                                {/* Tolerancia de monto */}
                                <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-2 mr-1">
                                    <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Monto:</span>
                                    <button
                                        onClick={() => setAmountTolerance(prev => prev === "exact" ? "approx" : prev === "approx" ? "any" : "exact")}
                                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                                    >
                                        {amountTolerance === "exact" ? "Exacto (±$1)" : amountTolerance === "approx" ? "Aprox. (±10%)" : "Cualquiera"}
                                    </button>
                                </div>

                                {/* Moneda */}
                                <button
                                    onClick={() => setCurrencyMatch(!currencyMatch)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${
                                        currencyMatch
                                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                            : "text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border border-transparent"
                                    }`}
                                >
                                    <span>Moneda: {invoice.moneda === 'XXX' ? 'Cualquiera' : invoice.moneda}</span>
                                </button>

                                {/* Solo sugerencias */}
                                <button
                                    onClick={() => setShowOnlySuggestions(!showOnlySuggestions)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ml-auto flex items-center gap-1 ${
                                        showOnlySuggestions
                                            ? "bg-blue-500 text-white shadow-sm shadow-blue-500/15"
                                            : "text-zinc-500 bg-zinc-100 dark:bg-zinc-800"
                                    }`}
                                >
                                    <Sparkles className="w-3 h-3" />
                                    <span>Sugerencias IA</span>
                                </button>
                            </div>
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
                                    {showOnlySuggestions && (
                                        <button 
                                            onClick={() => setShowOnlySuggestions(false)}
                                            className="mt-2 text-xs text-blue-500 font-bold hover:underline"
                                        >
                                            Desactivar filtro "Sugerencias IA" para ver todos
                                        </button>
                                    )}
                                </div>
                            ) : (
                                filteredMovements.map((move) => (
                                    <div 
                                        key={move.id}
                                        className={`group p-4 rounded-[2rem] bg-white dark:bg-zinc-950 border transition-all flex items-center justify-between relative overflow-hidden
                                            ${move.score >= 50 ? 'border-blue-500/50 shadow-md shadow-blue-500/10 hover:border-blue-500' : 'border-zinc-100 dark:border-zinc-800 hover:border-primary/30 hover:shadow-lg'}
                                        `}
                                    >
                                        {move.score >= 50 && (
                                            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[8px] font-black uppercase px-3 py-1 rounded-bl-xl">
                                                💡 Sugerencia del Sistema
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-[10px] font-black text-zinc-400">
                                                {move.score > 50 ? '🔥' : '💰'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-black text-zinc-900 dark:text-zinc-50 uppercase truncate max-w-[200px]">
                                                        {move.nombre_tercero || "Sin Nombre"}
                                                    </p>
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
                                                onClick={() => handleLink(move.id)}
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
