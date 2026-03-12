import React, { useState, useEffect } from 'react';
import { Plus, FileText, Users, BarChart3, Trash2, FileSpreadsheet, Settings, Calendar, DollarSign, Database } from 'lucide-react';
import { NuevoPacienteModal } from '../components/NuevoPacienteModal';
import { Autocomplete } from '../components/Autocomplete';
import { Paciente, Medico, SubEstudio, TipoCobro, FormaPago, DetalleConsulta } from '../types';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { generarReciboCompleto, generarReciboMedico, abrirRecibo } from '../lib/recibos';

interface HomePageProps {
  onNavigate: (page: string) => void;
}

interface PagoMultiple {
  forma_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'depositado';
  monto: number;
  numero_referencia?: string;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const rolUsuario = localStorage.getItem('rolUsuarioConrad') || '';
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [pacienteActual, setPacienteActual] = useState<(Paciente & { id: string }) | null>(null);
  const [medicoActual, setMedicoActual] = useState<Medico | null>(null);
  const [sinInfoMedico, setSinInfoMedico] = useState(false);
  const [sinOrdenMedicaConsulta, setSinOrdenMedicaConsulta] = useState(false);
  const [esServicioMovil, setEsServicioMovil] = useState(false);

  // ✅ ELIMINADO: incluyePlacas, precioPlacas, incluyeInforme, precioInforme
  // ✅ establecimientoMovil ahora viene del modal de NuevoPaciente
  const [establecimientoMovil, setEstablecimientoMovil] = useState('');

  const [consultaGuardada, setConsultaGuardada] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [numeroPacienteGuardado, setNumeroPacienteGuardado] = useState<number | null>(null);

  const [tipoCobro, setTipoCobro] = useState<TipoCobro>('normal');
  const [justificacionEspecial, setJustificacionEspecial] = useState('');
  const [showJustificacion, setShowJustificacion] = useState(false);
  const [estudios, setEstudios] = useState<any[]>([]);
  const [subEstudios, setSubEstudios] = useState<SubEstudio[]>([]);
  const [estudioSeleccionado, setEstudioSeleccionado] = useState('');
  const [subEstudioSeleccionado, setSubEstudioSeleccionado] = useState('');

  const [descripcion, setDescripcion] = useState<(DetalleConsulta & { es_referido: boolean; comentarios?: string })[]>([]);

  const [requiereFactura, setRequiereFactura] = useState(false);
  const [nit, setNit] = useState('');
  const [formaPago, setFormaPago] = useState<FormaPago | 'multiple'>('efectivo');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [numeroTransferencia, setNumeroTransferencia] = useState('');
  const [numeroVoucher, setNumeroVoucher] = useState('');

  const [showModalPagosMultiples, setShowModalPagosMultiples] = useState(false);
  const [pagosMultiples, setPagosMultiples] = useState<PagoMultiple[]>([
    { forma_pago: 'efectivo', monto: 0 }
  ]);

  const [showModalTipoRecibo, setShowModalTipoRecibo] = useState(false);
  const [datosReciboTemp, setDatosReciboTemp] = useState<any>(null);

  const esHorarioNormal = () => {
    const now = new Date();
    const dia = now.getDay();
    const hora = now.getHours();
    if (dia >= 1 && dia <= 5) return hora >= 7 && hora < 16;
    if (dia === 6) return hora >= 7 && hora < 11;
    return false;
  };

  useEffect(() => {
    const horarioNormal = esHorarioNormal();
    setTipoCobro(horarioNormal ? 'normal' : 'especial');
  }, []);

  useEffect(() => {
    cargarEstudios();
    cargarSubEstudios();
  }, []);

  useEffect(() => {
    if (descripcion.length > 0 && tipoCobro !== 'personalizado') {
      const nuevaDescripcion = descripcion.map(item => {
        const subEstudio = subEstudios.find(se => se.id === item.sub_estudio_id);
        if (!subEstudio) return item;
        const nuevoPrecio = tipoCobro === 'normal'
          ? subEstudio.precio_normal
          : tipoCobro === 'social'
          ? subEstudio.precio_social
          : subEstudio.precio_especial;
        return { ...item, precio: nuevoPrecio };
      });
      setDescripcion(nuevaDescripcion);
    }
  }, [tipoCobro]);

  useEffect(() => {
    if (requiereFactura) {
      if (formaPago === 'efectivo') setFormaPago('efectivo_facturado');
    } else {
      if (formaPago === 'efectivo_facturado') setFormaPago('efectivo');
    }
  }, [requiereFactura]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'U') {
        e.preventDefault();
        onNavigate('usuarios');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate]);

  const cargarEstudios = async () => {
    try {
      const { data, error } = await supabase.from('estudios').select('*').eq('activo', true);
      if (error) throw error;
      setEstudios(data || []);
    } catch (error) {
      console.error('Error al cargar estudios:', error);
    }
  };

  const cargarSubEstudios = async () => {
    try {
      const { data, error } = await supabase.from('sub_estudios').select('*').eq('activo', true);
      if (error) throw error;
      setSubEstudios(data || []);
    } catch (error) {
      console.error('Error al cargar sub-estudios:', error);
    }
  };

  const subEstudiosFiltrados = subEstudios.filter(se => se.estudio_id === estudioSeleccionado);

  const agregarSubEstudio = () => {
    if (!subEstudioSeleccionado) return;
    const subEstudio = subEstudios.find(se => se.id === subEstudioSeleccionado);
    if (!subEstudio) return;

    if (esServicioMovil) {
      const estudio = estudios.find(e => e.id === subEstudio.estudio_id);
      if (estudio && estudio.nombre.toUpperCase() !== 'RX') {
        alert('⚠️ Servicios Móviles: Solo se permiten estudios de RX');
        return;
      }
    }

    const precio = tipoCobro === 'normal'
      ? subEstudio.precio_normal
      : tipoCobro === 'social'
      ? subEstudio.precio_social
      : subEstudio.precio_especial;

    const nuevoDetalle = {
      sub_estudio_id: subEstudio.id!,
      precio,
      consulta_id: '',
      es_referido: true,
      comentarios: ''
    };

    setDescripcion([...descripcion, nuevoDetalle]);
    setSubEstudioSeleccionado('');
  };

  const eliminarDeDescripcion = (index: number) => {
    setDescripcion(descripcion.filter((_, i) => i !== index));
  };

  const toggleReferido = (index: number) => {
    const nuevaDescripcion = [...descripcion];
    nuevaDescripcion[index].es_referido = !nuevaDescripcion[index].es_referido;
    setDescripcion(nuevaDescripcion);
  };

  const actualizarComentarios = (index: number, comentarios: string) => {
    const nuevaDescripcion = [...descripcion];
    nuevaDescripcion[index].comentarios = comentarios;
    setDescripcion(nuevaDescripcion);
  };

  const calcularTotales = () => {
    const subTotal = descripcion.reduce((sum, item) => sum + item.precio, 0);
    const descuento = 0;
    const montoGravable = subTotal - descuento;
    const impuesto = 0;
    const total = montoGravable + impuesto;
    return { subTotal, descuento, montoGravable, impuesto, total };
  };

  // ✅ MODIFICADO: handleGuardarPaciente ahora recibe establecimiento desde el modal
  const handleGuardarPaciente = async (
    paciente: Paciente,
    medico: Medico | null,
    sinInfo: boolean,
    esServicioMovilParam: boolean = false,
    establecimiento: string = '',
    sinOrdenMedica: boolean = false
  ) => {
    try {
      const { data: pacienteData, error: pacienteError } = await supabase
        .from('pacientes')
        .insert([paciente])
        .select()
        .single();

      if (pacienteError) throw pacienteError;

      if (medico && !sinInfo) {
        if (!medico.id) {
          const { data: medicoData, error: medicoError } = await supabase
            .from('medicos')
            .insert([medico])
            .select()
            .single();
          if (medicoError) throw medicoError;
          setMedicoActual(medicoData);
        }
      }

      setPacienteActual(pacienteData);
      setMedicoActual(medico);
      setSinInfoMedico(sinInfo);
      setSinOrdenMedicaConsulta(sinOrdenMedica);
      setEsServicioMovil(esServicioMovilParam);

      // ✅ Guardar establecimiento recibido del modal
      setEstablecimientoMovil(esServicioMovilParam ? establecimiento : '');

      if (esServicioMovilParam) {
        setTipoCobro('especial');
      }

      setShowNuevoModal(false);
      alert(esServicioMovilParam ? 'Paciente guardado exitosamente' : 'Paciente guardado exitosamente');
    } catch (error) {
      console.error('Error al guardar paciente:', error);
      alert('Error al guardar paciente');
    }
  };

  const handleLimpiar = () => {
    if (confirm('¿Está seguro de que desea limpiar toda la información?')) {
      setPacienteActual(null);
      setMedicoActual(null);
      setSinInfoMedico(false);
      setEsServicioMovil(false);
      setEstablecimientoMovil('');
      setTipoCobro('normal');
      setJustificacionEspecial('');
      setShowJustificacion(false);
      setEstudioSeleccionado('');
      setSubEstudioSeleccionado('');
      setDescripcion([]);
      setRequiereFactura(false);
      setNit('');
      setFormaPago('efectivo');
      setNumeroFactura('');
      setNumeroTransferencia('');
      setNumeroVoucher('');
      setConsultaGuardada(null);
      setGuardando(false);
      setNumeroPacienteGuardado(null);
      setPagosMultiples([{ forma_pago: 'efectivo', monto: 0 }]);
    }
  };

  const validarPagosMultiples = (): boolean => {
    const totalPagos = pagosMultiples.reduce((sum, p) => sum + p.monto, 0);
    const totalEsperado = calcularTotales().total;
    if (Math.abs(totalPagos - totalEsperado) > 0.01) {
      alert(`❌ La suma de pagos (Q${totalPagos.toFixed(2)}) no coincide con el total (Q${totalEsperado.toFixed(2)})`);
      return false;
    }
    for (const pago of pagosMultiples) {
      if (pago.forma_pago === 'transferencia' && !pago.numero_referencia) {
        alert('❌ Debe ingresar el número de referencia para la transferencia');
        return false;
      }
    }
    return true;
  };

  const handleGuardar = async () => {
    if (!pacienteActual) {
      alert('Debe crear un paciente primero usando el botón "Nuevo"');
      return;
    }
    if (descripcion.length === 0) {
      alert('Debe agregar al menos un estudio');
      return;
    }
    // ✅ Servicio móvil: requiere al menos médico O establecimiento
    if (esServicioMovil && !establecimientoMovil.trim() && !medicoActual) {
      alert('Para servicios móviles ingresa al menos un médico o un establecimiento.');
      return;
    }

    const horarioNormal = esHorarioNormal();
    if (tipoCobro === 'normal' && !horarioNormal && !justificacionEspecial.trim()) {
      alert('Debe proporcionar una justificación para usar tarifa normal fuera del horario establecido');
      return;
    }
    if (tipoCobro === 'personalizado' && !esServicioMovil && !justificacionEspecial.trim()) {
      alert('Debe proporcionar una justificación para usar precio personalizado');
      return;
    }
    if (formaPago === 'multiple' && !validarPagosMultiples()) return;
    if (formaPago === 'transferencia' && !numeroTransferencia.trim()) {
      alert('Debe ingresar el número de transferencia');
      return;
    }
    if (guardando) {
      alert('⏳ Ya se está guardando, por favor espere...');
      return;
    }
    if (consultaGuardada) {
      const reimprimir = confirm('✅ Esta consulta ya fue guardada.\n\n¿Desea reimprimir el recibo?');
      if (reimprimir) handleImprimir();
      return;
    }

    setGuardando(true);

    try {
      let siguienteNumero = null;

      if (!esServicioMovil) {
        const fechaHoy = format(new Date(), 'yyyy-MM-dd');
        const { data: ultimaConsulta } = await supabase
          .from('consultas')
          .select('numero_paciente')
          .eq('fecha', fechaHoy)
          .or('anulado.is.null,anulado.eq.false')
          .or('es_servicio_movil.is.null,es_servicio_movil.eq.false')
          .order('numero_paciente', { ascending: false })
          .limit(1)
          .single();
        siguienteNumero = (ultimaConsulta?.numero_paciente || 0) + 1;
      }

      const detallePagosMultiples = formaPago === 'multiple' ? pagosMultiples : null;

      const { data: consultaData, error: consultaError } = await supabase
        .from('consultas')
        .insert([{
          numero_paciente: siguienteNumero,
          paciente_id: pacienteActual.id,
          medico_id: medicoActual?.id || null,
          medico_recomendado: medicoActual?.nombre || null,
          tipo_cobro: tipoCobro,
          requiere_factura: requiereFactura,
          nit: requiereFactura ? nit : null,
          forma_pago: formaPago === 'multiple' ? 'pago_multiple' : formaPago,
          numero_factura: numeroFactura || null,
          numero_transferencia: formaPago === 'transferencia' ? numeroTransferencia : null,
          numero_voucher: formaPago === 'tarjeta' ? numeroVoucher : null,
          sin_informacion_medico: sinInfoMedico,
          sin_orden_medica: sinOrdenMedicaConsulta,
          justificacion_especial: ((tipoCobro === 'normal' && !esHorarioNormal()) || (tipoCobro === 'personalizado' && !esServicioMovil)) ? justificacionEspecial : null,
          fecha: format(new Date(), 'yyyy-MM-dd'),
          es_servicio_movil: esServicioMovil,
          // ✅ ELIMINADO: movil_incluye_placas, movil_precio_placas, movil_incluye_informe, movil_precio_informe
          movil_establecimiento: esServicioMovil ? establecimientoMovil : null,
          detalle_pagos_multiples: detallePagosMultiples
        }])
        .select()
        .single();

      if (consultaError) throw consultaError;

      const detalles = descripcion.map(d => ({
        consulta_id: consultaData.id,
        sub_estudio_id: d.sub_estudio_id,
        precio: d.precio,
        es_referido: d.es_referido,
        comentarios: d.comentarios || null
      }));

      const { error: detallesError } = await supabase.from('detalle_consultas').insert(detalles);
      if (detallesError) throw detallesError;

      setConsultaGuardada(consultaData.id);
      setNumeroPacienteGuardado(consultaData.numero_paciente);
      alert('✅ Consulta guardada exitosamente.\n\nAhora puede imprimir el recibo usando el botón "Imprimir".');
    } catch (error) {
      console.error('Error al guardar consulta:', error);
      alert('❌ Error al guardar consulta: ' + (error as any).message);
    } finally {
      setGuardando(false);
    }
  };

  const handleImprimir = async () => {
    if (!consultaGuardada) {
      alert('⚠️ Debe guardar la consulta primero usando el botón "Guardar"');
      return;
    }
    if (!pacienteActual) {
      alert('❌ Error: No se encontró información del paciente');
      return;
    }

    try {
      const fechaHora = new Date();
      const tieneMedico = medicoActual !== null;
      const esReferente = tieneMedico && !sinInfoMedico;

      const estudiosRecibo = descripcion.map(d => {
        const subEstudio = subEstudios.find(se => se.id === d.sub_estudio_id);
        return {
          nombre: subEstudio?.nombre || 'Estudio',
          precio: d.precio,
          comentarios: d.comentarios || undefined
        };
      });

      const totales = calcularTotales();

      const datosRecibo = {
        numeroPaciente: numeroPacienteGuardado,
        paciente: {
          nombre: pacienteActual.nombre,
          edad: pacienteActual.edad,
          edad_valor: pacienteActual.edad_valor,
          edad_tipo: pacienteActual.edad_tipo,
          telefono: pacienteActual.telefono
        },
        medico: medicoActual ? { nombre: medicoActual.nombre } : undefined,
        esReferente,
        estudios: estudiosRecibo,
        total: totales.total,
        formaPago,
        fecha: fechaHora,
        sinInfoMedico
      };

      setDatosReciboTemp(datosRecibo);
      setShowModalTipoRecibo(true);
    } catch (error) {
      console.error('Error al imprimir:', error);
      alert('❌ Error al imprimir el recibo: ' + (error as any).message);
    }
  };

  const imprimirReciboSeleccionado = (tipoRecibo: 'completo' | 'medico') => {
    if (!datosReciboTemp) return;
    if (tipoRecibo === 'completo') {
      abrirRecibo(generarReciboCompleto(datosReciboTemp), 'Recibo Completo');
    } else {
      abrirRecibo(generarReciboMedico(datosReciboTemp), 'Orden Médico');
    }
    setShowModalTipoRecibo(false);
    setDatosReciboTemp(null);
    setTimeout(() => {
      const nuevaConsulta = confirm('✅ Recibo impreso.\n\n¿Desea crear una nueva consulta?');
      if (nuevaConsulta) handleLimpiar();
    }, 500);
  };

  const agregarPago = () => {
    setPagosMultiples([...pagosMultiples, { forma_pago: 'efectivo', monto: 0 }]);
  };

  const eliminarPago = (index: number) => {
    if (pagosMultiples.length === 1) { alert('Debe haber al menos un pago'); return; }
    setPagosMultiples(pagosMultiples.filter((_, i) => i !== index));
  };

  const actualizarPago = (index: number, campo: 'forma_pago' | 'monto' | 'numero_referencia', valor: any) => {
    const nuevosPagos = [...pagosMultiples];
    nuevosPagos[index] = { ...nuevosPagos[index], [campo]: valor };
    setPagosMultiples(nuevosPagos);
  };

  const totales = calcularTotales();
  const horarioNormal = esHorarioNormal();

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
      {/* HEADER */}
      <header style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1d4ed8 100%)' }} className="text-white shadow-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 border border-white/20">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">Centro de Diagnóstico</h1>
                <p className="text-blue-200 text-xs mt-0.5 font-medium tracking-wide">SISTEMA DE GESTIÓN MÉDICA · CONRAD</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-semibold text-sm">{format(new Date(), "EEEE, dd 'de' MMMM yyyy")}</p>
              <p className="text-blue-300 text-xs font-mono mt-0.5">{format(new Date(), 'HH:mm')}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Barra de navegación */}
      <div className="bg-white/80 backdrop-blur border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setShowNuevoModal(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm shadow-blue-200">
              <Plus size={16} /> Nuevo
            </button>
            {[
              { label: 'Productos', icon: <FileText size={15}/>, nav: 'productos' },
              { label: 'Referentes', icon: <Users size={15}/>, nav: 'referentes' },
              { label: 'Pacientes', icon: <Users size={15}/>, nav: 'pacientes' },
              { label: 'Cuadre Diario', icon: <BarChart3 size={15}/>, nav: 'cuadre' },
              { label: 'Est. Cta Quincenal', icon: <Calendar size={15}/>, nav: 'cuadre-quincenal' },
              { label: 'Reportes', icon: <FileSpreadsheet size={15}/>, nav: 'reportes' },
              { label: 'Comisiones', icon: <DollarSign size={15}/>, nav: 'comisiones' },
            ].map(({ label, icon, nav }) => (
              <button key={nav} onClick={() => onNavigate(nav)}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-gray-200 hover:border-blue-300 text-gray-600 hover:text-blue-700 px-3 py-2 rounded-lg text-sm font-medium transition-all">
                {icon} {label}
              </button>
            ))}
            {rolUsuario === 'admin' && (
              <button onClick={() => onNavigate('importar-medicos')}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-dashed border-gray-300 hover:border-emerald-400 text-gray-400 hover:text-emerald-700 px-3 py-2 rounded-lg text-sm font-medium transition-all ml-1"
                title="Importar base de datos de médicos desde Excel">
                <Database size={15}/> Importar BD
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="container mx-auto px-4 pb-10 pt-5">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Columna izquierda */}
          <div className="lg:col-span-2 space-y-6">
            {pacienteActual && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Header paciente */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100"
                  style={{ background: consultaGuardada ? 'linear-gradient(90deg,#f0fdf4,#dcfce7)' : esServicioMovil ? 'linear-gradient(90deg,#fff7ed,#fed7aa33)' : 'linear-gradient(90deg,#eff6ff,#dbeafe33)' }}>
                  <div className="flex items-center gap-2">
                    <div className={`rounded-lg p-1.5 ${consultaGuardada ? 'bg-green-100' : esServicioMovil ? 'bg-orange-100' : 'bg-blue-100'}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={consultaGuardada ? '#16a34a' : esServicioMovil ? '#ea580c' : '#2563eb'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <span className="font-bold text-sm text-gray-800">Información del Paciente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {esServicioMovil && <span className="text-xs bg-orange-500 text-white px-2.5 py-1 rounded-full font-bold">📱 MÓVIL</span>}
                    {consultaGuardada && <span className="text-xs bg-green-500 text-white px-2.5 py-1 rounded-full font-bold">✅ GUARDADO</span>}
                    {sinOrdenMedicaConsulta && <span className="text-xs bg-amber-400 text-white px-2.5 py-1 rounded-full font-bold">📋 SIN ORDEN</span>}
                  </div>
                </div>
                {/* Datos */}
                <div className="px-5 py-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                    <div><span className="text-gray-400 text-xs uppercase tracking-wide font-medium">Nombre</span><p className="font-semibold text-gray-900 mt-0.5">{pacienteActual.nombre}</p></div>
                    <div><span className="text-gray-400 text-xs uppercase tracking-wide font-medium">Edad</span><p className="font-semibold text-gray-900 mt-0.5">{pacienteActual.edad} años</p></div>
                    <div><span className="text-gray-400 text-xs uppercase tracking-wide font-medium">Teléfono</span><p className="font-semibold text-gray-900 mt-0.5">{pacienteActual.telefono}</p></div>
                    <div><span className="text-gray-400 text-xs uppercase tracking-wide font-medium">Departamento</span><p className="font-semibold text-gray-900 mt-0.5">{pacienteActual.departamento}</p></div>
                    <div><span className="text-gray-400 text-xs uppercase tracking-wide font-medium">Municipio</span><p className="font-semibold text-gray-900 mt-0.5">{pacienteActual.municipio}</p></div>
                    {esServicioMovil && establecimientoMovil && (
                      <div className="col-span-2 md:col-span-3">
                        <span className="text-gray-400 text-xs uppercase tracking-wide font-medium">Establecimiento</span>
                        <p className="font-semibold text-orange-700 mt-0.5">🏥 {establecimientoMovil}</p>
                      </div>
                    )}
                  </div>
                  {medicoActual && !sinInfoMedico && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2 flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        Médico {sinOrdenMedicaConsulta && <span className="text-amber-500 ml-1">(Sin orden médica)</span>}
                      </p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div><span className="text-gray-400 text-xs">Nombre</span><p className="font-semibold text-gray-900">{medicoActual.nombre}</p></div>
                        <div><span className="text-gray-400 text-xs">Teléfono</span><p className="font-semibold text-gray-900">{medicoActual.telefono}</p></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!pacienteActual && (
              <div className="rounded-2xl overflow-hidden border border-blue-100 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}>
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #1d4ed8, #0f172a)' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-1">Bienvenido al Centro de Diagnóstico</h3>
                  <p className="text-blue-600 text-sm mb-6 font-medium">Registra un nuevo paciente para comenzar la consulta</p>
                  <button onClick={() => setShowNuevoModal(true)}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-md shadow-blue-200 hover:shadow-lg">
                    <Plus size={18} /> Crear Nuevo Paciente
                  </button>
                </div>
              </div>
            )}

            {/* Tipo de cobro */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Tipo de Cobro</h3>
              <div className="flex gap-2 flex-wrap">
                <label className="flex items-center">
                  <input type="radio" name="tipoCobro" checked={tipoCobro === 'social'}
                    onChange={() => { setTipoCobro('social'); setShowJustificacion(false); setJustificacionEspecial(''); }}
                    disabled={esServicioMovil || !!consultaGuardada} className="mr-2" />
                  Social {esServicioMovil && <span className="text-gray-400 text-xs ml-1">(No disponible para móviles)</span>}
                </label>
                <label className="flex items-center">
                  <input type="radio" name="tipoCobro" checked={tipoCobro === 'normal'}
                    onChange={() => { if (!horarioNormal) setShowJustificacion(true); setTipoCobro('normal'); }}
                    disabled={esServicioMovil || !!consultaGuardada} className="mr-2" />
                  Normal {!horarioNormal && '(Requiere justificación)'} {esServicioMovil && <span className="text-gray-400 text-xs ml-1">(No disponible para móviles)</span>}
                </label>
                <label className="flex items-center">
                  <input type="radio" name="tipoCobro" checked={tipoCobro === 'especial'}
                    onChange={() => { setTipoCobro('especial'); setShowJustificacion(false); setJustificacionEspecial(''); }}
                    disabled={(horarioNormal && !esServicioMovil) || !!consultaGuardada} className="mr-2" />
                  Especial {horarioNormal && !esServicioMovil && '(Solo fuera de horario)'}
                  {esServicioMovil && <span className="text-orange-600 font-medium ml-1">(Precio del sistema)</span>}
                </label>
                <label className="flex items-center">
                  <input type="radio" name="tipoCobro" checked={tipoCobro === 'personalizado'}
                    onChange={() => { setTipoCobro('personalizado'); setShowJustificacion(!esServicioMovil); }}
                    disabled={!!consultaGuardada} className="mr-2" />
                  <span className="text-purple-600 font-medium">Personalizado</span>
                  {esServicioMovil && <span className="text-orange-600 text-xs ml-1">(Editar precios manualmente)</span>}
                </label>
              </div>

              {showJustificacion && (tipoCobro === 'normal' && !horarioNormal || (tipoCobro === 'personalizado' && !esServicioMovil)) && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <label className="label">
                    {tipoCobro === 'personalizado' ? 'Justificación y precio personalizado:' : 'Justificación para tarifa normal fuera de horario:'}
                  </label>
                  <textarea
                    className="input-field mt-2"
                    value={justificacionEspecial}
                    onChange={(e) => setJustificacionEspecial(e.target.value)}
                    placeholder={tipoCobro === 'personalizado' ? "Ej: Por orden del Dr. García, precio especial Q150" : "Ej: Médico referente solicitó tarifa normal"}
                    rows={2}
                    required
                    disabled={!!consultaGuardada}
                  />
                  <p className="text-xs text-gray-600 mt-1">* Esta justificación quedará registrada en el sistema</p>
                </div>
              )}

              {esServicioMovil && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <p className="text-sm text-orange-700">
                    <strong>📱 Servicio Móvil:</strong>
                    {tipoCobro === 'especial' && ' Usando precios especiales del sistema'}
                    {tipoCobro === 'personalizado' && ' Puedes editar el precio de cada estudio manualmente en la sección de Descripción'}
                  </p>
                </div>
              )}
            </div>

            {/* ✅ ELIMINADA: Sección "Opciones Extras - Servicio Móvil" */}

            {/* Estudios */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Estudios</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <Autocomplete
                  label="Estudio"
                  options={estudios
                    .filter(e => !esServicioMovil || e.nombre.toUpperCase() === 'RX')
                    .map(e => ({ id: e.id, nombre: e.nombre }))}
                  value={estudioSeleccionado}
                  onChange={(val) => { setEstudioSeleccionado(val); setSubEstudioSeleccionado(''); }}
                  placeholder={esServicioMovil ? "Solo estudios RX disponibles" : "Seleccione estudio"}
                  disabled={!!consultaGuardada}
                />
                <Autocomplete
                  label="Sub-Estudio"
                  options={subEstudiosFiltrados.map(se => ({ id: se.id || '', nombre: se.nombre }))}
                  value={subEstudioSeleccionado}
                  onChange={setSubEstudioSeleccionado}
                  placeholder="Seleccione sub-estudio"
                  disabled={!estudioSeleccionado || !!consultaGuardada}
                />
              </div>
              <button
                onClick={agregarSubEstudio}
                className="mt-3 flex items-center gap-2 justify-center w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold text-sm transition-all shadow-sm shadow-blue-100"
                disabled={!subEstudioSeleccionado || !!consultaGuardada}
              >
                <Plus size={16} />
                Agregar {estudioSeleccionado && descripcion.length > 0 ? 'Otro Estudio' : 'a Descripción'}
              </button>
              {estudioSeleccionado && descripcion.length > 0 && !consultaGuardada && (
                <p className="text-sm text-green-600 mt-2 text-center">✓ Puedes seguir agregando más estudios del mismo tipo</p>
              )}
              {consultaGuardada && (
                <p className="text-sm text-amber-600 mt-2 text-center font-medium">⚠️ Consulta guardada — no se pueden agregar más estudios</p>
              )}
            </div>

            {/* Descripción */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Descripción de Estudios</h3>
              {descripcion.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay estudios agregados</p>
              ) : (
                <div className="space-y-2">
                  {descripcion.map((item, index) => {
                    const subEstudio = subEstudios.find(se => se.id === item.sub_estudio_id);
                    return (
                      <div key={index} className="p-3 bg-gray-50 rounded border-l-4"
                        style={{ borderLeftColor: item.es_referido ? '#10b981' : '#94a3b8' }}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-medium flex items-center gap-2">
                              {subEstudio?.nombre}
                              {item.es_referido ? (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">✓ Genera comisión</span>
                              ) : (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Sin comisión</span>
                              )}
                            </div>
                            {tipoCobro === 'personalizado' ? (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-gray-600">Q</span>
                                <input
                                  type="number" step="0.01" min="0"
                                  value={item.precio}
                                  onChange={(e) => {
                                    const nuevaDescripcion = [...descripcion];
                                    nuevaDescripcion[index].precio = parseFloat(e.target.value) || 0;
                                    setDescripcion(nuevaDescripcion);
                                  }}
                                  className="w-24 px-2 py-1 border border-purple-300 rounded focus:ring-2 focus:ring-purple-500"
                                  disabled={!!consultaGuardada}
                                />
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600">Q {item.precio.toFixed(2)}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!consultaGuardada && medicoActual && !sinInfoMedico && (
                              <button
                                onClick={() => toggleReferido(index)}
                                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                                  item.es_referido ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                                }`}
                                title={item.es_referido ? 'Click para no generar comisión' : 'Click para generar comisión'}
                              >
                                {item.es_referido ? '✓ Referido' : 'No referido'}
                              </button>
                            )}
                            <button onClick={() => eliminarDeDescripcion(index)} className="text-red-600 hover:text-red-800 p-1" disabled={!!consultaGuardada}>
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                        {!consultaGuardada && (
                          <div className="mt-2 border-t pt-2">
                            <label className="flex items-center text-xs text-gray-600 mb-1">
                              <input
                                type="checkbox"
                                checked={!!item.comentarios && item.comentarios.trim() !== ''}
                                onChange={(e) => { if (!e.target.checked) actualizarComentarios(index, ''); }}
                                className="mr-2"
                              />
                              Agregar comentarios opcionales
                            </label>
                            {(item.comentarios !== undefined && item.comentarios !== '') || item.comentarios === '' ? (
                              <textarea
                                value={item.comentarios || ''}
                                onChange={(e) => actualizarComentarios(index, e.target.value)}
                                placeholder="Comentarios adicionales sobre este estudio..."
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 resize-none"
                                rows={2}
                                maxLength={500}
                              />
                            ) : null}
                          </div>
                        )}
                        {consultaGuardada && item.comentarios && item.comentarios.trim() !== '' && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                            <strong className="text-blue-700">Comentarios:</strong>
                            <p className="text-gray-700 mt-1">{item.comentarios}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {medicoActual && !sinInfoMedico && descripcion.length > 0 && !consultaGuardada && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm">
                  <p className="text-blue-700">💡 Usa el botón <strong>"Referido"</strong> para controlar qué estudios generan comisión al médico.</p>
                </div>
              )}
            </div>
          </div>

          {/* Columna derecha */}
          <div className="space-y-4">
            {/* Facturación */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Facturación</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="font-medium">Factura:</label>
                  <label className="flex items-center">
                    <input type="radio" name="factura" checked={requiereFactura} onChange={() => setRequiereFactura(true)} className="mr-1" disabled={!!consultaGuardada} />Sí
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="factura" checked={!requiereFactura} onChange={() => { setRequiereFactura(false); setNit(''); }} className="mr-1" disabled={!!consultaGuardada} />No
                  </label>
                </div>
                <div>
                  <label className="label">NIT</label>
                  <input type="text" className="input-field" value={nit} onChange={(e) => setNit(e.target.value)} placeholder="NIT (si aplica)" disabled={!requiereFactura || !!consultaGuardada} />
                </div>
                <div>
                  <label className="label">Forma de Pago</label>
                  <select
                    className="input-field"
                    value={formaPago}
                    onChange={(e) => {
                      const valor = e.target.value as FormaPago | 'multiple';
                      setFormaPago(valor);
                      setNumeroTransferencia('');
                      setNumeroVoucher('');
                      if (valor === 'multiple') setShowModalPagosMultiples(true);
                    }}
                    disabled={!!consultaGuardada}
                  >
                    {requiereFactura ? (
                      <>
                        <option value="efectivo_facturado">Efectivo Facturado (Depósito)</option>
                        <option value="tarjeta">Tarjeta Facturado</option>
                        <option value="transferencia">Transferencia Bancaria</option>
                        <option value="multiple">💳 Pago Múltiple (Dividir)</option>
                      </>
                    ) : (
                      <>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="transferencia">Transferencia Bancaria</option>
                        <option value="estado_cuenta">Estado de Cuenta</option>
                        <option value="multiple">💳 Pago Múltiple (Dividir)</option>
                      </>
                    )}
                  </select>
                </div>
                {formaPago === 'transferencia' && (
                  <div>
                    <label className="label">Número de Transferencia *</label>
                    <input type="text" className="input-field" value={numeroTransferencia} onChange={(e) => setNumeroTransferencia(e.target.value)} placeholder="Número de referencia" required disabled={!!consultaGuardada} />
                  </div>
                )}
                {formaPago === 'tarjeta' && (
                  <div>
                    <label className="label">Número de Voucher/Baucher <span className="text-yellow-600 ml-2">(Opcional - se puede agregar después)</span></label>
                    <input type="text" className="input-field" value={numeroVoucher} onChange={(e) => setNumeroVoucher(e.target.value)} placeholder="Número de voucher" disabled={!!consultaGuardada} />
                    {!numeroVoucher && <p className="text-xs text-yellow-600 mt-1">⚠️ Sin voucher - pendiente de agregar</p>}
                  </div>
                )}
                <div>
                  <label className="label">Número de Factura</label>
                  <input type="text" className="input-field" value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="Número de factura" disabled={!!consultaGuardada} />
                </div>
                {formaPago === 'multiple' && pagosMultiples.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded p-3">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold text-purple-800">💳 Pagos Configurados</h4>
                      <button onClick={() => setShowModalPagosMultiples(true)} className="text-xs text-purple-600 hover:text-purple-800" disabled={!!consultaGuardada}>Editar</button>
                    </div>
                    <div className="space-y-1 text-sm">
                      {pagosMultiples.map((pago, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="capitalize">{pago.forma_pago.replace('_', ' ')}:</span>
                          <span className="font-medium">Q {pago.monto.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t pt-1 font-bold">
                        <span>Total:</span>
                        <span>Q {pagosMultiples.reduce((sum, p) => sum + p.monto, 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Totales */}
            <div className="rounded-2xl overflow-hidden border border-blue-200 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)' }}>
              <div className="px-5 py-4">
                <h3 className="text-xs font-bold text-blue-200 uppercase tracking-wide mb-3">💰 Totales</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Sub-Total', value: totales.subTotal },
                    { label: 'Descuento', value: totales.descuento },
                    { label: 'Monto Gravable', value: totales.montoGravable },
                    { label: 'Impuesto', value: totales.impuesto },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-blue-200">{label}:</span>
                      <span className="text-white font-medium">Q {value.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 mt-1 border-t border-white/20">
                    <span className="font-bold text-white text-base">Total Ventas:</span>
                    <span className="font-black text-white text-xl">Q {totales.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="space-y-2.5">
              <button onClick={handleLimpiar}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 rounded-xl font-semibold text-sm transition-all">
                🗑️ Limpiar
              </button>
              <button
                onClick={handleGuardar}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all ${
                  guardando ? 'bg-amber-500 text-white cursor-wait shadow-md'
                  : consultaGuardada ? 'bg-emerald-600 text-white cursor-default shadow-md'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:shadow-lg'
                }`}
                disabled={!pacienteActual || descripcion.length === 0 || guardando || !!consultaGuardada}
              >
                {guardando ? '⏳ Guardando...' : consultaGuardada ? '✅ Consulta Guardada' : '💾 Guardar Consulta'}
              </button>
              <button
                onClick={handleImprimir}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                  consultaGuardada
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-green-100'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                disabled={!consultaGuardada}
              >
                🖨️ Imprimir Recibo
              </button>
              {!consultaGuardada && pacienteActual && descripcion.length > 0 && (
                <p className="text-xs text-blue-500 text-center font-medium">ℹ️ Primero debe guardar la consulta</p>
              )}
              {consultaGuardada && (
                <p className="text-xs text-emerald-600 text-center font-medium">✅ Guardado · puede imprimir ahora</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de nuevo paciente */}
      <NuevoPacienteModal
        isOpen={showNuevoModal}
        onClose={() => setShowNuevoModal(false)}
        onSave={handleGuardarPaciente}
      />

      {/* Modal pagos múltiples */}
      {showModalPagosMultiples && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">💳 Configurar Pagos Múltiples</h2>
              <button onClick={() => setShowModalPagosMultiples(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
              <p className="text-sm text-blue-800"><strong>Total a pagar:</strong> Q {totales.total.toFixed(2)}</p>
              <p className="text-xs text-blue-600 mt-1">La suma de todos los pagos debe coincidir con el total</p>
            </div>
            <div className="space-y-4">
              {pagosMultiples.map((pago, index) => (
                <div key={index} className="border-2 border-gray-200 rounded p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold">Pago #{index + 1}</h4>
                    {pagosMultiples.length > 1 && (
                      <button onClick={() => eliminarPago(index)} className="text-red-600 hover:text-red-800 text-sm">Eliminar</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Forma de Pago</label>
                      <select className="input-field" value={pago.forma_pago} onChange={(e) => actualizarPago(index, 'forma_pago', e.target.value)}>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="depositado">Depositado</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Monto (Q)</label>
                      <input type="number" step="0.01" min="0" className="input-field" value={pago.monto} onChange={(e) => actualizarPago(index, 'monto', parseFloat(e.target.value) || 0)} placeholder="0.00" />
                    </div>
                  </div>
                  {pago.forma_pago === 'transferencia' && (
                    <div className="mt-3">
                      <label className="label">Número de Referencia *</label>
                      <input type="text" className="input-field" value={pago.numero_referencia || ''} onChange={(e) => actualizarPago(index, 'numero_referencia', e.target.value)} placeholder="Número de transferencia" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={agregarPago} className="mt-4 w-full btn-secondary flex items-center justify-center gap-2">
              <Plus size={18} /> Agregar Otro Pago
            </button>
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <div className="flex justify-between font-semibold">
                <span>Total configurado:</span>
                <span className={Math.abs(pagosMultiples.reduce((sum, p) => sum + p.monto, 0) - totales.total) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                  Q {pagosMultiples.reduce((sum, p) => sum + p.monto, 0).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => { setShowModalPagosMultiples(false); setFormaPago('efectivo'); setPagosMultiples([{ forma_pago: 'efectivo', monto: 0 }]); }} className="btn-secondary">Cancelar</button>
              <button onClick={() => { if (validarPagosMultiples()) setShowModalPagosMultiples(false); }} className="btn-primary">Confirmar Pagos</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tipo recibo */}
      {showModalTipoRecibo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">¿Qué recibo desea imprimir?</h2>
            <p className="text-gray-600 text-sm mb-6 text-center">Seleccione el tipo de recibo que desea generar</p>
            <div className="space-y-3">
              <button onClick={() => imprimirReciboSeleccionado('completo')} className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-between">
                <span>📄 Recibo Completo</span><span className="text-sm opacity-90">(con precios)</span>
              </button>
              <button onClick={() => imprimirReciboSeleccionado('medico')} className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-between">
                <span>🩺 Orden para Médico</span><span className="text-sm opacity-90">(sin precios)</span>
              </button>
              <button onClick={() => { setShowModalTipoRecibo(false); setDatosReciboTemp(null); }} className="w-full py-3 px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};