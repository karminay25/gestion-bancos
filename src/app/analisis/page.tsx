"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  BarChart3, PieChart as PieChartIcon, TrendingUp, Calendar,
  Building2, Users, Filter, ArrowUpRight, ArrowDownRight,
  Loader2, CalendarDays, Leaf, Hash, Tag
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LabelList
} from "recharts";
import { supabase } from "@/lib/supabase";
import { formatCostCenter } from "@/lib/costCenter";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const COLORS = ["#6366f1","#10b981","#f59e0b","#ec4899","#8b5cf6","#06b6d4","#f43f5e","#84cc16"];

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

export default function AnalisisPage() {
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [selectedCC, setSelectedCC] = useState<string>("all");
  const [selectedCurrency, setSelectedCurrency] = useState<"MXN" | "USD">("MXN");
  const [timeRange, setTimeRange] = useState<"week"|"month"|"year"|"all">("all");
  const [isMounted, setIsMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [manuallyActivatedCCNames, setManuallyActivatedCCNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem('manually_activated_ccs');
      if (stored) {
        setManuallyActivatedCCNames(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.error('Error loading activated CCs:', e);
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCompany, selectedSeason, selectedCC, selectedCurrency, timeRange]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // Fetch metadata in parallel
      const [compRes, seasRes, ccRes] = await Promise.all([
        supabase.from('empresas').select('*'),
        supabase.from('temporadas').select('*').order('created_at', { ascending: false }),
        supabase.from('centros_costo').select('*').order('nombre')
      ]);

      if (compRes.data) setCompanies(compRes.data);
      if (seasRes.data) {
        setSeasons(seasRes.data);
        // Auto-select active season
        const active = seasRes.data.find((s: any) => s.fecha_inicio && !s.fecha_fin);
        if (active) setSelectedSeason(active.id.toString());
      }
      if (ccRes.data) setCostCenters(ccRes.data);

      // Fetch ALL movements using a loop to bypass the 1000 limit
      let allMovs: any[] = [];
      let from = 0;
      let to = 999;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('movimientos')
          .select('*, cuentas_bancarias(moneda, empresas(id, codigo)), centros_costo(nombre, numero), temporadas(nombre)')
          .order('fecha', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to);

        if (error || !data || data.length === 0) {
          hasMore = false;
        } else {
          allMovs = [...allMovs, ...data];
          if (data.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
            to += 1000;
          }
        }
      }

      setMovements(allMovs);
      setLoading(false);
    }
    fetchData();
    setIsMounted(true);
  }, []);

  const filteredData = useMemo(() => {
    let data = movements;
    
    // Filter strictly by the selected currency
    data = data.filter(m => m.cuentas_bancarias?.moneda === selectedCurrency);
    
    if (selectedCompany !== "all") data = data.filter(m => m.cuentas_bancarias?.empresas?.codigo === selectedCompany);
    if (selectedSeason !== "all") data = data.filter(m => m.temporada_id?.toString() === selectedSeason);
    if (selectedCC !== "all") data = data.filter(m => m.centro_costo_id?.toString() === selectedCC);
    
    const now = new Date();
    // Parse date-only string in local time to prevent timezone shift anomalies
    const parseLocalDate = (dateStr: string) => new Date(dateStr + 'T00:00:00');
    
    if (timeRange === "week") data = data.filter(m => isWithinInterval(parseLocalDate(m.fecha), { start: startOfWeek(now), end: endOfWeek(now) }));
    else if (timeRange === "month") data = data.filter(m => isWithinInterval(parseLocalDate(m.fecha), { start: startOfMonth(now), end: endOfMonth(now) }));
    else if (timeRange === "year") data = data.filter(m => parseLocalDate(m.fecha).getFullYear() === now.getFullYear());
    return data;
  }, [movements, selectedCompany, selectedSeason, selectedCC, timeRange, selectedCurrency]);

  const stats = useMemo(() => {
    const totalIncome = filteredData.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + parseFloat(m.monto), 0);
    const totalExpense = filteredData.filter(m => m.tipo === 'Egreso').reduce((s, m) => s + parseFloat(m.monto), 0);
    const byCC = filteredData.filter(m => m.tipo === 'Egreso').reduce((acc: any, m) => {
      const name = m.centros_costo ? formatCostCenter(m.centros_costo) : "Sin Clasificar";
      acc[name] = (acc[name] || 0) + parseFloat(m.monto);
      return acc;
    }, {});
    const pieCC = Object.entries(byCC).map(([name, value]) => ({ name, value }));
    const byEmpresa = filteredData.filter(m => m.tipo === 'Egreso').reduce((acc: any, m) => {
      const name = m.cuentas_bancarias?.empresas?.codigo || "S/E";
      acc[name] = (acc[name] || 0) + parseFloat(m.monto);
      return acc;
    }, {});
    const pieEmpresa = Object.entries(byEmpresa).map(([name, value]) => ({ name, value }));
    const byProvider = filteredData.filter(m => m.tipo === 'Egreso').reduce((acc: any, m) => {
      const name = m.nombre_tercero || "S/N";
      acc[name] = (acc[name] || 0) + parseFloat(m.monto);
      return acc;
    }, {});
    const barProviders = Object.entries(byProvider).map(([name, value]) => ({ name, value: value as number })).sort((a, b) => b.value - a.value).slice(0, 10);
    const byDate = filteredData.reduce((acc: any, m) => {
      const date = m.fecha;
      if (!acc[date]) acc[date] = { date, income: 0, expense: 0 };
      if (m.tipo === 'Ingreso') acc[date].income += parseFloat(m.monto);
      else acc[date].expense += parseFloat(m.monto);
      return acc;
    }, {});
    const trendData = Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));
    return { totalIncome, totalExpense, pieCC, pieEmpresa, barProviders, trendData, count: filteredData.length };
  }, [filteredData]);

  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

  // Temporada comparison table
  const seasonComparison = useMemo(() => {
    return seasons.map(s => {
      const movs = movements.filter(m => m.temporada_id?.toString() === s.id.toString() && m.cuentas_bancarias?.moneda === selectedCurrency);
      const income = movs.filter(m => m.tipo === 'Ingreso').reduce((a, m) => a + parseFloat(m.monto), 0);
      const expense = movs.filter(m => m.tipo === 'Egreso').reduce((a, m) => a + parseFloat(m.monto), 0);
      return { ...s, income, expense, net: income - expense, count: movs.length };
    });
  }, [seasons, movements, selectedCurrency]);

  const activeSeason = seasons.find(s => s.fecha_inicio && !s.fecha_fin);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh]">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
      <p className="mt-4 text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando Inteligencia Financiera...</p>
    </div>
  );

  return (
    <div className="space-y-10 pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter uppercase italic">Análisis de Operaciones</h1>
          <p className="text-zinc-500 mt-1 dark:text-zinc-300 font-medium">Visualiza el flujo y distribución de tus recursos en tiempo real.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 bg-zinc-100 dark:bg-zinc-900 p-2 rounded-[2rem] border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 px-4 border-r border-zinc-200 dark:border-zinc-800">
            <Filter className="w-4 h-4 text-zinc-400" />
            <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className="bg-transparent text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 border-none focus:ring-0">
              <option value="all">Todas las Empresas</option>
              {companies.map(c => <option key={c.id} value={c.codigo}>{c.codigo}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 px-4 border-r border-zinc-200 dark:border-zinc-800">
            <Leaf className="w-4 h-4 text-primary" />
            <select value={selectedSeason} onChange={e => setSelectedSeason(e.target.value)} className="bg-transparent text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 border-none focus:ring-0">
              <option value="all">Todas las Temporadas</option>
              {seasons.map(s => {
                const isActive = s.fecha_inicio && !s.fecha_fin;
                return <option key={s.id} value={s.id}>{s.nombre}{isActive ? ' ★' : ''}</option>;
              })}
            </select>
          </div>
          <div className="flex items-center gap-2 px-4 border-r border-zinc-200 dark:border-zinc-800">
            <Tag className="w-4 h-4 text-amber-500" />
            <select value={selectedCC} onChange={e => setSelectedCC(e.target.value)} className="bg-transparent text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 border-none focus:ring-0">
              <option value="all">Todos los Centros</option>
              {costCenters.filter(cc => !ARCHIVED_COST_CENTERS.has(cc.nombre.toUpperCase().trim()) || manuallyActivatedCCNames.has(cc.nombre.toUpperCase().trim()) || cc.id.toString() === selectedCC).map(cc => (
                <option key={cc.id} value={cc.id}>{formatCostCenter(cc)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 px-4 border-r border-zinc-200 dark:border-zinc-800">
            <Filter className="w-4 h-4 text-zinc-400" />
            <select value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value as "MXN" | "USD")} className="bg-transparent text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 border-none focus:ring-0">
              <option value="MXN">Moneda: MXN</option>
              <option value="USD">Moneda: USD</option>
            </select>
          </div>
          <div className="flex p-1 bg-white/50 dark:bg-black/20 rounded-xl">
            {(['week','month','year','all'] as const).map(r => (
              <button key={r} onClick={() => setTimeRange(r)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${timeRange === r ? "bg-primary text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"}`}>
                {r === 'week' ? 'Semana' : r === 'month' ? 'Mes' : r === 'year' ? 'Año' : 'Histórico'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active season banner */}
      {activeSeason && selectedSeason === activeSeason.id.toString() && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Temporada Activa: {activeSeason.nombre}</p>
          {activeSeason.fecha_inicio && <p className="text-xs text-zinc-500 font-medium">Desde {new Date(activeSeason.fecha_inicio).toLocaleDateString('es-MX')}</p>}
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard title="Ingresos Totales" value={stats.totalIncome} icon={<ArrowUpRight className="text-emerald-500" />} color="emerald" currency={selectedCurrency} />
        <MetricCard title="Egresos Totales" value={stats.totalExpense} icon={<ArrowDownRight className="text-rose-500" />} color="rose" currency={selectedCurrency} />
        <MetricCard title="Cash Flow Neto" value={stats.totalIncome - stats.totalExpense} icon={<TrendingUp className="text-primary" />} color="primary" currency={selectedCurrency} />
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8 rounded-[2.5rem] relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 dark:text-zinc-400">Movimientos</p>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl group-hover:scale-110 transition-transform">
              <Hash className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <h2 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50">{stats.count.toLocaleString()}</h2>
          <p className="text-xs text-zinc-400 mt-1 font-bold uppercase tracking-widest">registros</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Pie: Cost Center */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tighter">Gastos por Sector</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-300 font-bold uppercase mt-1">Por centro de costo</p>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-2xl"><PieChartIcon className="text-indigo-500" /></div>
          </div>
          <div className="h-[280px] w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.pieCC} innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value">
                    {stats.pieCC.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                <Tooltip contentStyle={{ borderRadius:'1rem', background:'#000', border:'none' }} itemStyle={{ color:'#fff', fontSize:'12px', fontWeight:'bold' }} formatter={((v: number) => `$${v.toLocaleString('es-MX', {minimumFractionDigits:2})}`) as any} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {stats.pieCC.slice(0,6).map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter truncate">{entry.name}</span>
                <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 ml-auto">${(entry.value as number).toLocaleString('es-MX',{minimumFractionDigits:0})}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pie: By Company */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tighter">Egresos por Empresa</h3>
              <p className="text-xs text-zinc-500 font-bold uppercase mt-1">Distribución entre entidades legales</p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-2xl"><Building2 className="text-emerald-500" /></div>
          </div>
          <div className="h-[280px] w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.pieEmpresa} innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent ? percent * 100 : 0).toFixed(0)}%`}>
                    {stats.pieEmpresa.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius:'1rem', background:'#000', border:'none' }} formatter={((v: number) => `$${v.toLocaleString('es-MX',{minimumFractionDigits:2})}`) as any} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {stats.pieEmpresa.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">{entry.name}</span>
                <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 ml-auto">${(entry.value as number).toLocaleString('es-MX',{minimumFractionDigits:0})}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar: Top Providers */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tighter">Top Proveedores / Terceros</h3>
            <p className="text-xs text-zinc-500 font-bold uppercase mt-1">Mayor volumen de pagos</p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-2xl"><Users className="text-amber-500" /></div>
        </div>
        <div className="h-[350px] w-full">
          {isMounted && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.barProviders} layout="vertical" margin={{ left: 20, right: 150 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={150} axisLine={false} tickLine={false} tick={{ fill:'#a1a1aa', fontSize:10, fontWeight:'bold' }} />
                <Tooltip formatter={((val: number) => `$${val.toLocaleString('es-MX',{minimumFractionDigits:2})}`) as any} contentStyle={{ borderRadius:'1rem', background:'#000', border:'none' }} cursor={{ fill:'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="value" fill="#6366f1" radius={[0,10,10,0]} barSize={22}>
                  <LabelList dataKey="value" position="right" formatter={((val: number) => `$${val.toLocaleString('es-MX',{minimumFractionDigits:0})}`) as any} style={{ fill:'#d1d5db', fontSize:'10px', fontWeight:'bold' }} offset={8} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Area: Trend */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[3rem] p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tighter">Evolución de Flujo de Caja</h3>
            <p className="text-xs text-zinc-300 font-bold uppercase mt-1">Egresos vs Ingresos en el periodo</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-2xl"><TrendingUp className="text-emerald-500" /></div>
        </div>
        <div className="h-[350px] w-full">
          {isMounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill:'#a1a1aa', fontSize:10 }} tickFormatter={(val) => { try { return format(new Date(val+'T12:00:00'), 'dd MMM', { locale: es }); } catch { return val; }}} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill:'#a1a1aa', fontSize:10 }} tickFormatter={(val) => `$${(val/1000)}k`} />
                <Tooltip contentStyle={{ borderRadius:'1rem', background:'#000', border:'none' }} formatter={((v: number) => `$${v.toLocaleString('es-MX',{minimumFractionDigits:2})}`) as any} />
                <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" name="Ingreso" />
                <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" name="Egreso" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Temporada Comparison Table */}
      {seasonComparison.length > 0 && (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tighter">Comparativa por Temporada</h3>
              <p className="text-xs text-zinc-500 font-bold uppercase mt-1">Rendimiento histórico de cada periodo</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-2xl"><Leaf className="text-primary" /></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="pb-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Temporada</th>
                  <th className="pb-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Estado</th>
                  <th className="pb-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Ingresos</th>
                  <th className="pb-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Egresos</th>
                  <th className="pb-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Flujo Neto</th>
                  <th className="pb-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Movs.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {seasonComparison.map(s => {
                  const isActive = s.fecha_inicio && !s.fecha_fin;
                  const isFin = !!s.fecha_fin;
                  return (
                    <tr key={s.id} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors ${selectedSeason === s.id.toString() ? 'bg-primary/[0.03]' : ''}`}>
                      <td className="py-4 font-black text-zinc-900 dark:text-zinc-50 text-sm">{s.nombre}</td>
                      <td className="py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isActive ? 'bg-emerald-500/10 text-emerald-600' : isFin ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800' : 'bg-amber-500/10 text-amber-600'}`}>
                          {isActive ? 'Activa' : isFin ? 'Finalizada' : 'Programada'}
                        </span>
                      </td>
                      <td className="py-4 text-right font-black text-emerald-600 text-sm">${s.income.toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
                      <td className="py-4 text-right font-black text-rose-600 text-sm">${s.expense.toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
                      <td className={`py-4 text-right font-black text-sm ${s.net >= 0 ? 'text-zinc-900 dark:text-zinc-50' : 'text-rose-500'}`}>${s.net.toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
                      <td className="py-4 text-right text-zinc-500 font-bold text-sm">{s.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Consultas y Detalle de Movimientos */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tighter">Consulta de Movimientos</h3>
            <p className="text-xs text-zinc-500 font-bold uppercase mt-1">
              {selectedCC !== "all" 
                ? `Mostrando movimientos del Centro de Costo: ${formatCostCenter(costCenters.find(cc => cc.id.toString() === selectedCC))}`
                : "Listado general de movimientos filtrados"
              }
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
            {filteredData.length} Registros
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Fecha</th>
                <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Empresa</th>
                <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Banco/Cuenta</th>
                <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Tercero</th>
                <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Concepto</th>
                <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">C. Costo</th>
                <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900 text-xs">
              {paginatedMovements.map((move: any) => {
                const isEgreso = move.tipo === 'Egreso';
                const isTraspaso = move.tipo === 'Traspaso';
                const amt = parseFloat(move.monto);
                const isTraspasoOut = isTraspaso && amt < 0;
                return (
                  <tr key={move.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                    <td className="px-5 py-4 font-bold text-zinc-500 dark:text-zinc-300 whitespace-nowrap">
                      {move.fecha.split('-').reverse().join('/')}
                    </td>
                    <td className="px-5 py-4 font-black uppercase text-zinc-900 dark:text-zinc-50">
                      {move.cuentas_bancarias?.empresas?.codigo || 'N/A'}
                    </td>
                    <td className="px-5 py-4 text-zinc-500 dark:text-zinc-400">
                      {move.cuentas_bancarias?.banco} ({move.cuentas_bancarias?.moneda})
                    </td>
                    <td className="px-5 py-4 font-bold text-zinc-900 dark:text-zinc-200">
                      {move.nombre_tercero || '—'}
                    </td>
                    <td className="px-5 py-4 text-zinc-500 dark:text-zinc-400 truncate max-w-[220px]" title={move.concepto}>
                      {move.concepto || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                        {move.centros_costo ? formatCostCenter(move.centros_costo) : 'Gral'}
                      </span>
                    </td>
                    <td className={`px-5 py-4 text-right font-black text-sm ${isEgreso ? 'text-rose-500' : isTraspaso ? 'text-blue-500' : 'text-emerald-500'}`}>
                      {isEgreso || isTraspasoOut ? '-' : '+'}${Math.abs(amt).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
              {paginatedMovements.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-zinc-400 italic">
                    No se encontraron movimientos con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} de {filteredData.length}
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 disabled:opacity-30 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 transition-all hover:border-primary/50"
              >
                &larr;
              </button>
              <div className="flex items-center gap-1 font-black text-[11px] text-zinc-900 dark:text-zinc-50 px-3">
                <span>{currentPage}</span>
                <span className="text-zinc-300">/</span>
                <span className="text-zinc-400 dark:text-zinc-300">{totalPages}</span>
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 disabled:opacity-30 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 transition-all hover:border-primary/50"
              >
                &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color, currency }: { title: string, value: number, icon: any, color: string, currency: string }) {
  const isNegative = value < 0;
  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8 rounded-[2.5rem] relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/5 blur-[80px] group-hover:bg-${color}-500/10 transition-all`} />
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 dark:text-zinc-400">{title}</p>
        <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <h2 className={`text-3xl font-black tracking-tighter ${isNegative ? "text-rose-500" : "text-zinc-900 dark:text-zinc-50"}`}>
          ${Math.abs(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
        </h2>
        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">{currency}</span>
      </div>
    </div>
  );
}
