import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Autocomplete } from './Autocomplete';
import { Paciente, Medico } from '../types';
import { departamentosGuatemala, municipiosGuatemala } from '../data/guatemala';
import { supabase } from '../lib/supabase';

interface NuevoPacienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (paciente: Paciente, medico: Medico | null, sinInfoMedico: boolean, esServicioMovil: boolean, establecimiento: string, sinOrdenMedica?: boolean) => void;
}

export const NuevoPacienteModal: React.FC<NuevoPacienteModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  //  SIMPLIFICADO: Un solo campo de nombre
  const [nombrePaciente, setNombrePaciente] = useState('');
  const [edadPaciente, setEdadPaciente] = useState('');
  const [tipoEdad, setTipoEdad] = useState<'anios' | 'meses' | 'dias'>('anios');
  const [telefonoPaciente, setTelefonoPaciente] = useState('');
  const [departamentoPaciente, setDepartamentoPaciente] = useState('');
  const [municipioPaciente, setMunicipioPaciente] = useState('');

  // Estado del medico
  const [esReferente, setEsReferente] = useState(true);
  const [sinInformacion, setSinInformacion] = useState(false);
  const [sinOrdenMedica, setSinOrdenMedica] = useState(false);
  const [esServicioMovil, setEsServicioMovil] = useState(false);
  const [nombreMedico, setNombreMedico] = useState('');
  const [telefonoMedico, setTelefonoMedico] = useState('');
  const [departamentoMedico, setDepartamentoMedico] = useState('');
  const [municipioMedico, setMunicipioMedico] = useState('');
  const [direccionMedico, setDireccionMedico] = useState('');
  const [establecimientoMovil, setEstablecimientoMovil] = useState('');
  const [establecimientos, setEstablecimientos] = useState<Array<{ id: string; nombre: string }>>([]);

  const [medicosReferentes, setMedicosReferentes] = useState<Medico[]>([]);
  const [medicoSeleccionado, setMedicoSeleccionado] = useState<Medico | null>(null);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      cargarMedicosReferentes();
      cargarEstablecimientos();
    }
  }, [isOpen]);

  const cargarMedicosReferentes = async () => {
    try {
      const { data, error } = await supabase
        .from('medicos')
        .select('*')
        .eq('es_referente', true)
        .eq('activo', true);
      if (error) throw error;
      setMedicosReferentes(data || []);
    } catch (error) {
      console.error('Error al cargar medicos referentes:', error);
    }
  };

  const cargarEstablecimientos = async () => {
    try {
      const { data, error } = await supabase
        .from('establecimientos')
        .select('id, nombre')
        .order('nombre');
      if (error) throw error;
      setEstablecimientos(data || []);
    } catch (error) {
      console.error('Error al cargar establecimientos:', error);
    }
  };

  const municipiosPacienteFiltrados = municipiosGuatemala.filter(
    m => m.departamento_id === departamentoPaciente
  );

  const municipiosMedicoFiltrados = municipiosGuatemala.filter(
    m => m.departamento_id === departamentoMedico
  );

  const handleMedicoReferenteChange = (medicoId: string) => {
    const medico = medicosReferentes.find(m => m.id === medicoId);
    if (medico) {
      setMedicoSeleccionado(medico);
      setNombreMedico(medico.id || '');
      setTelefonoMedico(medico.telefono);
      setDepartamentoMedico(medico.departamento);
      setMunicipioMedico(medico.municipio);
      setDireccionMedico(medico.direccion);
    }
  };

  const handleEstablecimientoChange = async (nombreEstablecimiento: string) => {
    setEstablecimientoMovil(nombreEstablecimiento);
    
    // Si el establecimiento no existe en la lista, agregarlo a la BD
    const existe = establecimientos.some(e => e.nombre.toLowerCase() === nombreEstablecimiento.toLowerCase());
    if (!existe && nombreEstablecimiento.trim()) {
      try {
        const { data, error } = await supabase
          .from('establecimientos')
          .insert([{ nombre: nombreEstablecimiento.trim() }])
          .select()
          .single();
        
        if (error) throw error;
        
        // Agregar a la lista local
        if (data) {
          setEstablecimientos(prev => [...prev, { id: data.id, nombre: data.nombre }].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        }
      } catch (error) {
        console.error('Error al guardar establecimiento:', error);
      }
    }
  };

  const handleSinInformacionChange = (checked: boolean) => {
    setSinInformacion(checked);
    if (checked) {
      setNombreMedico('');
      setTelefonoMedico('');
      setDepartamentoMedico('');
      setMunicipioMedico('');
      setDireccionMedico('');
    }
  };

  const resetForm = () => {
    setNombrePaciente('');
    setEdadPaciente('');
    setTipoEdad('anios');
    setTelefonoPaciente('');
    setDepartamentoPaciente('');
    setMunicipioPaciente('');
    setEsReferente(true);
    setSinOrdenMedica(false);
    setSinInformacion(false);
    setEsServicioMovil(false);
    setNombreMedico('');
    setTelefonoMedico('');
    setDepartamentoMedico('');
    setMunicipioMedico('');
    setDireccionMedico('');
    setMedicoSeleccionado(null);
    setEstablecimientoMovil('');
  };

  const handleGuardar = () => {
    if (!nombrePaciente.trim() || !edadPaciente || !telefonoPaciente.trim() || !departamentoPaciente || !municipioPaciente) {
      alert('Por favor complete todos los campos obligatorios del paciente:\n- Nombre\n- Edad\n- Telefono\n- Departamento\n- Municipio');
      return;
    }

    const tieneMedico = nombreMedico.trim() !== '';

    //  Para servicios moviles: el establecimiento es obligatorio
    if (esServicioMovil && !establecimientoMovil.trim()) {
      alert('Para Servicios Moviles debe ingresar el nombre del establecimiento');
      return;
    }

    if (tieneMedico && !sinInformacion && !esServicioMovil) {
      // Si es referente ya seleccionado de la lista, no validar campos adicionales
      const referenteSeleccionado = esReferente && medicoSeleccionado !== null;
      if (!referenteSeleccionado) {
        if (!telefonoMedico.trim() || !departamentoMedico || !municipioMedico || !direccionMedico.trim()) {
          alert('Por favor complete todos los campos del medico o marque "Sin informacion"');
          return;
        }
      }
    }

    let edadEnAnios = parseInt(edadPaciente);
    if (tipoEdad === 'meses') edadEnAnios = Math.floor(edadEnAnios / 12);
    else if (tipoEdad === 'dias') edadEnAnios = Math.floor(edadEnAnios / 365);

    const paciente: Paciente = {
      nombre: nombrePaciente.trim(),
      primer_nombre: nombrePaciente.trim(),
      segundo_nombre: undefined,
      primer_apellido: '',
      segundo_apellido: undefined,
      edad: edadEnAnios || 0,
      edad_valor: parseInt(edadPaciente),
      edad_tipo: tipoEdad === 'anios' ? ('a\u00f1os' as any) : tipoEdad === 'dias' ? ('d\u00edas' as any) : 'meses',
      telefono: telefonoPaciente,
      departamento: departamentoPaciente,
      municipio: municipioPaciente
    };

    let medico: Medico | null = null;
    if (!esServicioMovil && tieneMedico && !sinInformacion) {
      if (esReferente && medicoSeleccionado) {
        //  Medico seleccionado de la lista
        medico = medicoSeleccionado;
      } else {
        //  Medico no referente con datos completos
        medico = {
          nombre: nombreMedico,
          telefono: telefonoMedico,
          departamento: departamentoMedico,
          municipio: municipioMedico,
          direccion: direccionMedico,
          es_referente: esReferente
        };
      }
    }

    const sinInfoParaImprimir = !tieneMedico || sinInformacion;
    onSave(paciente, medico, sinInfoParaImprimir, esServicioMovil, establecimientoMovil.trim(), sinOrdenMedica);
    resetForm();
  };

  const handleCancelar = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Nuevo Paciente</h2>
          <button onClick={handleCancelar} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-6">
          {/* Seccin Paciente */}
          <div className="card">
            <h3 className="text-xl font-semibold mb-4 text-blue-700">Datos del Paciente</h3>

            <div className="space-y-4">
              {/*  CAMPO NICO DE NOMBRE */}
              <div>
                <label className="label">Nombre Completo <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="input-field"
                  value={nombrePaciente}
                  onChange={(e) => setNombrePaciente(e.target.value)}
                  placeholder="Ej: Juan Carlos Perez Garcia"
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Edad <span className="text-red-500">*</span></label>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setTipoEdad('dias')}
                    className={`px-3 py-1 rounded text-sm ${tipoEdad === 'dias' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                    Días
                  </button>
                  <button type="button" onClick={() => setTipoEdad('meses')}
                    className={`px-3 py-1 rounded text-sm ${tipoEdad === 'meses' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                    Meses
                  </button>
                  <button type="button" onClick={() => setTipoEdad('anios')}
                    className={`px-3 py-1 rounded text-sm ${tipoEdad === 'anios' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                    Años
                  </button>
                </div>
                <input
                  type="number"
                  className="input-field"
                  value={edadPaciente}
                  onChange={(e) => setEdadPaciente(e.target.value.replace(/\D/g, ''))}
                  placeholder={tipoEdad === "anios" ? "Edad en años" : tipoEdad === "meses" ? "Edad en meses" : "Edad en días"}
                  min="0"
                  max={tipoEdad === 'anios' ? '120' : tipoEdad === 'meses' ? '1440' : '43800'}
                />
              </div>

              <div>
                <label className="label">Numero de Telefono <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  className="input-field"
                  value={telefonoPaciente}
                  onChange={(e) => setTelefonoPaciente(e.target.value.replace(/\D/g, ''))}
                  placeholder="12345678"
                  maxLength={8}
                />
              </div>

              <Autocomplete
                label="Departamento"
                options={departamentosGuatemala}
                value={departamentoPaciente}
                onChange={(val) => { setDepartamentoPaciente(val); setMunicipioPaciente(''); }}
                placeholder="Seleccione departamento"
                required
              />

              <Autocomplete
                label="Municipio"
                options={municipiosPacienteFiltrados}
                value={municipioPaciente}
                onChange={setMunicipioPaciente}
                placeholder="Seleccione municipio"
                disabled={!departamentoPaciente}
                required
              />
            </div>
          </div>

          {/* Seccin Medico */}
          <div className="card">
            <h3 className="text-xl font-semibold mb-4 text-green-700">Datos del Medico</h3>

            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center">
                  <input type="radio" checked={esReferente && !esServicioMovil}
                    onChange={() => { setEsReferente(true); setEsServicioMovil(false); setEstablecimientoMovil(''); setNombreMedico(''); setTelefonoMedico(''); setDepartamentoMedico(''); setMunicipioMedico(''); setDireccionMedico(''); }}
                    className="mr-2" disabled={sinInformacion} />
                  Referente
                </label>
                <label className="flex items-center">
                  <input type="radio" checked={!esReferente && !esServicioMovil}
                    onChange={() => { setEsReferente(false); setEsServicioMovil(false); setEstablecimientoMovil(''); setMedicoSeleccionado(null); setNombreMedico(''); setTelefonoMedico(''); setDepartamentoMedico(''); setMunicipioMedico(''); setDireccionMedico(''); }}
                    className="mr-2" disabled={sinInformacion} />
                  No Referente
                </label>
                <label className="flex items-center">
                  <input type="radio" checked={esServicioMovil}
                    onChange={() => { setEsServicioMovil(true); setEsReferente(false); setMedicoSeleccionado(null); setNombreMedico(''); setTelefonoMedico(''); setDepartamentoMedico(''); setMunicipioMedico(''); setDireccionMedico(''); }}
                    className="mr-2" disabled={sinInformacion} />
                  <span className="text-purple-700 font-medium"> Servicio Movil</span>
                </label>
              </div>

              <div className="flex items-center">
                <input type="checkbox" id="sinInfo" checked={sinInformacion}
                  onChange={(e) => handleSinInformacionChange(e.target.checked)} className="mr-2" />
                <label htmlFor="sinInfo" className="text-sm font-medium text-gray-700">Sin informacion</label>
              </div>

              {/* Sin orden medica  solo si hay medico y no es sin informacion */}
              {!sinInformacion && !esServicioMovil && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${sinOrdenMedica ? 'bg-amber-50 border-amber-300' : 'border-gray-200'}`}>
                  <input type="checkbox" id="sinOrden" checked={sinOrdenMedica}
                    onChange={(e) => setSinOrdenMedica(e.target.checked)} className="mr-1" />
                  <label htmlFor="sinOrden" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-1.5">
                     Sin orden medica
                    {sinOrdenMedica && <span className="text-xs text-amber-600 font-normal"> No genera comisin</span>}
                  </label>
                </div>
              )}

{esServicioMovil && (
                <div className="space-y-3">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-sm text-purple-800">
                      <strong> Servicio Movil:</strong> Este registro no cuenta como paciente regular ni genera comisin. Solo se registran estudios habilitados para servicio movil, con precio propio.
                    </p>
                  </div>
                  
                  {/*  Campo de texto simple para establecimiento */}
                  <div>
                    <label className="label">
                       Establecimiento / Lugar <span className="text-red-500"> *</span>
                    </label>
                    <div className="space-y-2">
                      {/* Bsqueda + lista siempre visible */}
                      <input
                        type="text"
                        className="input-field"
                        value={establecimientoMovil}
                        onChange={(e) => {
                          setEstablecimientoMovil(e.target.value);
                          const q = e.target.value.toLowerCase();
                          const el = document.getElementById('lista-estab-movil');
                          if (el) {
                            el.querySelectorAll('button[data-nombre]').forEach((btn: any) => {
                              btn.style.display = btn.dataset.nombre.toLowerCase().includes(q) ? '' : 'none';
                            });
                          }
                        }}
                        placeholder=" Escribir o buscar establecimiento..."
                      />
                      {establecimientos.length > 0 && (
                        <div id="lista-estab-movil" className="border border-green-200 rounded-lg bg-green-50 max-h-44 overflow-y-auto">
                          {establecimientos.map(est => (
                            <button
                              key={est.id}
                              type="button"
                              data-nombre={est.nombre}
                              onClick={() => setEstablecimientoMovil(est.nombre)}
                              className={`w-full text-left px-3 py-2 hover:bg-green-100 text-sm border-b border-green-100 last:border-0 transition-colors ${establecimientoMovil === est.nombre ? 'bg-green-200 font-semibold' : ''}`}
                            >
                              {est.nombre}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <p className="text-xs text-orange-600">
                        * Nombre del lugar donde se realizar el servicio movil
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!esServicioMovil && (
                <>
                  {esReferente && !sinInformacion ? (
                    <Autocomplete
                      label="Nombre del Medico"
                      options={medicosReferentes.map(m => ({ id: m.id || '', nombre: m.nombre }))}
                      value={nombreMedico}
                      onChange={handleMedicoReferenteChange}
                      placeholder="Buscar medico referente"
                      disabled={sinInformacion}
                      required={!sinInformacion}
                    />
                  ) : (
                    <div>
                      <label className="label">Nombre {!sinInformacion && <span className="text-red-500">*</span>}</label>
                      <input type="text" className="input-field" value={nombreMedico}
                        onChange={(e) => setNombreMedico(e.target.value)}
                        placeholder="Nombre del medico" disabled={sinInformacion} />
                    </div>
                  )}

                  <div>
                    <label className="label">Numero de Telefono {!sinInformacion && <span className="text-red-500">*</span>}</label>
                    <input type="tel" className="input-field" value={telefonoMedico}
                      onChange={(e) => setTelefonoMedico(e.target.value.replace(/\D/g, ''))}
                      placeholder="12345678"
                      disabled={sinInformacion || (esReferente && medicoSeleccionado !== null)}
                      maxLength={8} />
                  </div>

                  <Autocomplete label="Departamento" options={departamentosGuatemala} value={departamentoMedico}
                    onChange={(val) => { setDepartamentoMedico(val); setMunicipioMedico(''); }}
                    placeholder="Seleccione departamento"
                    disabled={sinInformacion || (esReferente && medicoSeleccionado !== null)}
                    required={!sinInformacion} />

                  <Autocomplete label="Municipio" options={municipiosMedicoFiltrados} value={municipioMedico}
                    onChange={setMunicipioMedico} placeholder="Seleccione municipio"
                    disabled={sinInformacion || !departamentoMedico || (esReferente && medicoSeleccionado !== null)}
                    required={!sinInformacion} />

                  <div>
                    <label className="label">Direccion {!sinInformacion && <span className="text-red-500">*</span>}</label>
                    <textarea className="input-field" value={direccionMedico}
                      onChange={(e) => setDireccionMedico(e.target.value)}
                      placeholder="Direccion completa"
                      disabled={sinInformacion || (esReferente && medicoSeleccionado !== null)}
                      rows={3} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
          <button onClick={handleCancelar} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} className="btn-primary">Guardar</button>
        </div>
      </div>
    </div>
  );
};