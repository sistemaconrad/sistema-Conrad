import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginPageProps {
  onLogin: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: usuario, error: dbError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .eq('activo', true)
        .single();
      if (dbError || !usuario) {
        setError('Usuario o contraseña incorrectos');
        setLoading(false);
        return;
      }
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('nombreUsuarioConrad', usuario.nombre);
      localStorage.setItem('usernameConrad', usuario.username);
      localStorage.setItem('rolUsuarioConrad', usuario.rol || 'secretaria');
      onLogin();
    } catch {
      setError('Error al iniciar sesión');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        backgroundImage: 'url(/conrad-building.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.82) 0%, rgba(13,148,136,0.55) 100%)' }} />

      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #14b8a6, transparent)', transform: 'translate(30%, -30%)' }} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #0d9488, transparent)', transform: 'translate(-30%, 30%)' }} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4 animate-scale-in">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden"
          style={{ boxShadow: '0 25px 60px -12px rgba(0,0,0,0.4)' }}>

          {/* Top band */}
          <div className="px-8 pt-8 pb-6 text-center"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 50%, #0d9488 100%)' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <Activity size={30} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">CONRAD</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Centro de Diagnóstico</p>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <p className="text-sm font-semibold text-slate-500 mb-5 text-center">Ingresa tus credenciales</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Usuario</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="input-field"
                  placeholder="Tu nombre de usuario"
                  required
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="label">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field pr-10"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  <Lock size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2 text-sm"
                style={{ background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0d9488, #0f766e)' }}>
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Iniciando...</>
                  : 'Iniciar Sesión'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-6">
              Sistema de gestión médica · Conrad Central
            </p>
          </div>
        </div>

        <a
          href="https://www.codenest.business/"
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center gap-1 mt-6 opacity-80 hover:opacity-100 transition-opacity"
        >
          <img src="/codenest-logo.png" alt="Codenest" className="h-10 w-auto" />
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Desarrollado por <span className="font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>Codenest</span> · codenest.business
          </span>
        </a>
      </div>
    </div>
  );
};
