import React, { useState, useEffect } from 'react';
import { PerfilModal } from '../components/PerfilModal';
import {
  Activity, Package, LogOut, Users, Banknote, UserCog,
  Stethoscope, Calendar, ChevronRight, LayoutGrid, Folder,
  Menu, X
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateToModule: (module: string) => void;
  onLogout: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToModule, onLogout }) => {
  const rolUsuario   = localStorage.getItem('rolUsuarioConrad') || 'secretaria';
  const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || 'Usuario';
  const [showPerfil, setShowPerfil] = useState(false);
  const [fotoUrl, setFotoUrl]       = useState('');
  const [menuOpen, setMenuOpen]     = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (await import('../lib/supabase')).supabase
        .from('perfiles_usuario')
        .select('foto_url, nombre_completo')
        .eq('username', localStorage.getItem('usernameConrad') || '')
        .maybeSingle();
      if (data?.foto_url)       setFotoUrl(data.foto_url);
      if (data?.nombre_completo) localStorage.setItem('nombreUsuarioConrad', data.nombre_completo);
    })();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('rolUsuarioConrad');
    onLogout();
  };

  const permisosPorRol: Record<string, string[]> = {
    admin:      ['sanatorio', 'inventario', 'contabilidad', 'personal', 'doctores', 'visitadoras', 'documentos'],
    secretaria: ['sanatorio', 'inventario', 'visitadoras', 'documentos'],
    visitadora: ['visitadoras', 'documentos'],
    doctor:     ['doctores', 'documentos'],
  };
  const modulosPermitidos = permisosPorRol[rolUsuario] || permisosPorRol.secretaria;

  const getRolLabel = (rol: string) =>
    ({ admin: 'Administrador', secretaria: 'Secretaria', doctor: 'Doctor', visitadora: 'Visitadora' }[rol] || 'Usuario');

  interface ModuleDef {
    id: string; name: string; description: string; icon: any;
    gradient: string; accent: string; dot: string;
  }

  const modules: ModuleDef[] = [
    {
      id: 'sanatorio', name: 'Centro de Diagnóstico',
      description: 'Consultas, pacientes y estudios',
      icon: Activity,
      gradient: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #1d4ed8 100%)',
      accent: 'rgba(147,197,253,0.8)', dot: '#3b82f6',
    },
    {
      id: 'inventario', name: 'Inventario',
      description: 'Productos, stock y suministros',
      icon: Package,
      gradient: 'linear-gradient(135deg, #052e16 0%, #14532d 55%, #16a34a 100%)',
      accent: 'rgba(134,239,172,0.8)', dot: '#22c55e',
    },
    {
      id: 'contabilidad', name: 'Contabilidad',
      description: 'Finanzas, ingresos y gastos',
      icon: Banknote,
      gradient: 'linear-gradient(135deg, #0c1a3a 0%, #0c4a6e 55%, #0284c7 100%)',
      accent: 'rgba(186,230,253,0.8)', dot: '#38bdf8',
    },
    {
      id: 'personal', name: 'Recursos Humanos',
      description: 'Personal, nómina y asistencia',
      icon: UserCog,
      gradient: 'linear-gradient(135deg, #1e1035 0%, #4a1d96 55%, #7c3aed 100%)',
      accent: 'rgba(221,214,254,0.8)', dot: '#a78bfa',
    },
    {
      id: 'doctores', name: 'Módulo de Doctores',
      description: 'Informes médicos y estudios',
      icon: Stethoscope,
      gradient: 'linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #0d9488 100%)',
      accent: 'rgba(153,246,228,0.8)', dot: '#2dd4bf',
    },
    {
      id: 'visitadoras', name: 'Visitadoras Médicas',
      description: 'Visitas, comisiones y referentes',
      icon: Users,
      gradient: 'linear-gradient(135deg, #1c0533 0%, #6b21a8 55%, #a855f7 100%)',
      accent: 'rgba(233,213,255,0.8)', dot: '#c084fc',
    },
    {
      id: 'documentos', name: 'Repositorio',
      description: 'Archivos y documentos compartidos',
      icon: Folder,
      gradient: 'linear-gradient(135deg, #172554 0%, #1e40af 55%, #4f46e5 100%)',
      accent: 'rgba(199,210,254,0.8)', dot: '#818cf8',
    },
  ];

  const modulosFiltrados = modules.filter(m => modulosPermitidos.includes(m.id));

  const avatarLetter = nombreUsuario.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #f0f4f8 0%, #e8edf5 100%)' }}>

      {/* ── HEADER ───────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30"
        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', boxShadow: '0 2px 8px rgba(13,148,136,0.35)' }}>
              <Activity size={16} className="text-white" />
            </div>
            <span className="font-black text-slate-900 text-base tracking-tight">CONRAD</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-800 leading-tight">{nombreUsuario}</p>
              <p className="text-xs text-slate-400">{getRolLabel(rolUsuario)}</p>
            </div>

            {/* Avatar */}
            <button onClick={() => setShowPerfil(true)}
              className="relative flex items-center justify-center rounded-xl overflow-hidden w-9 h-9 border-2 border-teal-100 hover:border-teal-400 transition-colors"
              style={{ flexShrink: 0 }}>
              {fotoUrl
                ? <img src={fotoUrl} alt="avatar" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center font-black text-sm text-white"
                    style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}>
                    {avatarLetter}
                  </div>
              }
              <div className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-white" />
            </button>

            {/* Logout */}
            <button onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 border border-red-100 transition-colors">
              <LogOut size={14} /> Salir
            </button>

            {/* Mobile menu */}
            <button onClick={() => setMenuOpen(s => !s)}
              className="sm:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors">
              {menuOpen ? <X size={20} className="text-slate-600" /> : <Menu size={20} className="text-slate-600" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1 animate-fade-in">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}>
                {avatarLetter}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{nombreUsuario}</p>
                <p className="text-xs text-slate-400">{getRolLabel(rolUsuario)}</p>
              </div>
            </div>
            <button onClick={() => { setShowPerfil(true); setMenuOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Mi perfil
            </button>
            <button onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2">
              <LogOut size={14} /> Cerrar sesión
            </button>
          </div>
        )}
      </header>

      {/* ── CONTENT ──────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Welcome */}
        <div className="mb-6">
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            Bienvenido, {nombreUsuario.split(' ')[0]} 👋
          </p>
          <p className="text-slate-400 text-sm mt-1">Selecciona el módulo que deseas gestionar</p>
        </div>

        {/* Resumen del día — solo admin */}
        {rolUsuario === 'admin' && (
          <button onClick={() => onNavigateToModule('resumen')}
            className="w-full mb-5 text-left rounded-2xl overflow-hidden group transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 50%, #0d9488 100%)',
              boxShadow: '0 8px 24px rgba(13,148,136,0.25)',
            }}>
            <div className="px-5 py-4 sm:py-5 flex items-center gap-4">
              <div className="rounded-xl p-3 shrink-0"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}>
                <Calendar size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-base sm:text-lg">📊 Resumen del Día</p>
                <p className="text-sm mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Vista general, actividades y códigos de autorización
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-xl px-4 py-2 text-white text-sm font-bold group-hover:bg-white/20 transition-colors shrink-0"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}>
                Abrir <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
              <ChevronRight size={20} className="sm:hidden text-white/60 shrink-0" />
            </div>
          </button>
        )}

        {/* Module grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {modulosFiltrados.map(mod => {
            const Icon = mod.icon;
            return (
              <button key={mod.id}
                onClick={() => onNavigateToModule(mod.id)}
                className="module-card group"
                style={{ background: mod.gradient }}>
                <div className="relative overflow-hidden px-4 pt-5 pb-4 sm:px-5">
                  {/* Ghost icon background */}
                  <div className="absolute -right-3 -top-3 opacity-[0.07]">
                    <Icon size={80} className="text-white" />
                  </div>
                  <div className="relative z-10">
                    {/* Icon */}
                    <div className="rounded-xl p-2.5 w-fit mb-3.5"
                      style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)' }}>
                      <Icon size={19} className="text-white" />
                    </div>
                    <p className="font-black text-white text-sm sm:text-base leading-tight">{mod.name}</p>
                    <p className="mt-1 text-xs sm:text-sm leading-snug hidden sm:block" style={{ color: mod.accent }}>{mod.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 sm:px-5 py-2.5"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.12)' }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: mod.dot }} />
                    <span className="text-xs font-semibold text-white/60">Abrir</span>
                  </div>
                  <ChevronRight size={14} className="text-white/50 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between text-xs text-slate-400">
          <span>{modulosFiltrados.length} módulos disponibles · {getRolLabel(rolUsuario)}</span>
          <button
            onClick={() => { const m = document.getElementById('dev-modal'); if (m) m.style.display = 'flex'; }}
            className="font-mono hover:text-slate-600 transition-colors">&lt;/&gt;</button>
        </div>
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
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', boxShadow: '0 8px 20px rgba(13,148,136,0.3)' }}>
              <span className="text-white text-lg font-black">&lt;/&gt;</span>
            </div>
            <p className="font-black text-slate-900 text-lg">Desarrollado por</p>
            <p className="text-slate-500 mt-1 text-sm">Jonnathan David Franco Hernández</p>
          </div>
          <div className="space-y-2.5">
            <div className="bg-slate-50 rounded-xl p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Email</p>
                <p className="text-sm font-semibold text-slate-700">aguilarhz20001@gmail.com</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">WhatsApp</p>
                <p className="text-sm font-semibold text-slate-700">3658-3824</p>
              </div>
            </div>
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
