import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, FileSpreadsheet, Building2, Users, Search, MapPin, Phone } from 'lucide-react';
const getFechaGuatemala = () =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guatemala' }))
    .toLocaleDateString('en-CA');

import { supabase } from '../lib/supabase';
import { Autocomplete } from '../components/Autocomplete';
import { departamentosGuatemala, municipiosGuatemala } from '../data/guatemala';
import { AutorizacionModal } from '../components/AutorizacionModal';
import ExcelJS from 'exceljs';

interface Medico {
  id: string; nombre: string; telefono: string;
  departamento: string; municipio: string; direccion: string;
  clinica?: string; especialidad?: string;
  referencia?: string; horario?: string; especial?: string;
  es_referente: boolean; activo: boolean;
}
interface Establecimiento {
  id: string; nombre: string;
}
interface ReferentesPageProps { onBack: () => void; }

type TabActiva = 'medicos' | 'establecimientos';

export const ReferentesPage: React.FC<ReferentesPageProps> = ({ onBack }) => {
  const [tabActiva, setTabActiva] = useState<TabActiva>('medicos');

  // ── MÉDICOS ──────────────────────────────────────────────────────
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(false);
  const [medicoEditando, setMedicoEditando] = useState<Medico | null>(null);
  const [pendingMunicipio, setPendingMunicipio] = useState<string | null>(null);
  const [mostrarAutorizacion, setMostrarAutorizacion] = useState(false);
  const [medicoAEliminar, setMedicoAEliminar] = useState<Medico | null>(null);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [horario, setHorario] = useState('');
  const [especial, setEspecial] = useState('');

  // ── ESTABLECIMIENTOS ─────────────────────────────────────────────
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [filtroEstab, setFiltroEstab] = useState('');
  const [showModalEstab, setShowModalEstab] = useState(false);
  const [editandoEstab, setEditandoEstab] = useState<Establecimiento | null>(null);
  const [nombreEstab, setNombreEstab] = useState('');
  const [guardandoEstab, setGuardandoEstab] = useState(false);
  const [eliminarEstabId, setEliminarEstabId] = useState<string | null>(null);

  useEffect(() => { cargarMedicos(); cargarEstablecimientos(); }, []);

  // ── MÉDICOS CRUD ─────────────────────────────────────────────────
  const cargarMedicos = async () => {
    const { data } = await supabase.from('medicos').select('*').eq('es_referente', true).eq('activo', true).order('nombre');
    setMedicos(data || []);
  };

  const abrirModalNuevo = () => {
    setEditando(false); setMedicoEditando(null);
    setNombre(''); setTelefono(''); setDepartamento(''); setMunicipio(''); setDireccion('');
    setReferencia(''); setHorario(''); setEspecial('');
    setShowModal(true);
  };

  const abrirModalEditar = (m: Medico) => {
    setEditando(true); setMedicoEditando(m);
    setNombre(m.nombre); setTelefono(m.telefono); setDireccion(m.direccion);
    setReferencia(m.referencia || ''); setHorario(m.horario || ''); setEspecial(m.especial || '');
    setMunicipio('');
    setPendingMunicipio(m.municipio);
    setDepartamento(m.departamento);
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false); setEditando(false); setMedicoEditando(null);
    setNombre(''); setTelefono(''); setDepartamento(''); setMunicipio(''); setDireccion('');
    setReferencia(''); setHorario(''); setEspecial('');
  };

  const guardarMedico = async () => {
    if (!nombre || !departamento || !municipio) { alert('Complete los campos: Nombre, Departamento y Municipio'); return; }
    try {
      if (editando && medicoEditando) {
        const { error } = await supabase.from('medicos').update({
          nombre, telefono, departamento, municipio, direccion,
          referencia: referencia || null, horario: horario || null, especial: especial || null
        }).eq('id', medicoEditando.id);
        if (error) throw error;
        alert('Medico actualizado');
      } else {
        const { error } = await supabase.from('medicos').insert([{
          nombre, telefono, departamento, municipio, direccion,
          referencia: referencia || null, horario: horario || null, especial: especial || null,
          es_referente: true, activo: true
        }]);
        if (error) throw error;
        alert('Medico agregado');
      }
      cerrarModal(); cargarMedicos();
    } catch (e: any) { alert('Error al guardar: ' + (e?.message || JSON.stringify(e))); }
  };

  const solicitarEliminarMedico = (m: Medico) => { setMedicoAEliminar(m); setMostrarAutorizacion(true); };

  const eliminarMedico = async () => {
    if (!medicoAEliminar) return;
    try {
      await supabase.from('medicos').update({ activo: false }).eq('id', medicoAEliminar.id);
      const usuario = localStorage.getItem('usernameConrad') || '';
      const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || '';
      const rol = localStorage.getItem('rolUsuarioConrad') || '';
      await supabase.rpc('registrar_actividad', {
        p_usuario: usuario, p_nombre_usuario: nombreUsuario, p_rol: rol,
        p_modulo: 'sanatorio', p_accion: 'eliminar', p_tipo_registro: 'medico_referente',
        p_registro_id: medicoAEliminar.id,
        p_detalles: { nombre: medicoAEliminar.nombre, departamento: medicoAEliminar.departamento },
        p_fecha: getFechaGuatemala(),
        p_requirio_autorizacion: true
      });
      alert('✅ Médico eliminado'); cargarMedicos();
      setMostrarAutorizacion(false); setMedicoAEliminar(null);
    } catch (e) { alert('❌ Error al eliminar médico'); }
  };

  // ── ESTABLECIMIENTOS CRUD ────────────────────────────────────────
  const cargarEstablecimientos = async () => {
    const { data } = await supabase.from('establecimientos').select('id, nombre').order('nombre');
    setEstablecimientos(data || []);
  };

  const abrirNuevoEstab = () => { setEditandoEstab(null); setNombreEstab(''); setShowModalEstab(true); };
  const abrirEditarEstab = (e: Establecimiento) => { setEditandoEstab(e); setNombreEstab(e.nombre); setShowModalEstab(true); };

  const guardarEstab = async () => {
    if (!nombreEstab.trim()) { alert('Ingresa el nombre del establecimiento'); return; }
    setGuardandoEstab(true);
    try {
      if (editandoEstab) {
        await supabase.from('establecimientos').update({ nombre: nombreEstab.trim().toUpperCase() }).eq('id', editandoEstab.id);
      } else {
        await supabase.from('establecimientos').insert([{ nombre: nombreEstab.trim().toUpperCase() }]);
      }
      setShowModalEstab(false); setNombreEstab(''); setEditandoEstab(null);
      cargarEstablecimientos();
    } catch (e) { alert('Error al guardar'); }
    setGuardandoEstab(false);
  };

  const eliminarEstab = async (id: string) => {
    try {
      await supabase.from('establecimientos').delete().eq('id', id);
      setEliminarEstabId(null); cargarEstablecimientos();
    } catch (e) { alert('Error al eliminar'); }
  };

  // ── FILTROS ──────────────────────────────────────────────────────
  const medicosFiltrados = medicos.filter(m =>
    m.nombre.toLowerCase().includes(filtroNombre.toLowerCase()) &&
    (filtroDepartamento === '' || m.departamento === filtroDepartamento) &&
    (filtroMunicipio === '' || m.municipio === filtroMunicipio)
  );

  const establecimientosFiltrados = establecimientos.filter(e =>
    e.nombre.toLowerCase().includes(filtroEstab.toLowerCase())
  );

  const municipiosFiltradosFiltro = filtroDepartamento
    ? municipiosGuatemala.filter(m => m.departamento_id === filtroDepartamento) : municipiosGuatemala;
  const municipiosFiltradosFormulario = departamento
    ? municipiosGuatemala.filter(m => m.departamento_id === departamento) : [];

  // Set municipio after departamento options are ready
  useEffect(() => {
    if (pendingMunicipio && municipiosFiltradosFormulario.length > 0) {
      setMunicipio(pendingMunicipio);
      setPendingMunicipio(null);
    }
  }, [municipiosFiltradosFormulario, pendingMunicipio]);

  const exportarExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Médicos Referentes');
      worksheet.mergeCells('A1:F1');
      const tc = worksheet.getCell('A1');
      tc.value = 'MÉDICOS REFERENTES - CONRAD';
      tc.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      tc.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 30;
      worksheet.getRow(2).values = ['#', 'NOMBRE', 'TELÉFONO', 'DEPARTAMENTO', 'MUNICIPIO', 'DIRECCIÓN'];
      const hr = worksheet.getRow(2);
      hr.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
      hr.alignment = { vertical: 'middle', horizontal: 'center' };
      hr.height = 20;
      [5,35,15,20,20,40].forEach((w,i) => worksheet.getColumn(i+1).width = w);
      medicosFiltrados.forEach((m, i) => {
        const row = worksheet.addRow([i+1, m.nombre, m.telefono,
          departamentosGuatemala.find(d => d.id === m.departamento)?.nombre || m.departamento,
          municipiosGuatemala.find(mu => mu.id === m.municipio)?.nombre || m.municipio, m.direccion]);
        row.font = { name: 'Calibri', size: 10 };
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const url = window.URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `Medicos_Referentes_${new Date().toISOString().split('T')[0]}.xlsx`; a.click();
    } catch (e) { alert('Error al exportar'); }
  };

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>

      {/* ── HEADER ── */}
      <header className="text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1d4ed8 100%)' }}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button onClick={onBack} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-2 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl p-2 border border-white/20">
                <Users size={20} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">Gestión de Médicos</h1>
                <p className="text-blue-200 text-xs">Médicos referentes y establecimientos de servicio móvil</p>
              </div>
            </div>
          </div>

          {/* Tabs en header */}
          <div className="flex gap-1">
            {[
              { key: 'medicos', label: 'Médicos Referentes', icon: <Users size={14} />, count: medicos.length },
              { key: 'establecimientos', label: 'Establecimientos Móvil', icon: <Building2 size={14} />, count: establecimientos.length },
            ].map(t => (
              <button key={t.key} onClick={() => setTabActiva(t.key as TabActiva)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-xl transition-all border-b-2 ${
                  tabActiva === t.key
                    ? 'border-white text-white bg-white/15'
                    : 'border-transparent text-blue-200 hover:text-white hover:bg-white/8'
                }`}>
                {t.icon} {t.label}
                <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 max-w-7xl">

        {/* ═══ TAB MÉDICOS ═══ */}
        {tabActiva === 'medicos' && (
          <>
            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 mb-5">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-48">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Buscar</label>
                  <input type="text"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    placeholder="Nombre del médico..."
                    value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Departamento</label>
                  <select className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-white"
                    value={filtroDepartamento}
                    onChange={e => { setFiltroDepartamento(e.target.value); setFiltroMunicipio(''); }}>
                    <option value="">Todos</option>
                    {departamentosGuatemala.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Municipio</label>
                  <select className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-white disabled:bg-gray-50"
                    value={filtroMunicipio} onChange={e => setFiltroMunicipio(e.target.value)} disabled={!filtroDepartamento}>
                    <option value="">Todos</option>
                    {municipiosFiltradosFiltro.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 ml-auto">
                  <button onClick={exportarExcel}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                    <FileSpreadsheet size={15} /> Excel
                  </button>
                  <button onClick={abrirModalNuevo}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm shadow-blue-200 transition-all">
                    <Plus size={15} /> Agregar Médico
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Mostrando <strong className="text-gray-600">{medicosFiltrados.length}</strong> de <strong className="text-gray-600">{medicos.length}</strong> médicos referentes
              </p>
            </div>

            {/* Grid tarjetas */}
            {medicosFiltrados.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 text-center py-16">
                <p className="text-gray-400 font-medium">No se encontraron médicos referentes</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {medicosFiltrados.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden group">
                    {/* Card header */}
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-3 relative">
                      <div className="flex items-start justify-between">
                        <div className="bg-white/20 rounded-xl p-2 backdrop-blur-sm">
                          <Users size={16} className="text-white" />
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => abrirModalEditar(m)}
                            className="p-1.5 bg-white/15 hover:bg-white/30 rounded-lg transition-colors">
                            <Edit2 size={12} className="text-white" />
                          </button>
                          <button onClick={() => solicitarEliminarMedico(m)}
                            className="p-1.5 bg-white/15 hover:bg-red-400/60 rounded-lg transition-colors">
                            <Trash2 size={12} className="text-white" />
                          </button>
                        </div>
                      </div>
                      <p className="font-bold text-white text-sm mt-2 leading-tight">{m.nombre}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <MapPin size={11} className="text-blue-200 shrink-0" />
                        <p className="text-blue-100 text-xs truncate">
                          {municipiosGuatemala.find(mu => mu.id === m.municipio)?.nombre || m.municipio}
                        </p>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="px-4 py-3 space-y-2">
                      {m.telefono && (
                        <div className="flex items-center gap-2">
                          <div className="bg-green-50 rounded-lg p-1.5 shrink-0">
                            <Phone size={12} className="text-green-500" />
                          </div>
                          <a href={`tel:${m.telefono}`} className="text-sm text-green-600 font-bold hover:underline">{m.telefono}</a>
                        </div>
                      )}
                      {m.direccion && (
                        <div className="flex items-start gap-2">
                          <div className="bg-amber-50 rounded-lg p-1.5 shrink-0 mt-0.5">
                            <Building2 size={12} className="text-amber-500" />
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">{m.direccion}</p>
                        </div>
                      )}
                      {m.referencia && (
                        <div className="flex items-start gap-2">
                          <div className="bg-blue-50 rounded-lg p-1.5 shrink-0 mt-0.5">
                            <MapPin size={12} className="text-blue-400" />
                          </div>
                          <p className="text-xs text-blue-600 line-clamp-2">{m.referencia}</p>
                        </div>
                      )}
                      {m.horario && (
                        <p className="text-xs text-violet-600 font-medium bg-violet-50 rounded-lg px-2.5 py-1.5">⏰ {m.horario}</p>
                      )}
                      {m.especial && (
                        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">⭐ {m.especial}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══ TAB ESTABLECIMIENTOS ═══ */}
        {tabActiva === 'establecimientos' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 mb-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-black text-gray-800">Establecimientos de Servicio Móvil</p>
                  <p className="text-xs text-gray-400 mt-0.5">Aparecen en el modal de nuevo paciente al seleccionar Servicio Móvil</p>
                </div>
                <button onClick={abrirNuevoEstab}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm shadow-blue-200 transition-all">
                  <Plus size={15} /> Nuevo Establecimiento
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 max-w-sm bg-gray-50/50">
                <Search size={14} className="text-gray-400" />
                <input type="text" placeholder="Buscar establecimiento..." value={filtroEstab}
                  onChange={e => setFiltroEstab(e.target.value)}
                  className="flex-1 text-sm bg-transparent focus:outline-none" />
                {filtroEstab && (
                  <button onClick={() => setFiltroEstab('')} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">{establecimientosFiltrados.length} de {establecimientos.length} establecimientos</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {establecimientosFiltrados.length === 0 ? (
                <div className="text-center py-16">
                  <Building2 size={36} className="mx-auto mb-3 text-gray-200" />
                  <p className="font-medium text-gray-400">No hay establecimientos registrados</p>
                  <p className="text-xs text-gray-300 mt-1">Se crean al registrar pacientes con Servicio Móvil</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {establecimientosFiltrados.map((e, idx) => (
                    <div key={e.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-blue-50/30 transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-300 w-5 text-right font-mono">{idx + 1}</span>
                        <div className="bg-blue-100 rounded-xl p-1.5 shrink-0">
                          <Building2 size={13} className="text-blue-600" />
                        </div>
                        <span className="font-semibold text-gray-800 text-sm">{e.nombre}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => abrirEditarEstab(e)}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100">
                          <Edit2 size={14} />
                        </button>
                        {eliminarEstabId === e.id ? (
                          <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-xl px-2.5 py-1.5">
                            <span className="text-xs text-red-600 font-bold">¿Eliminar?</span>
                            <button onClick={() => eliminarEstab(e.id)}
                              className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-lg font-bold hover:bg-red-600">Sí</button>
                            <button onClick={() => setEliminarEstabId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 px-1">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setEliminarEstabId(e.id)}
                            className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── MODAL MÉDICO ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-xl p-2"><Users size={16} className="text-blue-600" /></div>
                <h2 className="text-base font-black text-gray-900">{editando ? 'Editar Médico Referente' : 'Agregar Médico Referente'}</h2>
              </div>
              <button onClick={cerrarModal} className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Nombre Completo *</label>
                <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Dr. Juan Pérez" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Teléfono *</label>
                <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="5555-5555" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Departamento *</label>
                  <Autocomplete label="Departamento" options={departamentosGuatemala} value={departamento}
                    onChange={v => { setDepartamento(v); setMunicipio(''); }} placeholder="Seleccione departamento" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Municipio *</label>
                  <Autocomplete label="Municipio" options={municipiosFiltradosFormulario} value={municipio}
                    onChange={setMunicipio} placeholder="Seleccione municipio" disabled={!departamento} required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Dirección Completa *</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 resize-none"
                  value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Zona 10, Edificio X, Oficina Y" rows={3} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Referencia de Ubicación</label>
                <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ej: Enfrente de la entrada a mano izquierda" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Horario</label>
                  <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    value={horario} onChange={e => setHorario(e.target.value)} placeholder="Ej: 8AM a 4:30PM" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Especial</label>
                  <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    value={especial} onChange={e => setEspecial(e.target.value)} placeholder="Notas especiales" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={cerrarModal}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-semibold transition-colors">Cancelar</button>
              <button onClick={guardarMedico}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-blue-200 transition-all">
                <Save size={14} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ESTABLECIMIENTO ── */}
      {showModalEstab && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-xl p-2"><Building2 size={16} className="text-blue-600" /></div>
                <h2 className="text-base font-black text-gray-900">{editandoEstab ? 'Editar Establecimiento' : 'Nuevo Establecimiento'}</h2>
              </div>
              <button onClick={() => { setShowModalEstab(false); setEditandoEstab(null); setNombreEstab(''); }}
                className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Nombre del Establecimiento *</label>
              <input type="text"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                value={nombreEstab} onChange={e => setNombreEstab(e.target.value.toUpperCase())}
                placeholder="CLINICA EJEMPLO" autoFocus
                onKeyDown={e => e.key === 'Enter' && guardarEstab()} />
              <p className="text-xs text-gray-400 mt-1">Se guardará en mayúsculas</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowModalEstab(false); setEditandoEstab(null); setNombreEstab(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-semibold transition-colors">Cancelar</button>
              <button onClick={guardarEstab} disabled={guardandoEstab}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm shadow-blue-200 transition-all">
                <Save size={14} /> {guardandoEstab ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AUTORIZACIÓN ── */}
      {mostrarAutorizacion && medicoAEliminar && (
        <AutorizacionModal
          accion="Eliminar Médico Referente"
          detalles={`${medicoAEliminar.nombre} - ${medicoAEliminar.departamento}, ${medicoAEliminar.municipio}`}
          onAutorizado={() => eliminarMedico()}
          onCancelar={() => { setMostrarAutorizacion(false); setMedicoAEliminar(null); }} />
      )}
    </div>
  );
};