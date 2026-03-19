import React, { useState, useEffect, useRef } from 'react';
import {
  X, Camera, User, Phone, Mail, Briefcase, Lock,
  Save, Eye, EyeOff, CheckCircle, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PerfilModalProps {
  onClose: () => void;
}

export const PerfilModal: React.FC<PerfilModalProps> = ({ onClose }) => {
  const username    = localStorage.getItem('usernameConrad') || '';
  const rolUsuario  = localStorage.getItem('rolUsuarioConrad') || '';
  const nombreLocal = localStorage.getItem('nombreUsuarioConrad') || '';

  const getRolLabel = (rol: string) => ({
    admin: 'Administrador', secretaria: 'Secretaria',
    doctor: 'Doctor', visitadora: 'Visitadora Médica'
  }[rol] || rol);

  const [tab, setTab] = useState<'perfil' | 'seguridad'>('perfil');
  const [loading, setLoading]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo]  = useState(false);
  const [toast, setToast]        = useState<{msg: string; ok: boolean} | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Perfil
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [cargo,          setCargo]          = useState('');
  const [telefono,       setTelefono]       = useState('');
  const [correo,         setCorreo]         = useState('');
  const [fotoUrl,        setFotoUrl]        = useState('');

  // Contraseña
  const [passActual,    setPassActual]    = useState('');
  const [passNueva,     setPassNueva]     = useState('');
  const [passConfirm,   setPassConfirm]   = useState('');
  const [showPass,      setShowPass]      = useState(false);

  useEffect(() => { cargarPerfil(); }, []);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const cargarPerfil = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('perfiles_usuario')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    if (data) {
      setNombreCompleto(data.nombre_completo || nombreLocal);
      setCargo(data.cargo || getRolLabel(rolUsuario));
      setTelefono(data.telefono || '');
      setCorreo(data.correo || '');
      setFotoUrl(data.foto_url || '');
    } else {
      setNombreCompleto(nombreLocal);
      setCargo(getRolLabel(rolUsuario));
    }
    setLoading(false);
  };

  const guardarPerfil = async () => {
    setGuardando(true);
    try {
      const { error } = await supabase.from('perfiles_usuario').upsert({
        username, nombre_completo: nombreCompleto, cargo,
        telefono, correo, foto_url: fotoUrl,
        updated_at: new Date().toISOString()
      }, { onConflict: 'username' });
      if (error) throw error;
      localStorage.setItem('nombreUsuarioConrad', nombreCompleto);
      showToast('Perfil actualizado correctamente');
    } catch (e: any) {
      showToast('Error: ' + e.message, false);
    }
    setGuardando(false);
  };

  const subirFoto = async (file: File) => {
    if (!file.type.startsWith('image/')) { showToast('Solo se permiten imágenes', false); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('La imagen no puede superar 2MB', false); return; }
    setSubiendo(true);
    try {
      const path = `${username}/avatar_${Date.now()}.${file.name.split('.').pop()}`;
      const { error: upErr } = await supabase.storage.from('perfiles').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('perfiles').getPublicUrl(path);
      setFotoUrl(data.publicUrl);
      // Auto-save foto
      await supabase.from('perfiles_usuario').upsert({
        username, foto_url: data.publicUrl, updated_at: new Date().toISOString()
      }, { onConflict: 'username' });
      showToast('Foto actualizada');
    } catch (e: any) { showToast('Error: ' + e.message, false); }
    setSubiendo(false);
  };

  const cambiarPassword = async () => {
    if (!passActual || !passNueva || !passConfirm) { showToast('Completa todos los campos', false); return; }
    if (passNueva !== passConfirm) { showToast('Las contraseñas no coinciden', false); return; }
    if (passNueva.length < 6) { showToast('Mínimo 6 caracteres', false); return; }
    setGuardando(true);
    try {
      // Verify current password against usuarios table
      const { data: user } = await supabase
        .from('usuarios')
        .select('id')
        .eq('username', username)
        .eq('password', passActual)
        .maybeSingle();
      if (!user) { showToast('Contraseña actual incorrecta', false); setGuardando(false); return; }
      const { error } = await supabase
        .from('usuarios')
        .update({ password: passNueva })
        .eq('username', username);
      if (error) throw error;
      showToast('Contraseña actualizada');
      setPassActual(''); setPassNueva(''); setPassConfirm('');
    } catch (e: any) { showToast('Error: ' + e.message, false); }
    setGuardando(false);
  };

  const inicialNombre = (nombreCompleto || nombreLocal || username).charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%)'}} className="relative pb-0">
          <button onClick={onClose}
            className="absolute top-4 right-4 text-indigo-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>

          {/* Avatar */}
          <div className="flex flex-col items-center pt-8 pb-6 px-6">
            <div className="relative mb-3">
              {fotoUrl ? (
                <img src={fotoUrl} alt="avatar"
                  className="w-24 h-24 rounded-2xl object-cover border-4 border-white/20 shadow-xl" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-3xl font-black shadow-xl border-4 border-white/20">
                  {inicialNombre}
                </div>
              )}
              <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                className="absolute -bottom-2 -right-2 bg-indigo-500 hover:bg-indigo-400 text-white p-2 rounded-xl shadow-lg transition-all">
                {subiendo
                  ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  : <Camera size={14} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && subirFoto(e.target.files[0])} />
            </div>
            <p className="text-white font-black text-lg">{nombreCompleto || nombreLocal}</p>
            <span className="mt-1 bg-white/15 text-indigo-200 text-xs font-bold px-3 py-1 rounded-full">
              {getRolLabel(rolUsuario)}
            </span>
            <p className="text-indigo-400 text-xs mt-1 font-mono">@{username}</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 px-6">
            {([
              { id: 'perfil',    label: 'Mi Perfil' },
              { id: 'seguridad', label: 'Seguridad'  },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-5 py-3 text-sm font-bold border-b-2 transition-all ${
                  tab === t.id
                    ? 'text-white border-indigo-400'
                    : 'text-indigo-400 border-transparent hover:text-white'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-6 max-h-[420px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent" />
            </div>
          ) : tab === 'perfil' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    <User size={11} className="inline mr-1" />Nombre Completo
                  </label>
                  <input type="text" value={nombreCompleto} onChange={e => setNombreCompleto(e.target.value)}
                    placeholder="Tu nombre completo"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    <Briefcase size={11} className="inline mr-1" />Cargo
                  </label>
                  <input type="text" value={cargo} onChange={e => setCargo(e.target.value)}
                    placeholder="Tu cargo o puesto"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    <Phone size={11} className="inline mr-1" />Teléfono
                  </label>
                  <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
                    placeholder="5555-5555"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                    <Mail size={11} className="inline mr-1" />Correo
                  </label>
                  <input type="email" value={correo} onChange={e => setCorreo(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                </div>
              </div>
              <button onClick={guardarPerfil} disabled={guardando}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-xl font-bold text-sm shadow-sm transition-all disabled:opacity-50 mt-2">
                {guardando
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Guardando...</>
                  : <><Save size={15} />Guardar Cambios</>}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-700">
                <Lock size={13} className="shrink-0 mt-0.5" />
                Asegúrate de usar una contraseña segura de al menos 6 caracteres.
              </div>
              {[
                { label: 'Contraseña Actual', val: passActual, set: setPassActual },
                { label: 'Nueva Contraseña',  val: passNueva,  set: setPassNueva  },
                { label: 'Confirmar Nueva',   val: passConfirm,set: setPassConfirm},
              ].map((f, i) => (
                <div key={i}>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">{f.label}</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={f.val}
                      onChange={e => f.set(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                    {i === 0 && (
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {passNueva && passConfirm && (
                <div className={`flex items-center gap-2 text-xs font-semibold ${passNueva === passConfirm ? 'text-emerald-600' : 'text-red-500'}`}>
                  {passNueva === passConfirm
                    ? <><CheckCircle size={13} />Las contraseñas coinciden</>
                    : <><AlertCircle size={13} />Las contraseñas no coinciden</>}
                </div>
              )}
              <button onClick={cambiarPassword} disabled={guardando}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-bold text-sm shadow-sm transition-all disabled:opacity-50 mt-2">
                {guardando
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Actualizando...</>
                  : <><Lock size={15} />Cambiar Contraseña</>}
              </button>
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className={`mx-6 mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${
            toast.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
          }`}>
            {toast.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
};