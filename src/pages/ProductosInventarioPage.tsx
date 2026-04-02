import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, AlertCircle, X, Save, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProductoInventario, CategoriaInventario } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks';

interface ProductosInventarioPageProps {
  onBack: () => void;
}

const UNIDADES = ['unidad', 'caja', 'frasco', 'ampolla', 'bolsa', 'rollo', 'par', 'kit', 'litro', 'ml', 'mg', 'g', 'kg'];

const FORM_VACIO = {
  codigo: '', nombre: '', descripcion: '', categoria_id: '',
  unidad_medida: 'unidad', stock_actual: 0, stock_minimo: 5,
  stock_maximo: 100, precio_compra: 0, precio_venta: 0,
  ubicacion: '', lote: '', fecha_vencimiento: '',
};

export const ProductosInventarioPage: React.FC<ProductosInventarioPageProps> = ({ onBack }) => {
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<CategoriaInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [showModal, setShowModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState<string | null>(null);
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase.from('productos_inventario').select('*, categorias_inventario(nombre)').eq('activo', true).order('nombre'),
        supabase.from('categorias_inventario').select('*').eq('activo', true).order('nombre')
      ]);
      if (prodRes.error) throw prodRes.error;
      if (catRes.error) throw catRes.error;
      setProductos(prodRes.data || []);
      setCategorias(catRes.data || []);
    } catch (error) {
      showToast('Error al cargar productos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const abrirNuevo = () => {
    setForm(FORM_VACIO);
    setEditando(null);
    setShowModal(true);
  };

  const abrirEditar = (p: any) => {
    setForm({
      codigo: p.codigo || '', nombre: p.nombre, descripcion: p.descripcion || '',
      categoria_id: p.categoria_id || '', unidad_medida: p.unidad_medida,
      stock_actual: p.stock_actual, stock_minimo: p.stock_minimo,
      stock_maximo: p.stock_maximo || 100, precio_compra: p.precio_compra,
      precio_venta: p.precio_venta || 0, ubicacion: p.ubicacion || '',
      lote: p.lote || '', fecha_vencimiento: p.fecha_vencimiento || '',
    });
    setEditando(p.id);
    setShowModal(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    setGuardando(true);
    try {
      const datos = {
        ...form,
        stock_actual: Number(form.stock_actual),
        stock_minimo: Number(form.stock_minimo),
        stock_maximo: Number(form.stock_maximo),
        precio_compra: Number(form.precio_compra),
        precio_venta: Number(form.precio_venta),
        categoria_id: form.categoria_id || null,
        fecha_vencimiento: form.fecha_vencimiento || null,
        activo: true,
        updated_at: new Date().toISOString(),
      };

      if (editando) {
        const { error } = await supabase.from('productos_inventario').update(datos).eq('id', editando);
        if (error) throw error;
        showToast('Producto actualizado', 'success');
      } else {
        const { error } = await supabase.from('productos_inventario').insert(datos);
        if (error) throw error;
        showToast('Producto agregado', 'success');
      }
      setShowModal(false);
      cargarDatos();
    } catch (e: any) {
      showToast(e.message || 'Error al guardar', 'error');
    }
    setGuardando(false);
  };

  const productosFiltrados = productos.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       p.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategoria = categoriaFiltro === 'todas' || p.categoria_id === categoriaFiltro;
    return matchSearch && matchCategoria;
  });

  if (loading) return <LoadingSpinner fullScreen text="Cargando productos..." />;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* HEADER */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#064e3b 50%,#065f46 100%)'}}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-emerald-200 hover:text-white mb-4 text-sm font-medium transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver al Inventario
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                <Package size={22} className="text-emerald-200" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Catálogo de Productos</h1>
                <p className="text-emerald-300 text-sm mt-0.5">{productosFiltrados.length} productos · {productosFiltrados.filter(p => p.stock_actual <= p.stock_minimo).length} con stock bajo</p>
              </div>
            </div>
            <button onClick={abrirNuevo}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-900/30">
              <Plus size={16} /> Agregar Producto
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input type="text" placeholder="Buscar por nombre o código..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none" />
            </div>
            <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none bg-white">
              <option value="todas">Todas las categorías</option>
              {categorias.map(cat => (<option key={cat.id} value={cat.id}>{cat.nombre}</option>))}
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Código','Producto','Categoría','Stock','Precio Compra','Ubicación',''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {productosFiltrados.map((producto) => {
                  const stockBajo = producto.stock_actual <= producto.stock_minimo;
                  const stockMedio = !stockBajo && producto.stock_actual <= producto.stock_minimo * 1.5;
                  return (
                    <tr key={producto.id} className={`hover:bg-slate-50 transition-colors ${stockBajo ? 'bg-red-50/30' : ''}`}>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{producto.codigo || '—'}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-800">{producto.nombre}</p>
                        {producto.descripcion && <p className="text-xs text-slate-400 mt-0.5">{producto.descripcion}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg">
                          {producto.categorias_inventario?.nombre || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black ${
                          stockBajo  ? 'bg-red-100 text-red-700' :
                          stockMedio ? 'bg-amber-100 text-amber-700' :
                                       'bg-emerald-100 text-emerald-700'
                        }`}>
                          {producto.stock_actual} {producto.unidad_medida}
                        </span>
                        <p className="text-xs text-slate-400 mt-0.5">mín: {producto.stock_minimo}</p>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-700">Q {Number(producto.precio_compra).toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{producto.ubicacion || '—'}</td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => abrirEditar(producto)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {productosFiltrados.length === 0 && (
              <div className="py-14 text-center">
                <AlertCircle size={36} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">No se encontraron productos</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL AGREGAR/EDITAR */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 rounded-xl p-2">
                  <Package size={18} className="text-emerald-700" />
                </div>
                <h2 className="font-black text-slate-800">{editando ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Fila 1 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Código</label>
                  <input type="text" value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value})}
                    placeholder="Ej: MED-001"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Nombre *</label>
                  <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                    placeholder="Nombre del producto"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Descripción</label>
                <textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})}
                  placeholder="Descripción opcional..." rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none resize-none" />
              </div>

              {/* Fila 2 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Categoría</label>
                  <select value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value})}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none bg-white">
                    <option value="">Sin categoría</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Unidad de medida</label>
                  <select value={form.unidad_medida} onChange={e => setForm({...form, unidad_medida: e.target.value})}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none bg-white">
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Fila 3 — Stock */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Stock actual</label>
                  <input type="number" min="0" value={form.stock_actual} onChange={e => setForm({...form, stock_actual: Number(e.target.value)})}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Stock mínimo</label>
                  <input type="number" min="0" value={form.stock_minimo} onChange={e => setForm({...form, stock_minimo: Number(e.target.value)})}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Stock máximo</label>
                  <input type="number" min="0" value={form.stock_maximo} onChange={e => setForm({...form, stock_maximo: Number(e.target.value)})}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
              </div>

              {/* Fila 4 — Precios */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Precio de compra (Q)</label>
                  <input type="number" min="0" step="0.01" value={form.precio_compra} onChange={e => setForm({...form, precio_compra: Number(e.target.value)})}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Precio de venta (Q)</label>
                  <input type="number" min="0" step="0.01" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: Number(e.target.value)})}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
              </div>

              {/* Fila 5 — Extra */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Ubicación</label>
                  <input type="text" value={form.ubicacion} onChange={e => setForm({...form, ubicacion: e.target.value})}
                    placeholder="Ej: Estante A-3"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Lote</label>
                  <input type="text" value={form.lote} onChange={e => setForm({...form, lote: e.target.value})}
                    placeholder="Número de lote"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Vencimiento</label>
                  <input type="date" value={form.fecha_vencimiento} onChange={e => setForm({...form, fecha_vencimiento: e.target.value})}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm">
                <Save size={15} />
                {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Guardar Producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} onClose={hideToast} />}
    </div>
  );
};