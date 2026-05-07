import React, { useState, useEffect, useCallback } from 'react';
import {
  Key, Search, Copy, CheckCircle, RefreshCw, Eye, EyeOff,
  Globe, UserCheck, UserX, Download, AlertCircle, Loader2, Link2,
  MessageSquare, Send, Bell, ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AccesoMedico {
  id: string;
  medico_id: string;
  codigo_acceso: string | null;
  activo: boolean;
  created_at: string;
  medico?: {
    nombre: string;
    especialidad: string | null;
    clinica: string | null;
    telefono: string;
  };
}

interface Medico {
  id: string;
  nombre: string;
  especialidad: string | null;
  clinica: string | null;
  telefono: string;
}

interface Mensaje {
  id: string;
  medico_id: string;
  nota: string;
  created_at: string;
  leido?: boolean;
  medico?: { nombre: string };
}

const PORTAL_URL = 'https://tu-sitio.vercel.app/portal-medico.html';

function generarCodigoCorto(nombre: string, idx: number): string {
  const n = nombre.toUpperCase()
    .replace(/^(DR\.|DRA\.|LIC\.|COMADRONA |C\.S\. |C\.C\. |C\.C\.|ASOCIACIÓN |ASOCIACION |CLINICA |CLÍNICA )/i, '')
    .trim();
  const palabra = n.replace(/[^A-ZÁÉÍÓÚÜÑ]/gi, '').substring(0, 5) || 'MED';
  return `CR-${palabra}-${String(idx + 1).padStart(3, '0')}`;
}

export const PortalAccesosView: React.FC = () => {
  const [accesos, setAccesos] = useState<AccesoMedico[]>([]);
  const [medicosSinAcceso, setMedicosSinAcceso] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [copiado, setCopiado] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [tab, setTab] = useState<'activos' | 'sinacceso'>('activos');
  const [regenerando, setRegenerando] = useState(false);
  const [mostrarUrl, setMostrarUrl] = useState(false);
  const [tabPrincipal, setTabPrincipal] = useState<'accesos' | 'mensajes'>('accesos');
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const [expandidoMedico, setExpandidoMedico] = useState<string | null>(null);
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar accesos existentes con datos del médico
      const { data: acc } = await supabase
        .from('portal_medicos_acceso')
        .select(`
          id, medico_id, codigo_acceso, activo, created_at,
          medico:medicos!medico_id(nombre, especialidad, clinica, telefono)
        `)
        .order('activo', { ascending: false })
        .order('created_at', { ascending: false });

      const accNormalized: AccesoMedico[] = (acc || []).map((a: any) => ({
        ...a,
        medico: Array.isArray(a.medico) ? a.medico[0] ?? undefined : a.medico,
      }));
      setAccesos(accNormalized);

      // Médicos referentes sin acceso
      const idsConAcceso = new Set((acc || []).map((a: any) => a.medico_id));
      const { data: todos } = await supabase
        .from('medicos')
        .select('id, nombre, especialidad, clinica, telefono')
        .eq('es_referente', true)
        .eq('activo', true)
        .order('nombre');

      setMedicosSinAcceso((todos || []).filter((m: Medico) => !idsConAcceso.has(m.id)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarMensajes = useCallback(async () => {
    setLoadingMensajes(true);
    try {
      const { data } = await supabase
        .from('portal_notas_medico')
        .select(`id, medico_id, nota, created_at, medico:medicos!medico_id(nombre)`)
        .is('consulta_id', null)
        .order('created_at', { ascending: false })
        .limit(100);
      const msgs: Mensaje[] = (data || []).map((m: any) => ({
        ...m,
        medico: Array.isArray(m.medico) ? m.medico[0] ?? undefined : m.medico,
      }));
      setMensajes(msgs);
      setMensajesNoLeidos(msgs.filter(m => !m.nota.startsWith('[TEAM]')).length);
    } catch(e) { console.error(e); }
    finally { setLoadingMensajes(false); }
  }, []);

  useEffect(() => { cargar(); cargarMensajes(); }, [cargar, cargarMensajes]);

  const responderMensaje = async (medicoId: string) => {
    const texto = respuestas[medicoId]?.trim();
    if (!texto) return;
    setEnviando(medicoId);
    try {
      await supabase.from('portal_notas_medico').insert({
        medico_id: medicoId,
        nota: '[TEAM] ' + texto,
        consulta_id: null,
      });
      setRespuestas(prev => ({ ...prev, [medicoId]: '' }));
      await cargarMensajes();
    } catch(e) {
      console.error(e);
    } finally {
      setEnviando(null);
    }
  };

  const copiar = (texto: string, id: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const toggleActivo = async (acc: AccesoMedico) => {
    setProcesando(acc.id);
    await supabase
      .from('portal_medicos_acceso')
      .update({ activo: !acc.activo })
      .eq('id', acc.id);
    await cargar();
    setProcesando(null);
  };

  const agregarAcceso = async (medico: Medico) => {
    setProcesando(medico.id);
    try {
      // Generate code based on position among all referentes
      const { data: todos } = await supabase
        .from('medicos').select('id').eq('es_referente', true).eq('activo', true).order('nombre');
      const idx = (todos || []).findIndex((m: any) => m.id === medico.id);
      const { count } = await supabase
        .from('portal_medicos_acceso').select('*', { count: 'exact', head: true });
      const codigo = generarCodigoCorto(medico.nombre, (count || 0));

      await supabase.from('portal_medicos_acceso').insert({
        medico_id: medico.id,
        email: medico.nombre.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30) + '@conrad.gt',
        activo: true,
        codigo_acceso: codigo,
      });
      await cargar();
    } catch (e) {
      console.error(e);
    } finally {
      setProcesando(null);
    }
  };

  const regenerarCodigo = async (acc: AccesoMedico) => {
    const nombre = acc.medico?.nombre || '';
    const nuevoCodigo = `CR-${nombre.replace(/[^A-Z]/gi, '').substring(0, 5).toUpperCase()}-${Math.floor(Math.random() * 900) + 100}`;
    setProcesando(acc.id);
    await supabase
      .from('portal_medicos_acceso')
      .update({ codigo_acceso: nuevoCodigo })
      .eq('id', acc.id);
    await cargar();
    setProcesando(null);
  };

  const exportarCSV = () => {
    const activos = accesos.filter(a => a.activo && a.codigo_acceso);
    const csv = [
      'Código de Acceso,Nombre,Especialidad,Clínica,Teléfono',
      ...activos.map(a =>
        `${a.codigo_acceso},"${a.medico?.nombre || ''}","${a.medico?.especialidad || ''}","${a.medico?.clinica || ''}",${a.medico?.telefono || ''}`
      )
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'codigos_portal_medicos.csv';
    link.click();
  };

  const filtrados = accesos.filter(a => {
    const q = busqueda.toLowerCase();
    return (
      a.medico?.nombre?.toLowerCase().includes(q) ||
      a.codigo_acceso?.toLowerCase().includes(q) ||
      a.medico?.clinica?.toLowerCase().includes(q) || false
    );
  });

  const sinAccesoFiltrados = medicosSinAcceso.filter(m =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-teal-600" size={36} />
    </div>
  );

  return (
    <div className="space-y-5 p-4 sm:p-6">

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center">
              <Key className="text-teal-600" size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Portal de Accesos</h2>
              <p className="text-sm text-slate-500">Códigos de acceso al portal web de médicos referentes</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setMostrarUrl(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Link2 size={15} />
              Link portal
            </button>
            <button
              onClick={exportarCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Download size={15} />
              Exportar CSV
            </button>
            <button
              onClick={cargar}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white rounded-xl transition-colors"
              style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}
            >
              <RefreshCw size={15} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Link del portal */}
        {mostrarUrl && (
          <div className="mt-4 bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center gap-3">
            <Globe className="text-teal-600 shrink-0" size={18} />
            <p className="text-sm text-teal-800 font-mono flex-1 break-all">{PORTAL_URL}</p>
            <button
              onClick={() => copiar(PORTAL_URL, 'url')}
              className="shrink-0 p-1.5 hover:bg-teal-100 rounded-lg transition-colors"
            >
              {copiado === 'url'
                ? <CheckCircle className="text-teal-600" size={16} />
                : <Copy className="text-teal-500" size={16} />}
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-teal-600">{accesos.filter(a => a.activo).length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Activos</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-slate-400">{accesos.filter(a => !a.activo).length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Desactivados</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-orange-500">{medicosSinAcceso.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Sin acceso</p>
          </div>
        </div>
      </div>

      {/* Main tabs: Accesos / Mensajes */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTabPrincipal('accesos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            tabPrincipal === 'accesos' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Key size={15} />
          Accesos al Portal
        </button>
        <button
          onClick={() => { setTabPrincipal('mensajes'); cargarMensajes(); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors relative ${
            tabPrincipal === 'mensajes' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <MessageSquare size={15} />
          Mensajes del Portal
          {mensajesNoLeidos > 0 && tabPrincipal !== 'mensajes' && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full text-white font-black text-xs bg-orange-500">
              {mensajesNoLeidos > 9 ? '9+' : mensajesNoLeidos}
            </span>
          )}
        </button>
      </div>

      {/* MENSAJES PANEL */}
      {tabPrincipal === 'mensajes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-500">Mensajes enviados por médicos desde el portal web</p>
            <button onClick={cargarMensajes} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-semibold">
              <RefreshCw size={12} /> Actualizar
            </button>
          </div>

          {loadingMensajes ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-teal-600" size={28} /></div>
          ) : (() => {
            // Group messages by medico
            const grouped: Record<string, Mensaje[]> = {};
            mensajes.forEach(m => {
              if (!grouped[m.medico_id]) grouped[m.medico_id] = [];
              grouped[m.medico_id].push(m);
            });
            const medicosConMsgs = Object.entries(grouped);
            if (!medicosConMsgs.length) return (
              <div className="bg-white rounded-2xl p-10 text-center text-slate-400">
                <MessageSquare size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No hay mensajes del portal aún</p>
                <p className="text-xs mt-1">Los médicos pueden enviarte mensajes desde su portal</p>
              </div>
            );
            return medicosConMsgs.map(([medId, msgs]) => {
              const nombre = msgs[0]?.medico?.nombre || 'Médico';
              const isOpen = expandidoMedico === medId;
              const msgsMedico = msgs.filter(m => !m.nota.startsWith('[TEAM]'));
              const msgsTeam = msgs.filter(m => m.nota.startsWith('[TEAM]'));
              return (
                <div key={medId} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Header */}
                  <button
                    onClick={() => setExpandidoMedico(isOpen ? null : medId)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-base">👨‍⚕️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-sm truncate">{nombre}</div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {msgs[0]?.nota.replace('[TEAM] ', '')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {msgsMedico.length > 0 && (
                        <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
                          {msgsMedico.length} msg
                        </span>
                      )}
                      {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>

                  {/* Conversation */}
                  {isOpen && (
                    <div className="border-t border-slate-100 p-4">
                      {/* Messages */}
                      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                        {[...msgs].reverse().map(m => {
                          const fromTeam = m.nota.startsWith('[TEAM]');
                          const texto = fromTeam ? m.nota.replace('[TEAM] ', '') : m.nota;
                          const fecha = new Date(m.created_at).toLocaleDateString('es-GT', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          });
                          return (
                            <div key={m.id} className={`flex ${fromTeam ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-xs rounded-xl px-3 py-2 text-sm ${
                                fromTeam
                                  ? 'bg-teal-600 text-white rounded-br-sm'
                                  : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                              }`}>
                                <p>{texto}</p>
                                <p className={`text-xs mt-1 ${fromTeam ? 'text-teal-200' : 'text-slate-400'}`}>
                                  {fromTeam ? 'Tú · ' : nombre.split(' ')[0] + ' · '}{fecha}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Reply box */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={`Responder a ${nombre.split(' ')[0]}...`}
                          value={respuestas[medId] || ''}
                          onChange={e => setRespuestas(prev => ({ ...prev, [medId]: e.target.value }))}
                          onKeyDown={e => { if(e.key === 'Enter') responderMensaje(medId); }}
                          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300 bg-slate-50"
                        />
                        <button
                          onClick={() => responderMensaje(medId)}
                          disabled={enviando === medId || !respuestas[medId]?.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40 transition-colors"
                          style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}
                        >
                          {enviando === medId ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                          Enviar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {tabPrincipal === 'accesos' && (<>
      {/* Search + Tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre, código o clínica..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
          />
        </div>
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab('activos')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'activos' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            Con acceso ({accesos.length})
          </button>
          <button
            onClick={() => setTab('sinacceso')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'sinacceso'
                ? 'bg-orange-500 text-white'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            Sin acceso ({medicosSinAcceso.length})
          </button>
        </div>
      </div>

      {/* TAB: Con acceso */}
      {tab === 'activos' && (
        <div className="space-y-3">
          {filtrados.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center text-slate-400">
              <Key size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No se encontraron resultados</p>
            </div>
          ) : (
            filtrados.map(acc => (
              <div
                key={acc.id}
                className={`bg-white rounded-2xl border p-4 transition-all ${
                  acc.activo ? 'border-slate-100 shadow-sm' : 'border-slate-100 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">

                  {/* Médico info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${acc.activo ? 'bg-teal-500' : 'bg-slate-300'}`} />
                      <p className="font-bold text-slate-800 truncate">{acc.medico?.nombre || '—'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      {acc.medico?.especialidad && (
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full">{acc.medico.especialidad}</span>
                      )}
                      {acc.medico?.clinica && (
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full">📍 {acc.medico.clinica}</span>
                      )}
                      {acc.medico?.telefono && acc.medico.telefono !== '0' && (
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full">📞 {acc.medico.telefono}</span>
                      )}
                    </div>
                  </div>

                  {/* Código */}
                  <div className="flex items-center gap-2">
                    {acc.codigo_acceso ? (
                      <div className="flex items-center gap-1.5 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
                        <Key className="text-teal-500 shrink-0" size={14} />
                        <span className="font-mono font-black text-teal-700 text-sm tracking-wider">
                          {acc.codigo_acceso}
                        </span>
                        <button
                          onClick={() => copiar(acc.codigo_acceso!, acc.id)}
                          className="ml-1 p-1 hover:bg-teal-100 rounded-lg transition-colors"
                          title="Copiar código"
                        >
                          {copiado === acc.id
                            ? <CheckCircle className="text-teal-600" size={14} />
                            : <Copy className="text-teal-400" size={14} />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Sin código</span>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Copiar mensaje de WhatsApp */}
                    {acc.codigo_acceso && acc.medico && (
                      <button
                        onClick={() => copiar(
                          `Hola ${acc.medico!.nombre}, le compartimos su código de acceso al portal de CONRAD:\n\n🔑 *${acc.codigo_acceso}*\n\nIngrese en: ${PORTAL_URL}\n\nCon este código podrá ver sus pacientes referidos y comisiones.\n\nSaludos, CONRAD Centro de Diagnóstico`,
                          acc.id + '_wa'
                        )}
                        title="Copiar mensaje para WhatsApp"
                        className="p-2 rounded-xl hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors border border-slate-100"
                      >
                        {copiado === acc.id + '_wa'
                          ? <CheckCircle className="text-green-500" size={16} />
                          : <span className="text-base">💬</span>}
                      </button>
                    )}

                    {/* Regenerar código */}
                    <button
                      onClick={() => regenerarCodigo(acc)}
                      disabled={procesando === acc.id}
                      title="Regenerar código"
                      className="p-2 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors border border-slate-100 disabled:opacity-40"
                    >
                      {procesando === acc.id
                        ? <Loader2 className="animate-spin" size={16} />
                        : <RefreshCw size={16} />}
                    </button>

                    {/* Activar/desactivar */}
                    <button
                      onClick={() => toggleActivo(acc)}
                      disabled={procesando === acc.id}
                      title={acc.activo ? 'Desactivar acceso' : 'Activar acceso'}
                      className={`p-2 rounded-xl transition-colors border disabled:opacity-40 ${
                        acc.activo
                          ? 'hover:bg-red-50 text-slate-400 hover:text-red-500 border-slate-100'
                          : 'hover:bg-teal-50 text-slate-400 hover:text-teal-600 border-slate-100'
                      }`}
                    >
                      {acc.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: Sin acceso */}
      {tab === 'sinacceso' && (
        <div className="space-y-3">
          {sinAccesoFiltrados.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center">
              <CheckCircle className="mx-auto mb-3 text-teal-400" size={40} />
              <p className="font-medium text-slate-500">Todos los médicos tienen acceso</p>
            </div>
          ) : (
            <>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={16} />
                <p className="text-sm text-orange-700">
                  Estos médicos son referentes pero <strong>no tienen código</strong> para el portal web.
                  Haz clic en <strong>"Dar acceso"</strong> para generarles uno automáticamente.
                </p>
              </div>
              {sinAccesoFiltrados.map(medico => (
                <div key={medico.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{medico.nombre}</p>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                      {medico.especialidad && <span className="bg-slate-100 px-2 py-0.5 rounded-full">{medico.especialidad}</span>}
                      {medico.clinica && <span className="bg-slate-100 px-2 py-0.5 rounded-full">📍 {medico.clinica}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => agregarAcceso(medico)}
                    disabled={procesando === medico.id}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50 shrink-0"
                    style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}
                  >
                    {procesando === medico.id
                      ? <Loader2 className="animate-spin" size={14} />
                      : <Key size={14} />}
                    Dar acceso
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </>) }
    </div>
  );
};