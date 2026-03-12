import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, DollarSign, CheckCircle2, Plus, Trash2, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Lock, FileText, Clock, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, subDays } from 'date-fns';
import { generarCuadreExcel } from '../utils/cuadre-excel-generator';
import { AutorizacionModal } from '../components/AutorizacionModal';

interface CuadrePorFormaPago {
  forma_pago: string;
  cantidad: number;
  total: number;
  es_servicio_movil?: boolean;
}

interface CuadreDiario {
  fecha: string;
  total_consultas: number;
  total_ventas: number;
  cuadres_forma_pago: CuadrePorFormaPago[];
}

interface CuadreDiarioPageProps {
  onBack: () => void;
}

export const CuadreDiarioPage: React.FC<CuadreDiarioPageProps> = ({ onBack }) => {
  const getFechaGuatemala = () => {
    const ahora = new Date();
    const guatemalaTime = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
    return format(guatemalaTime, 'yyyy-MM-dd');
  };

  // ✅ CORREGIDO: La caja se cierra a la 1:00 AM (no a medianoche)
  // Entre las 00:00 y 00:59 todavía pertenece al día ANTERIOR, así que
  // la "fecha operativa" es ayer si la hora actual es < 1:00 AM.
  const getFechaOperativaGuatemala = () => {
    const ahora = new Date();
    const guatemalaTime = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
    const hora = guatemalaTime.getHours();

    // Si es antes de la 1:00 AM, operativamente seguimos en el día anterior
    if (hora < 1) {
      const ayer = new Date(guatemalaTime);
      ayer.setDate(ayer.getDate() - 1);
      return format(ayer, 'yyyy-MM-dd');
    }

    return format(guatemalaTime, 'yyyy-MM-dd');
  };

  const necesitaAutorizacionParaExcel = () => {
    const ahora = new Date();
    const guatemalaTime = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
    const fechaOperativa = getFechaOperativaGuatemala();

    // No necesita autorización si estamos viendo el día operativo actual
    return fecha !== fechaOperativa;
  };

  // ✅ CORREGIDO: Cierre a la 1:00 AM usando fecha operativa
  const debeEstarCerrada = () => {
    if (cuadreCerrado) return true;

    const fechaOperativa = getFechaOperativaGuatemala();

    // Si la fecha del cuadre es anterior al día operativo actual → bloqueada
    if (fecha < fechaOperativa) {
      return true;
    }

    return false;
  };

  const [fecha, setFecha] = useState(getFechaOperativaGuatemala()); // ✅ Usar fecha operativa al iniciar
  const [cuadre, setCuadre] = useState<CuadreDiario | null>(null);
  const [loading, setLoading] = useState(false);

  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarModalToken, setMostrarModalToken] = useState(false);
  const [mostrarModalTokenExcel, setMostrarModalTokenExcel] = useState(false);

  const [billetes, setBilletes] = useState({
    b200: '',
    b100: '',
    b50: '',
    b20: '',
    b10: '',
    b5: '',
    b1: ''
  });

  const [monedas, setMonedas] = useState({
    m1: '',
    m050: '',
    m025: '',
    m010: '',
    m005: '',
    m001: ''
  });

  const [tarjetaContado, setTarjetaContado] = useState('');
  const [transferenciaContado, setTransferenciaContado] = useState('');
  const [estadoCuentaContado, setEstadoCuentaContado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [mostrarCuadre, setMostrarCuadre] = useState(false);

  const [cuadreValidado, setCuadreValidado] = useState(false);
  const [mostrarEsperados, setMostrarEsperados] = useState(false);
  const [pinCierre, setPinCierre] = useState('');
  const [nombreCajero, setNombreCajero] = useState('');
  const [cuadreCerrado, setCuadreCerrado] = useState(false);

  const [gastos, setGastos] = useState<any[]>([]);
  const [showModalGasto, setShowModalGasto] = useState(false);
  const [conceptoGasto, setConceptoGasto] = useState('');
  const [montoGasto, setMontoGasto] = useState('');

  const [mostrarGastos, setMostrarGastos] = useState(true);
  const [mostrarAnuladas, setMostrarAnuladas] = useState(false);
  const [consultasAnuladas, setConsultasAnuladas] = useState<any[]>([]);
  const [listaConsultas, setListaConsultas] = useState<any[]>([]);
  const [mostrarListaPacientes, setMostrarListaPacientes] = useState(false);

  const cajaBloqueada = debeEstarCerrada() && !modoEdicion;

  const solicitarEdicion = () => {
    setMostrarModalToken(true);
  };

  const ejecutarEdicion = async () => {
    setModoEdicion(true);
    setMostrarModalToken(false);
    setCuadreValidado(false);
    setMostrarEsperados(false);
    alert('✅ Modo edición activado. Puede modificar y re-validar el cuadre.');
  };

  const solicitarDescargaExcel = () => {
    if (necesitaAutorizacionParaExcel()) {
      setMostrarModalTokenExcel(true);
    } else {
      descargarCuadre('csv');
    }
  };

  const ejecutarDescargaExcel = async () => {
    setMostrarModalTokenExcel(false);
    await descargarCuadre('csv');
  };

  useEffect(() => {
    cargarCuadre();
    resetearCuadre();
  }, [fecha]);

  const resetearCuadre = () => {
    setBilletes({ b200: '', b100: '', b50: '', b20: '', b10: '', b5: '', b1: '' });
    setMonedas({ m1: '', m050: '', m025: '', m010: '', m005: '', m001: '' });
    setTarjetaContado('');
    setTransferenciaContado('');
    setEstadoCuentaContado('');
    setObservaciones('');
    setCuadreValidado(false);
    setMostrarEsperados(false);
    setPinCierre('');
    setNombreCajero('');
    setCuadreCerrado(false);
    setModoEdicion(false);
  };

  const cargarCuadre = async () => {
    setLoading(true);
    try {
      const { data: consultas, error: errorConsultas } = await supabase
        .from('consultas')
        .select(`
          *,
          pacientes(nombre),
          medicos(nombre, es_referente)
        `)
        .eq('fecha', fecha);

      if (errorConsultas) throw errorConsultas;

      const consultasRegulares = consultas?.filter(c => c.anulado !== true) || [];
      const consultasIds = consultas?.map(c => c.id) || [];

      if (consultasIds.length === 0) {
        setCuadre({
          fecha,
          total_consultas: 0,
          total_ventas: 0,
          cuadres_forma_pago: []
        });
        setConsultasAnuladas([]);
        setLoading(false);
        return;
      }

      const { data: detallesData, error: errorDetalles } = await supabase
        .from('detalle_consultas')
        .select(`*, sub_estudios(nombre)`)
        .in('consulta_id', consultasIds);

      if (errorDetalles) throw errorDetalles;

      const cuadrePorForma: { [key: string]: CuadrePorFormaPago } = {};
      const consultasAnuladasData = consultas?.filter(c => c.anulado === true) || [];

      const consultasRegularesOnly = consultasRegulares.filter(c => !c.es_servicio_movil);
      const consultasMoviles = consultasRegulares.filter(c => c.es_servicio_movil === true);

      consultasRegularesOnly.forEach(consulta => {
        const detallesConsulta = detallesData?.filter(d => d.consulta_id === consulta.id) || [];
        const totalConsulta = detallesConsulta.reduce((sum, d) => sum + d.precio, 0);
        const formaPago = consulta.forma_pago;

        if (!cuadrePorForma[formaPago]) {
          cuadrePorForma[formaPago] = { forma_pago: formaPago, cantidad: 0, total: 0, es_servicio_movil: false };
        }
        cuadrePorForma[formaPago].cantidad += 1;
        cuadrePorForma[formaPago].total += totalConsulta;
      });

      consultasMoviles.forEach(consulta => {
        const detallesConsulta = detallesData?.filter(d => d.consulta_id === consulta.id) || [];
        const totalConsulta = detallesConsulta.reduce((sum, d) => sum + d.precio, 0);
        const formaPago = consulta.forma_pago;
        const keyMovil = `${formaPago}_movil`;

        if (!cuadrePorForma[keyMovil]) {
          cuadrePorForma[keyMovil] = { forma_pago: formaPago, cantidad: 0, total: 0, es_servicio_movil: true };
        }
        cuadrePorForma[keyMovil].cantidad += 1;
        cuadrePorForma[keyMovil].total += totalConsulta;
      });

      const totalVentas = Object.values(cuadrePorForma).reduce((sum, c) => sum + c.total, 0);

      setCuadre({
        fecha,
        total_consultas: consultasRegulares.length,
        total_ventas: totalVentas,
        cuadres_forma_pago: Object.values(cuadrePorForma)
      });

      setListaConsultas(consultasRegulares);
      setConsultasAnuladas(consultasAnuladasData.map(c => ({
        nombre: c.pacientes?.nombre,
        usuario_anulo: c.usuario_anulo,
        fecha_anulacion: c.fecha_anulacion,
        motivo_anulacion: c.motivo_anulacion,
        total: detallesData?.filter(d => d.consulta_id === c.id).reduce((sum, d) => sum + d.precio, 0) || 0
      })));

      cargarGastos();
      await cargarCuadreGuardado();

    } catch (error) {
      console.error('Error al cargar cuadre:', error);
      alert('Error al cargar el cuadre diario');
    }
    setLoading(false);
  };

  const cargarGastos = async () => {
    try {
      const { data, error } = await supabase
        .from('gastos')
        .select(`*, categorias_gastos(nombre)`)
        .eq('fecha', fecha)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGastos(data || []);
    } catch (error) {
      console.error('Error al cargar gastos:', error);
    }
  };

  const guardarCuadre = async () => {
    try {
      const cuadreData = {
        fecha,
        billetes_200: parseInt(billetes.b200) || 0,
        billetes_100: parseInt(billetes.b100) || 0,
        billetes_50: parseInt(billetes.b50) || 0,
        billetes_20: parseInt(billetes.b20) || 0,
        billetes_10: parseInt(billetes.b10) || 0,
        billetes_5: parseInt(billetes.b5) || 0,
        billetes_1: parseInt(billetes.b1) || 0,
        monedas_1: parseInt(monedas.m1) || 0,
        monedas_050: parseInt(monedas.m050) || 0,
        monedas_025: parseInt(monedas.m025) || 0,
        monedas_010: parseInt(monedas.m010) || 0,
        monedas_005: parseInt(monedas.m005) || 0,
        monedas_001: parseInt(monedas.m001) || 0,
        efectivo_contado: efectivoContadoNum,
        tarjeta_contado: parseFloat(tarjetaContado) || 0,
        transferencia_contado: parseFloat(transferenciaContado) || 0,
        estado_cuenta_contado: parseFloat(estadoCuentaContado) || 0,
        observaciones,
        validado: cuadreValidado,
        nombre_cajero: nombreCajero,
        pin_cierre: pinCierre,
        cerrado: cuadreCerrado,
        // ✅ Guardar también los valores esperados para poder recuperarlos desde ResumenDía
        efectivo_esperado: efectivoEsperado,
        tarjeta_esperada: tarjetaEsperada,
        transferencia_esperada: depositadoEsperado,
        estado_cuenta_esperada: estadoCuentaEsperada
      };

      const { error } = await supabase
        .from('cuadres_diarios')
        .upsert(cuadreData, { onConflict: 'fecha' });

      if (error) throw error;
      alert('✅ Cuadre guardado correctamente');
    } catch (error) {
      console.error('Error al guardar cuadre:', error);
      alert('❌ Error al guardar cuadre');
    }
  };

  const cargarCuadreGuardado = async () => {
    try {
      const { data, error } = await supabase
        .from('cuadres_diarios')
        .select('*')
        .eq('fecha', fecha)
        .maybeSingle();

      if (error) { console.error('Error al cargar cuadre guardado:', error); return; }

      if (data) {
        setBilletes({
          b200: data.billetes_200?.toString() || '',
          b100: data.billetes_100?.toString() || '',
          b50: data.billetes_50?.toString() || '',
          b20: data.billetes_20?.toString() || '',
          b10: data.billetes_10?.toString() || '',
          b5: data.billetes_5?.toString() || '',
          b1: data.billetes_1?.toString() || ''
        });
        setMonedas({
          m1: data.monedas_1?.toString() || '',
          m050: data.monedas_050?.toString() || '',
          m025: data.monedas_025?.toString() || '',
          m010: data.monedas_010?.toString() || '',
          m005: data.monedas_005?.toString() || '',
          m001: data.monedas_001?.toString() || ''
        });
        setTarjetaContado(data.tarjeta_contado?.toString() || '');
        setTransferenciaContado(data.transferencia_contado?.toString() || '');
        setEstadoCuentaContado(data.estado_cuenta_contado?.toString() || '');
        setObservaciones(data.observaciones || '');
        setCuadreValidado(data.validado || false);
        setNombreCajero(data.nombre_cajero || '');
        setPinCierre(data.pin_cierre || '');
        setCuadreCerrado(data.cerrado || false);
      }
    } catch (error) {
      console.error('Error al cargar cuadre guardado:', error);
    }
  };

  const agregarGasto = async () => {
    if (!conceptoGasto.trim() || !montoGasto) {
      alert('Complete todos los campos del gasto');
      return;
    }

    try {
      let { data: categoria, error: catError } = await supabase
        .from('categorias_gastos')
        .select('id')
        .eq('nombre', 'Gastos Operativos')
        .maybeSingle();

      if (catError || !categoria) {
        const { data: nuevaCategoria, error: nuevaCatError } = await supabase
          .from('categorias_gastos')
          .insert([{ nombre: 'Gastos Operativos', descripcion: 'Gastos diarios operacionales' }])
          .select()
          .single();

        if (nuevaCatError) throw nuevaCatError;
        categoria = nuevaCategoria;
      }

      const { error } = await supabase
        .from('gastos')
        .insert([{
          fecha,
          categoria_id: categoria.id,
          concepto: conceptoGasto,
          monto: parseFloat(montoGasto),
          forma_pago: 'efectivo'
        }]);

      if (error) throw error;

      setConceptoGasto('');
      setMontoGasto('');
      setShowModalGasto(false);
      cargarGastos();
      alert('✅ Gasto agregado exitosamente');
    } catch (error) {
      console.error('Error al agregar gasto:', error);
      alert('Error al agregar gasto');
    }
  };

  const eliminarGasto = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      const { error } = await supabase.from('gastos').delete().eq('id', id);
      if (error) throw error;
      cargarGastos();
      alert('Gasto eliminado');
    } catch (error) {
      console.error('Error al eliminar gasto:', error);
      alert('Error al eliminar gasto');
    }
  };

  const calcularTotalEfectivoContado = () => {
    const totalBilletes =
      (parseFloat(billetes.b200) || 0) * 200 +
      (parseFloat(billetes.b100) || 0) * 100 +
      (parseFloat(billetes.b50) || 0) * 50 +
      (parseFloat(billetes.b20) || 0) * 20 +
      (parseFloat(billetes.b10) || 0) * 10 +
      (parseFloat(billetes.b5) || 0) * 5 +
      (parseFloat(billetes.b1) || 0) * 1;

    const totalMonedas =
      (parseFloat(monedas.m1) || 0) * 1 +
      (parseFloat(monedas.m050) || 0) * 0.50 +
      (parseFloat(monedas.m025) || 0) * 0.25 +
      (parseFloat(monedas.m010) || 0) * 0.10 +
      (parseFloat(monedas.m005) || 0) * 0.05 +
      (parseFloat(monedas.m001) || 0) * 0.01;

    return totalBilletes + totalMonedas;
  };

  const validarCuadre = () => {
    const efectivoContadoNum = calcularTotalEfectivoContado();
    const tarjetaContadoNum = parseFloat(tarjetaContado) || 0;
    const transferenciaContadoNum = parseFloat(transferenciaContado) || 0;
    const estadoCuentaContadoNum = parseFloat(estadoCuentaContado) || 0;

    if (efectivoContadoNum === 0 && tarjetaContadoNum === 0 && transferenciaContadoNum === 0 && estadoCuentaContadoNum === 0) {
      alert('⚠️ Debe ingresar al menos un monto para validar el cuadre');
      return;
    }

    setMostrarEsperados(true);
    setCuadreValidado(true);

    const cuadra =
      Math.abs(efectivoContadoNum - efectivoEsperado) < 0.01 &&
      Math.abs(tarjetaContadoNum - tarjetaEsperada) < 0.01 &&
      Math.abs(transferenciaContadoNum - depositadoEsperado) < 0.01 &&
      (estadoCuentaEsperada < 0.01 || Math.abs(estadoCuentaContadoNum - estadoCuentaEsperada) < 0.01);

    if (!cuadra) {
      alert('⚠️ El cuadre NO coincide.');
    } else {
      alert('✅ ¡Cuadre correcto! Ahora puede confirmar el cierre.');
    }
  };

  const confirmarCierre = async () => {
    if (!nombreCajero.trim()) { alert('⚠️ Debe ingresar el nombre del cajero'); return; }
    if (!pinCierre.trim()) { alert('⚠️ Debe ingresar el PIN de autorización'); return; }

    try {
      // ✅ CORREGIDO: Guardar en Supabase con cerrado=true ANTES de descargar
      const cuadreData = {
        fecha,
        billetes_200: parseInt(billetes.b200) || 0,
        billetes_100: parseInt(billetes.b100) || 0,
        billetes_50: parseInt(billetes.b50) || 0,
        billetes_20: parseInt(billetes.b20) || 0,
        billetes_10: parseInt(billetes.b10) || 0,
        billetes_5: parseInt(billetes.b5) || 0,
        billetes_1: parseInt(billetes.b1) || 0,
        monedas_1: parseInt(monedas.m1) || 0,
        monedas_050: parseInt(monedas.m050) || 0,
        monedas_025: parseInt(monedas.m025) || 0,
        monedas_010: parseInt(monedas.m010) || 0,
        monedas_005: parseInt(monedas.m005) || 0,
        monedas_001: parseInt(monedas.m001) || 0,
        efectivo_contado: efectivoContadoNum,
        tarjeta_contado: parseFloat(tarjetaContado) || 0,
        transferencia_contado: parseFloat(transferenciaContado) || 0,
        estado_cuenta_contado: parseFloat(estadoCuentaContado) || 0,
        observaciones,
        validado: true,
        nombre_cajero: nombreCajero,
        pin_cierre: pinCierre,
        cerrado: true,
        // ✅ Guardar valores esperados para poder usarlos en ResumenDía
        efectivo_esperado: efectivoEsperado,
        tarjeta_esperada: tarjetaEsperada,
        transferencia_esperada: depositadoEsperado,
        estado_cuenta_esperada: estadoCuentaEsperada
      };

      const { error } = await supabase
        .from('cuadres_diarios')
        .upsert(cuadreData, { onConflict: 'fecha' });

      if (error) throw error;

      // ✅ Actualizar estado local después de guardar exitosamente
      setCuadreCerrado(true);
      setCuadreValidado(true);

      alert('✅ Cierre de caja confirmado y guardado exitosamente');
      await descargarCuadre('csv');
    } catch (error) {
      console.error('Error al confirmar cierre:', error);
      alert('❌ Error al confirmar el cierre de caja');
    }
  };

  const descargarCuadre = async (formato: 'csv' | 'pdf') => {
    const efectivoContadoNum = calcularTotalEfectivoContado();
    const tarjetaContadoNum = parseFloat(tarjetaContado) || 0;
    const depositadoContadoNum = parseFloat(transferenciaContado) || 0;
    const estadoCuentaContadoNum = parseFloat(estadoCuentaContado) || 0;

    const diferencias = {
      efectivo: calcularDiferencia(efectivoEsperado, efectivoContadoNum),
      tarjeta: calcularDiferencia(tarjetaEsperada, tarjetaContadoNum),
      depositado: calcularDiferencia(depositadoEsperado, depositadoContadoNum),
      estado_cuenta: calcularDiferencia(estadoCuentaEsperada, estadoCuentaContadoNum)
    };

    const cuadreCorrecto =
      Math.abs(diferencias.efectivo) < 0.01 &&
      Math.abs(diferencias.tarjeta) < 0.01 &&
      Math.abs(diferencias.depositado) < 0.01 &&
      (estadoCuentaEsperada < 0.01 || Math.abs(diferencias.estado_cuenta) < 0.01);

    const fechaFormateada = format(new Date(fecha + 'T12:00:00'), 'dd/MM/yyyy');
    const horaActual = format(new Date(), 'HH:mm');

    if (formato === 'csv') {
      await generarCuadreExcel({
        fecha: fechaFormateada,
        horaActual,
        totalConsultas: cuadre?.total_consultas || 0,
        totalVentas: cuadre?.total_ventas || 0,
        efectivoEsperado,
        efectivoContado: efectivoContadoNum,
        tarjetaEsperada,
        tarjetaContado: tarjetaContadoNum,
        transferenciaEsperada: depositadoEsperado,
        transferenciaContado: depositadoContadoNum,
        diferencias,
        cuadreCorrecto,
        observaciones,
        cajero: nombreCajero,
        cuadresPorFormaPago: cuadre?.cuadres_forma_pago.map(c => ({
          forma_pago: getFormaPagoNombre(c.forma_pago),
          cantidad: c.cantidad,
          total: c.total,
          es_servicio_movil: c.es_servicio_movil || false
        })) || []
      });
    }
  };

  const getFormaPagoNombre = (forma: string) => {
    const formas: any = {
      efectivo: 'Efectivo',
      tarjeta: 'Tarjeta',
      transferencia: 'Transferencia',
      efectivo_facturado: 'Depósito',
      estado_cuenta: 'Estado de Cuenta',
      multiple: 'Múltiple'
    };
    return formas[forma] || forma;
  };

  const calcularDiferencia = (esperado: number, contado: number) => contado - esperado;

  const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);

  const efectivoRegular = cuadre?.cuadres_forma_pago.find(c => c.forma_pago === 'efectivo' && !c.es_servicio_movil)?.total || 0;
  const efectivoMovil = cuadre?.cuadres_forma_pago.find(c => c.forma_pago === 'efectivo' && c.es_servicio_movil)?.total || 0;
  const efectivoEsperado = (efectivoRegular + efectivoMovil) - totalGastos;

  const tarjetaRegular = cuadre?.cuadres_forma_pago.find(c => c.forma_pago === 'tarjeta' && !c.es_servicio_movil)?.total || 0;
  const tarjetaMovil = cuadre?.cuadres_forma_pago.find(c => c.forma_pago === 'tarjeta' && c.es_servicio_movil)?.total || 0;
  const tarjetaEsperada = tarjetaRegular + tarjetaMovil;

  const depositoRegular = (cuadre?.cuadres_forma_pago.find(c => c.forma_pago === 'efectivo_facturado' && !c.es_servicio_movil)?.total || 0) +
                          (cuadre?.cuadres_forma_pago.find(c => c.forma_pago === 'transferencia' && !c.es_servicio_movil)?.total || 0);
  const depositoMovil = (cuadre?.cuadres_forma_pago.find(c => c.forma_pago === 'efectivo_facturado' && c.es_servicio_movil)?.total || 0) +
                        (cuadre?.cuadres_forma_pago.find(c => c.forma_pago === 'transferencia' && c.es_servicio_movil)?.total || 0);
  const depositadoEsperado = depositoRegular + depositoMovil;

  const estadoCtaRegular = cuadre?.cuadres_forma_pago.find(c => c.forma_pago === 'estado_cuenta' && !c.es_servicio_movil)?.total || 0;
  const estadoCtaMovil = cuadre?.cuadres_forma_pago.find(c => c.forma_pago === 'estado_cuenta' && c.es_servicio_movil)?.total || 0;
  const estadoCuentaEsperada = estadoCtaRegular + estadoCtaMovil;

  const efectivoContadoNum = calcularTotalEfectivoContado();
  const depositadoContadoNum = parseFloat(transferenciaContado) || 0;
  const tarjetaContadoNum = parseFloat(tarjetaContado) || 0;
  const estadoCuentaContadoNum = parseFloat(estadoCuentaContado) || 0;

  const diferenciaEfectivo = calcularDiferencia(efectivoEsperado, efectivoContadoNum);
  const diferenciaDepositado = calcularDiferencia(depositadoEsperado, depositadoContadoNum);
  const diferenciaTarjeta = calcularDiferencia(tarjetaEsperada, tarjetaContadoNum);
  const diferenciaEstadoCuenta = calcularDiferencia(estadoCuentaEsperada, estadoCuentaContadoNum);

  const cuadreCorrecto =
    Math.abs(diferenciaEfectivo) < 0.01 &&
    Math.abs(diferenciaDepositado) < 0.01 &&
    Math.abs(diferenciaTarjeta) < 0.01 &&
    (estadoCuentaEsperada < 0.01 || Math.abs(diferenciaEstadoCuenta) < 0.01);

  const inputBase = `w-full px-3 py-2 border border-gray-200 rounded-xl text-center font-bold text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
  const inputDisabled = `bg-gray-50 cursor-not-allowed text-gray-400`;
  const btnPrimary = `w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all shadow-sm`;

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>

      {/* ─── HEADER ─────────────────────────────────────── */}
      <header className="text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1d4ed8 100%)' }}>
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-2 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl p-2 border border-white/20">
                <DollarSign size={20} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">Cierre de Caja</h1>
                <p className="text-blue-200 text-xs">Control y cuadre diario · Incluye servicios móviles</p>
              </div>
            </div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 flex items-center gap-2">
            <Calendar size={14} className="text-blue-200" />
            <span className="text-sm font-bold">{format(new Date(fecha + 'T12:00:00'), 'dd/MM/yyyy')}</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 max-w-5xl">

        {/* ─── BARRA FECHA ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-3.5 mb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => { const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate() - 1); setFecha(d.toISOString().split('T')[0]); }}
              className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"><ChevronLeft size={16} /></button>
            <input type="date"
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <button onClick={() => { const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate() + 1); setFecha(d.toISOString().split('T')[0]); }}
              className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"><ChevronRight size={16} /></button>
          </div>
          <div className="flex items-center gap-2">
            {cuadreCerrado && (
              <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Caja Cerrada
              </span>
            )}
            <button onClick={() => setMostrarCuadre(!mostrarCuadre)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm shadow-blue-200 transition-all">
              <DollarSign size={15} />
              {mostrarCuadre ? 'Ocultar Cuadre' : 'Ver Cuadre del Día'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600 mb-4" />
            <p className="text-gray-400 text-sm">Cargando información...</p>
          </div>
        ) : (
          <>
            {/* ─── PANEL CIERRE ─────────────────────────── */}
            {mostrarCuadre && cuadre && cuadre.total_consultas > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-5 overflow-hidden">

                {/* Sub-header del panel */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"
                  style={{ background: cajaBloqueada && !modoEdicion ? 'linear-gradient(90deg,#fff1f2,#ffe4e6)' : modoEdicion ? 'linear-gradient(90deg,#fffbeb,#fef3c7)' : 'linear-gradient(90deg,#f0f9ff,#e0f2fe)' }}>
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 ${cajaBloqueada && !modoEdicion ? 'bg-red-100' : modoEdicion ? 'bg-amber-100' : 'bg-blue-100'}`}>
                      <DollarSign size={18} className={cajaBloqueada && !modoEdicion ? 'text-red-600' : modoEdicion ? 'text-amber-600' : 'text-blue-600'} />
                    </div>
                    <div>
                      <p className="font-black text-gray-900 text-sm">Formulario de Cierre</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {cajaBloqueada && !modoEdicion ? 'Solo lectura — caja cerrada' : modoEdicion ? 'Modo edición activo' : 'Cuenta el dinero físicamente e ingresa las cantidades'}
                      </p>
                    </div>
                  </div>
                  {cajaBloqueada && (
                    <div className="flex items-center gap-2">
                      {modoEdicion ? (
                        <span className="bg-amber-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"><Edit size={12}/> Modo Edición</span>
                      ) : (
                        <>
                          <span className="bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"><Lock size={12}/> Cerrada</span>
                          <button onClick={solicitarEdicion}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all shadow-sm">
                            <Edit size={14}/> Editar Cuadre
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-6">

                  {/* ── BILLETES ── */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">💵 Billetes</p>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {[
                        { key: 'b200', label: 'Q200', value: 200 },
                        { key: 'b100', label: 'Q100', value: 100 },
                        { key: 'b50',  label: 'Q50',  value: 50  },
                        { key: 'b20',  label: 'Q20',  value: 20  },
                        { key: 'b10',  label: 'Q10',  value: 10  },
                        { key: 'b5',   label: 'Q5',   value: 5   },
                        { key: 'b1',   label: 'Q1',   value: 1   },
                      ].map(b => (
                        <div key={b.key} className="bg-emerald-50 border border-emerald-100 rounded-xl p-2 text-center">
                          <p className="text-xs font-bold text-emerald-700 mb-1">{b.label}</p>
                          <input type="number" min="0" placeholder="0"
                            className={`${inputBase} bg-white border-emerald-200 focus:ring-emerald-400 ${cajaBloqueada ? inputDisabled : ''}`}
                            value={billetes[b.key as keyof typeof billetes]}
                            onChange={(e) => setBilletes({ ...billetes, [b.key]: e.target.value })}
                            disabled={cajaBloqueada} onWheel={(e) => e.currentTarget.blur()} />
                          {billetes[b.key as keyof typeof billetes] && (
                            <p className="text-xs text-emerald-600 mt-1 font-semibold">
                              Q{((parseFloat(billetes[b.key as keyof typeof billetes]) || 0) * b.value).toFixed(0)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── MONEDAS ── */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">🪙 Monedas</p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[
                        { key: 'm1',   label: 'Q1',    value: 1    },
                        { key: 'm050', label: 'Q0.50', value: 0.50 },
                        { key: 'm025', label: 'Q0.25', value: 0.25 },
                        { key: 'm010', label: 'Q0.10', value: 0.10 },
                        { key: 'm005', label: 'Q0.05', value: 0.05 },
                        { key: 'm001', label: 'Q0.01', value: 0.01 },
                      ].map(m => (
                        <div key={m.key} className="bg-amber-50 border border-amber-100 rounded-xl p-2 text-center">
                          <p className="text-xs font-bold text-amber-700 mb-1">{m.label}</p>
                          <input type="number" min="0" placeholder="0"
                            className={`${inputBase} bg-white border-amber-200 focus:ring-amber-400 ${cajaBloqueada ? inputDisabled : ''}`}
                            value={monedas[m.key as keyof typeof monedas]}
                            onChange={(e) => setMonedas({ ...monedas, [m.key]: e.target.value })}
                            disabled={cajaBloqueada} onWheel={(e) => e.currentTarget.blur()} />
                          {monedas[m.key as keyof typeof monedas] && (
                            <p className="text-xs text-amber-600 mt-1 font-semibold">
                              Q{((parseFloat(monedas[m.key as keyof typeof monedas]) || 0) * m.value).toFixed(2)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── TOTAL EFECTIVO ── */}
                  <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: 'linear-gradient(90deg,#052e16,#14532d)' }}>
                    <span className="text-emerald-300 text-sm font-bold uppercase tracking-wide">Total Efectivo en Caja</span>
                    <span className="text-3xl font-black text-white">Q {calcularTotalEfectivoContado().toFixed(2)}</span>
                  </div>

                  {/* ── TARJETA / TRANSFERENCIA / ESTADO CUENTA ── */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    {[
                      { label: '💳 Tarjeta', sub: 'Suma total de vouchers', color: 'purple', val: tarjetaContado, set: setTarjetaContado },
                      { label: '🏦 Transferencias', sub: 'Suma de comprobantes', color: 'blue', val: transferenciaContado, set: setTransferenciaContado },
                      { label: '📋 Estado de Cuenta', sub: 'Pagos a cuenta o crédito', color: 'amber', val: estadoCuentaContado, set: setEstadoCuentaContado },
                    ].map(item => (
                      <div key={item.label} className={`bg-${item.color}-50 border border-${item.color}-100 rounded-2xl p-4`}>
                        <p className="text-sm font-bold text-gray-700 mb-2">{item.label}</p>
                        <input type="number" step="0.01" placeholder="0.00"
                          className={`${inputBase} bg-white text-lg border-${item.color}-200 focus:ring-${item.color}-400 ${cajaBloqueada ? inputDisabled : ''}`}
                          value={item.val} onChange={(e) => item.set(e.target.value)}
                          disabled={cajaBloqueada} onWheel={(e) => e.currentTarget.blur()} />
                        <p className="text-xs text-gray-400 text-center mt-1.5">{item.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── OBSERVACIONES ── */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Observaciones del Cierre</label>
                    <textarea
                      className={`w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 resize-none ${cajaBloqueada ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                      disabled={cajaBloqueada} placeholder="Notas, incidencias o comentarios..." rows={3} />
                  </div>

                  {/* ── BOTONES ACCIÓN ── */}
                  {!cajaBloqueada && (
                    <div className="space-y-3">
                      <button onClick={guardarCuadre} className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200`}>
                        💾 Guardar Cuadre
                      </button>
                      <button onClick={validarCuadre} disabled={cuadreValidado}
                        className={`${btnPrimary} ${cuadreValidado ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'}`}>
                        <CheckCircle2 size={18} />
                        {cuadreValidado ? '✓ Cuadre Validado' : 'Validar Cuadre'}
                      </button>
                      {cuadreValidado && !cuadreCerrado && (
                        <button onClick={solicitarDescargaExcel} className={`${btnPrimary} bg-teal-600 hover:bg-teal-700 text-white shadow-teal-200`}>
                          <FileText size={18} /> Descargar Excel del Cuadre
                          {necesitaAutorizacionParaExcel() && <span className="ml-2 text-xs bg-orange-500 px-2 py-0.5 rounded-lg">Requiere autorización</span>}
                        </button>
                      )}
                    </div>
                  )}

                  {cajaBloqueada && modoEdicion && (
                    <div className="space-y-3">
                      <button onClick={guardarCuadre} className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-700 text-white`}>
                        💾 Guardar Cambios
                      </button>
                      <button onClick={validarCuadre} className={`${btnPrimary} bg-blue-600 hover:bg-blue-700 text-white`}>
                        <CheckCircle2 size={18} /> Re-Validar Cuadre
                      </button>
                      {cuadreValidado && (
                        <button onClick={solicitarDescargaExcel} className={`${btnPrimary} bg-teal-600 hover:bg-teal-700 text-white`}>
                          <FileText size={18} /> Descargar Excel del Cuadre
                          {necesitaAutorizacionParaExcel() && <span className="ml-2 text-xs bg-orange-500 px-2 py-0.5 rounded-lg">Requiere autorización</span>}
                        </button>
                      )}
                    </div>
                  )}

                  {cajaBloqueada && !modoEdicion && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center">
                      <Lock size={28} className="text-slate-400 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">Cuadre Bloqueado</p>
                      <p className="text-xs text-slate-400 mt-1">Día pasado en modo solo lectura. Usa "Editar Cuadre" para modificar.</p>
                    </div>
                  )}

                  {/* ── COMPARACIÓN SISTEMA vs CONTADO ── */}
                  {cuadreValidado && mostrarEsperados && (
                    <div className="space-y-4 pt-2">
                      {cuadreCorrecto ? (
                        <>
                          <div className="rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                              <p className="font-bold text-gray-700 text-sm">📊 Comparación Sistema vs Contado</p>
                            </div>
                            <div className="divide-y divide-gray-50">
                              {[
                                { label: '💵 Efectivo', esperado: efectivoEsperado, contado: efectivoContadoNum, diferencia: diferenciaEfectivo },
                                { label: '💳 Tarjeta', esperado: tarjetaEsperada, contado: tarjetaContadoNum, diferencia: diferenciaTarjeta },
                                { label: '🏦 Transferencias', esperado: depositadoEsperado, contado: depositadoContadoNum, diferencia: diferenciaDepositado },
                                ...(estadoCuentaEsperada > 0 ? [{ label: '📋 Estado de Cuenta', esperado: estadoCuentaEsperada, contado: estadoCuentaContadoNum, diferencia: diferenciaEstadoCuenta }] : [])
                              ].map((row, i) => (
                                <div key={i} className="px-5 py-3 grid grid-cols-4 gap-3 items-center">
                                  <span className="text-sm font-semibold text-gray-700">{row.label}</span>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-400">Sistema</p>
                                    <p className="font-bold text-gray-800 text-sm">Q {row.esperado.toFixed(2)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-400">Contado</p>
                                    <p className="font-bold text-gray-800 text-sm">Q {row.contado.toFixed(2)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-400">Diferencia</p>
                                    <p className="font-bold text-emerald-600 text-sm">{row.diferencia > 0 ? '+' : ''}{row.diferencia.toFixed(2)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-5">
                              <div className="bg-emerald-500 rounded-xl p-2"><CheckCircle2 size={20} className="text-white" /></div>
                              <div>
                                <p className="font-black text-emerald-800">¡Cuadre Correcto!</p>
                                <p className="text-xs text-emerald-600">Confirme el cierre de caja para bloquearlo</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">Nombre de quien cuadró *</label>
                                <input type="text"
                                  className="w-full px-4 py-2.5 border border-emerald-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                                  value={nombreCajero} onChange={(e) => setNombreCajero(e.target.value)} placeholder="Ingrese su nombre completo" />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">PIN de Autorización *</label>
                                <input type="password"
                                  className="w-full px-4 py-2.5 border border-emerald-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                                  value={pinCierre} onChange={(e) => setPinCierre(e.target.value)} placeholder="••••" maxLength={4} />
                              </div>
                              <button onClick={confirmarCierre} className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200`}>
                                <Lock size={16} /> Confirmar y Cerrar Caja
                              </button>
                              <button onClick={solicitarDescargaExcel} className={`${btnPrimary} bg-blue-600 hover:bg-blue-700 text-white`}>
                                <FileText size={16} /> Descargar Excel del Cuadre
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="bg-red-500 rounded-xl p-2"><X size={18} className="text-white" /></div>
                            <div>
                              <p className="font-black text-red-800">Cuadre Incorrecto</p>
                              <p className="text-xs text-red-500">Las siguientes formas de pago no cuadran:</p>
                            </div>
                          </div>
                          <div className="space-y-2 mb-4">
                            {diferenciaEfectivo !== 0     && <div className="bg-white border border-red-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700 flex items-center gap-2">✗ 💵 Efectivo</div>}
                            {diferenciaTarjeta !== 0      && <div className="bg-white border border-red-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700 flex items-center gap-2">✗ 💳 Tarjeta</div>}
                            {diferenciaDepositado !== 0   && <div className="bg-white border border-red-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700 flex items-center gap-2">✗ 🏦 Transferencias</div>}
                            {diferenciaEstadoCuenta !== 0 && <div className="bg-white border border-red-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700 flex items-center gap-2">✗ 📋 Estado de Cuenta</div>}
                          </div>
                          <button onClick={() => { setCuadreValidado(false); setMostrarEsperados(false); }}
                            className={`${btnPrimary} bg-red-600 hover:bg-red-700 text-white`}>
                            Volver a Contar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── GASTOS ───────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-5 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <button onClick={() => setMostrarGastos(!mostrarGastos)} className="flex items-center gap-2.5">
                  <div className="bg-red-100 rounded-xl p-2"><span className="text-base">📉</span></div>
                  <span className="font-bold text-gray-800 text-sm">Gastos del Día</span>
                  {gastos.length > 0 && (
                    <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{gastos.length}</span>
                  )}
                  {mostrarGastos ? <ChevronUp size={15} className="text-gray-300 ml-1" /> : <ChevronDown size={15} className="text-gray-300 ml-1" />}
                </button>
                <button onClick={() => setShowModalGasto(true)}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-200">
                  <Plus size={14} /> Agregar
                </button>
              </div>
              {mostrarGastos && (
                <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                  {gastos.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-6">No hay gastos registrados hoy</p>
                  ) : (
                    <div className="space-y-2">
                      {gastos.map(gasto => (
                        <div key={gasto.id} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{gasto.concepto}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {(() => {
                                const f = new Date(gasto.created_at);
                                const horaGT = new Date(f.getTime() - (6 * 60 * 60 * 1000));
                                return horaGT.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
                              })()}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-red-600">- Q {gasto.monto.toFixed(2)}</span>
                            <button onClick={() => eliminarGasto(gasto.id)}
                              className="text-red-400 hover:text-red-600 hover:bg-red-100 p-1.5 rounded-lg transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between items-center px-4 py-3 bg-red-100 border border-red-200 rounded-xl font-black mt-1">
                        <span className="text-gray-700 text-sm">Total Gastos</span>
                        <span className="text-red-700 text-lg">- Q {totalGastos.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─── PACIENTES DEL DÍA ───────────────────── */}
            {listaConsultas.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-5 overflow-hidden">
                <button onClick={() => setMostrarListaPacientes(!mostrarListaPacientes)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-blue-100 rounded-xl p-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <span className="font-bold text-gray-800 text-sm">Pacientes del día</span>
                    <span className="bg-blue-100 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">{listaConsultas.length}</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-300 transition-transform ${mostrarListaPacientes ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {mostrarListaPacientes && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {listaConsultas.map((c, idx) => {
                      const esSinOrden = c.sin_orden_medica === true;
                      const tieneReferente = c.medicos?.es_referente === true;
                      const tieneNoReferente = c.medico_id && !tieneReferente && !c.sin_informacion_medico && !c.es_servicio_movil;
                      const medicoNombre = c.medicos?.nombre || c.medico_recomendado;
                      return (
                        <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-300 w-5 text-right font-mono">{idx + 1}</span>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{c.pacientes?.nombre || '—'}</p>
                              {medicoNombre && (
                                <p className={`text-xs mt-0.5 font-medium ${
                                  esSinOrden && tieneReferente   ? 'text-amber-600' :
                                  esSinOrden && tieneNoReferente ? 'text-orange-600' :
                                  tieneReferente                 ? 'text-emerald-600' :
                                  tieneNoReferente               ? 'text-blue-500' : 'text-gray-400'
                                }`}>
                                  {medicoNombre}
                                  {esSinOrden ? <span className="ml-1 font-normal">(sin orden)</span> : tieneNoReferente ? <span className="ml-1 font-normal">(referente)</span> : null}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            {esSinOrden && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Sin orden</span>}
                            {!esSinOrden && tieneReferente && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Referente</span>}
                            {!esSinOrden && tieneNoReferente && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">No Ref.</span>}
                            <span className={`px-2 py-0.5 rounded-full font-semibold ${
                              c.tipo_cobro === 'normal'        ? 'bg-gray-100 text-gray-500' :
                              c.tipo_cobro === 'especial'      ? 'bg-purple-100 text-purple-700' :
                              c.forma_pago === 'estado_cuenta' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {c.forma_pago === 'estado_cuenta' ? 'Est.Cta' : c.tipo_cobro}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ─── ANULADAS ─────────────────────────────── */}
            {consultasAnuladas.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-5 overflow-hidden">
                <button onClick={() => setMostrarAnuladas(!mostrarAnuladas)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-red-100 rounded-xl p-2"><X size={16} className="text-red-500" /></div>
                    <span className="font-bold text-gray-800 text-sm">Consultas Anuladas</span>
                    <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{consultasAnuladas.length}</span>
                  </div>
                  {mostrarAnuladas ? <ChevronUp size={15} className="text-gray-300" /> : <ChevronDown size={15} className="text-gray-300" />}
                </button>
                {mostrarAnuladas && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-2">
                    {consultasAnuladas.map((anulada, index) => (
                      <div key={index} className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{anulada.nombre}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{anulada.motivo_anulacion}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Anulado por: {anulada.usuario_anulo}</p>
                        </div>
                        <span className="font-black text-red-600 text-sm">Q {anulada.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── MODAL GASTO ─────────────────────────────── */}
      {showModalGasto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 rounded-xl p-2"><Plus size={16} className="text-red-600" /></div>
                <h2 className="text-base font-black text-gray-900">Agregar Gasto</h2>
              </div>
              <button onClick={() => { setShowModalGasto(false); setConceptoGasto(''); setMontoGasto(''); }}
                className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100 transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Concepto *</label>
                <input type="text"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400"
                  placeholder="Ej: Diesel, Papelería, Mantenimiento"
                  value={conceptoGasto} onChange={(e) => setConceptoGasto(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Monto (Q) *</label>
                <input type="number" step="0.01" placeholder="0.00"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={montoGasto} onChange={(e) => setMontoGasto(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowModalGasto(false); setConceptoGasto(''); setMontoGasto(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-semibold transition-colors">
                Cancelar
              </button>
              <button onClick={agregarGasto}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-red-200">
                Guardar Gasto
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalToken && (
        <AutorizacionModal
          accion="Editar Cuadre Cerrado"
          detalles={`Cuadre del ${format(new Date(fecha + 'T12:00:00'), 'dd/MM/yyyy')} - Bloqueado automáticamente`}
          onAutorizado={ejecutarEdicion}
          onCancelar={() => setMostrarModalToken(false)}
        />
      )}
      {mostrarModalTokenExcel && (
        <AutorizacionModal
          accion="Descargar Excel de Cuadre"
          detalles={`Cuadre del ${format(new Date(fecha + 'T12:00:00'), 'dd/MM/yyyy')} - Requiere autorización administrativa`}
          onAutorizado={ejecutarDescargaExcel}
          onCancelar={() => setMostrarModalTokenExcel(false)}
        />
      )}
    </div>
  );
};