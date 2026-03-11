import React, { useState } from 'react';
import { ArrowLeft, Users, Stethoscope, DollarSign, FileSpreadsheet, MapPin, CreditCard, LogOut } from 'lucide-react';
import { MedicosView } from './MedicosView';
import { VisitasView } from './VisitasView';
import { ComisionesView } from './ComisionesView';
import { ReportesVisitadorasView } from './ReportesVisitadorasView';
import { PagosComisionesView } from './PagosComisionesView';

interface VisitadorasHomePageProps {
  onBack: () => void;
}

type TabKey = 'visitas' | 'medicos' | 'comisiones' | 'pagos' | 'reportes';

export const VisitadorasHomePage: React.FC<VisitadorasHomePageProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('visitas');
  const rolUsuario = localStorage.getItem('rolUsuarioConrad');
  const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || '';
  const esVisitadora = rolUsuario === 'visitadora';

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('nombreUsuarioConrad');
    localStorage.removeItem('usernameConrad');
    localStorage.removeItem('rolUsuarioConrad');
    window.location.reload();
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'visitas',     label: 'Visitas',            icon: <MapPin size={16} /> },
    { key: 'medicos',     label: 'Médicos Referentes', icon: <Stethoscope size={16} /> },
    { key: 'comisiones',  label: 'Comisiones',         icon: <DollarSign size={16} /> },
    { key: 'pagos',       label: 'Pago Comisiones',    icon: <CreditCard size={16} /> },
    { key: 'reportes',    label: 'Reportes',           icon: <FileSpreadsheet size={16} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'visitas':    return <VisitasView />;
      case 'medicos':    return <MedicosView />;
      case 'comisiones': return <ComisionesView />;
      case 'pagos':      return <PagosComisionesView />;
      case 'reportes':   return <ReportesVisitadorasView />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-5">
          {esVisitadora ? (
            <div className="flex items-center justify-between mb-3">
              <p className="text-pink-100 text-sm">Bienvenida, <span className="font-semibold text-white">{nombreUsuario}</span></p>
              <button onClick={handleLogout}
                className="flex items-center gap-1.5 text-pink-100 hover:text-white transition-colors text-sm">
                <LogOut size={14} /> Cerrar sesión
              </button>
            </div>
          ) : (
            <button onClick={onBack}
              className="flex items-center gap-2 text-pink-100 hover:text-white mb-3 transition-colors text-sm">
              <ArrowLeft size={16} />
              Volver al Dashboard
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2.5">
              <Users size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Visitadoras Médicas</h1>
              <p className="text-pink-100 text-sm">Gestión de visitas, médicos referentes y comisiones</p>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab.key
                    ? 'border-white text-white bg-white/10'
                    : 'border-transparent text-pink-200 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="container mx-auto px-4 py-6">
        {renderContent()}
      </div>
    </div>
  );
};