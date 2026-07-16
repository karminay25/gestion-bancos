"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  FileText, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Link as LinkIcon,
  Eye,
  Unlink,
  Building2,
  Copy,
  Check,
  X,
  FileCode,
  AlertTriangle,
  RotateCcw
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ManualLinkModal } from "@/components/ManualLinkModal";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const safeFormatDate = (dateStr: string, formatPattern: string, options?: any) => {
    try {
        if (!dateStr) return "Sin fecha";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "Fecha inválida";
        return format(date, formatPattern, options);
    } catch (e) {
        return "Fecha inválida";
    }
};

export default function FacturasPage() {
    const { isAdmin } = useAuth();
    const [loading, setLoading] = useState(true);
    const [facturas, setFacturas] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
    const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
    const [copiedUuid, setCopiedUuid] = useState(false);
    const [showPdf, setShowPdf] = useState(false);
    
    const ITEMS_PER_PAGE = 20;

    async function fetchFacturas() {
        setLoading(true);
        let allFacturas: any[] = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('facturas')
                .select('*, movimientos(fecha, nombre_tercero, monto, concepto, factura)')
                .order('fecha_emision', { ascending: false })
                .range(from, to);
            
            if (error || !data || data.length === 0) {
                hasMore = false;
            } else {
                allFacturas = [...allFacturas, ...data];
                if (data.length < 1000) {
                    hasMore = false;
                } else {
                    from += 1000;
                    to += 1000;
                }
            }
        }

        setFacturas(allFacturas);
        setLoading(false);
    }

    useEffect(() => {
        fetchFacturas();
    }, []);

    // Sync detail view with updated facturas array to ensure real-time status updates in drawer
    useEffect(() => {
        if (detailInvoice) {
            const updated = facturas.find(f => f.id === detailInvoice.id);
            if (updated && updated !== detailInvoice) {
                setDetailInvoice(updated);
            }
        }
    }, [facturas, detailInvoice]);

    // Dynamic Counts for each state
    const counts = useMemo(() => {
        return {
            all: facturas.length,
            pendiente: facturas.filter(f => f.estado === 'PENDIENTE_VINCULO').length,
            sugerencias: facturas.filter(f => f.estado === 'CON_SUGERENCIAS').length,
            vinculada: facturas.filter(f => f.estado === 'VINCULADA').length,
            descartada: facturas.filter(f => f.estado === 'DESCARTADA').length,
        };
    }, [facturas]);

    const filteredFacturas = facturas.filter(f => {
        const matchesSearch = 
            f.emisor_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.uuid_sat?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.folio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.emisor_rfc?.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Map status filter
        let matchesStatus = false;
        if (statusFilter === "all") {
            // By default hide discarded invoices in "All" tab to keep it clean, unless they select "Descartadas"
            matchesStatus = f.estado !== 'DESCARTADA';
        } else {
            matchesStatus = f.estado === statusFilter;
        }
        
        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filteredFacturas.length / ITEMS_PER_PAGE);
    const paginatedFacturas = filteredFacturas.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/invoices/sync', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                const sync = data.sync || {};
                const matched = data.matches?.matched ?? 0;
                const suggested = data.matches?.suggested ?? 0;

                const lines = [
                    `✅ Sincronización completada`,
                    ``,
                    `📧 Correos revisados: ${sync.emailsScanned ?? '—'}`,
                    `📎 Archivos XML encontrados: ${sync.xmlsFound ?? '—'}`,
                    sync.newSaved > 0
                        ? `🆕 Facturas nuevas guardadas: ${sync.newSaved}`
                        : `✔️  Facturas ya estaban en el sistema: ${sync.alreadyInDB ?? 0}`,
                    ``,
                    matched > 0 ? `🔗 Vinculadas automáticamente: ${matched}` : null,
                    suggested > 0 ? `💡 Con sugerencias para revisar: ${suggested}` : null,
                    matched === 0 && suggested === 0 ? `ℹ️  No se encontraron nuevas coincidencias con movimientos` : null,
                ].filter(Boolean).join('\n');

                alert(lines);
                fetchFacturas();
            } else {
                alert('❌ Error en sincronización:\n' + (data.error || 'Error desconocido'));
            }
        } catch (e: any) {
            alert('❌ Error de red: ' + e.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleUnlink = async (invoice: any) => {
        if (!confirm("¿Estás seguro de que deseas desvincular esta factura del movimiento bancario?")) return;
        
        try {
            const moveId = invoice.movimiento_id;
            
            if (moveId) {
                // Fetch movement to extract and preserve Excel's [BANCO: ... ] marker
                const { data: movement } = await supabase
                    .from('movimientos')
                    .select('factura')
                    .eq('id', moveId)
                    .maybeSingle();
                
                let newFacturaLabel: string | null = null;
                if (movement && movement.factura) {
                    const bancoMatch = movement.factura.match(/\[BANCO:\s*[\d,.-]+\]/);
                    if (bancoMatch) {
                        newFacturaLabel = bancoMatch[0]; // Preserve bank balance only
                    }
                }
                
                // Update movement
                await supabase
                    .from('movimientos')
                    .update({ factura: newFacturaLabel })
                    .eq('id', moveId);
            }
            
            // Update invoice
            await supabase
                .from('facturas')
                .update({ 
                    movimiento_id: null, 
                    estado: 'PENDIENTE_VINCULO' 
                })
                .eq('id', invoice.id);
            
            alert("✅ Factura desvinculada exitosamente.");
            setDetailInvoice(null);
            fetchFacturas();
        } catch (e: any) {
            alert("❌ Error al desvincular: " + e.message);
        }
    };

    const handleMarkAsDiscarded = async (invoice: any) => {
        try {
            await supabase
                .from('facturas')
                .update({ estado: 'DESCARTADA' })
                .eq('id', invoice.id);
            alert("✅ Factura marcada como excluida/descartada.");
            setDetailInvoice(null);
            fetchFacturas();
        } catch (e: any) {
            alert("❌ Error al descartar factura: " + e.message);
        }
    };

    const handleRestoreInvoice = async (invoice: any) => {
        try {
            await supabase
                .from('facturas')
                .update({ estado: 'PENDIENTE_VINCULO' })
                .eq('id', invoice.id);
            alert("✅ Factura restaurada a estado pendiente.");
            setDetailInvoice(null);
            fetchFacturas();
        } catch (e: any) {
            alert("❌ Error al restaurar factura: " + e.message);
        }
    };

    const handleCopyUuid = (uuid: string) => {
        navigator.clipboard.writeText(uuid);
        setCopiedUuid(true);
        setTimeout(() => setCopiedUuid(false), 2000);
    };

    // Helper for highlighting text matches
    const highlightMatch = (text: string, query: string) => {
        if (!query || !text) return text;
        const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) => 
                    part.toLowerCase() === query.toLowerCase() 
                        ? <mark key={i} className="bg-amber-100 text-amber-900 px-0.5 rounded dark:bg-amber-500/30 dark:text-amber-100 font-medium">{part}</mark>
                        : part
                )}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse pb-20">
                {/* Skeleton Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                        <div className="h-10 w-64 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
                        <div className="h-4 w-96 bg-zinc-100 dark:bg-zinc-900 rounded-lg" />
                    </div>
                    <div className="h-14 w-44 bg-zinc-200 dark:bg-emerald-950/40 rounded-2xl" />
                </div>
                {/* Skeleton Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-850 p-6 flex items-center gap-4">
                            <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
                            <div className="space-y-2 flex-1">
                                <div className="h-3 w-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                <div className="h-6 w-10 bg-zinc-200 dark:bg-zinc-700 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
                {/* Skeleton Filters */}
                <div className="h-16 bg-zinc-100 dark:bg-zinc-900/60 rounded-3xl" />
                {/* Skeleton Table */}
                <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-900 overflow-hidden shadow-sm p-6 space-y-4">
                    <div className="h-8 bg-zinc-100 dark:bg-zinc-900 rounded-lg w-full" />
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-12 bg-zinc-100 dark:bg-zinc-900/50 rounded-lg w-full" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Facturas Recibidas</h1>
                    <p className="text-zinc-500 mt-1 dark:text-zinc-300 font-medium italic">Archivo digital de comprobantes fiscales (XML) sincronizados desde el correo.</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className={`flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black text-zinc-50 shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 ${isSyncing ? "cursor-not-allowed" : ""}`}
                    >
                        <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Sincronizando..." : "Sincronizar Ahora"}
                    </button>
                )}
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center gap-5">
                    <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-400">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-zinc-300 dark:text-zinc-400 tracking-widest">Total Sincronizadas</p>
                        <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{facturas.length}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center gap-5">
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Vinculadas</p>
                        <p className="text-2xl font-black text-emerald-600">{counts.vinculada}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center gap-5">
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-500">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Pendientes</p>
                        <p className="text-2xl font-black text-amber-600">{counts.pendiente + counts.sugerencias}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center gap-5">
                    <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500">
                        <X className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Excluidas / Descartadas</p>
                        <p className="text-2xl font-black text-zinc-300 dark:text-zinc-400 dark:text-zinc-300 dark:text-zinc-400">{counts.descartada}</p>
                    </div>
                </div>
            </div>

            {/* State Pills Filter & Search */}
            <div className="flex flex-col gap-4">
                <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none border-b border-zinc-100 dark:border-zinc-900">
                    {[
                        { id: "all", label: "Todas", count: counts.all - counts.descartada, color: "zinc" },
                        { id: "PENDIENTE_VINCULO", label: "Pendientes", count: counts.pendiente, color: "amber" },
                        { id: "CON_SUGERENCIAS", label: "Con Sugerencias", count: counts.sugerencias, color: "blue" },
                        { id: "VINCULADA", label: "Vinculadas", count: counts.vinculada, color: "emerald" },
                        { id: "DESCARTADA", label: "Descartadas", count: counts.descartada, color: "red" }
                    ].map(tab => {
                        const isActive = statusFilter === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setStatusFilter(tab.id);
                                    setCurrentPage(1);
                                }}
                                className={`relative px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap border
                                    ${isActive 
                                        ? tab.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-sm'
                                        : tab.color === 'amber' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-sm'
                                        : tab.color === 'blue' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 shadow-sm'
                                        : tab.color === 'red' ? 'bg-red-500/10 text-red-600 border-red-500/20 shadow-sm'
                                        : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent shadow-sm'
                                        : 'bg-white dark:bg-zinc-950 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border-zinc-100 dark:border-zinc-900'
                                    }
                                `}
                            >
                                <span>{tab.label}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold 
                                    ${isActive
                                        ? tab.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-700'
                                        : tab.color === 'amber' ? 'bg-amber-500/20 text-amber-700'
                                        : tab.color === 'blue' ? 'bg-blue-500/20 text-blue-700'
                                        : tab.color === 'red' ? 'bg-red-500/20 text-red-700'
                                        : 'bg-zinc-700 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800'
                                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-300 dark:text-zinc-400 dark:text-zinc-500'
                                    }
                                `}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 dark:text-zinc-400" />
                    <input 
                        type="text"
                        placeholder="Buscar por RFC, emisor, folio o UUID..."
                        className="w-full pl-10 pr-10 py-4 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-300 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-900 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 shadow-sm transition-all"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm("")} 
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 bg-zinc-100 dark:bg-zinc-900 text-zinc-300 dark:text-zinc-400 hover:text-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full text-xs"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-900 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-zinc-100/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-900">
                                <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-300 dark:text-zinc-400">Fecha Emisión</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-300 dark:text-zinc-400">Emisor</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-300 dark:text-zinc-400 text-right">Monto</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-300 dark:text-zinc-400 text-center">Estado</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-300 dark:text-zinc-400">Vínculo Bancario</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-300 dark:text-zinc-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                            {paginatedFacturas.map((factura) => (
                                <tr 
                                    key={factura.id} 
                                    onClick={() => setDetailInvoice(factura)}
                                    className="hover:bg-zinc-100/40 dark:hover:bg-zinc-900/20 transition-colors cursor-pointer"
                                >
                                    <td className="px-6 py-5">
                                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50">
                                            {safeFormatDate(factura.fecha_emision, "dd 'de' MMMM", { locale: es })}
                                        </p>
                                        <p className="text-[10px] text-zinc-300 dark:text-zinc-400 font-medium">{safeFormatDate(factura.fecha_emision, "yyyy")}</p>
                                    </td>
                                    <td className="px-6 py-5">
                                        <p className="text-xs font-black text-zinc-900 dark:text-zinc-50 uppercase">
                                            {highlightMatch(factura.emisor_nombre, searchTerm)}
                                        </p>
                                        <p className="text-[10px] text-zinc-300 dark:text-zinc-400 font-mono flex gap-2">
                                            <span>{highlightMatch(factura.emisor_rfc, searchTerm)}</span>
                                            {factura.folio && (
                                                <>
                                                    <span className="text-zinc-300">•</span>
                                                    <span className="font-bold text-zinc-500">Folio: {highlightMatch(factura.folio, searchTerm)}</span>
                                                </>
                                            )}
                                        </p>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">${parseFloat(factura.monto_total).toLocaleString()}</p>
                                        <p className="text-[9px] font-bold text-zinc-300 dark:text-zinc-400 uppercase tracking-tighter">{factura.moneda}</p>
                                    </td>
                                    <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                                        {factura.estado === 'VINCULADA' ? (
                                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">Vinculada</span>
                                        ) : factura.estado === 'CON_SUGERENCIAS' ? (
                                            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-[9px] font-black uppercase tracking-widest border border-blue-500/20">Sugerencias</span>
                                        ) : factura.estado === 'DESCARTADA' ? (
                                            <span className="px-3 py-1 rounded-full bg-zinc-1000/10 text-zinc-300 dark:text-zinc-400 text-[9px] font-black uppercase tracking-widest border border-zinc-500/20">Excluida</span>
                                        ) : (factura.moneda === 'XXX' || factura.monto_total === 0) ? (
                                            <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 text-[9px] font-black uppercase tracking-widest border border-purple-500/20">Comp. Pago</span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">Pendiente</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-5">
                                        {factura.estado === 'VINCULADA' && factura.movimientos ? (
                                            <div className="flex flex-col gap-0.5">
                                                <p className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 uppercase truncate max-w-[200px]">
                                                    {factura.movimientos.nombre_tercero || factura.movimientos.concepto || '—'}
                                                </p>
                                                <p className="text-[9px] text-emerald-500 font-bold">Vinculado · {factura.movimientos.fecha}</p>
                                            </div>
                                        ) : factura.estado === 'CON_SUGERENCIAS' ? (
                                            <p className="text-[10px] text-blue-500 italic font-medium">Revisar candidatos manualmente</p>
                                        ) : factura.estado === 'DESCARTADA' ? (
                                            <p className="text-[10px] text-zinc-300 dark:text-zinc-400 italic font-medium">Descartada de conciliación</p>
                                        ) : (factura.moneda === 'XXX' || factura.monto_total === 0) ? (
                                            <p className="text-[10px] text-purple-400 italic font-medium">Complemento de pago (sin monto)</p>
                                        ) : (
                                            <p className="text-[10px] text-zinc-300 dark:text-zinc-400 italic font-medium">Sin movimiento detectado</p>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-2">
                                            {!isAdmin ? null : factura.estado !== 'VINCULADA' && factura.estado !== 'DESCARTADA' ? (
                                                <button 
                                                    onClick={() => setSelectedInvoice(factura)}
                                                    className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider
                                                        ${factura.estado === 'CON_SUGERENCIAS' 
                                                        ? 'bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white' 
                                                        : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90'
                                                    }`}
                                                >
                                                    <LinkIcon className="w-3.5 h-3.5" />
                                                    {factura.estado === 'CON_SUGERENCIAS' ? 'Revisar' : 'Vincular'}
                                                </button>
                                            ) : factura.estado === 'VINCULADA' ? (
                                                <button 
                                                    onClick={() => handleUnlink(factura)}
                                                    className="p-2 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-600 hover:text-white transition-all flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider"
                                                >
                                                    <Unlink className="w-3.5 h-3.5" />
                                                    Desvincular
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => handleRestoreInvoice(factura)}
                                                    className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-300 dark:text-zinc-400 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                    Restaurar
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => setDetailInvoice(factura)}
                                                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-300 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredFacturas.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-20">
                                        <AlertTriangle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                                        <p className="text-zinc-300 dark:text-zinc-400 text-sm font-medium">No se encontraron facturas con los filtros seleccionados.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-5 bg-zinc-100/30 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase text-zinc-300 dark:text-zinc-400 tracking-widest">
                            Mostrando {paginatedFacturas.length} de {filteredFacturas.length} facturas
                        </p>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-900 text-zinc-300 dark:text-zinc-400 disabled:opacity-30"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-[11px] font-black">{currentPage} / {totalPages}</span>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-900 text-zinc-300 dark:text-zinc-400 disabled:opacity-30"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Manual Link Modal */}
            {selectedInvoice && (
                <ManualLinkModal 
                    invoice={selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                    onSuccess={() => fetchFacturas()}
                />
            )}

            {/* Sliding Drawer for Invoice Detail */}
            <AnimatePresence>
                {detailInvoice && (
                    <>
                        {/* Backdrop */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setDetailInvoice(null)}
                            className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-xs"
                        />
                        {/* Drawer Panel */}
                        <motion.div 
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl p-8 overflow-y-auto flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-800">
                                <div>
                                    <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50">Detalle de Factura</h2>
                                    <p className="text-zinc-300 dark:text-zinc-400 text-xs font-mono break-all mt-1">{detailInvoice.uuid_sat}</p>
                                </div>
                                <button 
                                    onClick={() => setDetailInvoice(null)}
                                    className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-300 dark:text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 py-8 space-y-6">
                                {/* Amount section */}
                                <div className="text-center p-6 rounded-3xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900">
                                    <p className="text-xs font-black uppercase text-zinc-300 dark:text-zinc-400 tracking-wider">Monto Total del XML</p>
                                    <p className="text-4xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
                                        ${parseFloat(detailInvoice.monto_total).toLocaleString()}
                                        <span className="text-sm font-bold text-zinc-300 dark:text-zinc-400 ml-1.5 uppercase">{detailInvoice.moneda}</span>
                                    </p>
                                    <div className="mt-3 inline-block">
                                        {detailInvoice.estado === 'VINCULADA' ? (
                                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">Vinculada</span>
                                        ) : detailInvoice.estado === 'CON_SUGERENCIAS' ? (
                                            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-[9px] font-black uppercase tracking-widest border border-blue-500/20">Con Sugerencias</span>
                                        ) : detailInvoice.estado === 'DESCARTADA' ? (
                                            <span className="px-3 py-1 rounded-full bg-zinc-1000/10 text-zinc-300 dark:text-zinc-400 text-[9px] font-black uppercase tracking-widest border border-zinc-500/20">Excluida</span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">Pendiente de Vínculo</span>
                                        )}
                                    </div>
                                </div>

                                {/* Emisor & Receptor Cards */}
                                <div className="space-y-3">
                                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 flex items-start gap-3.5 shadow-xs">
                                        <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-950 text-zinc-300 dark:text-zinc-400">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-zinc-300 dark:text-zinc-400 uppercase tracking-wide">Emisor / Proveedor</p>
                                            <p className="text-sm font-black text-zinc-900 dark:text-zinc-50 uppercase mt-0.5">{detailInvoice.emisor_nombre}</p>
                                            <p className="text-xs text-zinc-500 font-mono mt-0.5">{detailInvoice.emisor_rfc}</p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 flex items-start gap-3.5 shadow-xs">
                                        <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-950 text-zinc-300 dark:text-zinc-400">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-zinc-300 dark:text-zinc-400 uppercase tracking-wide">Receptor / Empresa</p>
                                            <p className="text-xs text-zinc-500 font-mono mt-0.5">{detailInvoice.receptor_rfc}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* General Details */}
                                <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                    <h3 className="text-xs font-black uppercase text-zinc-300 dark:text-zinc-400 tracking-wider">Datos Fiscales</h3>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <p className="text-zinc-300 dark:text-zinc-400">Fecha Emisión</p>
                                            <p className="font-bold text-zinc-800 dark:text-zinc-200 mt-1">
                                                {safeFormatDate(detailInvoice.fecha_emision, "dd 'de' MMMM, yyyy", { locale: es })}
                                            </p>
                                        </div>
                                        {detailInvoice.folio && (
                                            <div>
                                                <p className="text-zinc-300 dark:text-zinc-400">Folio</p>
                                                <p className="font-bold text-zinc-800 dark:text-zinc-200 mt-1">{detailInvoice.folio}</p>
                                            </div>
                                        )}
                                        <div className="col-span-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-zinc-300 dark:text-zinc-400">UUID SAT</p>
                                                <button 
                                                    onClick={() => handleCopyUuid(detailInvoice.uuid_sat)}
                                                    className="text-primary hover:underline flex items-center gap-1 text-[10px] font-bold"
                                                >
                                                    {copiedUuid ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                    {copiedUuid ? 'Copiado' : 'Copiar UUID'}
                                                </button>
                                            </div>
                                            <p className="font-mono text-zinc-300 dark:text-zinc-400 dark:text-zinc-450 bg-zinc-100 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-900 mt-1 select-all">{detailInvoice.uuid_sat}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-zinc-300 dark:text-zinc-400">Archivo XML Sincronizado</p>
                                            <div className="flex items-center gap-2 mt-1.5 text-zinc-300 dark:text-zinc-400 dark:text-zinc-300 dark:text-zinc-400">
                                                <FileCode className="w-4 h-4 text-primary" />
                                                <span className="font-mono text-[11px] truncate max-w-[280px]">{detailInvoice.archivo_xml}</span>
                                            </div>
                                            <button onClick={() => window.open(`/api/facturas/${detailInvoice.uuid_sat}/pdf`, '_blank')} className="mt-2 px-3 py-1 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors">
                                                Ver PDF
                                            </button>
                                            {showPdf && (
                                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
                                                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
                                                    <div className="flex justify-between items-center mb-2">
                                                      <h3 className="text-lg font-bold">PDF del Archivo</h3>
                                                      <button onClick={() => setShowPdf(false)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">✕</button>
                                                    </div>
                                                    <iframe src={detailInvoice.archivo_xml} className="w-full h-[80vh]" />
                                                  </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Bank linkage details */}
                                <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                                    <h3 className="text-xs font-black uppercase text-zinc-300 dark:text-zinc-400 tracking-wider">Vínculo Bancario</h3>
                                    {detailInvoice.estado === 'VINCULADA' && detailInvoice.movimientos ? (
                                        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-3 shadow-xs">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wide">Movimiento Conciliado</p>
                                                    <p className="text-sm font-black text-zinc-900 dark:text-zinc-50 uppercase mt-1">
                                                        {detailInvoice.movimientos.nombre_tercero || "Sin Nombre"}
                                                    </p>
                                                    {detailInvoice.movimientos.concepto && (
                                                        <p className="text-xs text-zinc-500 mt-0.5">{detailInvoice.movimientos.concepto}</p>
                                                    )}
                                                    <p className="text-[10px] text-zinc-300 dark:text-zinc-400 font-bold uppercase mt-1.5 flex gap-2">
                                                        <span>Fecha: {detailInvoice.movimientos.fecha}</span>
                                                        <span>•</span>
                                                        <span>Monto: ${parseFloat(detailInvoice.movimientos.monto).toLocaleString()}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleUnlink(detailInvoice)}
                                                    className="w-full py-2.5 bg-red-500 hover:bg-red-650 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-red-500/15 flex items-center justify-center gap-2 transition-all active:scale-98"
                                                >
                                                    <Unlink className="w-4 h-4" />
                                                    Desvincular Movimiento
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 space-y-4 text-center">
                                            {detailInvoice.estado === 'DESCARTADA' ? (
                                                <>
                                                    <p className="text-xs text-zinc-500 italic">Esta factura está excluida y no forma parte del flujo de conciliación bancaria.</p>
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleRestoreInvoice(detailInvoice)}
                                                            className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98"
                                                        >
                                                            <RotateCcw className="w-4 h-4" />
                                                            Restaurar a Pendiente
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-xs text-zinc-500 italic">Esta factura aún no se encuentra vinculada a ningún movimiento en tus cuentas de banco.</p>
                                                    {isAdmin && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedInvoice(detailInvoice);
                                                                    setDetailInvoice(null);
                                                                }}
                                                                className="flex-1 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98"
                                                            >
                                                                <LinkIcon className="w-4 h-4" />
                                                                Vincular Ahora
                                                            </button>
                                                            <button
                                                                onClick={() => handleMarkAsDiscarded(detailInvoice)}
                                                                className="px-3 py-2.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-250 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                                                                title="Descartar de la conciliación"
                                                            >
                                                                Excluir
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
