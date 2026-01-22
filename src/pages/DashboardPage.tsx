import React from 'react';
import { Activity, Package, LogOut, FileText, Users } from 'lucide-react';

interface DashboardPageProps {
  onNavigateToModule: (module: string) => void;
  onLogout: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ 
  onNavigateToModule, 
  onLogout 
}) => {
  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    onLogout();
  };

  const modules = [
    {
      id: 'sanatorio',
      name: 'Centro de Diagnóstico',
      description: 'Gestión de consultas, pacientes y estudios médicos',
      icon: Activity,
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600'
    },
    {
      id: 'inventario',
      name: 'Inventario',
      description: 'Control de productos, stock y suministros',
      icon: Package,
      color: 'green',
      gradient: 'from-green-500 to-green-600',
      disabled: true
    },
    {
      id: 'contabilidad',
      name: 'Contabilidad',
      description: 'Gestión financiera, facturas y reportes',
      icon: FileText,
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
      disabled: true
    },
    {
      id: 'personal',
      name: 'Personal',
      description: 'Administración de empleados y horarios',
      icon: Users,
      color: 'orange',
      gradient: 'from-orange-500 to-orange-600',
      disabled: true
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">CONRAD - Sistema de Gestión</h1>
            <p className="text-sm text-gray-600">Panel Principal</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Módulos */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Selecciona un Módulo</h2>
          <p className="text-gray-600">Elige el área que deseas gestionar</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.id}
                onClick={() => !module.disabled && onNavigateToModule(module.id)}
                disabled={module.disabled}
                className={`
                  relative overflow-hidden rounded-xl shadow-lg transition-all duration-300
                  ${module.disabled 
                    ? 'opacity-50 cursor-not-allowed bg-gray-300' 
                    : `bg-gradient-to-br ${module.gradient} hover:scale-105 hover:shadow-2xl cursor-pointer`
                  }
                  p-8 text-left text-white group
                `}
              >
                {/* Icono de fondo */}
                <div className="absolute top-0 right-0 opacity-10 transform translate-x-6 -translate-y-6">
                  <Icon size={120} />
                </div>

                {/* Contenido */}
                <div className="relative z-10">
                  <div className="bg-white bg-opacity-20 w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                    <Icon size={32} />
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-2">{module.name}</h3>
                  <p className="text-white text-opacity-90">{module.description}</p>
                  
                  {module.disabled && (
                    <div className="mt-4 inline-block bg-white bg-opacity-30 px-3 py-1 rounded-full text-sm">
                      Próximamente
                    </div>
                  )}

                  {!module.disabled && (
                    <div className="mt-4 flex items-center text-sm font-semibold group-hover:translate-x-2 transition-transform">
                      Abrir módulo →
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Información adicional */}
        <div className="mt-12 text-center">
          <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
            <h3 className="text-lg font-bold text-gray-800 mb-2">📊 Estado del Sistema</h3>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">1</div>
                <div className="text-sm text-gray-600">Módulo Activo</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">3</div>
                <div className="text-sm text-gray-600">Próximamente</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">100%</div>
                <div className="text-sm text-gray-600">Operativo</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
