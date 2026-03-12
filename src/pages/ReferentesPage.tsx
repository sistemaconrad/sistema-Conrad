import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, FileSpreadsheet, Building2, Users, Search } from 'lucide-react';
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
    setNombre(m.nombre); setTelefono(m.telefono); setDepartamento(m.departamento);
    setMunicipio(m.municipio); setDireccion(m.direccion);
    setReferencia(m.referencia || ''); setHorario(m.horario || ''); setEspecial(m.especial || '');
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false); setEditando(false); setMedicoEditando(null);
    setNombre(''); setTelefono(''); setDepartamento(''); setMunicipio(''); setDireccion('');
    setReferencia(''); setHorario(''); setEspecial('');
  };

  const guardarMedico = async () => {
    if (!nombre || !telefono || !departamento || !municipio || !direccion) { alert('Complete todos los campos'); return; }
    try {
      if (editando && medicoEditando) {
        await supabase.from('medicos').update({ nombre, telefono, departamento, municipio, direccion, referencia: referencia || null, horario: horario || null, especial: especial || null }).eq('id', medicoEditando.id);
        alert('Médico actualizado');
      } else {
        await supabase.from('medicos').insert([{ nombre, telefono, departamento, municipio, direccion, referencia: referencia || null, horario: horario || null, especial: especial || null, es_referente: true, activo: true }]);
        alert('Médico agregado');
      }
      cerrarModal(); cargarMedicos();
    } catch (e) { alert('Error al guardar médico'); }
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-white hover:text-blue-100 mb-4 transition-colors">
            <ArrowLeft size={20} /> Volver al Dashboard
          </button>
          <h1 className="text-3xl font-bold">Gestión de Médicos</h1>
          <p className="text-blue-100 mt-1">Médicos referentes y establecimientos de servicio móvil</p>
        </div>

        {/* Tabs */}
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            {[
              { key: 'medicos', label: 'Médicos Referentes', icon: <Users size={16} />, count: medicos.length },
              { key: 'establecimientos', label: 'Establecimientos Móvil', icon: <Building2 size={16} />, count: establecimientos.length },
            ].map(t => (
              <button key={t.key} onClick={() => setTabActiva(t.key as TabActiva)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 ${
                  tabActiva === t.key ? 'border-white text-white bg-white/10' : 'border-transparent text-blue-200 hover:text-white hover:bg-white/5'
                }`}>
                {t.icon} {t.label}
                <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4">

        {/* ═══ TAB MÉDICOS ═══ */}
        {tabActiva === 'medicos' && (
          <>
            <div className="card mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Filtros de Búsqueda</h2>
                <div className="flex gap-2">
                  <button onClick={exportarExcel} className="btn-secondary flex items-center gap-2">
                    <FileSpreadsheet size={18} /> Exportar Excel
                  </button>
                  <button onClick={abrirModalNuevo} className="btn-primary flex items-center gap-2">
                    <Plus size={18} /> Agregar Médico
                  </button>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Buscar por Nombre</label>
                  <input type="text" className="input-field" placeholder="Nombre del médico..."
                    value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} />
                </div>
                <div>
                  <label className="label">Departamento</label>
                  <select className="input-field" value={filtroDepartamento}
                    onChange={e => { setFiltroDepartamento(e.target.value); setFiltroMunicipio(''); }}>
                    <option value="">Todos</option>
                    {departamentosGuatemala.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Municipio</label>
                  <select className="input-field" value={filtroMunicipio}
                    onChange={e => setFiltroMunicipio(e.target.value)} disabled={!filtroDepartamento}>
                    <option value="">Todos</option>
                    {municipiosFiltradosFiltro.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                Mostrando <strong>{medicosFiltrados.length}</strong> de <strong>{medicos.length}</strong> médicos referentes
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {medicosFiltrados.map(m => (
                <div key={m.id} className="card hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-blue-700">{m.nombre}</h3>
                    <div className="flex gap-1">
                      <button onClick={() => abrirModalEditar(m)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => solicitarEliminarMedico(m)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p><strong>Teléfono:</strong> {m.telefono}</p>
                    <p><strong>Ubicación:</strong> {departamentosGuatemala.find(d => d.id === m.departamento)?.nombre} - {municipiosGuatemala.find(mu => mu.id === m.municipio)?.nombre}</p>
                    <p className="text-gray-500">{m.direccion}</p>
                    {m.referencia && <p className="text-blue-500 text-xs">📍 {m.referencia}</p>}
                    {m.horario && <p className="text-violet-600 text-xs font-medium">⏰ {m.horario}</p>}
                    {m.especial && <p className="text-amber-600 text-xs">⭐ {m.especial}</p>}
                  </div>
                </div>
              ))}
            </div>
            {medicosFiltrados.length === 0 && (
              <div className="card text-center py-12"><p className="text-gray-500">No se encontraron médicos referentes</p></div>
            )}
          </>
        )}

        {/* ═══ TAB ESTABLECIMIENTOS ═══ */}
        {tabActiva === 'establecimientos' && (
          <>
            <div className="card mb-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">Establecimientos de Servicio Móvil</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Lugares donde se realiza servicio móvil — aparecen en el modal de nuevo paciente</p>
                </div>
                <button onClick={abrirNuevoEstab} className="btn-primary flex items-center gap-2">
                  <Plus size={18} /> Nuevo Establecimiento
                </button>
              </div>

              {/* Búsqueda */}
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 max-w-sm">
                <Search size={16} className="text-gray-400" />
                <input type="text" placeholder="Buscar establecimiento..." value={filtroEstab}
                  onChange={e => setFiltroEstab(e.target.value)}
                  className="flex-1 text-sm focus:outline-none" />
                {filtroEstab && <button onClick={() => setFiltroEstab('')} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {establecimientosFiltrados.length} de {establecimientos.length} establecimientos
              </p>
            </div>

            {/* Lista */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {establecimientosFiltrados.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Building2 size={40} className="mx-auto mb-3 text-gray-200" />
                  <p className="font-medium text-gray-500">No hay establecimientos registrados</p>
                  <p className="text-sm">Los establecimientos aparecen al crear pacientes con Servicio Móvil</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {establecimientosFiltrados.map((e, idx) => (
                    <div key={e.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-6 text-right shrink-0">{idx + 1}</span>
                        <div className="bg-blue-100 rounded-lg p-1.5 shrink-0">
                          <Building2 size={14} className="text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-800 text-sm">{e.nombre}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => abrirEditarEstab(e)}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                          <Edit2 size={15} />
                        </button>
                        {eliminarEstabId === e.id ? (
                          <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                            <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
                            <button onClick={() => eliminarEstab(e.id)}
                              className="text-xs bg-red-500 text-white px-2 py-0.5 rounded font-bold hover:bg-red-600">Sí</button>
                            <button onClick={() => setEliminarEstabId(null)}
                              className="text-xs text-gray-500 hover:text-gray-700 px-1">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setEliminarEstabId(e.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                            <Trash2 size={15} />
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

      {/* Modal médico */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{editando ? 'Editar Médico Referente' : 'Agregar Médico Referente'}</h2>
              <button onClick={cerrarModal} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="label">Nombre Completo *</label>
                <input type="text" className="input-field" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Dr. Juan Pérez" /></div>
              <div><label className="label">Teléfono *</label>
                <input type="text" className="input-field" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="5555-5555" /></div>
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="label">Departamento *</label>
                  <Autocomplete label="Departamento" options={departamentosGuatemala} value={departamento}
                    onChange={v => { setDepartamento(v); setMunicipio(''); }} placeholder="Seleccione departamento" required /></div>
                <div><label className="label">Municipio *</label>
                  <Autocomplete label="Municipio" options={municipiosFiltradosFormulario} value={municipio}
                    onChange={setMunicipio} placeholder="Seleccione municipio" disabled={!departamento} required /></div>
              </div>
              <div><label className="label">Dirección Completa *</label>
                <textarea className="input-field" value={direccion} onChange={e => setDireccion(e.target.value)}
                  placeholder="Zona 10, Edificio X, Oficina Y" rows={3} /></div>
              <div><label className="label">Referencia de ubicación</label>
                <input type="text" className="input-field" value={referencia} onChange={e => setReferencia(e.target.value)}
                  placeholder="Ej: Enfrente de la entrada de Zaragoza a mano izquierda" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Horario</label>
                  <input type="text" className="input-field" value={horario} onChange={e => setHorario(e.target.value)}
                    placeholder="Ej: 8AM a 4:30PM" /></div>
                <div><label className="label">Especial</label>
                  <input type="text" className="input-field" value={especial} onChange={e => setEspecial(e.target.value)}
                    placeholder="Notas especiales" /></div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={cerrarModal} className="btn-secondary">Cancelar</button>
              <button onClick={guardarMedico} className="btn-primary flex items-center gap-2"><Save size={18} /> Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal establecimiento */}
      {showModalEstab && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold">{editandoEstab ? 'Editar Establecimiento' : 'Nuevo Establecimiento'}</h2>
              <button onClick={() => { setShowModalEstab(false); setEditandoEstab(null); setNombreEstab(''); }}
                className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="mb-5">
              <label className="label">Nombre del Establecimiento *</label>
              <input type="text" className="input-field" value={nombreEstab}
                onChange={e => setNombreEstab(e.target.value.toUpperCase())}
                placeholder="CLINICA EJEMPLO" autoFocus
                onKeyDown={e => e.key === 'Enter' && guardarEstab()} />
              <p className="text-xs text-gray-400 mt-1">Se guardará en mayúsculas</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowModalEstab(false); setEditandoEstab(null); setNombreEstab(''); }} className="btn-secondary">Cancelar</button>
              <button onClick={guardarEstab} disabled={guardandoEstab} className="btn-primary flex items-center gap-2">
                <Save size={16} /> {guardandoEstab ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal autorización */}
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