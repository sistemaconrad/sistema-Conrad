import React, { useState, useEffect, useRef } from 'react';
import { PerfilModal } from '../components/PerfilModal';
import { supabase } from '../lib/supabase';
import {
  Activity, Package, LogOut, Users, Banknote, UserCog,
  Stethoscope, Calendar, ChevronRight, Folder, Home,
  Menu, X, Bell, TrendingUp, TrendingDown, DollarSign,
  ClipboardList, UserCheck, FileCheck, Flame, ListChecks,
  MapPin, Settings, FolderOpen
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateToModule: (module: string) => void;
  onLogout: () => void;
}

// ─── Helpers de fecha (Guatemala, GMT-6) ───────────────────────────────────
const getGuatemalaTime = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
const toISODate = (d: Date) => d.toLocaleDateString('en-CA');
const fechaLocalGT = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
const diaCorto = (isoDate: string) => {
  const d = new Date(isoDate + 'T12:00:00');
  return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
};
const restarDias = (isoDate: string, n: number) => {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return toISODate(d);
};

interface ModuleDef {
  id: string; name: string; description: string; icon: any;
  gradient: string; accent: string; dot: string;
}

const ALL_MODULES: ModuleDef[] = [
  { id: 'sanatorio', name: 'Centro de Diagnóstico', description: 'Consultas, pacientes y estudios', icon: Activity,
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #1d4ed8 100%)', accent: 'rgba(147,197,253,0.8)', dot: '#3b82f6' },
  { id: 'doctores', name: 'Módulo de Doctores', description: 'Informes médicos y estudios', icon: Stethoscope,
    gradient: 'linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #0d9488 100%)', accent: 'rgba(153,246,228,0.8)', dot: '#2dd4bf' },
  { id: 'visitadoras', name: 'Visitadoras Médicas', description: 'Visitas, comisiones y referentes', icon: Users,
    gradient: 'linear-gradient(135deg, #1c0533 0%, #6b21a8 55%, #a855f7 100%)', accent: 'rgba(233,213,255,0.8)', dot: '#c084fc' },
  { id: 'inventario', name: 'Inventario', description: 'Productos, stock y suministros', icon: Package,
    gradient: 'linear-gradient(135deg, #052e16 0%, #14532d 55%, #16a34a 100%)', accent: 'rgba(134,239,172,0.8)', dot: '#22c55e' },
  { id: 'contabilidad', name: 'Contabilidad', description: 'Finanzas, ingresos y gastos', icon: Banknote,
    gradient: 'linear-gradient(135deg, #0c1a3a 0%, #0c4a6e 55%, #0284c7 100%)', accent: 'rgba(186,230,253,0.8)', dot: '#38bdf8' },
  { id: 'personal', name: 'Recursos Humanos', description: 'Personal, nómina y asistencia', icon: UserCog,
    gradient: 'linear-gradient(135deg, #1e1035 0%, #4a1d96 55%, #7c3aed 100%)', accent: 'rgba(221,214,254,0.8)', dot: '#a78bfa' },
  { id: 'documentos', name: 'Repositorio', description: 'Archivos y documentos compartidos', icon: Folder,
    gradient: 'linear-gradient(135deg, #172554 0%, #1e40af 55%, #4f46e5 100%)', accent: 'rgba(199,210,254,0.8)', dot: '#818cf8' },
];

const MODULO_ICON: Record<string, any> = {
  sanatorio: Activity, inventario: Package, contabilidad: Banknote, personal: UserCog,
  doctores: Stethoscope, documentos: FolderOpen, visitadoras: Users, sistema: Settings,
};

// ─── Mini gráfica de línea (SVG, sin dependencias) ─────────────────────────
const MiniLineChart: React.FC<{ labels: string[]; values: number[]; color: string }> = ({ labels, values, color }) => {
  const w = 560, h = 160, padX = 24, padY = 16;
  const max = Math.max(1, ...values);
  const stepX = (w - padX * 2) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = padX + i * stepX;
    const y = h - padY - (v / max) * (h - padY * 2);
    return { x, y, v };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L ${points[points.length - 1]?.x || padX} ${h - padY} L ${padX} ${h - padY} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="none" style={{ maxHeight: 180 }}>
      <path d={areaPath} fill={color} opacity={0.08} />
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="white" stroke={color} strokeWidth={2} />
      ))}
      {labels.map((l, i) => (
        <text key={i} x={padX + i * stepX} y={h - 2} fontSize="10" textAnchor="middle" fill="#94a3b8">{l}</text>
      ))}
    </svg>
  );
};

// ─── Mini gráfica de barras (SVG, sin dependencias) ────────────────────────
const MiniBarChart: React.FC<{ labels: string[]; values: number[]; color: string }> = ({ labels, values, color }) => {
  const w = 560, h = 160, padX = 24, padY = 16;
  const max = Math.max(1, ...values);
  const slot = (w - padX * 2) / values.length;
  const barW = slot * 0.5;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="none" style={{ maxHeight: 180 }}>
      {values.map((v, i) => {
        const barH = (v / max) * (h - padY * 2);
        const x = padX + i * slot + (slot - barW) / 2;
        const y = h - padY - barH;
        return <rect key={i} x={x} y={y} width={barW} height={Math.max(barH, v > 0 ? 2 : 0)} rx={3} fill={color} opacity={0.85} />;
      })}
      {labels.map((l, i) => (
        <text key={i} x={padX + i * slot + slot / 2} y={h - 2} fontSize="10" textAnchor="middle" fill="#94a3b8">{l}</text>
      ))}
    </svg>
  );
};

// ─── Mini dona (SVG, sin dependencias) ─────────────────────────────────────
const MiniDonut: React.FC<{ segments: { label: string; value: number; color: string }[] }> = ({ segments }) => {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const size = 130, radius = 52, stroke = 16, cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {total > 0 && segments.filter(s => s.value > 0).map((s, i) => {
          const frac = s.value / total;
          const dash = frac * circumference;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={radius} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="20" fontWeight="900" fill="#0f172a">{total}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="#94a3b8">Total</text>
      </svg>
      <div className="space-y-1.5 min-w-0">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-slate-500 truncate">{s.label}</span>
            <span className="font-bold text-slate-700 ml-auto">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Tarjeta de estadística ─────────────────────────────────────────────────
const StatCard: React.FC<{ icon: any; label: string; value: string; deltaPct?: number; color: string }> = ({ icon: Icon, label, value, deltaPct, color }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
    <div className="flex items-start justify-between mb-2">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
        <Icon size={16} style={{ color }} />
      </div>
      {deltaPct !== undefined && (
        <span className={`flex items-center gap-0.5 text-[11px] font-bold ${deltaPct >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
          {deltaPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {Math.abs(deltaPct)}%
        </span>
      )}
    </div>
    <p className="text-xl sm:text-2xl font-black text-slate-900 leading-none">{value}</p>
    <p className="text-xs text-slate-400 mt-1.5">{label}</p>
  </div>
);

const relativeTime = (iso: string) => {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'justo ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} d`;
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToModule, onLogout }) => {
  const rolUsuario   = localStorage.getItem('rolUsuarioConrad') || 'secretaria';
  const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || 'Usuario';
  const usernameUsuario = localStorage.getItem('usernameConrad') || '';
  const [showPerfil, setShowPerfil] = useState(false);
  const [fotoUrl, setFotoUrl]       = useState('');
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const actividadRef = useRef<HTMLDivElement>(null);

  const esAdmin = rolUsuario === 'admin';
  const esSecretaria = rolUsuario === 'secretaria';
  const esVisitadora = rolUsuario === 'visitadora';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ label: string; value: string; icon: any; color: string; deltaPct?: number }[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [chartValues, setChartValues] = useState<number[]>([]);
  const [chartTitle, setChartTitle] = useState('Resumen semanal');
  const [chartTipo, setChartTipo] = useState<'linea' | 'barras'>('linea');
  const [donutSegments, setDonutSegments] = useState<{ label: string; value: number; color: string }[]>([]);
  const [actividad, setActividad] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('perfiles_usuario')
        .select('foto_url, nombre_completo')
        .eq('username', usernameUsuario)
        .maybeSingle();
      if (data?.foto_url)        setFotoUrl(data.foto_url);
      if (data?.nombre_completo) localStorage.setItem('nombreUsuarioConrad', data.nombre_completo);
    })();
  }, []);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const hoy = toISODate(getGuatemalaTime());
      const ayer = restarDias(hoy, 1);
      const inicioVentana = restarDias(hoy, 7); // últimos 8 días (incluye hoy) para deltas + gráfica de 7 días
      const diasVentana = Array.from({ length: 7 }, (_, i) => restarDias(hoy, 6 - i)); // 7 días terminando hoy

      const promesas: any[] = [];

      // Actividad reciente (log_actividad)
      let qActividad = supabase.from('log_actividad').select('*').order('created_at', { ascending: false }).limit(8);
      if (!esAdmin) qActividad = qActividad.eq('usuario', usernameUsuario);
      promesas.push(qActividad);

      if (esAdmin || esSecretaria) {
        promesas.push(
          supabase.from('consultas')
            .select('id, fecha, tipo_cobro, es_servicio_movil, anulado, nombre_usuario, paciente_id, detalle_consultas(precio)')
            .gte('fecha', inicioVentana).lte('fecha', hoy)
        );
      } else {
        promesas.push(Promise.resolve({ data: [] }));
      }

      if (esAdmin || esVisitadora) {
        promesas.push(
          supabase.from('visitas_medicas')
            .select('id, created_at, visitadora_nombre')
            .gte('created_at', inicioVentana + 'T06:00:00.000Z')
            .lt('created_at', toISODate(new Date(new Date(hoy + 'T12:00:00').getTime() + 86400000)) + 'T06:00:00.000Z')
        );
      } else {
        promesas.push(Promise.resolve({ data: [] }));
      }

      if (esAdmin) {
        promesas.push(supabase.from('comisiones_por_pagar').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'));
      } else {
        promesas.push(Promise.resolve({ count: 0 }));
      }

      const [{ data: logs }, { data: consultasRaw }, { data: visitasRaw }, { count: pendientesCount }] = await Promise.all(promesas);

      setActividad(logs || []);

      let consultas = (consultasRaw || []).filter((c: any) => c.anulado !== true);
      let visitas = visitasRaw || [];
      if (esVisitadora) visitas = visitas.filter((v: any) => v.visitadora_nombre === nombreUsuario);
      if (esSecretaria) consultas = consultas.filter((c: any) => c.nombre_usuario === nombreUsuario);

      const precioConsulta = (c: any) => (c.detalle_consultas || []).reduce((s: number, d: any) => s + (d.precio || 0), 0);

      if (esAdmin) {
        const consultasHoy = consultas.filter((c: any) => c.fecha === hoy);
        const consultasAyer = consultas.filter((c: any) => c.fecha === ayer);
        const visitasHoy = visitas.filter((v: any) => fechaLocalGT(v.created_at) === hoy);
        const visitasAyer = visitas.filter((v: any) => fechaLocalGT(v.created_at) === ayer);
        const ingresosHoy = consultasHoy.reduce((s, c) => s + precioConsulta(c), 0);
        const ingresosAyer = consultasAyer.reduce((s, c) => s + precioConsulta(c), 0);
        const pct = (hoyN: number, ayerN: number) => ayerN > 0 ? Math.round(((hoyN - ayerN) / ayerN) * 100) : (hoyN > 0 ? 100 : 0);

        setStats([
          { label: 'Consultas', value: String(consultasHoy.length), icon: ClipboardList, color: '#0d9488', deltaPct: pct(consultasHoy.length, consultasAyer.length) },
          { label: 'Visitas', value: String(visitasHoy.length), icon: MapPin, color: '#7c3aed', deltaPct: pct(visitasHoy.length, visitasAyer.length) },
          { label: 'Ingresos', value: `Q${ingresosHoy.toLocaleString('es-GT', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: '#16a34a', deltaPct: pct(ingresosHoy, ingresosAyer) },
          { label: 'Comisiones pendientes', value: String(pendientesCount || 0), icon: Banknote, color: '#ea580c' },
        ]);

        setChartTitle('Consultas por día'); setChartTipo('linea');
        setChartLabels(diasVentana.map(diaCorto));
        setChartValues(diasVentana.map(d => consultas.filter((c: any) => c.fecha === d).length));

        const ultimos7 = consultas.filter((c: any) => diasVentana.includes(c.fecha));
        setDonutSegments([
          { label: 'Normal', value: ultimos7.filter((c: any) => c.tipo_cobro === 'normal' && !c.es_servicio_movil).length, color: '#3b82f6' },
          { label: 'Social', value: ultimos7.filter((c: any) => c.tipo_cobro === 'social' && !c.es_servicio_movil).length, color: '#22c55e' },
          { label: 'Especial', value: ultimos7.filter((c: any) => c.tipo_cobro === 'especial' && !c.es_servicio_movil).length, color: '#a78bfa' },
          { label: 'Móvil', value: ultimos7.filter((c: any) => c.es_servicio_movil).length, color: '#ec4899' },
        ]);
      } else if (esSecretaria) {
        const consultasHoy = consultas.filter((c: any) => c.fecha === hoy);
        const pacientesHoy = new Set(consultasHoy.map((c: any) => c.paciente_id));
        const estudiosHoy = consultasHoy.reduce((s, c) => s + (c.detalle_consultas || []).length, 0);
        const esteMes = consultas.filter((c: any) => c.fecha.slice(0, 7) === hoy.slice(0, 7));

        setStats([
          { label: 'Consultas realizadas', value: String(consultasHoy.length), icon: ClipboardList, color: '#0d9488' },
          { label: 'Pacientes atendidos', value: String(pacientesHoy.size), icon: UserCheck, color: '#3b82f6' },
          { label: 'Estudios completados', value: String(estudiosHoy), icon: FileCheck, color: '#a78bfa' },
          { label: 'Actividad del mes', value: String(esteMes.length), icon: ListChecks, color: '#ea580c' },
        ]);

        setChartTitle('Mi rendimiento esta semana'); setChartTipo('barras');
        setChartLabels(diasVentana.map(diaCorto));
        setChartValues(diasVentana.map(d => consultas.filter((c: any) => c.fecha === d).length));
        setDonutSegments([]);
      } else if (esVisitadora) {
        const visitasHoy = visitas.filter((v: any) => fechaLocalGT(v.created_at) === hoy);
        const visitasSemana = visitas.filter((v: any) => diasVentana.includes(fechaLocalGT(v.created_at)));
        const diasConVisita = new Set(visitas.map((v: any) => fechaLocalGT(v.created_at)));
        let racha = 0; let cursor = hoy;
        while (diasConVisita.has(cursor) && racha <= 60) { racha++; cursor = restarDias(cursor, 1); }

        setStats([
          { label: 'Visitas hoy', value: String(visitasHoy.length), icon: MapPin, color: '#7c3aed' },
          { label: 'Visitas esta semana', value: String(visitasSemana.length), icon: ClipboardList, color: '#0d9488' },
          { label: 'Racha de días', value: String(racha), icon: Flame, color: '#ea580c' },
        ]);

        setChartTitle('Mis visitas esta semana'); setChartTipo('barras');
        setChartLabels(diasVentana.map(diaCorto));
        setChartValues(diasVentana.map(d => visitas.filter((v: any) => fechaLocalGT(v.created_at) === d).length));
        setDonutSegments([]);
      } else {
        setStats([]);
        setChartValues([]);
        setDonutSegments([]);
      }
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('rolUsuarioConrad');
    onLogout();
  };

  const permisosPorRol: Record<string, string[]> = {
    admin:      ['sanatorio', 'doctores', 'visitadoras', 'inventario', 'contabilidad', 'personal', 'documentos'],
    secretaria: ['sanatorio', 'inventario', 'visitadoras', 'documentos'],
    visitadora: ['visitadoras', 'documentos'],
    doctor:     ['doctores', 'documentos'],
  };
  const modulosPermitidos = permisosPorRol[rolUsuario] || permisosPorRol.secretaria;
  const modulosFiltrados = ALL_MODULES.filter(m => modulosPermitidos.includes(m.id));

  const getRolLabel = (rol: string) =>
    ({ admin: 'Administrador', secretaria: 'Secretaria', doctor: 'Doctor', visitadora: 'Visitadora' }[rol] || 'Usuario');

  const avatarLetter = nombreUsuario.charAt(0).toUpperCase();
  const horaGT = getGuatemalaTime().getHours();
  const saludo = horaGT < 12 ? 'Buenos días' : horaGT < 19 ? 'Buenas tardes' : 'Buenas noches';
  const fechaBonita = getGuatemalaTime().toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });

  const navItems = [
    { id: 'inicio', label: 'Inicio', icon: Home, action: () => { setSidebarAbierto(false); } },
    ...(esAdmin ? [{ id: 'resumen', label: 'Resumen del día', icon: Calendar, action: () => onNavigateToModule('resumen') }] : []),
  ];

  const primaryColor = '#0d9488';

  return (
    <div className="min-h-screen flex" style={{ background: '#f4f6f9' }}>

      {/* ── SIDEBAR (desktop persistente / mobile drawer) ── */}
      <aside className={`${sidebarAbierto ? 'fixed inset-y-0 left-0 flex' : 'hidden'} md:flex md:sticky md:top-0 h-screen w-64 bg-white border-r border-slate-100 flex-col z-40`}>
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-slate-100 shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', boxShadow: '0 2px 8px rgba(13,148,136,0.35)' }}>
            <Activity size={16} className="text-white" />
          </div>
          <span className="font-black text-slate-900 text-base tracking-tight">CONRAD</span>
          <button onClick={() => setSidebarAbierto(false)} className="ml-auto md:hidden p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          <div className="space-y-0.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const activo = item.id === 'inicio';
              return (
                <button key={item.id} onClick={item.action}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    activo ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}>
                  <Icon size={16} /> {item.label}
                </button>
              );
            })}
            {!esAdmin && actividad.length > 0 && (
              <button onClick={() => { actividadRef.current?.scrollIntoView({ behavior: 'smooth' }); setSidebarAbierto(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors">
                <ListChecks size={16} /> Mis actividades
              </button>
            )}
          </div>

          <div>
            <p className="px-3 text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {esAdmin ? 'Módulos' : 'Módulos'}
            </p>
            <div className="space-y-0.5">
              {modulosFiltrados.map(mod => {
                const Icon = mod.icon;
                return (
                  <button key={mod.id} onClick={() => onNavigateToModule(mod.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors">
                    <Icon size={16} /> {mod.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-slate-100 shrink-0">
          <button onClick={() => { const m = document.getElementById('dev-modal'); if (m) m.style.display = 'flex'; }}
            className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-slate-500 font-mono transition-colors">
            &lt;/&gt; soporte del sistema
          </button>
        </div>
      </aside>

      {sidebarAbierto && (
        <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setSidebarAbierto(false)} />
      )}

      {/* ── CONTENIDO ── */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-100 h-14 flex items-center gap-3 px-4 sm:px-6"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
          <button onClick={() => setSidebarAbierto(true)} className="md:hidden p-1.5 -ml-1.5 text-slate-500 hover:text-slate-700">
            <Menu size={20} />
          </button>
          {esAdmin ? (
            <span className="hidden sm:block text-sm font-semibold text-slate-400">{fechaBonita}</span>
          ) : (
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
              Vista: Trabajador / Empleado
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {esAdmin && (
              <button onClick={() => onNavigateToModule('resumen')}
                className="relative p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <Bell size={18} />
                {stats.find(s => s.label.includes('pendientes')) && Number(stats.find(s => s.label.includes('pendientes'))?.value) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {stats.find(s => s.label.includes('pendientes'))?.value}
                  </span>
                )}
              </button>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-800 leading-tight">{nombreUsuario}</p>
              <p className="text-xs text-slate-400">{getRolLabel(rolUsuario)}</p>
            </div>
            <button onClick={() => setShowPerfil(true)}
              className="relative flex items-center justify-center rounded-xl overflow-hidden w-9 h-9 border-2 border-teal-100 hover:border-teal-400 transition-colors shrink-0">
              {fotoUrl
                ? <img src={fotoUrl} alt="avatar" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center font-black text-sm text-white"
                    style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}>{avatarLetter}</div>
              }
              <div className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-white" />
            </button>
            <button onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 border border-red-100 transition-colors">
              <LogOut size={14} /> Salir
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Saludo */}
          <div className="mb-6 flex items-end justify-between flex-wrap gap-2">
            <div>
              <p className="text-xl sm:text-2xl font-black text-slate-900">
                {saludo}, {nombreUsuario.split(' ')[0]} 👋
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {esAdmin ? 'Aquí tienes un resumen de la actividad del sistema.' : 'Este es tu resumen de actividad.'}
              </p>
            </div>
            <span className="sm:hidden inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
              {esAdmin ? fechaBonita : 'Vista: Trabajador'}
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-teal-600" />
            </div>
          ) : (
            <>
              {/* Stats */}
              {stats.length > 0 && (
                <div className={`grid grid-cols-2 ${stats.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 sm:gap-4 mb-5`}>
                  {stats.map((s, i) => <StatCard key={i} {...s} />)}
                </div>
              )}

              {/* Actividad / Accesos rápidos / Gráfica */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* Actividad reciente */}
                <div ref={actividadRef} className="min-w-0 bg-white rounded-2xl border border-slate-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <p className="font-black text-slate-800 text-sm mb-3.5">Actividad reciente</p>
                  {actividad.length === 0 ? (
                    <p className="text-xs text-slate-300 py-6 text-center">Sin actividad registrada</p>
                  ) : (
                    <div className="space-y-3.5">
                      {actividad.slice(0, 5).map((a, i) => {
                        const Icon = MODULO_ICON[a.modulo] || Activity;
                        const desc = a.detalles?.descripcion || `${a.accion} ${a.tipo_registro || ''}`.trim();
                        return (
                          <div key={i} className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
                              <Icon size={13} className="text-slate-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-700 truncate">{desc}</p>
                              {esAdmin && <p className="text-[11px] text-slate-400">{a.nombre_usuario}</p>}
                            </div>
                            <span className="text-[10px] text-slate-300 shrink-0 mt-0.5">{relativeTime(a.created_at)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Accesos rápidos */}
                <div className="min-w-0 bg-white rounded-2xl border border-slate-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <p className="font-black text-slate-800 text-sm mb-3.5">Accesos rápidos</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {modulosFiltrados.slice(0, 4).map(mod => {
                      const Icon = mod.icon;
                      return (
                        <button key={mod.id} onClick={() => onNavigateToModule(mod.id)}
                          className="flex flex-col items-start gap-2 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:-translate-y-0.5 transition-all text-left"
                          style={{ background: `${mod.dot}0d` }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${mod.dot}22` }}>
                            <Icon size={15} style={{ color: mod.dot }} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 leading-tight">{mod.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Gráfica */}
                <div className="min-w-0 bg-white rounded-2xl border border-slate-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <p className="font-black text-slate-800 text-sm mb-3">{chartTitle}</p>
                  {chartValues.length > 0 ? (
                    chartTipo === 'linea'
                      ? <MiniLineChart labels={chartLabels} values={chartValues} color={primaryColor} />
                      : <MiniBarChart labels={chartLabels} values={chartValues} color={primaryColor} />
                  ) : (
                    <p className="text-xs text-slate-300 py-14 text-center">Sin datos disponibles</p>
                  )}

                  {donutSegments.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-500 mb-3">Distribución de consultas (7 días)</p>
                      <MiniDonut segments={donutSegments} />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Módulos del sistema */}
          <div>
            <p className="font-black text-slate-800 text-sm mb-3.5">Módulos del sistema</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {modulosFiltrados.map(mod => {
                const Icon = mod.icon;
                return (
                  <button key={mod.id} onClick={() => onNavigateToModule(mod.id)}
                    className="group bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 text-left hover:border-slate-200 hover:-translate-y-0.5 transition-all"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div className="flex items-start justify-between mb-3.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${mod.dot}18` }}>
                        <Icon size={18} style={{ color: mod.dot }} />
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-400 transition-all mt-2" />
                    </div>
                    <p className="font-black text-slate-800 text-sm sm:text-base leading-tight">{mod.name}</p>
                    <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-snug">{mod.description}</p>
                    <div className="flex items-center gap-1.5 mt-3.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: mod.dot }} />
                      <span className="text-xs font-bold" style={{ color: mod.dot }}>Abrir módulo</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 text-xs text-slate-400">
            {modulosFiltrados.length} módulos disponibles · {getRolLabel(rolUsuario)}
          </div>
        </main>
      </div>

      {/* ── Perfil modal ─── */}
      {showPerfil && <PerfilModal onClose={() => setShowPerfil(false)} />}

      {/* ── Dev modal ─────── */}
      <div id="dev-modal"
        className="fixed inset-0 items-center justify-center z-50"
        style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'none' }}
        onClick={e => { if (e.target === e.currentTarget) { const m = document.getElementById('dev-modal'); if (m) m.style.display = 'none'; } }}>
        <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm mx-4 relative animate-scale-in">
          <button onClick={() => { const m = document.getElementById('dev-modal'); if (m) m.style.display = 'none'; }}
            className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">✕</button>
          <div className="text-center mb-5">
            <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-3 shadow-lg bg-white border border-slate-100 flex items-center justify-center">
              <img src="/codenest-logo.png" alt="Codenest" className="w-full h-full object-contain p-1" />
            </div>
            <p className="font-black text-slate-900 text-lg">Desarrollado por</p>
            <p className="mt-1 text-sm">
              <span className="font-bold text-slate-900">code</span>
              <span className="font-bold" style={{ color: '#7C3AED' }}>nest</span>
            </p>
          </div>
          <div className="space-y-2.5">
            <a href="https://www.codenest.business/" target="_blank" rel="noreferrer"
              className="bg-slate-50 hover:bg-slate-100 rounded-xl p-3.5 flex items-center gap-3 transition-colors">
              <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" style={{ color: '#7C3AED' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Sitio web</p>
                <p className="text-sm font-semibold text-slate-700">codenest.business</p>
              </div>
            </a>
            <a href="https://wa.me/50239009547" target="_blank" rel="noreferrer"
              className="bg-slate-50 hover:bg-slate-100 rounded-xl p-3.5 flex items-center gap-3 transition-colors">
              <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">WhatsApp</p>
                <p className="text-sm font-semibold text-slate-700">+502 3900-9547</p>
              </div>
            </a>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">Hecho con <span className="text-red-400">❤</span> en Guatemala</p>
            <p className="text-xs text-slate-300 mt-1 font-mono">React · Vite · Supabase · PostgreSQL</p>
          </div>
        </div>
      </div>
    </div>
  );
};
