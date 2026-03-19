import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit, Trash2, Building2 as Building } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Proveedor } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { sanitizeInput, validarNIT, formatearNIT } from '../utils/validation';

interface ProveedoresPageProps {
  onBack: () => void;
}

export const ProveedoresPage: React.FC<ProveedoresPageProps> = ({ onBack }) => {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [proveedorAEliminar, setProveedorAEliminar] = useState<string | null>(null);
  const { toast, showToast, hideToast } = useToast();

  // Estados del formulario
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [nit, setNit] = useState('');

  useEffect(() => {
    cargarProveedores();
  }, []);

  const cargarProveedores = async () => {
    try {
      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .eq('activo', true)
        .order('nombre');

      if (error) throw error;
      setProveedores(data || []);
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al cargar proveedores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNuevoProveedor = () => {
    limpiarFormulario();
    setProveedorSeleccionado(null);
    setShowModal(true);
  };

  const handleEditarProveedor = (proveedor: Proveedor) => {
    setNombre(proveedor.nombre);
    setContacto(proveedor.contacto || '');
    setTelefono(proveedor.telefono || '');
    setEmail(proveedor.email || '');
    setDireccion(proveedor.direccion || '');
    setNit(proveedor.nit || '');
    setProveedorSeleccionado(proveedor);
    setShowModal(true);
  };

  const handleGuardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      showToast('El nombre es requerido', 'error');
      return;
    }

    // Validar NIT si se proporcionó
    if (nit.trim()) {
      const validacion = validarNIT(nit);
      if (!validacion.valido) {
        showToast(validacion.mensaje || 'NIT inválido', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const proveedorData = {
        nombre: sanitizeInput(nombre),
        contacto: contacto.trim() || null,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        direccion: sanitizeInput(direccion) || null,
        nit: nit.trim() ? formatearNIT(nit) : null,
        activo: true
      };

      if (proveedorSeleccionado) {
        // Actualizar
        const { error } = await supabase
          .from('proveedores')
          .update(proveedorData)
          .eq('id', proveedorSeleccionado.id);

        if (error) throw error;
        showToast('Proveedor actualizado exitosamente', 'success');
      } else {
        // Insertar
        const { error } = await supabase
          .from('proveedores')
          .insert([proveedorData]);

        if (error) throw error;
        showToast('Proveedor agregado exitosamente', 'success');
      }

      setShowModal(false);
      limpiarFormulario();
      cargarProveedores();
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al guardar proveedor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarProveedor = async () => {
    if (!proveedorAEliminar) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('proveedores')
        .update({ activo: false })
        .eq('id', proveedorAEliminar);

      if (error) throw error;

      showToast('Proveedor eliminado exitosamente', 'success');
      setShowConfirmDelete(false);
      setProveedorAEliminar(null);
      cargarProveedores();
    } catch (error) {
      console.error('Error:', error);
      showToast('Error al eliminar proveedor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const limpiarFormulario = () => {
    setNombre('');
    setContacto('');
    setTelefono('');
    setEmail('');
    setDireccion('');
    setNit('');
    setProveedorSeleccionado(null);
  };

  if (loading && proveedores.length === 0) {
    return <LoadingSpinner fullScreen text="Cargando proveedores..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── HEADER ── */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#064e3b 50%,#065f46 100%)'}}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-emerald-200 hover:text-white mb-4 text-sm font-medium transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver al Inventario
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                <Building size={22} className="text-emerald-200" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Proveedores</h1>
                <p className="text-emerald-300 text-sm mt-0.5">{proveedores.length} proveedores registrados</p>
              </div>
            </div>
            <button onClick={handleNuevoProveedor}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-900/30 transition-all">
              <Plus size={15} /> Nuevo Proveedor
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Nombre','Contacto','Teléfono','Email','NIT','Acciones'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {proveedores.map((proveedor) => (
                  <tr key={proveedor.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800">{proveedor.nombre}</p>
                      {proveedor.direccion && <p className="text-xs text-slate-400 mt-0.5">{proveedor.direccion}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{proveedor.contacto || '—'}</td>
                    <td className="px-5 py-4 text-sm text-slate-600 font-mono">{proveedor.telefono || '—'}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{proveedor.email || '—'}</td>
                    <td className="px-5 py-4 text-xs text-slate-500 font-mono">{proveedor.nit || '—'}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditarProveedor(proveedor)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={15} /></button>
                        <button onClick={() => { setProveedorAEliminar(proveedor.id!); setShowConfirmDelete(true); }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {proveedores.length === 0 && (
              <div className="py-14 text-center">
                <Building size={36} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">No hay proveedores registrados</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal Formulario ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 rounded-xl p-2"><Building size={16} className="text-emerald-600" /></div>
                <h2 className="text-base font-black text-slate-900">{proveedorSeleccionado ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
              </div>
              <button onClick={() => { setShowModal(false); limpiarFormulario(); }} className="text-slate-300 hover:text-slate-500 p-1 rounded-lg hover:bg-slate-100">✕</button>
            </div>
            <form onSubmit={handleGuardarProveedor} className="p-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nombre *</label>
                  <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Persona de Contacto</label>
                  <input type="text" value={contacto} onChange={(e) => setContacto(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Teléfono</label>
                  <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="12345678"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">NIT</label>
                  <input type="text" value={nit} onChange={(e) => setNit(e.target.value)} placeholder="1234567-8"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Dirección</label>
                  <textarea value={direccion} onChange={(e) => setDireccion(e.target.value)} rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-5 pt-5 border-t border-slate-100">
                <button type="button" onClick={() => { setShowModal(false); limpiarFormulario(); }}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-semibold transition-colors">Cancelar</button>
                <button type="submit" disabled={loading}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50">
                  {loading ? 'Guardando...' : 'Guardar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirmDelete && (
        <ConfirmDialog
          title="Eliminar Proveedor"
          message="¿Está seguro de que desea eliminar este proveedor? Esta acción no se puede deshacer."
          confirmText="Eliminar" cancelText="Cancelar" type="danger"
          onConfirm={handleEliminarProveedor}
          onCancel={() => { setShowConfirmDelete(false); setProveedorAEliminar(null); }}
        />
      )}

      {toast && <Toast {...toast} onClose={hideToast} />}
    </div>
  );
};