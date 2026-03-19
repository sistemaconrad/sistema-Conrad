import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Users, 
  Clock, 
  DollarSign, 
  Calendar,
  UserPlus,
  FileText,
  TrendingUp,
  Settings
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EmpleadosPage } from './EmpleadosPage';
import { AsistenciaPage } from './AsistenciaPage';
import { NominaPage } from './NominaPage';
import { ConfiguracionPage } from './ConfiguracionPage';
import { AusenciasPage } from './AusenciasPage';
import { ReportesPersonalPage } from './ReportesPersonalPage';

interface PersonalPageProps {
  onBack: () => void;
}

type Vista = 'dashboard' | 'empleados' | 'asistencia' | 'nomina' | 'configuracion' | 'ausencias' | 'reportes';

export const PersonalPage: React.FC<PersonalPageProps> = ({ onBack }) => {
  const [vistaActual, setVistaActual] = useState<Vista>('dashboard');
  const [loading, setLoading] = useState(false);
  
  const [estadisticas, setEstadisticas] = useState({
    totalEmpleados: 0,
    empleadosActivos: 0,
    ausenciasHoy: 0,
    totalNomina: 0
  });

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      // Total empleados
      const { data: empleados } = await supabase
        .from('empleados')
        .select('id, estado, salario_mensual');

      const total = empleados?.length || 0;
      const activos = empleados?.filter(e => e.estado === 'activo').length || 0;
      const totalNomina = empleados
        ?.filter(e => e.estado === 'activo')
        .reduce((sum, e) => sum + (e.salario_mensual || 0), 0) || 0;

      // Ausencias hoy
      const hoy = new Date().toISOString().split('T')[0];
      const { data: ausencias } = await supabase
        .from('ausencias')
        .select('id')
        .lte('fecha_inicio', hoy)
        .gte('fecha_fin', hoy)
        .eq('estado', 'aprobado');

      setEstadisticas({
        totalEmpleados: total,
        empleadosActivos: activos,
        ausenciasHoy: ausencias?.length || 0,
        totalNomina: totalNomina
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // VISTAS INTERNAS
  if (vistaActual === 'empleados') {
    return <EmpleadosPage onBack={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'asistencia') {
    return <AsistenciaPage onBack={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'nomina') {
    return <NominaPage onBack={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'configuracion') {
    return <ConfiguracionPage onBack={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'ausencias') {
    return <AusenciasPage onBack={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual === 'reportes') {
    return <ReportesPersonalPage onBack={() => setVistaActual('dashboard')} />;
  }

  if (vistaActual !== 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%)'}}>
          <div className="max-w-7xl mx-auto px-6 py-6">
            <button onClick={() => setVistaActual('dashboard')}
              className="flex items-center gap-2 text-indigo-200 hover:text-white mb-4 text-sm font-medium transition-colors group">
              <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver
            </button>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {vistaActual === 'empleados' && 'Gestión de Empleados'}
              {vistaActual === 'asistencia' && 'Control de Asistencia'}
              {vistaActual === 'nomina' && 'Nómina'}
            </h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-10 text-center">
            <p className="text-indigo-800 font-black text-lg">🚧 Módulo en desarrollo</p>
            <p className="text-indigo-600 mt-2 text-sm">Próximamente disponible</p>
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD PRINCIPAL
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── HEADER ── */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%)'}}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-indigo-200 hover:text-white mb-5 text-sm font-medium transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver al Dashboard
          </button>
          <div className="flex items-center gap-4">
            <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
              <Users size={24} className="text-indigo-200" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Recursos Humanos</h1>
              <p className="text-indigo-300 text-sm mt-0.5">Gestión de personal y nómina</p>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Total Empleados', val: estadisticas.totalEmpleados,  icon: <Users size={16} className="text-indigo-300" />,   color: 'text-white'       },
              { label: 'Activos',         val: estadisticas.empleadosActivos, icon: <Clock size={16} className="text-emerald-300" />,  color: 'text-emerald-300' },
              { label: 'Ausencias Hoy',   val: estadisticas.ausenciasHoy,     icon: <Calendar size={16} className="text-amber-300" />, color: estadisticas.ausenciasHoy > 0 ? 'text-amber-300' : 'text-white' },
              { label: 'Nómina Mensual',  val: `Q ${estadisticas.totalNomina.toLocaleString('es-GT',{minimumFractionDigits:2})}`, icon: <DollarSign size={16} className="text-blue-300" />, color: 'text-blue-200' },
            ].map((s, i) => (
              <div key={i} className="bg-white/10 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide">{s.label}</span>
                  {s.icon}
                </div>
                <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Módulos ── */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { vista: 'empleados',     label: 'Empleados',     desc: 'Gestionar personal y datos',    icon: Users,      grad: 'from-indigo-600 to-violet-600',  shadow: 'shadow-indigo-200'  },
            { vista: 'asistencia',    label: 'Asistencia',    desc: 'Control de horarios',           icon: Clock,      grad: 'from-emerald-600 to-teal-600',   shadow: 'shadow-emerald-200' },
            { vista: 'nomina',        label: 'Nómina',        desc: 'Calcular y generar pagos',      icon: DollarSign, grad: 'from-blue-600 to-cyan-600',      shadow: 'shadow-blue-200'    },
            { vista: 'configuracion', label: 'Configuración', desc: 'Departamentos y puestos',       icon: Settings,   grad: 'from-violet-600 to-purple-600',  shadow: 'shadow-violet-200'  },
            { vista: 'ausencias',     label: 'Ausencias',     desc: 'Permisos y vacaciones',         icon: Calendar,   grad: 'from-amber-500 to-orange-500',   shadow: 'shadow-amber-200'   },
            { vista: 'reportes',      label: 'Reportes',      desc: 'Reportes de RR.HH.',            icon: FileText,   grad: 'from-violet-700 to-indigo-700',  shadow: 'shadow-violet-200'  },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <button key={i}
                onClick={() => item.vista && setVistaActual(item.vista as Vista)}
                className={`bg-gradient-to-br ${item.grad} text-white rounded-2xl p-6 text-left shadow-lg ${item.shadow} hover:shadow-xl transition-all hover:-translate-y-1 group relative overflow-hidden`}>
                <div className="absolute -right-3 -bottom-3 opacity-10"><Icon size={80} /></div>
                <div className="bg-white/20 rounded-xl p-3 w-fit mb-4 border border-white/20">
                  <Icon size={20} className="text-white" />
                </div>
                <p className="font-black text-lg leading-tight">{item.label}</p>
                <p className="text-white/70 text-sm mt-1">{item.desc}</p>

              </button>
            );
          })}
        </div>

        {/* ── Info ── */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-indigo-100 rounded-lg p-1.5"><TrendingUp size={13} className="text-indigo-600" /></div>
            <span className="text-xs font-black text-indigo-800 uppercase tracking-wide">Sistema de Recursos Humanos</span>
          </div>
          <ul className="space-y-1.5">
            {[
              ['Empleados', 'Gestión completa del personal'],
              ['Asistencia', 'Control de entradas y salidas'],
              ['Nómina', 'Cálculo flexible de salarios'],
              ['Reportes', 'Exportación a Excel disponible'],
            ].map(([k, v], i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-indigo-700">
                <div className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <span><strong>{k}:</strong> {v}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};