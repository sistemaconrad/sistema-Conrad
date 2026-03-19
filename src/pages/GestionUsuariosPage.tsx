import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, Trash2, Save, X, Users, Eye, EyeOff,
  Edit2, Key, Shield, CheckCircle, AlertCircle, Search, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface GestionUsuariosPageProps { onBack: () => void; }

const ROLES = [
  { id: 'admin',      label: 'Administrador', color: 'bg-red-100 text-red-700 border-red-200'          },
  { id: 'secretaria', label: 'Secretaria',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'doctor',     label: 'Doctor',        color: 'bg-blue-100 text-blue-700 border-blue-200'        },
  { id: 'visitadora', label: 'Visitadora',    color: 'bg-violet-100 text-violet-700 border-violet-200'  },
];

const getRolStyle = (rol: string) => ROLES.find(r => r.id === rol)?.color || 'bg-slate-100 text-slate-700 border-slate-200';
const getRolLabel = (rol: string) => ROLES.find(r => r.id === rol)?.label || rol;

export const GestionUsuariosPage: React.FC<GestionUsuariosPageProps> = ({ onBack }) => {
  const [usuarios, setUsuarios]     = useState<any[]>([]);
  const [perfiles, setPerfiles]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editando, setEditando]     = useState<any | null>(null);
  const [showResetModal, setShowResetModal] = useState<any | null>(null);
  const [showPass, setShowPass]     = useState(false);
  const [guardando, setGuardando]   = useState(false);
  const [toast, setToast]           = useState<{msg: string; ok: boolean} | null>(null);

  const [form, setForm] = useState({
    username: '', password: '', nombre: '', rol: 'secretaria'
  });
  const [nuevaPass, setNuevaPass] = useState('');

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    const [usrRes, perfRes] = await Promise.all([
      supabase.from('usuarios').select('*').order('created_at', { ascending: true }),
      supabase.from('perfiles_usuario').select('username, foto_url, cargo, correo, telefono'),
    ]);
    setUsuarios(usrRes.data || []);
    setPerfiles(perfRes.data || []);
    setLoading(false);
  };

  const getPerfil = (username: string) => perfiles.find(p => p.username === username);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ username: '', password: '', nombre: '', rol: 'secretaria' });
    setShowModal(true);
  };

  const abrirEditar = (u: any) => {
    setEditando(u);
    setForm({ username: u.username, password: u.password, nombre: u.nombre, rol: u.rol || 'secretaria' });
    setShowModal(true);
  };

  const guardar = async () => {
    if (!form.username.trim() || !form.password.trim() || !form.nombre.trim()) {
      showToast('Completa todos los campos', false); return;
    }
    if (form.username.includes(' ')) {
      showToast('El usuario no puede tener espacios', false); return;
    }
    setGuardando(true);
    try {
      if (editando) {
        const { error } = await supabase.from('usuarios')
          .update({ password: form.password, nombre: form.nombre, rol: form.rol })
          .eq('id', editando.id);
        if (error) throw error;
        showToast('Usuario actualizado');
      } else {
        const { data: existe } = await supabase.from('usuarios')
          .select('username').eq('username', form.username).maybeSingle();
        if (existe) { showToast('El usuario ya existe', false); setGuardando(false); return; }
        const { error } = await supabase.from('usuarios').insert([{
          username: form.username.toLowerCase().trim(),
          password: form.password, nombre: form.nombre, rol: form.rol, activo: true
        }]);
        if (error) throw error;
        showToast('Usuario creado exitosamente');
      }
      setShowModal(false);
      cargarDatos();
    } catch (e: any) { showToast('Error: ' + e.message, false); }
    setGuardando(false);
  };

  const resetearPassword = async () => {
    if (!nuevaPass.trim() || nuevaPass.length < 4) {
      showToast('Mínimo 4 caracteres', false); return;
    }
    setGuardando(true);
    try {
      const { error } = await supabase.from('usuarios')
        .update({ password: nuevaPass })
        .eq('id', showResetModal.id);
      if (error) throw error;
      showToast(`Contraseña de "${showResetModal.nombre}" actualizada`);
      setShowResetModal(null);
      setNuevaPass('');
      cargarDatos();
    } catch (e: any) { showToast('Error: ' + e.message, false); }
    setGuardando(false);
  };

  const eliminar = async (u: any) => {
    if (u.username === 'admin') { showToast('No puedes eliminar el admin', false); return; }
    if (!confirm(`¿Eliminar usuario "${u.nombre}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('usuarios').delete().eq('id', u.id);
    if (error) { showToast('Error: ' + error.message, false); return; }
    showToast('Usuario eliminado');
    cargarDatos();
  };

  const usuariosFiltrados = usuarios.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    u.rol?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── HEADER ── */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%)'}}>
        <div className="max-w-6xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-indigo-200 hover:text-white mb-5 text-sm font-medium transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                <Users size={24} className="text-indigo-200" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Gestión de Usuarios</h1>
                <p className="text-indigo-300 text-sm mt-0.5">Administrar cuentas, roles y contraseñas</p>
              </div>
            </div>
            {/* Stats */}
            <div className="hidden md:flex items-center gap-5">
              {ROLES.map(r => {
                const count = usuarios.filter(u => (u.rol || 'secretaria') === r.id).length;
                if (!count) return null;
                return (
                  <div key={r.id} className="text-right">
                    <p className="text-xl font-black text-white">{count}</p>
                    <p className="text-xs text-indigo-300">{r.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">

        {/* Barra acciones */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
            <input type="text" placeholder="Buscar por usuario, nombre o rol..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
          </div>
          <button onClick={cargarDatos}
            className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={abrirNuevo}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm shadow-indigo-200 transition-all hover:shadow-md">
            <Plus size={15} /> Nuevo Usuario
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent" />
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="py-16 text-center">
              <Users size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-slate-400 font-medium">No se encontraron usuarios</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Usuario','Nombre','Rol','Contraseña','Contacto','Acciones'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {usuariosFiltrados.map(u => {
                  const perfil = getPerfil(u.username);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                      {/* Usuario */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {perfil?.foto_url ? (
                            <img src={perfil.foto_url} alt="" className="w-9 h-9 rounded-xl object-cover border border-slate-200" />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-black text-sm">
                              {(u.nombre || u.username).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-mono text-xs text-slate-500">@{u.username}</p>
                            {u.username === 'admin' && (
                              <span className="flex items-center gap-0.5 text-xs text-amber-600 font-bold">
                                <Shield size={10} /> Protegido
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Nombre */}
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-800">{u.nombre}</p>
                        {perfil?.cargo && <p className="text-xs text-slate-400">{perfil.cargo}</p>}
                      </td>
                      {/* Rol */}
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${getRolStyle(u.rol || 'secretaria')}`}>
                          {getRolLabel(u.rol || 'secretaria')}
                        </span>
                      </td>
                      {/* Contraseña */}
                      <td className="px-5 py-4">
                        <code className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-mono">
                          {u.password}
                        </code>
                      </td>
                      {/* Contacto */}
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {perfil?.correo && <p>{perfil.correo}</p>}
                        {perfil?.telefono && <p>{perfil.telefono}</p>}
                        {!perfil?.correo && !perfil?.telefono && <span className="text-slate-300">—</span>}
                      </td>
                      {/* Acciones */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => abrirEditar(u)} title="Editar"
                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => { setShowResetModal(u); setNuevaPass(''); }} title="Resetear contraseña"
                            className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors">
                            <Key size={14} />
                          </button>
                          {u.username !== 'admin' && (
                            <button onClick={() => eliminar(u)} title="Eliminar"
                              className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Info */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
          <Shield size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Las contraseñas se muestran en texto plano para facilitar la administración. Solo el administrador tiene acceso a esta pantalla (acceso por <strong>Ctrl+Shift+U</strong> desde el módulo de sanatorio).
          </p>
        </div>
      </div>

      {/* ── Modal Crear/Editar ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
              style={{background:'linear-gradient(135deg,#1e1b4b,#312e81)'}}>
              <div className="flex items-center gap-3">
                <div className="bg-white/15 rounded-xl p-2">
                  <Users size={16} className="text-white" />
                </div>
                <p className="text-white font-black text-sm">{editando ? 'Editar Usuario' : 'Nuevo Usuario'}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-indigo-200 hover:text-white p-1 rounded-lg hover:bg-white/10"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Username — solo al crear */}
              {!editando && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Usuario *</label>
                  <input type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value.toLowerCase()})}
                    placeholder="sin espacios (ej: maria)"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none font-mono" />
                </div>
              )}
              {editando && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">Usuario:</span>
                  <span className="font-mono text-sm font-bold text-slate-700">@{editando.username}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nombre Completo *</label>
                <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                  placeholder="Nombre completo del usuario"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Rol *</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(r => (
                    <button key={r.id} type="button" onClick={() => setForm({...form, rol: r.id})}
                      className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                        form.rol === r.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Contraseña *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                    placeholder="Contraseña del usuario"
                    className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-semibold">Cancelar</button>
                <button onClick={guardar} disabled={guardando}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
                  {guardando
                    ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Guardando...</>
                    : <><Save size={14} />{editando ? 'Guardar Cambios' : 'Crear Usuario'}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Resetear Contraseña ── */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
              style={{background:'linear-gradient(135deg,#78350f,#92400e)'}}>
              <div className="flex items-center gap-3">
                <div className="bg-white/15 rounded-xl p-2"><Key size={16} className="text-white" /></div>
                <div>
                  <p className="text-white font-black text-sm">Resetear Contraseña</p>
                  <p className="text-amber-200 text-xs">{showResetModal.nombre}</p>
                </div>
              </div>
              <button onClick={() => setShowResetModal(null)} className="text-amber-200 hover:text-white p-1 rounded-lg hover:bg-white/10"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                <Key size={13} className="shrink-0 mt-0.5" />
                Se asignará una nueva contraseña al usuario <strong>@{showResetModal.username}</strong>. El usuario deberá usar esta nueva contraseña la próxima vez que inicie sesión.
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nueva Contraseña *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={nuevaPass}
                    onChange={e => setNuevaPass(e.target.value)}
                    placeholder="Nueva contraseña..."
                    className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowResetModal(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-semibold">Cancelar</button>
                <button onClick={resetearPassword} disabled={guardando}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
                  {guardando
                    ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Actualizando...</>
                    : <><Key size={14} />Resetear</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold z-50 ${
          toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};