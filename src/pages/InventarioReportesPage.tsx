import React, { useState } from 'react';
import { ArrowLeft, FileSpreadsheet, Package, TrendingDown, DollarSign, Users, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  generarReporteStockActual, 
  generarReporteMovimientos,
  generarReporteStockBajo,
  generarReporteValorizacion,
  generarReportePorProveedor,
  generarReporteMermas
} from '../utils/inventario-reportes-excel';

interface InventarioReportesPageProps {
  onBack: () => void;
}

export const InventarioReportesPage: React.FC<InventarioReportesPageProps> = ({ onBack }) => {
  const [generando, setGenerando] = useState<string | null>(null);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const generarReporte = async (tipo: string, nombreReporte: string, generador: Function) => {
    setGenerando(tipo);
    try {
      let datos;
      
      switch (tipo) {
        case 'stock':
          const { data: productos } = await supabase
            .from('productos_inventario')
            .select('*, categorias_inventario(nombre)')
            .eq('activo', true)
            .order('nombre');
          datos = productos || [];
          break;

        case 'movimientos':
          if (!fechaInicio || !fechaFin) {
            alert('⚠️ Debe seleccionar fechas de inicio y fin');
            setGenerando(null);
            return;
          }
          const { data: movimientos } = await supabase
            .from('movimientos_inventario')
            .select(`
              *,
              productos_inventario(nombre, codigo),
              proveedores(nombre)
            `)
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFin)
            .order('fecha', { ascending: false });
          datos = { movimientos: movimientos || [], fechaInicio, fechaFin };
          break;

        case 'stockbajo':
          const { data: todosProductos } = await supabase
            .from('productos_inventario')
            .select('*, categorias_inventario(nombre)')
            .eq('activo', true);
          datos = todosProductos?.filter(p => p.stock_actual <= p.stock_minimo) || [];
          break;

        case 'valorizacion':
          const { data: productosVal } = await supabase
            .from('productos_inventario')
            .select('*, categorias_inventario(nombre)')
            .eq('activo', true);
          datos = productosVal || [];
          break;

        case 'proveedor':
          const { data: productosProveedor } = await supabase
            .from('productos_inventario')
            .select('*, categorias_inventario(nombre), proveedores(nombre)')
            .eq('activo', true)
            .order('proveedor_id');
          datos = productosProveedor || [];
          break;

        case 'mermas':
          if (!fechaInicio || !fechaFin) {
            alert('⚠️ Debe seleccionar fechas de inicio y fin');
            setGenerando(null);
            return;
          }
          const { data: mermas } = await supabase
            .from('movimientos_inventario')
            .select(`
              *,
              productos_inventario(nombre, codigo, precio_compra)
            `)
            .in('tipo_movimiento', ['merma', 'ajuste'])
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFin)
            .order('fecha', { ascending: false });
          datos = { mermas: mermas || [], fechaInicio, fechaFin };
          break;
      }

      await generador(datos);
      alert(`✅ Reporte "${nombreReporte}" generado exitosamente`);
    } catch (error) {
      console.error('Error al generar reporte:', error);
      alert('❌ Error al generar el reporte');
    } finally {
      setGenerando(null);
    }
  };

  const reportes = [
    {
      id: 'stock',
      nombre: 'Stock Actual',
      descripcion: 'Inventario completo con cantidades actuales',
      icon: Package,
      color: 'blue',
      requiereFechas: false,
      generador: generarReporteStockActual
    },
    {
      id: 'movimientos',
      nombre: 'Movimientos',
      descripcion: 'Historial de entradas y salidas por período',
      icon: TrendingDown,
      color: 'green',
      requiereFechas: true,
      generador: generarReporteMovimientos
    },
    {
      id: 'stockbajo',
      nombre: 'Stock Bajo',
      descripcion: 'Productos que requieren reabastecimiento',
      icon: AlertTriangle,
      color: 'yellow',
      requiereFechas: false,
      generador: generarReporteStockBajo
    },
    {
      id: 'valorizacion',
      nombre: 'Valorización',
      descripcion: 'Valor económico del inventario',
      icon: DollarSign,
      color: 'purple',
      requiereFechas: false,
      generador: generarReporteValorizacion
    },
    {
      id: 'proveedor',
      nombre: 'Por Proveedor',
      descripcion: 'Productos agrupados por proveedor',
      icon: Users,
      color: 'indigo',
      requiereFechas: false,
      generador: generarReportePorProveedor
    },
    {
      id: 'mermas',
      nombre: 'Mermas y Ajustes',
      descripcion: 'Control de pérdidas y ajustes',
      icon: TrendingDown,
      color: 'red',
      requiereFechas: true,
      generador: generarReporteMermas
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── HEADER ── */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#064e3b 50%,#065f46 100%)'}}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-emerald-200 hover:text-white mb-4 text-sm font-medium transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver al Inventario
          </button>
          <div className="flex items-center gap-4">
            <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
              <FileSpreadsheet size={22} className="text-emerald-200" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Reportes de Inventario</h1>
              <p className="text-emerald-300 text-sm mt-0.5">Análisis y exportación de datos a Excel</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* ── Rango de fechas ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="bg-orange-50 rounded-xl p-2"><Calendar size={14} className="text-orange-500" /></div>
            <span className="text-sm font-black text-slate-800">Rango de Fechas</span>
            <span className="text-xs text-slate-400 ml-1">(para reportes con período)</span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Fecha Inicio</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Fecha Fin</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
            </div>
          </div>
        </div>

        {/* ── Grid de reportes ── */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportes.map((reporte) => {
            const Icon = reporte.icon;
            const estaGenerando = generando === reporte.id;
            const gradients: any = {
              blue:   'from-blue-600 to-indigo-600',
              green:  'from-emerald-600 to-teal-600',
              purple: 'from-violet-600 to-purple-600',
              orange: 'from-orange-500 to-amber-500',
              red:    'from-red-500 to-rose-500',
              yellow: 'from-yellow-500 to-amber-500',
              indigo: 'from-indigo-600 to-blue-600',
            };
            const bgs: any = {
              blue: 'bg-blue-50', green: 'bg-emerald-50', purple: 'bg-violet-50',
              orange: 'bg-orange-50', red: 'bg-red-50', yellow: 'bg-yellow-50', indigo: 'bg-indigo-50',
            };
            const iconColors: any = {
              blue: 'text-blue-600', green: 'text-emerald-600', purple: 'text-violet-600',
              orange: 'text-orange-500', red: 'text-red-500', yellow: 'text-yellow-600', indigo: 'text-indigo-600',
            };
            return (
              <div key={reporte.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="p-5">
                  <div className={`${bgs[reporte.color] || 'bg-slate-50'} rounded-xl p-3 w-fit mb-3`}>
                    <Icon size={20} className={iconColors[reporte.color] || 'text-slate-500'} />
                  </div>
                  <h3 className="font-black text-slate-800 text-sm mb-1">{reporte.nombre}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{reporte.descripcion}</p>
                  {reporte.requiereFechas && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <Calendar size={11} className="text-orange-500" />
                      <span className="text-xs text-orange-600 font-semibold">Requiere rango de fechas</span>
                    </div>
                  )}
                </div>
                <div className="px-5 pb-5">
                  <button
                    onClick={() => generarReporte(reporte.id, reporte.nombre, reporte.generador)}
                    disabled={estaGenerando}
                    className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${gradients[reporte.color] || 'from-slate-600 to-slate-700'} text-white py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50`}
                  >
                    {estaGenerando ? (
                      <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />Generando...</>
                    ) : (
                      <><FileSpreadsheet size={14} />Generar Excel</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Nota ── */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-blue-100 rounded-lg p-1.5"><Calendar size={13} className="text-blue-600" /></div>
            <span className="text-xs font-black text-blue-800 uppercase tracking-wide">Información</span>
          </div>
          <ul className="space-y-1.5">
            {[
              'Los reportes se generan en formato Excel profesional (.xlsx)',
              'Incluyen formato de colores, bordes y fórmulas automáticas',
              'Algunos reportes requieren seleccionar rango de fechas arriba',
              'Los archivos se descargan automáticamente al generarse',
            ].map((txt, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
                <div className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />{txt}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};