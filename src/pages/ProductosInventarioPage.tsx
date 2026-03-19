import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProductoInventario, CategoriaInventario } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks';

interface ProductosInventarioPageProps {
  onBack: () => void;
}

export const ProductosInventarioPage: React.FC<ProductosInventarioPageProps> = ({ onBack }) => {
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<CategoriaInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase
          .from('productos_inventario')
          .select('*, categorias_inventario(nombre)')
          .eq('activo', true)
          .order('nombre'),
        supabase
          .from('categorias_inventario')
          .select('*')
          .eq('activo', true)
          .order('nombre')
      ]);

      if (prodRes.error) throw prodRes.error;
      if (catRes.error) throw catRes.error;

      setProductos(prodRes.data || []);
      setCategorias(catRes.data || []);
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al cargar productos', 'error');
    } finally {
      setLoading(false);
    }
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

      {/* ── HEADER ── */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#064e3b 50%,#065f46 100%)'}}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-emerald-200 hover:text-white mb-4 text-sm font-medium transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver al Inventario
          </button>
          <div className="flex items-center gap-4">
            <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
              <Search size={22} className="text-emerald-200" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Catálogo de Productos</h1>
              <p className="text-emerald-300 text-sm mt-0.5">{productosFiltrados.length} productos · {productosFiltrados.filter(p => p.stock_actual <= p.stock_minimo).length} con stock bajo</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* ── Filtros ── */}
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

        {/* ── Tabla ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Código','Producto','Categoría','Stock','Precio Compra','Ubicación'].map(h => (
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
                      <td className="px-5 py-3.5 font-bold text-slate-700">Q {producto.precio_compra.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{producto.ubicacion || '—'}</td>
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

      {toast && <Toast {...toast} onClose={hideToast} />}
    </div>
  );
};