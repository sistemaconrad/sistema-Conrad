import React, { useState } from 'react';
import {
  ArrowLeft, Users, Stethoscope, DollarSign, FileSpreadsheet,
  MapPin, CreditCard, LogOut, UserPlus, LayoutDashboard, CalendarDays, Menu, X
} from 'lucide-react';
import { MedicosView }              from './MedicosView';
import { VisitasView }              from './VisitasView';
import { ComisionesView }           from './ComisionesView';
import { ReportesVisitadorasView }  from './ReportesVisitadorasView';
import { PagosComisionesView }      from './PagosComisionesView';
import { ProspectosView }           from './ProspectosView';
import { DashboardView }            from './DashboardView';
import { PlanificadorView }         from './PlanificadorView';

interface VisitadorasHomePageProps {
  onBack: () => void;
}

type TabKey = 'dashboard' | 'visitas' | 'prospectos' | 'medicos' | 'comisiones' | 'pagos' | 'reportes' | 'planificador';

export const VisitadorasHomePage: React.FC<VisitadorasHomePageProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [mobileNav, setMobileNav] = useState(false);

  const rolUsuario    = localStorage.getItem('rolUsuarioConrad');
  const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || '';
  const esVisitadora  = rolUsuario === 'visitadora';

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('nombreUsuarioConrad');
    localStorage.removeItem('usernameConrad');
    localStorage.removeItem('rolUsuarioConrad');
    window.location.reload();
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; soloAdmin?: boolean }[] = [
    { key: 'dashboard',    label: 'Dashboard',         icon: <LayoutDashboard size={15} /> },
    { key: 'visitas',      label: 'Visitas',            icon: <MapPin size={15} /> },
    { key: 'prospectos',   label: 'Prospectos',         icon: <UserPlus size={15} /> },
    { key: 'planificador', label: 'Planificador',       icon: <CalendarDays size={15} /> },
    { key: 'medicos',      label: 'Médicos',            icon: <Stethoscope size={15} /> },
    { key: 'comisiones',   label: 'Comisiones',         icon: <DollarSign size={15} />, soloAdmin: true },
    { key: 'pagos',        label: 'Pagos',              icon: <CreditCard size={15} />, soloAdmin: true },
    { key: 'reportes',     label: 'Reportes',           icon: <FileSpreadsheet size={15} /> },
  ];

  const tabsVisibles = tabs.filter(t => !t.soloAdmin || !esVisitadora);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':    return <DashboardView />;
      case 'visitas':      return <VisitasView />;
      case 'prospectos':   return <ProspectosView />;
      case 'planificador': return <PlanificadorView />;
      case 'medicos':      return <MedicosView />;
      case 'comisiones':   return <ComisionesView />;
      case 'pagos':        return <PagosComisionesView />;
      case 'reportes':     return <ReportesVisitadorasView />;
    }
  };

  const activeTabDef = tabsVisibles.find(t => t.key === activeTab);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header style={{ background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 50%, #0d9488 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Top bar */}
          <div className="flex items-center justify-between py-3 sm:py-4">
            <div className="flex items-center gap-3">
              {esVisitadora ? null : (
                <button onClick={onBack}
                  className="flex items-center gap-1.5 text-teal-200 hover:text-white transition-colors text-sm font-medium mr-1">
                  <ArrowLeft size={16} />
                  <span className="hidden sm:inline">Volver</span>
                </button>
              )}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <Users size={18} className="text-white" />
                </div>
                <div>
                  <h1 className="text-white font-black text-base sm:text-lg leading-tight">Visitadoras Médicas</h1>
                  <p className="text-teal-200/70 text-xs hidden sm:block">Gestión de visitas, médicos y comisiones</p>
                </div>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              {esVisitadora && (
                <p className="text-teal-200 text-sm hidden sm:block">
                  <span className="text-white/50 mr-1">Bienvenida,</span>
                  <span className="font-semibold text-white">{nombreUsuario}</span>
                </p>
              )}
              {/* Mobile nav toggle */}
              <button onClick={() => setMobileNav(s => !s)}
                className="sm:hidden p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                {mobileNav ? <X size={20} /> : <Menu size={20} />}
              </button>
              {esVisitadora && (
                <button onClick={handleLogout}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors border border-white/20">
                  <LogOut size={14} /> Salir
                </button>
              )}
            </div>
          </div>

          {/* Tab bar — desktop */}
          <div className="tab-bar hidden sm:flex">
            {tabsVisibles.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
              >
                {tab.icon}
                {tab.label}
                {tab.key === 'prospectos' && activeTab !== 'prospectos' && (
                  <span className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-white font-black text-xs"
                    style={{ background: '#f97316', fontSize: '10px' }}>!</span>
                )}
              </button>
            ))}
          </div>

          {/* Mobile: current tab indicator */}
          <div className="sm:hidden pb-3 flex items-center gap-2">
            <span className="text-teal-200/60 text-xs">Módulo:</span>
            <span className="text-white text-sm font-semibold flex items-center gap-1.5">
              {activeTabDef?.icon}
              {activeTabDef?.label}
            </span>
          </div>
        </div>
      </header>

      {/* ── MOBILE NAV DRAWER ───────────────────────────────── */}
      {mobileNav && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
          <div className="relative w-72 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #0f172a, #134e4a)' }}>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-teal-300" />
                <span className="text-white font-bold text-sm">Visitadoras</span>
              </div>
              <button onClick={() => setMobileNav(false)} className="text-white/60 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {tabsVisibles.map(tab => (
                <button key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setMobileNav(false); }}
                  className={`nav-item ${activeTab === tab.key ? 'active' : ''}`}>
                  {tab.icon}
                  {tab.label}
                  {tab.key === 'prospectos' && activeTab !== 'prospectos' && (
                    <span className="ml-auto w-5 h-5 flex items-center justify-center rounded-full text-white font-black"
                      style={{ background: '#f97316', fontSize: '10px' }}>!</span>
                  )}
                </button>
              ))}
            </nav>
            {esVisitadora && (
              <div className="p-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-2">Sesión activa como</p>
                <p className="text-sm font-bold text-slate-800 mb-3">{nombreUsuario}</p>
                <button onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-red-500 border border-red-100 hover:bg-red-50 transition-colors">
                  <LogOut size={14} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CONTENT ─────────────────────────────────────────── */}
      <main className="page-container max-w-7xl mx-auto">
        {renderContent()}
      </main>
    </div>
  );
};
