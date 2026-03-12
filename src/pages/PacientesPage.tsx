import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Trash2, Calendar, Printer, Plus, FileText, X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { EditarPacienteModal } from '../components/EditarPacienteModal';
import { AgregarEstudioModal } from '../components/AgregarEstudioModal';
import { AutorizacionModal } from '../components/AutorizacionModal';
import { generarReciboCompleto, generarReciboMedico, abrirRecibo } from '../lib/recibos';

interface PacientesPageProps {
  onBack: () => void;
}

export const PacientesPage: React.FC<PacientesPageProps> = ({ onBack }) => {
  const getFechaGuatemala = () => {
    const ahora = new Date();
    const guatemalaTime = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
    return format(guatemalaTime, 'yyyy-MM-dd');
  };

  const [fecha, setFecha] = useState(getFechaGuatemala());
  const [consultas, setConsultas] = useState<any[]>([]);
  const [consultasAnuladas, setConsultasAnuladas] = useState<any[]>([]);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [pestanaActiva, setPestanaActiva] = useState<'todos' | 'regulares' | 'moviles' | 'anuladas'>('regulares');
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAgregarEstudioModal, setShowAgregarEstudioModal] = useState(false);
  const [showEditVoucherModal, setShowEditVoucherModal] = useState(false);
  const [showEditFormaPagoModal, setShowEditFormaPagoModal] = useState(false);
  const [pacienteEditando, setPacienteEditando] = useState<any>(null);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState<any>(null);
  const [voucherEditando, setVoucherEditando] = useState('');
  const [nitEditando, setNitEditando] = useState('');
  const [formaPagoEditando, setFormaPagoEditando] = useState('');
  const [requiereFacturaEditando, setRequiereFacturaEditando] = useState(false);
  const [showModalTipoRecibo, setShowModalTipoRecibo] = useState(false);
  const [datosReciboTemp, setDatosReciboTemp] = useState<any>(null);

  // Estados para autorización
  const [mostrarAutorizacion, setMostrarAutorizacion] = useState(false);
  const [accionPendiente, setAccionPendiente] = useState<{
    tipo: 'eliminar_consulta' | 'editar_paciente' | 'eliminar_estudio' | 'editar_precio';
    datos: any;
  } | null>(null);

  // ✅ NUEVO: Estados para modal de edición de precio
  const [showEditPrecioModal, setShowEditPrecioModal] = useState(false);
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [justificacionPrecio, setJustificacionPrecio] = useState('');

  useEffect(() => {
    cargarConsultas();
  }, [fecha]);

  const cargarConsultas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('consultas')
        .select(`
          *,
          pacientes(*),
          medicos(nombre),
          detalle_consultas(*, sub_estudios(nombre))
        `)
        .eq('fecha', fecha)
        .order('numero_paciente', { ascending: true });

      if (error) throw error;

      const activas = (data || []).filter(c => !c.anulado);
      const anuladas = (data || []).filter(c => c.anulado);

      setConsultas(activas);
      setConsultasAnuladas(anuladas);
    } catch (error) {
      console.error('Error al cargar consultas:', error);
      alert('Error al cargar consultas');
    }
    setLoading(false);
  };

  // ─── ELIMINAR CONSULTA ────────────────────────────────────────────────────
  const solicitarEliminarConsulta = (consultaId: string, numeroEliminado: number | null, nombrePaciente: string) => {
    setAccionPendiente({
      tipo: 'eliminar_consulta',
      datos: { consultaId, numeroEliminado, nombrePaciente }
    });
    setMostrarAutorizacion(true);
  };

  const eliminarConsulta = async () => {
    if (!accionPendiente || accionPendiente.tipo !== 'eliminar_consulta') return;

    const { consultaId, numeroEliminado, nombrePaciente } = accionPendiente.datos;

    const motivo = prompt('⚠️ ANULAR CONSULTA\n\n¿Por qué se anula?\n(Obligatorio para auditoría)');
    if (!motivo || motivo.trim() === '') {
      alert('❌ Debes dar un motivo');
      setMostrarAutorizacion(false);
      setAccionPendiente(null);
      return;
    }

    const mensajeConfirmacion = numeroEliminado
      ? `¿ANULAR esta consulta?\n\nMotivo: ${motivo}\n\nLos pacientes posteriores se renumerarán automáticamente.`
      : `¿ANULAR este servicio móvil?\n\nMotivo: ${motivo}`;

    if (!confirm(mensajeConfirmacion)) {
      setMostrarAutorizacion(false);
      setAccionPendiente(null);
      return;
    }

    try {
      const usuarioActual = localStorage.getItem('nombreUsuarioConrad') || 'Desconocido';

      const { error } = await supabase
        .from('consultas')
        .update({
          anulado: true,
          numero_paciente: null,
          fecha_anulacion: new Date().toISOString(),
          usuario_anulo: usuarioActual,
          motivo_anulacion: motivo
        })
        .eq('id', consultaId);

      if (error) throw error;

      let consultasPosteriores: any[] = [];

      if (numeroEliminado !== null && numeroEliminado !== undefined) {
        const { data, error: errorConsultar } = await supabase
          .from('consultas')
          .select('id, numero_paciente')
          .eq('fecha', fecha)
          .or('anulado.is.null,anulado.eq.false')
          .gt('numero_paciente', numeroEliminado)
          .order('numero_paciente', { ascending: true });

        if (errorConsultar) throw errorConsultar;
        consultasPosteriores = data || [];

        for (const consulta of consultasPosteriores) {
          const { error: errorActualizar } = await supabase
            .from('consultas')
            .update({ numero_paciente: consulta.numero_paciente - 1 })
            .eq('id', consulta.id);
          if (errorActualizar) throw errorActualizar;
        }
      }

      const usuario = localStorage.getItem('usernameConrad') || '';
      const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || '';
      const rol = localStorage.getItem('rolUsuarioConrad') || '';

      await supabase.rpc('registrar_actividad', {
        p_usuario: usuario,
        p_nombre_usuario: nombreUsuario,
        p_rol: rol,
        p_modulo: 'sanatorio',
        p_accion: 'anular',
        p_tipo_registro: 'consulta',
        p_registro_id: consultaId,
        p_detalles: {
          paciente: nombrePaciente,
          motivo: motivo,
          numero_paciente: numeroEliminado
        },
        p_requirio_autorizacion: true
      });

      const mensajeExito = numeroEliminado
        ? `✅ CONSULTA ANULADA\n\nUsuario: ${usuarioActual}\nMotivo: ${motivo}\n\n${consultasPosteriores.length} pacientes renumerados.`
        : `✅ SERVICIO MÓVIL ANULADO\n\nUsuario: ${usuarioActual}\nMotivo: ${motivo}`;

      alert(mensajeExito);
      cargarConsultas();
      setMostrarAutorizacion(false);
      setAccionPendiente(null);
    } catch (error) {
      console.error('Error al eliminar consulta:', error);
      alert('Error al eliminar consulta');
    }
  };

  // ─── ELIMINAR ESTUDIO ─────────────────────────────────────────────────────
  const solicitarEliminarEstudio = (consultaId: string, detalleId: string, precioEstudio: number, nombreEstudio: string, nombrePaciente: string) => {
    setAccionPendiente({
      tipo: 'eliminar_estudio',
      datos: { consultaId, detalleId, precioEstudio, nombreEstudio, nombrePaciente }
    });
    setMostrarAutorizacion(true);
  };

  const eliminarEstudio = async () => {
    if (!accionPendiente || accionPendiente.tipo !== 'eliminar_estudio') return;

    const { consultaId, detalleId, precioEstudio } = accionPendiente.datos;

    try {
      const consulta = consultas.find(c => c.id === consultaId);
      if (!consulta) return;

      if (consulta.detalle_consultas.length === 1) {
        alert('❌ No puedes eliminar el único estudio de la consulta.\n\nSi deseas eliminar toda la consulta, usa el botón de eliminar consulta (🗑️) en la parte superior.');
        setMostrarAutorizacion(false);
        setAccionPendiente(null);
        return;
      }

      const { error: errorDetalle } = await supabase
        .from('detalle_consultas')
        .delete()
        .eq('id', detalleId);

      if (errorDetalle) throw errorDetalle;

      const usuario = localStorage.getItem('usernameConrad') || '';
      const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || '';
      const rol = localStorage.getItem('rolUsuarioConrad') || '';

      await supabase.rpc('registrar_actividad', {
        p_usuario: usuario,
        p_nombre_usuario: nombreUsuario,
        p_rol: rol,
        p_modulo: 'sanatorio',
        p_accion: 'eliminar',
        p_tipo_registro: 'estudio',
        p_registro_id: detalleId,
        p_detalles: {
          paciente: accionPendiente.datos.nombrePaciente,
          estudio: accionPendiente.datos.nombreEstudio,
          precio: precioEstudio
        },
        p_requirio_autorizacion: true
      });

      alert(`✅ Estudio eliminado.\n\nSe ha descontado Q ${precioEstudio.toFixed(2)} del total.`);
      cargarConsultas();
      setMostrarAutorizacion(false);
      setAccionPendiente(null);
    } catch (error) {
      console.error('Error al eliminar estudio:', error);
      alert('❌ Error al eliminar estudio');
    }
  };

  // ─── EDITAR PACIENTE ──────────────────────────────────────────────────────
  const solicitarEditarPaciente = (consulta: any) => {
    setAccionPendiente({
      tipo: 'editar_paciente',
      datos: { consulta }
    });
    setMostrarAutorizacion(true);
  };

  const abrirEditarPaciente = () => {
    if (!accionPendiente || accionPendiente.tipo !== 'editar_paciente') return;
    const { consulta } = accionPendiente.datos;
    setPacienteEditando(consulta.pacientes);
    setConsultaSeleccionada(consulta);
    setShowEditModal(true);
    setMostrarAutorizacion(false);
    setAccionPendiente(null);
  };

  // ─── ✅ EDITAR PRECIO DE ESTUDIO ──────────────────────────────────────────
  const solicitarEditarPrecio = (
    consultaId: string,
    detalleId: string,
    precioActual: number,
    nombreEstudio: string,
    nombrePaciente: string
  ) => {
    setAccionPendiente({
      tipo: 'editar_precio',
      datos: { consultaId, detalleId, precioActual, nombreEstudio, nombrePaciente }
    });
    setMostrarAutorizacion(true);
  };

  // Se llama después de que el AutorizacionModal aprueba el token
  const abrirModalEditarPrecio = () => {
    if (!accionPendiente || accionPendiente.tipo !== 'editar_precio') return;
    setNuevoPrecio(accionPendiente.datos.precioActual.toFixed(2));
    setJustificacionPrecio('');
    setMostrarAutorizacion(false);
    setShowEditPrecioModal(true);
  };

  const guardarNuevoPrecio = async () => {
    if (!accionPendiente || accionPendiente.tipo !== 'editar_precio') return;

    const precio = parseFloat(nuevoPrecio);
    if (isNaN(precio) || precio < 0) {
      alert('❌ Ingresa un precio válido (número mayor o igual a 0).');
      return;
    }

    if (!justificacionPrecio.trim()) {
      alert('❌ La justificación es obligatoria para la auditoría.');
      return;
    }

    const { detalleId, precioActual, nombreEstudio, nombrePaciente } = accionPendiente.datos;
    const usuarioActual = localStorage.getItem('nombreUsuarioConrad') || 'Desconocido';

    try {
      const { error } = await supabase
        .from('detalle_consultas')
        .update({ precio })
        .eq('id', detalleId);

      if (error) throw error;

      const usuario = localStorage.getItem('usernameConrad') || '';
      const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || '';
      const rol = localStorage.getItem('rolUsuarioConrad') || '';

      await supabase.rpc('registrar_actividad', {
        p_usuario: usuario,
        p_nombre_usuario: nombreUsuario,
        p_rol: rol,
        p_modulo: 'sanatorio',
        p_accion: 'editar_precio',
        p_tipo_registro: 'detalle_consulta',
        p_registro_id: detalleId,
        p_detalles: {
          paciente: nombrePaciente,
          estudio: nombreEstudio,
          precio_anterior: precioActual,
          precio_nuevo: precio,
          justificacion: justificacionPrecio.trim(),
          usuario: usuarioActual
        },
        p_requirio_autorizacion: true
      });

      alert(
        `✅ Precio actualizado\n\nEstudio: ${nombreEstudio}\nPrecio anterior: Q ${precioActual.toFixed(2)}\nPrecio nuevo: Q ${precio.toFixed(2)}\n\nUsuario: ${usuarioActual}\nJustificación: ${justificacionPrecio.trim()}`
      );

      setShowEditPrecioModal(false);
      setNuevoPrecio('');
      setJustificacionPrecio('');
      setAccionPendiente(null);
      cargarConsultas();
    } catch (error) {
      console.error('Error al actualizar precio:', error);
      alert('❌ Error al actualizar el precio');
    }
  };

  // ─── EJECUTAR ACCIÓN AUTORIZADA ───────────────────────────────────────────
  const ejecutarAccionAutorizada = () => {
    if (!accionPendiente) return;
    switch (accionPendiente.tipo) {
      case 'eliminar_consulta':
        eliminarConsulta();
        break;
      case 'editar_paciente':
        abrirEditarPaciente();
        break;
      case 'eliminar_estudio':
        eliminarEstudio();
        break;
      case 'editar_precio':
        abrirModalEditarPrecio();
        break;
    }
  };

  const getDescripcionAccion = () => {
    if (!accionPendiente) return '';
    switch (accionPendiente.tipo) {
      case 'eliminar_consulta':
        return `${accionPendiente.datos.nombrePaciente}${accionPendiente.datos.numeroEliminado ? ` - #${accionPendiente.datos.numeroEliminado}` : ' - Servicio Móvil'}`;
      case 'editar_paciente':
        return `${accionPendiente.datos.consulta.pacientes.nombre} - ${accionPendiente.datos.consulta.pacientes.edad} años`;
      case 'eliminar_estudio':
        return `${accionPendiente.datos.nombreEstudio} - Paciente: ${accionPendiente.datos.nombrePaciente}`;
      case 'editar_precio':
        return `${accionPendiente.datos.nombreEstudio} — Precio actual: Q ${accionPendiente.datos.precioActual.toFixed(2)}\nPaciente: ${accionPendiente.datos.nombrePaciente}`;
      default:
        return '';
    }
  };

  const getNombreAccion = () => {
    if (!accionPendiente) return '';
    switch (accionPendiente.tipo) {
      case 'eliminar_consulta':  return 'Anular Consulta';
      case 'editar_paciente':    return 'Editar Paciente';
      case 'eliminar_estudio':   return 'Eliminar Estudio';
      case 'editar_precio':      return 'Editar Precio de Estudio';
      default:                   return '';
    }
  };

  // ─── RESTO DE FUNCIONES (sin cambios) ─────────────────────────────────────
  const abrirAgregarEstudio = (consulta: any) => {
    setConsultaSeleccionada(consulta);
    setShowAgregarEstudioModal(true);
  };

  const handleGuardarPaciente = async (pacienteData: any, medicoId: string | null, medicoNombre: string | null) => {
    try {
      const { error: errorPaciente } = await supabase
        .from('pacientes')
        .update({
          nombre: pacienteData.nombre,
          edad: pacienteData.edad,
          telefono: pacienteData.telefono,
          departamento: pacienteData.departamento,
          municipio: pacienteData.municipio
        })
        .eq('id', pacienteEditando.id);
      if (errorPaciente) throw errorPaciente;

      const { error: errorConsulta } = await supabase
        .from('consultas')
        .update({
          medico_id: medicoId,
          medico_recomendado: medicoNombre,
          sin_informacion_medico: !(medicoId || medicoNombre)
        })
        .eq('id', consultaSeleccionada.id);
      if (errorConsulta) throw errorConsulta;

      const usuario = localStorage.getItem('usernameConrad') || '';
      const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || '';
      const rol = localStorage.getItem('rolUsuarioConrad') || '';

      await supabase.rpc('registrar_actividad', {
        p_usuario: usuario,
        p_nombre_usuario: nombreUsuario,
        p_rol: rol,
        p_modulo: 'sanatorio',
        p_accion: 'editar',
        p_tipo_registro: 'paciente',
        p_registro_id: pacienteEditando.id,
        p_detalles: {
          nombre: pacienteData.nombre,
          edad: pacienteData.edad,
          medico: medicoNombre || 'Sin médico'
        },
        p_requirio_autorizacion: true
      });

      alert('Paciente y médico actualizados exitosamente');
      setShowEditModal(false);
      setPacienteEditando(null);
      setConsultaSeleccionada(null);
      cargarConsultas();
    } catch (error) {
      console.error('Error al actualizar paciente:', error);
      alert('Error al actualizar paciente');
    }
  };

  const abrirEditarVoucher = (consulta: any) => {
    setConsultaSeleccionada(consulta);
    setVoucherEditando(consulta.numero_voucher || consulta.numero_factura || consulta.numero_transferencia || '');
    setNitEditando(consulta.nit || '');
    setShowEditVoucherModal(true);
  };

  const guardarVoucher = async () => {
    if (!voucherEditando.trim()) { alert('Ingrese el número'); return; }
    try {
      let updateData: any = {};
      if (consultaSeleccionada.forma_pago === 'tarjeta') {
        updateData.numero_voucher = voucherEditando;
      } else if (consultaSeleccionada.forma_pago === 'transferencia') {
        updateData.numero_transferencia = voucherEditando;
      } else if (consultaSeleccionada.forma_pago === 'efectivo_facturado') {
        updateData.numero_factura = voucherEditando;
        updateData.requiere_factura = true;
        updateData.nit = nitEditando.trim() || 'C/F';
      }
      const { error } = await supabase.from('consultas').update(updateData).eq('id', consultaSeleccionada.id);
      if (error) throw error;
      alert('Información actualizada exitosamente');
      setShowEditVoucherModal(false);
      setConsultaSeleccionada(null);
      setVoucherEditando('');
      setNitEditando('');
      cargarConsultas();
    } catch (error) {
      console.error('Error al actualizar:', error);
      alert('Error al actualizar información');
    }
  };

  const abrirEditarFormaPago = (consulta: any) => {
    setConsultaSeleccionada(consulta);
    setFormaPagoEditando(consulta.forma_pago);
    setRequiereFacturaEditando(consulta.requiere_factura || false);
    setShowEditFormaPagoModal(true);
  };

  const guardarFormaPago = async () => {
    if (!formaPagoEditando) { alert('Seleccione una forma de pago'); return; }
    try {
      const updateData: any = { forma_pago: formaPagoEditando, requiere_factura: requiereFacturaEditando };
      if (formaPagoEditando !== 'tarjeta') updateData.numero_voucher = null;
      if (formaPagoEditando !== 'transferencia') updateData.numero_transferencia = null;
      if (formaPagoEditando !== 'efectivo_facturado') {
        updateData.numero_factura = null;
        if (!requiereFacturaEditando) updateData.nit = null;
      }
      const { error } = await supabase.from('consultas').update(updateData).eq('id', consultaSeleccionada.id);
      if (error) throw error;
      alert('✅ Forma de pago actualizada exitosamente');
      setShowEditFormaPagoModal(false);
      setConsultaSeleccionada(null);
      setFormaPagoEditando('');
      setRequiereFacturaEditando(false);
      cargarConsultas();
    } catch (error) {
      console.error('Error al actualizar forma de pago:', error);
      alert('❌ Error al actualizar forma de pago');
    }
  };

  const reimprimirRecibo = (consulta: any) => {
    const tieneMedico = consulta.medicos || consulta.medico_recomendado;
    const esReferente = tieneMedico && !consulta.sin_informacion_medico;
    const estudiosRecibo = consulta.detalle_consultas.map((d: any) => ({
      nombre: d.sub_estudios.nombre,
      precio: d.precio,
      comentarios: d.comentarios || undefined
    }));
    const total = estudiosRecibo.reduce((sum: number, e: any) => sum + e.precio, 0);
    const nombreMedico = consulta.medicos?.nombre || consulta.medico_recomendado;
    const datosRecibo = {
      numeroPaciente: consulta.numero_paciente,
      paciente: {
        nombre: consulta.pacientes.nombre,
        edad: consulta.pacientes.edad,
        edad_valor: consulta.pacientes.edad_valor,
        edad_tipo: consulta.pacientes.edad_tipo,
        telefono: consulta.pacientes.telefono
      },
      medico: nombreMedico ? { nombre: nombreMedico } : undefined,
      esReferente,
      estudios: estudiosRecibo,
      total,
      formaPago: consulta.forma_pago,
      fecha: new Date(consulta.created_at),
      sinInfoMedico: consulta.sin_informacion_medico
    };
    setDatosReciboTemp(datosRecibo);
    setShowModalTipoRecibo(true);
  };

  const reimprimirSoloAdicionales = (consulta: any) => {
    const estudiosAdicionales = consulta.detalle_consultas.filter((d: any) => d.es_adicional);
    if (estudiosAdicionales.length === 0) { alert('Esta consulta no tiene estudios adicionales'); return; }
    const tieneMedico = consulta.medicos || consulta.medico_recomendado;
    const esReferente = tieneMedico && !consulta.sin_informacion_medico;
    const estudiosRecibo = estudiosAdicionales.map((d: any) => ({ nombre: d.sub_estudios.nombre, precio: d.precio }));
    const total = estudiosRecibo.reduce((sum: number, e: any) => sum + e.precio, 0);
    const nombreMedico = consulta.medicos?.nombre || consulta.medico_recomendado;
    const datosRecibo = {
      numeroPaciente: consulta.numero_paciente,
      paciente: {
        nombre: consulta.pacientes.nombre,
        edad: consulta.pacientes.edad,
        edad_valor: consulta.pacientes.edad_valor,
        edad_tipo: consulta.pacientes.edad_tipo,
        telefono: consulta.pacientes.telefono
      },
      medico: nombreMedico ? { nombre: nombreMedico } : undefined,
      esReferente,
      estudios: estudiosRecibo,
      total,
      formaPago: consulta.forma_pago,
      fecha: new Date(),
      sinInfoMedico: consulta.sin_informacion_medico
    };
    setDatosReciboTemp(datosRecibo);
    setShowModalTipoRecibo(true);
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
  };

  const getTipoCobro = (tipo: string) => {
    const tipos: any = { normal: 'Normal', social: 'Social', especial: 'Especial' };
    return tipos[tipo] || tipo;
  };

  const getFormaPago = (forma: string) => {
    const formas: any = {
      efectivo: 'Efectivo',
      tarjeta: 'Tarjeta',
      transferencia: 'Transferencia',
      efectivo_facturado: 'Depósito',
      estado_cuenta: 'Estado de Cuenta'
    };
    return formas[forma] || forma;
  };

  const renumerarTodosPacientes = async () => {
    if (!confirm('¿Desea renumerar todos los pacientes del día en orden de llegada?\n\nEsto organizará los números: 1, 2, 3, 4...')) return;
    try {
      setLoading(true);
      const { data: consultasOrdenadas, error: errorConsultar } = await supabase
        .from('consultas')
        .select('id, created_at')
        .eq('fecha', fecha)
        .or('anulado.is.null,anulado.eq.false')
        .order('created_at', { ascending: true });
      if (errorConsultar) throw errorConsultar;
      if (!consultasOrdenadas || consultasOrdenadas.length === 0) {
        alert('No hay consultas para renumerar');
        setLoading(false);
        return;
      }
      for (let i = 0; i < consultasOrdenadas.length; i++) {
        const { error: errorActualizar } = await supabase
          .from('consultas')
          .update({ numero_paciente: i + 1 })
          .eq('id', consultasOrdenadas[i].id);
        if (errorActualizar) throw errorActualizar;
      }
      alert(`${consultasOrdenadas.length} pacientes renumerados correctamente`);
      await cargarConsultas();
    } catch (error) {
      console.error('Error al renumerar pacientes:', error);
      alert('Error al renumerar pacientes');
    } finally {
      setLoading(false);
    }
  };

  // ─── RENDER CONSULTA ──────────────────────────────────────────────────────
  const renderConsulta = (consulta: any, index: number) => {
    const total = consulta.detalle_consultas.reduce((sum: number, d: any) => sum + d.precio, 0);

    const tieneReferente = consulta.medicos?.es_referente === true;
    const medicoLabel = consulta.sin_informacion_medico
      ? 'Sin información'
      : (consulta.medicos?.nombre || consulta.medico_recomendado || 'N/A');
    const esSinOrden = consulta.sin_orden_medica === true;

    return (
      <div key={consulta.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${consulta.anulado ? 'border-red-300' : 'border-gray-200'}`}>

        {/* ── Banner anulado ── */}
        {consulta.anulado && (
          <div className="bg-red-600 text-white px-5 py-2.5 flex items-center justify-between">
            <span className="font-black text-sm tracking-wide">🚫 CONSULTA ANULADA</span>
            <button
              onClick={() => alert(`Usuario: ${consulta.usuario_anulo}\nFecha: ${format(new Date(consulta.fecha_anulacion), 'dd/MM/yyyy HH:mm')}\nMotivo: ${consulta.motivo_anulacion}`)
              }
              className="text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 px-3 py-1 rounded-lg transition-colors font-semibold"
            >
              Ver detalles
            </button>
          </div>
        )}

        {/* ── Header de tarjeta ── */}
        <div className={`px-5 py-4 flex items-start justify-between gap-3 border-b ${
          consulta.anulado ? 'bg-red-50 border-red-100' :
          consulta.es_servicio_movil ? 'bg-purple-50 border-purple-100' :
          'bg-gradient-to-r from-blue-50 to-slate-50 border-gray-100'
        }`}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-black ${
                consulta.anulado ? 'text-red-600 line-through' :
                consulta.es_servicio_movil ? 'text-purple-700' : 'text-blue-700'
              }`}>
                {consulta.anulado ? '#ANULADO' : consulta.es_servicio_movil ? '📱 MÓVIL' : `#${consulta.numero_paciente || (index + 1)}`}
              </span>
              <span className="font-bold text-gray-900 text-sm">{consulta.pacientes.nombre}</span>
              {consulta.es_servicio_movil && (
                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full border border-purple-200">Sin número</span>
              )}
              {esSinOrden && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-200">Sin orden médica</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
              <span>{consulta.pacientes.edad} años</span>
              <span>·</span>
              <span>{consulta.pacientes.telefono}</span>
              <span>·</span>
              <span>{format(new Date(consulta.created_at), 'HH:mm')}</span>
            </div>
          </div>

          {/* Botones acción */}
          {!consulta.anulado && (
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => abrirAgregarEstudio(consulta)} className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition-colors" title="Agregar estudios">
                <Plus size={16} />
              </button>
              {consulta.detalle_consultas.some((d: any) => d.es_adicional) && (
                <button onClick={() => reimprimirSoloAdicionales(consulta)} className="p-2 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-xl transition-colors" title="Imprimir adicionales">
                  <FileText size={16} />
                </button>
              )}
              <button onClick={() => reimprimirRecibo(consulta)} className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors" title="Reimprimir recibo">
                <Printer size={16} />
              </button>
              <button onClick={() => solicitarEditarPaciente(consulta)} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors" title="Editar paciente">
                <Edit2 size={16} />
              </button>
              <button onClick={() => solicitarEliminarConsulta(consulta.id, consulta.numero_paciente, consulta.pacientes.nombre)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="Anular consulta">
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-4 grid md:grid-cols-2 gap-5">

          {/* Médico + tipo cobro */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Información Médica</p>
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 w-20 shrink-0 pt-0.5">Médico:</span>
              <span className={`text-sm font-semibold ${tieneReferente && !esSinOrden ? 'text-emerald-600' : esSinOrden && tieneReferente ? 'text-amber-600' : 'text-gray-700'}`}>
                {medicoLabel}
                {tieneReferente && !esSinOrden && <span className="ml-1.5 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">Referente</span>}
                {esSinOrden && <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">Sin orden</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20 shrink-0">Tipo cobro:</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                consulta.tipo_cobro === 'normal'      ? 'bg-blue-100 text-blue-700' :
                consulta.tipo_cobro === 'social'      ? 'bg-emerald-100 text-emerald-700' :
                consulta.tipo_cobro === 'especial'    ? 'bg-purple-100 text-purple-700' :
                'bg-orange-100 text-orange-700'
              }`}>
                {getTipoCobro(consulta.tipo_cobro)}
              </span>
            </div>
            {consulta.justificacion_especial && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-1">
                <strong>Justificación:</strong> {consulta.justificacion_especial}
              </div>
            )}
          </div>

          {/* Estudios */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Estudios Realizados</p>
            <ul className="space-y-1.5">
              {consulta.detalle_consultas.map((detalle: any) => (
                <li key={detalle.id} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-800 flex-1">• {detalle.sub_estudios.nombre}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-bold text-sm text-gray-900">Q {detalle.precio.toFixed(2)}</span>
                      {!consulta.anulado && (
                        <button
                          onClick={() => solicitarEditarPrecio(consulta.id, detalle.id, detalle.precio, detalle.sub_estudios.nombre, consulta.pacientes.nombre)}
                          className="p-1 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Editar precio">
                          <Edit2 size={12} />
                        </button>
                      )}
                      {!consulta.anulado && (
                        <button
                          onClick={() => solicitarEliminarEstudio(consulta.id, detalle.id, detalle.precio, detalle.sub_estudios.nombre, consulta.pacientes.nombre)}
                          className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar estudio">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  {detalle.comentarios?.trim() && (
                    <p className="text-xs text-blue-600 mt-1 pl-3 border-l-2 border-blue-200">📝 {detalle.comentarios}</p>
                  )}
                  {detalle.numero_factura && (
                    <p className="text-xs text-gray-500 mt-1 pl-3"><span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-medium">Factura: {detalle.numero_factura}{detalle.nit ? ` | NIT: ${detalle.nit}` : ''}</span></p>
                  )}
                  {detalle.numero_voucher && (
                    <p className="text-xs mt-1 pl-3"><span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-medium">Voucher: {detalle.numero_voucher}</span></p>
                  )}
                  {detalle.numero_transferencia && (
                    <p className="text-xs mt-1 pl-3"><span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md font-medium">Transferencia: {detalle.numero_transferencia}</span></p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Footer: forma de pago + total ── */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-gray-500 font-medium">Forma de pago:</span>
            <span className="font-bold text-gray-800">{getFormaPago(consulta.forma_pago)}</span>
            {!consulta.anulado && (
              <button onClick={() => abrirEditarFormaPago(consulta)} className="p-1 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors" title="Editar forma de pago">
                <Edit2 size={13} />
              </button>
            )}
            {consulta.requiere_factura && (
              <span className="text-gray-400">| NIT: <strong>{consulta.nit || 'C/F'}</strong></span>
            )}

            {/* Alertas voucher pendiente */}
            {!consulta.anulado && consulta.forma_pago === 'tarjeta' && !consulta.numero_voucher && (
              <button onClick={() => abrirEditarVoucher(consulta)} className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-bold hover:bg-amber-200 transition-colors">
                ⚠️ Agregar Voucher
              </button>
            )}
            {!consulta.anulado && consulta.forma_pago === 'transferencia' && !consulta.numero_transferencia && (
              <button onClick={() => abrirEditarVoucher(consulta)} className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-bold hover:bg-amber-200 transition-colors">
                ⚠️ Agregar No. Transferencia
              </button>
            )}
            {!consulta.anulado && consulta.forma_pago === 'efectivo_facturado' && !consulta.numero_factura && (
              <button onClick={() => abrirEditarVoucher(consulta)} className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-bold hover:bg-amber-200 transition-colors">
                ⚠️ Agregar No. Factura
              </button>
            )}

            {/* Números registrados */}
            {consulta.numero_voucher && (
              <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold">
                Voucher: {consulta.numero_voucher}
                <button onClick={() => abrirEditarVoucher(consulta)} className="ml-0.5 hover:text-emerald-900"><Edit2 size={11}/></button>
              </span>
            )}
            {consulta.numero_transferencia && (
              <span className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full font-semibold">
                Transf: {consulta.numero_transferencia}
                <button onClick={() => abrirEditarVoucher(consulta)} className="ml-0.5 hover:text-purple-900"><Edit2 size={11}/></button>
              </span>
            )}
            {consulta.numero_factura && (
              <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-semibold">
                Factura: {consulta.numero_factura}
                <button onClick={() => abrirEditarVoucher(consulta)} className="ml-0.5 hover:text-blue-900"><Edit2 size={11}/></button>
              </span>
            )}
          </div>

          <span className="text-2xl font-black text-blue-700 shrink-0">Q {total.toFixed(2)}</span>
        </div>
      </div>
    );
  };

  // ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>

      {/* ── HEADER ── */}
      <header className="text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1d4ed8 100%)' }}>
        <div className="container mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={onBack} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-2 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-xl p-2 border border-white/20">
              <Calendar size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Gestión de Pacientes</h1>
              <p className="text-blue-200 text-xs">Consultas y seguimiento del día</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 max-w-5xl">

        {/* ── BARRA FILTROS ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 mb-5">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Fecha</label>
              <input type="date"
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Buscar paciente</label>
              <input type="text"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                placeholder="Nombre del paciente..."
                value={filtroBusqueda} onChange={(e) => setFiltroBusqueda(e.target.value)} />
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={renumerarTodosPacientes}
                disabled={loading || consultas.length === 0}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                🔢 Renumerar
              </button>
              <button onClick={cargarConsultas}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-blue-200 transition-all">
                Actualizar
              </button>
            </div>
          </div>
        </div>

        {/* ── PESTAÑAS ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-5 flex overflow-hidden">
          {[
            { key: 'regulares', label: 'Regulares',  emoji: '👥', count: consultas.filter(c => !c.es_servicio_movil).length,  active: 'bg-blue-600 text-white',   inactive: 'text-gray-500 hover:bg-blue-50 hover:text-blue-600' },
            { key: 'moviles',   label: 'Móviles',    emoji: '📱', count: consultas.filter(c => c.es_servicio_movil).length,   active: 'bg-purple-600 text-white', inactive: 'text-gray-500 hover:bg-purple-50 hover:text-purple-600' },
            { key: 'todos',     label: 'Todos',      emoji: '📋', count: consultas.length,                                    active: 'bg-slate-700 text-white',  inactive: 'text-gray-500 hover:bg-gray-50 hover:text-gray-700' },
            { key: 'anuladas',  label: 'Anuladas',   emoji: '🚫', count: consultasAnuladas.length,                            active: 'bg-red-600 text-white',    inactive: 'text-gray-500 hover:bg-red-50 hover:text-red-600' },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setPestanaActiva(tab.key as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all ${pestanaActiva === tab.key ? tab.active : tab.inactive}`}>
              <span>{tab.emoji}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${pestanaActiva === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── CONTENIDO ── */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600 mb-4" />
            <p className="text-gray-400 text-sm">Cargando...</p>
          </div>
        ) : (
          <>
            {pestanaActiva !== 'anuladas' && (
              <>
                {consultas.filter(c => {
                  if (pestanaActiva === 'regulares' && c.es_servicio_movil === true) return false;
                  if (pestanaActiva === 'moviles' && c.es_servicio_movil !== true) return false;
                  return c.pacientes.nombre.toLowerCase().includes(filtroBusqueda.toLowerCase());
                }).length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200 text-center py-16">
                    <p className="text-gray-400 font-medium">No hay consultas para esta fecha</p>
                    <p className="text-gray-300 text-sm mt-1">Selecciona otra fecha o registra una nueva consulta</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {consultas.filter(c => {
                      if (pestanaActiva === 'regulares' && c.es_servicio_movil === true) return false;
                      if (pestanaActiva === 'moviles' && c.es_servicio_movil !== true) return false;
                      return c.pacientes.nombre.toLowerCase().includes(filtroBusqueda.toLowerCase());
                    }).map((consulta, index) => renderConsulta(consulta, index))}
                  </div>
                )}
              </>
            )}

            {pestanaActiva === 'anuladas' && (
              <>
                {consultasAnuladas.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200 text-center py-16">
                    <div className="text-4xl mb-3">✅</div>
                    <p className="font-bold text-emerald-700">No hay consultas anuladas</p>
                    <p className="text-gray-400 text-sm mt-1">¡Excelente! Todas las consultas del día están activas</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3.5 mb-4 flex items-center gap-3">
                      <AlertCircle className="text-red-500" size={18} />
                      <div>
                        <p className="font-bold text-red-700 text-sm">Consultas Anuladas</p>
                        <p className="text-xs text-red-500">{consultasAnuladas.length} consulta{consultasAnuladas.length !== 1 ? 's' : ''} anulada{consultasAnuladas.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {consultasAnuladas.filter(c => c.pacientes.nombre.toLowerCase().includes(filtroBusqueda.toLowerCase()))
                        .map((consulta, index) => renderConsulta(consulta, index))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── MODALES ── */}
      {showEditModal && pacienteEditando && consultaSeleccionada && (
        <EditarPacienteModal
          paciente={pacienteEditando}
          consulta={consultaSeleccionada}
          onClose={() => { setShowEditModal(false); setPacienteEditando(null); setConsultaSeleccionada(null); }}
          onSave={handleGuardarPaciente}
        />
      )}

      {showAgregarEstudioModal && consultaSeleccionada && (
        <AgregarEstudioModal
          consulta={consultaSeleccionada}
          onClose={() => { setShowAgregarEstudioModal(false); setConsultaSeleccionada(null); }}
          onSave={cargarConsultas}
        />
      )}

      {showEditVoucherModal && consultaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-xl p-2"><Edit2 size={16} className="text-blue-600" /></div>
                <h2 className="text-base font-black text-gray-900">
                  {consultaSeleccionada.forma_pago === 'tarjeta' && (consultaSeleccionada.numero_voucher ? 'Editar Voucher' : 'Agregar Voucher')}
                  {consultaSeleccionada.forma_pago === 'transferencia' && (consultaSeleccionada.numero_transferencia ? 'Editar Transferencia' : 'Agregar Transferencia')}
                  {consultaSeleccionada.forma_pago === 'efectivo_facturado' && (consultaSeleccionada.numero_factura ? 'Editar Factura' : 'Agregar Factura')}
                </h2>
              </div>
              <button onClick={() => { setShowEditVoucherModal(false); setConsultaSeleccionada(null); setVoucherEditando(''); setNitEditando(''); }}
                className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  {consultaSeleccionada.forma_pago === 'tarjeta' ? 'Número de Voucher *' :
                   consultaSeleccionada.forma_pago === 'transferencia' ? 'Número de Transferencia *' : 'Número de Factura *'}
                </label>
                <input type="text"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  placeholder={consultaSeleccionada.forma_pago === 'efectivo_facturado' ? 'Ej: 1234567' : 'Ej: 1234567890'}
                  value={voucherEditando} onChange={(e) => setVoucherEditando(e.target.value)} autoFocus />
              </div>
              {consultaSeleccionada.forma_pago === 'efectivo_facturado' && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">NIT (vacío = C/F)</label>
                  <input type="text"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    placeholder="Ej: 12345678 o dejar vacío"
                    value={nitEditando} onChange={(e) => setNitEditando(e.target.value)} />
                  <p className="text-xs text-gray-400 mt-1">Si se deja vacío, se guardará como "C/F"</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowEditVoucherModal(false); setConsultaSeleccionada(null); setVoucherEditando(''); setNitEditando(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-semibold transition-colors">Cancelar</button>
              <button onClick={guardarVoucher}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-blue-200">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {showEditFormaPagoModal && consultaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-xl p-2"><Edit2 size={16} className="text-blue-600" /></div>
                <h2 className="text-base font-black text-gray-900">Editar Forma de Pago</h2>
              </div>
              <button onClick={() => { setShowEditFormaPagoModal(false); setConsultaSeleccionada(null); setFormaPagoEditando(''); setRequiereFacturaEditando(false); }}
                className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">¿Requiere Factura?</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="radio" checked={requiereFacturaEditando} onChange={() => setRequiereFacturaEditando(true)} className="accent-blue-600" /> Sí
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="radio" checked={!requiereFacturaEditando} onChange={() => setRequiereFacturaEditando(false)} className="accent-blue-600" /> No
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Forma de Pago *</label>
                <select className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  value={formaPagoEditando} onChange={(e) => setFormaPagoEditando(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {requiereFacturaEditando ? (
                    <>
                      <option value="efectivo_facturado">Efectivo Facturado (Depósito)</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="transferencia">Transferencia</option>
                    </>
                  ) : (
                    <>
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="estado_cuenta">Estado de Cuenta</option>
                    </>
                  )}
                </select>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                <strong>Nota:</strong> Al cambiar la forma de pago, se eliminarán los números de voucher/factura/transferencia anteriores si no aplican.
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowEditFormaPagoModal(false); setConsultaSeleccionada(null); setFormaPagoEditando(''); setRequiereFacturaEditando(false); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-semibold transition-colors">Cancelar</button>
              <button onClick={guardarFormaPago}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-blue-200">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {showModalTipoRecibo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h2 className="text-base font-black text-gray-900 text-center mb-1">¿Qué recibo desea imprimir?</h2>
            <p className="text-xs text-gray-400 text-center mb-5">Seleccione el tipo de recibo</p>
            <div className="space-y-3">
              <button onClick={() => imprimirReciboSeleccionado('completo')}
                className="w-full py-3.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-between transition-all shadow-sm shadow-blue-200">
                <span>📄 Recibo Completo</span><span className="text-xs opacity-80">con precios</span>
              </button>
              <button onClick={() => imprimirReciboSeleccionado('medico')}
                className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-between transition-all shadow-sm shadow-emerald-200">
                <span>🩺 Orden para Médico</span><span className="text-xs opacity-80">sin precios</span>
              </button>
              <button onClick={() => { setShowModalTipoRecibo(false); setDatosReciboTemp(null); }}
                className="w-full py-3 px-5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-semibold text-sm transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showEditPrecioModal && accionPendiente?.tipo === 'editar_precio' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 rounded-xl p-2"><Edit2 size={16} className="text-amber-600" /></div>
                <h2 className="text-base font-black text-gray-900">Editar Precio</h2>
              </div>
              <button onClick={() => { setShowEditPrecioModal(false); setNuevoPrecio(''); setJustificacionPrecio(''); setAccionPendiente(null); }}
                className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm">
              <p className="font-bold text-amber-800">{accionPendiente.datos.nombreEstudio}</p>
              <p className="text-amber-600 text-xs mt-0.5">Paciente: {accionPendiente.datos.nombrePaciente}</p>
              <p className="text-amber-700 text-xs mt-0.5">Precio actual: <strong>Q {accionPendiente.datos.precioActual.toFixed(2)}</strong></p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Nuevo Precio (Q) *</label>
                <input type="number" min="0" step="0.01"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-lg font-bold focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  placeholder="0.00" value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Justificación <span className="text-red-400">*</span>
                  <span className="ml-1 normal-case font-normal text-gray-300">(obligatorio para auditoría)</span>
                </label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 resize-none"
                  rows={3} placeholder="Ej: Error de cobro, precio de convenio, descuento autorizado..."
                  value={justificacionPrecio} onChange={(e) => setJustificacionPrecio(e.target.value)} maxLength={300} />
                <p className="text-xs text-gray-300 text-right mt-1">{justificacionPrecio.length}/300</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                <span>Este cambio quedará registrado en el log de auditoría con su nombre de usuario, fecha y justificación.</span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowEditPrecioModal(false); setNuevoPrecio(''); setJustificacionPrecio(''); setAccionPendiente(null); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-semibold transition-colors">Cancelar</button>
              <button onClick={guardarNuevoPrecio} disabled={!nuevoPrecio || !justificacionPrecio.trim()}
                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Guardar Precio
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarAutorizacion && accionPendiente && (
        <AutorizacionModal
          accion={getNombreAccion()}
          detalles={getDescripcionAccion()}
          onAutorizado={ejecutarAccionAutorizada}
          onCancelar={() => { setMostrarAutorizacion(false); setAccionPendiente(null); }}
        />
      )}
    </div>
  );
};