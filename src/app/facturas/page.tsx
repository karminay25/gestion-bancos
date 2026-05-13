"use client";

import { useState, useEffect } from "react";
import { 
  FileText, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Download,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Link as LinkIcon
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ManualLinkModal } from "@/components/ManualLinkModal";

export default function FacturasPage() {
    const [loading, setLoading] = useState(true);
    const [facturas, setFacturas] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
    const ITEMS_PER_PAGE = 20;

    async function fetchFacturas() {
        setLoading(true);
        const { data, error } = await supabase
            .from('facturas')
            .select('*, movimientos(fecha, nombre_tercero, monto)')
            .order('fecha_emision', { ascending: false });
        
        if (data) setFacturas(data);
        setLoading(false);
    }

    useEffect(() => {
        fetchFacturas();
    }, []);

    const filteredFacturas = facturas.filter(f => {
        const matchesSearch = 
            f.emisor_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.uuid_sat?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.folio?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === "all" || f.estado === statusFilter;
        
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
                alert(`Sincronización completada:\n- Sinc: ${data.sync}\n- Vínculos: ${data.matches.matched}`);
                fetchFacturas();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e: any) {
            alert('Error de red: ' + e.message);
        } finally {
            setIsSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="mt-4 text-zinc-500 font-medium italic">Cargando repositorio de facturas...</p>
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
                <button 
                    onClick={handleSync}
                    disabled={isSyncing}
                    className={`flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black text-zinc-50 shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-all active:scale-95 ${isSyncing ? "opacity-50" : ""}`}
                >
                    <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Sincronizando..." : "Sincronizar Ahora"}
                </button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center gap-5">
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-zinc-400">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Total Facturas</p>
                        <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{facturas.length}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center gap-5">
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Vinculadas</p>
                        <p className="text-2xl font-black text-emerald-600">{facturas.filter(f => f.estado === 'VINCULADA').length}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center gap-5">
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-500">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Pendientes</p>
                        <p className="text-2xl font-black text-amber-600">{facturas.filter(f => f.estado === 'PENDIENTE_VINCULO').length}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                        type="text"
                        placeholder="Buscar por RFC, emisor o folio..."
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-950 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative w-full md:w-64">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <select 
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-950 border-none rounded-xl text-sm appearance-none focus:ring-2 focus:ring-primary/20 font-bold"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Todos los Estados</option>
                        <option value="VINCULADA">Vinculadas</option>
                        <option value="PENDIENTE_VINCULO">Pendientes</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-900 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                                <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400">Fecha Emisión</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400">Emisor</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Monto</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-center">Estado</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400">Vínculo Bancario</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                            {paginatedFacturas.map((factura) => (
                                <tr key={factura.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-900/30 transition-colors">
                                    <td className="px-6 py-5">
                                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50">
                                            {format(new Date(factura.fecha_emision), "dd 'de' MMMM", { locale: es })}
                                        </p>
                                        <p className="text-[10px] text-zinc-400 font-medium">{format(new Date(factura.fecha_emision), "yyyy")}</p>
                                    </td>
                                    <td className="px-6 py-5">
                                        <p className="text-xs font-black text-zinc-900 dark:text-zinc-50 uppercase">{factura.emisor_nombre}</p>
                                        <p className="text-[10px] text-zinc-400 font-mono">{factura.emisor_rfc}</p>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">${parseFloat(factura.monto_total).toLocaleString()}</p>
                                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">{factura.moneda}</p>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        {factura.estado === 'VINCULADA' ? (
                                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">Vinculada</span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">Pendiente</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-5">
                                        {factura.movimientos ? (
                                            <div className="flex flex-col gap-0.5">
                                                <p className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 uppercase truncate max-w-[200px]">
                                                    {factura.movimientos.nombre_tercero}
                                                </p>
                                                <p className="text-[9px] text-emerald-500 font-bold">Matched on {factura.movimientos.fecha}</p>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-zinc-400 italic font-medium">Sin movimiento detectado</p>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {factura.estado === 'PENDIENTE_VINCULO' && (
                                                <button 
                                                    onClick={() => setSelectedInvoice(factura)}
                                                    className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all flex items-center gap-2 text-[10px] font-black uppercase"
                                                >
                                                    <LinkIcon className="w-4 h-4" />
                                                    Vincular
                                                </button>
                                            )}
                                            <button className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-400 hover:text-primary transition-colors">
                                                <ExternalLink className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-5 bg-zinc-50/30 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                            Mostrando {paginatedFacturas.length} de {filteredFacturas.length} facturas
                        </p>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-400 disabled:opacity-30"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-[11px] font-black">{currentPage} / {totalPages}</span>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-400 disabled:opacity-30"
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
        </div>
    );
}
