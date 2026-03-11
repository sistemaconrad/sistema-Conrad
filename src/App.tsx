import { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { ProductosPage } from './pages/ProductosPage';
import { ReferentesPage } from './pages/ReferentesPage';
import { PacientesPage } from './pages/PacientesPage';
import { CuadreDiarioPage } from './pages/CuadreDiarioPage';
import { CuadreQuincenalPage } from './pages/CuadreQuincenalPage';
import { EstadisticasPage } from './pages/EstadisticasPage';
import { ReportesPage } from './pages/ReportesPage';
import { GestionUsuariosPage } from './pages/GestionUsuariosPage';

// Módulo de Inventario
import { InventarioHomePage } from './pages/InventarioHomePage';
import { ProductosInventarioPage } from './pages/ProductosInventarioPage';
import { MovimientosPage } from './pages/MovimientosPage';
import { ProveedoresPage } from './pages/ProveedoresPage';

// Módulos faltantes
import { ContabilidadPage } from './pages/ContabilidadPage';
import { PersonalPage } from './pages/PersonalPage';
import { DoctoresPage } from './pages/DoctoresPage';
import { ResumenDiaPage } from './pages/ResumenDiaPage';

// Módulo de Visitadoras Médicas
import { VisitadorasHomePage } from './pages/visitadoras/VisitadorasHomePage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [currentPage, setCurrentPage] = useState('home');

  useEffect(() => {
    const auth = localStorage.getItem('isAuthenticated');
    setIsAuthenticated(auth === 'true');
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    const rol = localStorage.getItem('rolUsuarioConrad');
    if (rol === 'visitadora') {
      setCurrentModule('visitadoras');
    } else {
      setCurrentModule('dashboard');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentModule('dashboard');
    setCurrentPage('home');
  };

  const handleNavigateToModule = (module: string) => {
    setCurrentModule(module);
    setCurrentPage('home');
  };

  const handleBackToDashboard = () => {
    setCurrentModule('dashboard');
    setCurrentPage('home');
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (currentModule === 'dashboard') {
    return (
      <DashboardPage
        onNavigateToModule={handleNavigateToModule}
        onLogout={handleLogout}
      />
    );
  }

  if (currentModule === 'sanatorio') {
    const renderPage = () => {
      switch (currentPage) {
        case 'home': return <HomePage onNavigate={setCurrentPage} />;
        case 'productos': return <ProductosPage onBack={() => setCurrentPage('home')} />;
        case 'referentes': return <ReferentesPage onBack={() => setCurrentPage('home')} />;
        case 'pacientes': return <PacientesPage onBack={() => setCurrentPage('home')} />;
        case 'cuadre': return <CuadreDiarioPage onBack={() => setCurrentPage('home')} />;
        case 'cuadre-quincenal': return <CuadreQuincenalPage onBack={() => setCurrentPage('home')} />;
        case 'estadisticas': return <EstadisticasPage onBack={() => setCurrentPage('home')} />;
        case 'reportes': return <ReportesPage onBack={() => setCurrentPage('home')} />;
        case 'usuarios': return <GestionUsuariosPage onBack={() => setCurrentPage('home')} />;
        default: return <HomePage onNavigate={setCurrentPage} />;
      }
    };
    return (
      <div>
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={handleBackToDashboard}
            className="bg-white shadow-md px-3 py-1.5 rounded hover:bg-gray-50 transition-colors text-xs font-medium border border-gray-300"
          >
            ← Dashboard
          </button>
        </div>
        {renderPage()}
      </div>
    );
  }

  if (currentModule === 'inventario') {
    const renderPage = () => {
      switch (currentPage) {
        case 'home': return <InventarioHomePage onNavigate={setCurrentPage} />;
        case 'productos': return <ProductosInventarioPage onBack={() => setCurrentPage('home')} />;
        case 'movimientos': return <MovimientosPage onBack={() => setCurrentPage('home')} />;
        case 'proveedores': return <ProveedoresPage onBack={() => setCurrentPage('home')} />;
        default: return <InventarioHomePage onNavigate={setCurrentPage} />;
      }
    };
    return (
      <div>
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={handleBackToDashboard}
            className="bg-white shadow-md px-3 py-1.5 rounded hover:bg-gray-50 transition-colors text-xs font-medium border border-gray-300"
          >
            ← Dashboard
          </button>
        </div>
        {renderPage()}
      </div>
    );
  }

  // ✅ Módulo de Visitadoras Médicas — integrado nativamente
  if (currentModule === 'visitadoras') {
    return <VisitadorasHomePage onBack={handleBackToDashboard} />;
  }

  if (currentModule === 'contabilidad') {
    return <ContabilidadPage onBack={handleBackToDashboard} />;
  }

  if (currentModule === 'personal') {
    return <PersonalPage onBack={handleBackToDashboard} />;
  }

  if (currentModule === 'doctores') {
    return <DoctoresPage onBack={handleBackToDashboard} />;
  }

  if (currentModule === 'resumen') {
    return <ResumenDiaPage onBack={handleBackToDashboard} />;
  }

  return <DashboardPage onNavigateToModule={handleNavigateToModule} onLogout={handleLogout} />;
}

export default App;