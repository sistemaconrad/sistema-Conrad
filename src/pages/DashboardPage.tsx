import React from 'react';
import { Activity, Package, LogOut, Users, Banknote, UserCog, Stethoscope, Calendar, ChevronRight, LayoutGrid } from 'lucide-react';

interface DashboardPageProps {
  onNavigateToModule: (module: string) => void;
  onLogout: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToModule, onLogout }) => {
  const rolUsuario = localStorage.getItem('rolUsuarioConrad') || 'secretaria';
  const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || 'Usuario';

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('rolUsuarioConrad');
    onLogout();
  };

  const permisosPorRol: { [key: string]: string[] } = {
    'admin':      ['sanatorio', 'inventario', 'contabilidad', 'personal', 'doctores', 'visitadoras'],
    'secretaria': ['sanatorio', 'inventario', 'visitadoras'],
    'visitadora': ['visitadoras'],
    'doctor':     ['doctores'],
  };

  const modulosPermitidos = permisosPorRol[rolUsuario] || permisosPorRol['secretaria'];

  const getRolLabel = (rol: string) => ({ admin:'Administrador', secretaria:'Secretaria', doctor:'Doctor', visitadora:'Visitadora' }[rol] || 'Usuario');

  interface ModuleDef {
    id: string; name: string; description: string; icon: any;
    bg: string; accent: string; iconBg: string; tag?: string;
  }

  const modules: ModuleDef[] = [
    {
      id: 'sanatorio', name: 'Centro de Diagnóstico',
      description: 'Consultas, pacientes y estudios médicos',
      icon: Activity,
      bg: 'linear-gradient(135deg,#1d4ed8 0%,#2563eb 60%,#3b82f6 100%)',
      accent: '#93c5fd', iconBg: 'rgba(255,255,255,0.18)',
    },
    {
      id: 'inventario', name: 'Inventario',
      description: 'Productos, stock y suministros',
      icon: Package,
      bg: 'linear-gradient(135deg,#059669 0%,#10b981 60%,#34d399 100%)',
      accent: '#6ee7b7', iconBg: 'rgba(255,255,255,0.18)',
    },
    {
      id: 'contabilidad', name: 'Contabilidad',
      description: 'Finanzas, ingresos y gastos',
      icon: Banknote,
      bg: 'linear-gradient(135deg,#0891b2 0%,#06b6d4 60%,#22d3ee 100%)',
      accent: '#a5f3fc', iconBg: 'rgba(255,255,255,0.18)',
    },
    {
      id: 'personal', name: 'Recursos Humanos',
      description: 'Personal, nómina y asistencia',
      icon: UserCog,
      bg: 'linear-gradient(135deg,#7c3aed 0%,#8b5cf6 60%,#a78bfa 100%)',
      accent: '#c4b5fd', iconBg: 'rgba(255,255,255,0.18)',
    },
    {
      id: 'doctores', name: 'Módulo de Doctores',
      description: 'Informes médicos y estudios',
      icon: Stethoscope,
      bg: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1d4ed8 100%)',
      accent: '#93c5fd', iconBg: 'rgba(255,255,255,0.18)',
    },
    {
      id: 'visitadoras', name: 'Visitadoras Médicas',
      description: 'Visitas, comisiones y referentes',
      icon: Users,
      bg: 'linear-gradient(135deg,#be185d 0%,#ec4899 60%,#f9a8d4 100%)',
      accent: '#fce7f3', iconBg: 'rgba(255,255,255,0.18)',
    },
  ];

  const modulosFiltrados = modules.filter(m => modulosPermitidos.includes(m.id));

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#f0f4f8 0%,#e8edf5 100%)' }}>

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-2 shadow-sm shadow-blue-200">
              <LayoutGrid size={20} className="text-white" />
            </div>
            <div>
              <p className="font-black text-gray-900 leading-none text-base">CONRAD</p>
              <p className="text-gray-400 text-xs mt-0.5">Sistema de Gestión</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-800">{nombreUsuario}</p>
              <p className="text-xs text-gray-400">{getRolLabel(rolUsuario)}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
              {nombreUsuario.charAt(0).toUpperCase()}
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold shadow-sm shadow-red-200 transition-all">
              <LogOut size={15} /> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">

        {/* ── Bienvenida ── */}
        <div className="mb-8">
          <p className="text-2xl font-black text-gray-900">Bienvenido, {nombreUsuario} 👋</p>
          <p className="text-gray-400 text-sm mt-1">Selecciona el módulo que deseas gestionar</p>
        </div>

        {/* ── Resumen del Día (solo admin) ── */}
        {rolUsuario === 'admin' && (
          <button onClick={() => onNavigateToModule('resumen')}
            className="w-full mb-6 text-left rounded-2xl overflow-hidden shadow-lg shadow-indigo-200/50 transition-all hover:shadow-xl hover:shadow-indigo-200/70 hover:-translate-y-0.5 group"
            style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#3730a3 50%,#6366f1 100%)' }}>
            <div className="px-6 py-5 flex items-center gap-5">
              <div className="bg-white/15 border border-white/20 rounded-2xl p-3.5 backdrop-blur-sm shrink-0">
                <Calendar size={26} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-black text-lg">📊 Resumen del Día</p>
                <p className="text-indigo-200 text-sm mt-0.5">Vista general, actividades y códigos de autorización</p>
              </div>
              <div className="flex items-center gap-2 bg-white/15 border border-white/20 rounded-xl px-4 py-2 text-white text-sm font-bold group-hover:bg-white/25 transition-colors">
                Abrir <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </button>
        )}

        {/* ── Grid de módulos ── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modulosFiltrados.map(mod => {
            const Icon = mod.icon;
            return (
              <button key={mod.id}
                onClick={() => onNavigateToModule(mod.id)}
                className="text-left rounded-2xl overflow-hidden shadow-md transition-all duration-200 hover:shadow-xl hover:-translate-y-1 group"
                style={{ background: mod.bg }}>
                {/* Decorative blob */}
                <div className="relative overflow-hidden px-5 pt-5 pb-4">
                  <div className="absolute -right-4 -top-4 opacity-10">
                    <Icon size={96} className="text-white" />
                  </div>
                  <div className="relative z-10">
                    <div className="rounded-xl p-3 w-fit mb-4" style={{ background: mod.iconBg, border: '1px solid rgba(255,255,255,0.2)' }}>
                      <Icon size={22} className="text-white" />
                    </div>
                    <p className="font-black text-white text-base leading-tight">{mod.name}</p>
                    <p className="mt-1.5 text-sm leading-snug" style={{ color: mod.accent }}>{mod.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.1)' }}>
                  <span className="text-xs font-bold text-white/70">Abrir módulo</span>
                  <ChevronRight size={16} className="text-white/60 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Footer info ── */}
        <div className="mt-10 flex items-center justify-between text-xs text-gray-400">
          <span>{modulosFiltrados.length} módulos disponibles · {getRolLabel(rolUsuario)}</span>
          <button
            onClick={() => { const m = document.getElementById('dev-modal'); if (m) m.style.display='flex'; }}
            className="font-mono hover:text-gray-600 transition-colors">&lt;/&gt;</button>
        </div>
      </div>

      {/* ── Modal dev ── */}
      <div id="dev-modal" className="fixed inset-0 bg-black/50 items-center justify-center z-50" style={{ display:'none' }}
        onClick={e => { if (e.target === e.currentTarget) { const m = document.getElementById('dev-modal'); if(m) m.style.display='none'; } }}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-4 relative">
          <button onClick={() => { const m = document.getElementById('dev-modal'); if(m) m.style.display='none'; }}
            className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">✕</button>
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-200">
              <span className="text-white text-lg font-black">&lt;/&gt;</span>
            </div>
            <p className="font-black text-gray-900 text-lg">Desarrollado por</p>
            <p className="text-gray-600 mt-1">Jonnathan David Franco Hernández</p>
          </div>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-xl p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400">EMAIL</p>
                <p className="text-sm font-semibold text-gray-800">aguilarhz20001@gmail.com</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400">TELÉFONO / WHATSAPP</p>
                <p className="text-sm font-semibold text-gray-800">3658-3824</p>
              </div>
            </div>
          </div>
          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">Hecho con <span className="text-red-400">❤</span> en Guatemala</p>
            <p className="text-xs text-gray-300 mt-1 font-mono">React · Vite · Supabase · PostgreSQL</p>
          </div>
        </div>
      </div>
    </div>
  );
};