import React, { useState, useEffect } from 'react';
import { Package, TrendingUp, AlertTriangle, Activity, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface InventarioHomePageProps {
  onNavigate: (page: string) => void;
}

export const InventarioHomePage: React.FC<InventarioHomePageProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProductos: 0,
    productosBajos: 0,
    valorTotal: 0,
    movimientosHoy: 0
  });
  const [productosStockBajo, setProductosStockBajo] = useState<any[]>([]);
  const [movimientosRecientes, setMovimientosRecientes] = useState<any[]>([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      // Total productos activos
      const { count: totalProductos } = await supabase
        .from('productos_inventario')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true);

      // Productos con stock bajo (comparar stock_actual con stock_minimo)
      const { data: todosProductos } = await supabase
        .from('productos_inventario')
        .select('*, categorias_inventario(nombre)')
        .eq('activo', true);

      // Filtrar en JavaScript los que tienen stock bajo
      const stockBajo = todosProductos
        ?.filter(p => p.stock_actual <= p.stock_minimo)
        .sort((a, b) => a.stock_actual - b.stock_actual)
        .slice(0, 5) || [];

      // Valor total del inventario
      const { data: productos } = await supabase
        .from('productos_inventario')
        .select('stock_actual, precio_compra')
        .eq('activo', true);

      const valorTotal = productos?.reduce((sum, p) => sum + (p.stock_actual * p.precio_compra), 0) || 0;

      // Movimientos de hoy
      const hoy = new Date().toISOString().split('T')[0];
      const { count: movimientosHoy } = await supabase
        .from('movimientos_inventario')
        .select('*', { count: 'exact', head: true })
        .eq('fecha', hoy);

      // Últimos movimientos
      const { data: movimientos } = await supabase
        .from('movimientos_inventario')
        .select(`
          *,
          productos_inventario(nombre, codigo)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        totalProductos: totalProductos || 0,
        productosBajos: stockBajo?.length || 0,
        valorTotal,
        movimientosHoy: movimientosHoy || 0
      });

      setProductosStockBajo(stockBajo || []);
      setMovimientosRecientes(movimientos || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen text="Cargando inventario..." />;

  const menuItems = [
    { id: 'productos', name: 'Productos', icon: Package, color: 'blue', description: 'Catálogo completo' },
    { id: 'movimientos', name: 'Movimientos', icon: Activity, color: 'green', description: 'Entradas y salidas' },
    { id: 'proveedores', name: 'Proveedores', icon: TrendingUp, color: 'purple', description: 'Gestión de proveedores' },
    { id: 'reportes', name: 'Reportes', icon: AlertTriangle, color: 'orange', description: 'Análisis y estadísticas' }
  ];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── HEADER ── */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#064e3b 50%,#065f46 100%)'}}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button onClick={() => window.location.reload()}
            className="flex items-center gap-2 text-emerald-200 hover:text-white mb-5 text-sm font-medium transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver
          </button>
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
              <Package size={24} className="text-emerald-200" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Módulo de Inventario</h1>
              <p className="text-emerald-300 text-sm mt-0.5">Control de productos y suministros</p>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Productos',   val: stats.totalProductos,              icon: <Package size={18} className="text-emerald-300" />,       sub: 'activos' },
              { label: 'Stock Bajo',        val: stats.productosBajos,              icon: <AlertTriangle size={18} className="text-yellow-300" />,   sub: 'requieren atención', warn: stats.productosBajos > 0 },
              { label: 'Valor Total',       val: `Q ${stats.valorTotal.toFixed(2)}`,icon: <TrendingUp size={18} className="text-emerald-300" />,     sub: 'en inventario' },
              { label: 'Movimientos Hoy',   val: stats.movimientosHoy,              icon: <Activity size={18} className="text-emerald-300" />,       sub: 'hoy' },
            ].map((s, i) => (
              <div key={i} className="bg-white/10 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-200 uppercase tracking-wide">{s.label}</span>
                  {s.icon}
                </div>
                <p className={`text-2xl font-black ${s.warn ? 'text-yellow-300' : 'text-white'}`}>{s.val}</p>
                <p className="text-xs text-emerald-300/70 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Nav módulos ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const styles: any = {
              productos:    { bg: 'from-blue-600 to-indigo-600',   shadow: 'shadow-blue-200'   },
              movimientos:  { bg: 'from-emerald-600 to-teal-600',  shadow: 'shadow-emerald-200' },
              proveedores:  { bg: 'from-violet-600 to-purple-600', shadow: 'shadow-violet-200' },
              reportes:     { bg: 'from-orange-500 to-amber-500',  shadow: 'shadow-orange-200'  },
            };
            const s = styles[item.id] || { bg: 'from-slate-600 to-slate-700', shadow: '' };
            return (
              <button key={item.id} onClick={() => onNavigate(item.id)}
                className={`bg-gradient-to-br ${s.bg} text-white rounded-2xl p-5 text-left shadow-lg ${s.shadow} hover:shadow-xl transition-all hover:-translate-y-1 group relative overflow-hidden`}>
                <div className="absolute -right-3 -bottom-3 opacity-10"><Icon size={72} /></div>
                <div className="bg-white/20 rounded-xl p-2.5 w-fit mb-3 border border-white/20">
                  <Icon size={18} className="text-white" />
                </div>
                <p className="font-black text-base">{item.name}</p>
                <p className="text-xs text-white/70 mt-0.5">{item.description}</p>
              </button>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-2 gap-5">

          {/* ── Stock Bajo ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="bg-amber-50 rounded-xl p-2"><AlertTriangle size={14} className="text-amber-500" /></div>
                <span className="text-sm font-black text-slate-800">Stock Bajo</span>
                {stats.productosBajos > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs font-black px-2 py-0.5 rounded-full">{stats.productosBajos}</span>
                )}
              </div>
              <button onClick={() => onNavigate('productos')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-bold transition-colors">Ver todos →</button>
            </div>
            <div className="p-4">
              {productosStockBajo.length > 0 ? (
                <div className="space-y-2">
                  {productosStockBajo.map((producto) => (
                    <div key={producto.id} className="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{producto.nombre}</p>
                        <p className="text-xs text-slate-400 font-mono">{producto.codigo}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-red-600">{producto.stock_actual}</p>
                        <p className="text-xs text-slate-400">mín: {producto.stock_minimo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Package size={20} className="text-emerald-500" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">Todos los productos tienen stock adecuado</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Movimientos Recientes ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-50 rounded-xl p-2"><Activity size={14} className="text-emerald-600" /></div>
                <span className="text-sm font-black text-slate-800">Movimientos Recientes</span>
              </div>
              <button onClick={() => onNavigate('movimientos')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-bold transition-colors">Ver historial →</button>
            </div>
            <div className="p-4">
              {movimientosRecientes.length > 0 ? (
                <div className="space-y-2">
                  {movimientosRecientes.map((mov) => {
                    const isEntrada = mov.tipo_movimiento === 'entrada';
                    const tipos: any = { entrada: '📥', salida: '📤', ajuste: '⚙️', merma: '❌' };
                    return (
                      <div key={mov.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{tipos[mov.tipo_movimiento] || '📦'}</span>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{mov.productos_inventario?.nombre}</p>
                            <p className="text-xs text-slate-400 capitalize">{mov.tipo_movimiento}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-black ${isEntrada ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isEntrada ? '+' : '-'}{mov.cantidad}
                          </p>
                          <p className="text-xs text-slate-400">{new Date(mov.fecha + 'T12:00:00').toLocaleDateString('es-GT')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Activity size={20} className="text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">No hay movimientos registrados</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};