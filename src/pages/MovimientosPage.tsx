import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, ArrowDownCircle, ArrowUpCircle, Settings, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProductoInventario, Proveedor, TipoMovimiento } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks';
import { MENSAJES } from '../constants';

interface MovimientosPageProps {
  onBack: () => void;
}

export const MovimientosPage: React.FC<MovimientosPageProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [productos, setProductos] = useState<ProductoInventario[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const { toast, showToast, hideToast } = useToast();

  // Estados del formulario
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimiento>('entrada');
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [prodRes, provRes, movRes] = await Promise.all([
        supabase
          .from('productos_inventario')
          .select('*')
          .eq('activo', true)
          .order('nombre'),
        supabase
          .from('proveedores')
          .select('*')
          .eq('activo', true)
          .order('nombre'),
        supabase
          .from('movimientos_inventario')
          .select(`
            *,
            productos_inventario(nombre, codigo, unidad_medida),
            proveedores(nombre)
          `)
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      if (prodRes.error) throw prodRes.error;
      if (provRes.error) throw provRes.error;
      if (movRes.error) throw movRes.error;

      setProductos(prodRes.data || []);
      setProveedores(provRes.data || []);
      setMovimientos(movRes.data || []);
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productoId || !cantidad) {
      showToast('Complete los campos requeridos', 'error');
      return;
    }

    const cantidadNum = parseInt(cantidad);
    if (cantidadNum <= 0) {
      showToast('La cantidad debe ser mayor a 0', 'error');
      return;
    }

    setLoading(true);
    try {
      // Obtener stock actual del producto
      const { data: producto, error: prodError } = await supabase
        .from('productos_inventario')
        .select('stock_actual')
        .eq('id', productoId)
        .single();

      if (prodError) throw prodError;

      const stockAnterior = producto.stock_actual;
      let stockNuevo = stockAnterior;

      // Calcular nuevo stock según tipo de movimiento
      switch (tipoMovimiento) {
        case 'entrada':
          stockNuevo = stockAnterior + cantidadNum;
          break;
        case 'salida':
          if (stockAnterior < cantidadNum) {
            showToast('Stock insuficiente', 'error');
            setLoading(false);
            return;
          }
          stockNuevo = stockAnterior - cantidadNum;
          break;
        case 'ajuste':
          stockNuevo = cantidadNum; // Ajuste absoluto
          break;
        case 'merma':
          if (stockAnterior < cantidadNum) {
            showToast('Stock insuficiente', 'error');
            setLoading(false);
            return;
          }
          stockNuevo = stockAnterior - cantidadNum;
          break;
      }

      // Insertar movimiento
      const movimientoData = {
        producto_id: productoId,
        tipo_movimiento: tipoMovimiento,
        cantidad: cantidadNum,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        motivo: motivo || null,
        proveedor_id: proveedorId || null,
        costo_unitario: costoUnitario ? parseFloat(costoUnitario) : null,
        costo_total: costoUnitario ? parseFloat(costoUnitario) * cantidadNum : null,
        numero_factura: numeroFactura || null,
        usuario: 'admin', // TODO: Obtener usuario actual
        fecha: new Date().toISOString().split('T')[0]
      };

      const { error: movError } = await supabase
        .from('movimientos_inventario')
        .insert([movimientoData]);

      if (movError) throw movError;

      showToast('Movimiento registrado exitosamente', 'success');
      limpiarFormulario();
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al registrar movimiento', 'error');
    } finally {
      setLoading(false);
    }
  };

  const limpiarFormulario = () => {
    setProductoId('');
    setCantidad('');
    setMotivo('');
    setProveedorId('');
    setCostoUnitario('');
    setNumeroFactura('');
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'entrada': return <ArrowDownCircle className="text-green-600" size={20} />;
      case 'salida': return <ArrowUpCircle className="text-red-600" size={20} />;
      case 'ajuste': return <Settings className="text-blue-600" size={20} />;
      case 'merma': return <Trash2 className="text-orange-600" size={20} />;
      default: return null;
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'entrada': return 'bg-green-100 text-green-800';
      case 'salida': return 'bg-red-100 text-red-800';
      case 'ajuste': return 'bg-blue-100 text-blue-800';
      case 'merma': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && productos.length === 0) {
    return <LoadingSpinner fullScreen text="Cargando movimientos..." />;
  }

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
              <Plus size={22} className="text-emerald-200" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Movimientos de Inventario</h1>
              <p className="text-emerald-300 text-sm mt-0.5">Registro de entradas, salidas, ajustes y mermas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Formulario ── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden sticky top-4">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
                <div className="bg-emerald-50 rounded-xl p-2"><Plus size={14} className="text-emerald-600" /></div>
                <span className="text-sm font-black text-slate-800">Registrar Movimiento</span>
              </div>
              <div className="p-5">
                <form onSubmit={handleRegistrarMovimiento} className="space-y-4">
                  {/* Tipo */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Tipo de Movimiento *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'entrada', label: '📥 Entrada',  active: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                        { id: 'salida',  label: '📤 Salida',   active: 'border-red-500 bg-red-50 text-red-700'             },
                        { id: 'ajuste',  label: '⚙️ Ajuste',   active: 'border-blue-500 bg-blue-50 text-blue-700'          },
                        { id: 'merma',   label: '❌ Merma',    active: 'border-orange-500 bg-orange-50 text-orange-700'    },
                      ].map(t => (
                        <button key={t.id} type="button" onClick={() => setTipoMovimiento(t.id as any)}
                          className={`p-2.5 rounded-xl border-2 text-xs font-bold transition-all ${tipoMovimiento === t.id ? t.active : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Producto */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Producto *</label>
                    <select value={productoId} onChange={(e) => setProductoId(e.target.value)} required
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none bg-white">
                      <option value="">Seleccione un producto</option>
                      {productos.map(p => (
                        <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} - ` : ''}{p.nombre} (Stock: {p.stock_actual})</option>
                      ))}
                    </select>
                  </div>

                  {/* Cantidad */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                      Cantidad * {tipoMovimiento === 'ajuste' && <span className="text-blue-400">(Stock final)</span>}
                    </label>
                    <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} min="1" required
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                  </div>

                  {/* Motivo */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Motivo</label>
                    <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2}
                      placeholder="Ej: Compra mensual, Consumo paciente..."
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none resize-none" />
                  </div>

                  {tipoMovimiento === 'entrada' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Proveedor</label>
                        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none bg-white">
                          <option value="">Seleccione proveedor</option>
                          {proveedores.map(p => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Costo Unitario</label>
                        <input type="number" step="0.01" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} placeholder="0.00"
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">No. Factura</label>
                        <input type="text" value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="Ej: F-12345"
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                      </div>
                    </>
                  )}

                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3 rounded-xl font-bold text-sm shadow-sm transition-all disabled:opacity-50">
                    {loading ? 'Procesando...' : <><Plus size={15} /> Registrar Movimiento</>}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* ── Historial ── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-slate-100 rounded-xl p-2"><Plus size={14} className="text-slate-500 rotate-45" /></div>
                  <span className="text-sm font-black text-slate-800">Historial de Movimientos</span>
                </div>
                <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">Últimos {movimientos.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Fecha','Producto','Tipo','Cantidad','Stock','Motivo'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {movimientos.map((mov) => (
                      <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">
                          {new Date(mov.fecha + 'T12:00:00').toLocaleDateString('es-GT')}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800 text-xs">{mov.productos_inventario?.nombre}</p>
                          {mov.productos_inventario?.codigo && <p className="text-xs text-slate-400 font-mono">{mov.productos_inventario.codigo}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-xl text-xs font-black inline-flex items-center gap-1 ${getTipoColor(mov.tipo_movimiento)}`}>
                            {getTipoIcon(mov.tipo_movimiento)} {mov.tipo_movimiento}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-base font-black ${mov.tipo_movimiento === 'entrada' || mov.tipo_movimiento === 'ajuste' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {mov.tipo_movimiento === 'entrada' ? '+' : mov.tipo_movimiento === 'ajuste' ? '=' : '-'}{mov.cantidad}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          <span>{mov.stock_anterior}</span>
                          <span className="text-slate-300 mx-1">→</span>
                          <span className="font-black text-slate-700">{mov.stock_nuevo}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[150px] truncate">{mov.motivo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {movimientos.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-sm text-slate-400">No hay movimientos registrados</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast {...toast} onClose={hideToast} />}
    </div>
  );
};