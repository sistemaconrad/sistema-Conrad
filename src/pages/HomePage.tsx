import React, { useState, useEffect } from 'react';
import { Plus, FileText, Users, BarChart3, Trash2, FileSpreadsheet, Settings, Calendar, DollarSign, Activity, ChevronRight } from 'lucide-react';
import { NuevoPacienteModal } from '../components/NuevoPacienteModal';
import { Autocomplete } from '../components/Autocomplete';
import { Paciente, Medico, SubEstudio, TipoCobro, FormaPago, DetalleConsulta } from '../types';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { generarReciboCompleto, generarReciboMedico, abrirRecibo } from '../lib/recibos';

// ─── Inline styles (design-only, zero logic change) ──────────────────────────
const btnSaveStyle = (state: 'idle' | 'saving' | 'saved'): React.CSSProperties => ({
  width: '100%',
  padding: '14px',
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 15,
  border: 'none',
  cursor: state === 'saved' ? 'default' : state === 'saving' ? 'wait' : 'pointer',
  background: state === 'saved'
    ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
    : state === 'saving'
    ? '#f59e0b'
    : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#fff',
  boxShadow: state === 'idle' ? '0 4px 14px rgba(37,99,235,0.35)' : 'none',
  transition: 'all .2s',
  letterSpacing: '0.2px',
});

const btnPrintStyle = (active: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '14px',
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 15,
  border: 'none',
  cursor: active ? 'pointer' : 'not-allowed',
  background: active
    ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
    : '#e5e7eb',
  color: active ? '#fff' : '#9ca3af',
  boxShadow: active ? '0 4px 14px rgba(5,150,105,0.3)' : 'none',
  transition: 'all .2s',
  letterSpacing: '0.2px',
});

const S: Record<string, React.CSSProperties> = {
  /* Layout */
  root: {
    minHeight: '100vh',
    background: '#f0f4f8',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  },

  /* Header */
  header: {
    background: 'linear-gradient(135deg, #0f2942 0%, #1a4a7a 60%, #1d5c9e 100%)',
    color: '#fff',
    boxShadow: '0 4px 24px rgba(15,41,66,0.25)',
    position: 'relative',
    overflow: 'hidden',
  },
  headerInner: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '22px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAccent: {
    position: 'absolute',
    right: -60,
    top: -60,
    width: 300,
    height: 300,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  headerAccent2: {
    position: 'absolute',
    right: 80,
    top: 30,
    width: 120,
    height: 120,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  h1: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '-0.3px',
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 3,
    letterSpacing: '0.3px',
    textTransform: 'uppercase' as const,
  },
  dateBlock: {
    textAlign: 'right' as const,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.6,
  },

  /* Nav bar */
  navbar: {
    background: '#fff',
    borderBottom: '1px solid #e8edf3',
    boxShadow: '0 2px 8px rgba(15,41,66,0.06)',
  },
  navInner: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '0 32px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    overflowX: 'auto' as const,
    scrollbarWidth: 'none' as const,
  },

  /* Content */
  content: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '28px 32px 48px',
    display: 'grid',
    gridTemplateColumns: '1fr 360px',
    gap: 24,
  },
  leftCol: { display: 'flex', flexDirection: 'column' as const, gap: 20 },
  rightCol: { display: 'flex', flexDirection: 'column' as const, gap: 20 },

  /* Cards */
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '24px 28px',
    boxShadow: '0 2px 12px rgba(15,41,66,0.07)',
    border: '1px solid #e8edf3',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#0f2942',
    marginBottom: 18,
    letterSpacing: '0.2px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  titleDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#2563eb',
    flexShrink: 0,
  },

  /* Welcome card */
  welcomeCard: {
    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    borderRadius: 16,
    padding: '48px 32px',
    border: '1px solid #bfdbfe',
    textAlign: 'center' as const,
    boxShadow: '0 2px 12px rgba(37,99,235,0.08)',
  },
  welcomeIcon: {
    fontSize: 48,
    marginBottom: 16,
    display: 'block',
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1e40af',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: '#3b82f6',
    marginBottom: 24,
  },

  /* Patient info */
  patientGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px 20px',
  },
  patientField: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 1.5,
  },
  fieldLabel: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    display: 'block',
    marginBottom: 2,
  },
  fieldValue: {
    color: '#111827',
    fontWeight: 500,
    fontSize: 13,
  },

  /* Badges */
  badgeMobile: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 600,
    background: '#fff7ed',
    color: '#c2410c',
    border: '1px solid #fed7aa',
    padding: '3px 10px',
    borderRadius: 20,
  },
  badgeSaved: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 600,
    background: '#f0fdf4',
    color: '#16a34a',
    border: '1px solid #bbf7d0',
    padding: '3px 10px',
    borderRadius: 20,
  },

  /* Tipo cobro radios */
  radioGroup: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '9px 16px',
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    cursor: 'pointer',
    fontSize: 13,
    color: '#374151',
    fontWeight: 500,
    transition: 'all .15s',
    background: '#fafafa',
    userSelect: 'none' as const,
  },

  /* Justificacion box */
  justBox: {
    marginTop: 16,
    padding: '16px 18px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 12,
  },

  /* Descripcion items */
  descItem: {
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: '14px 16px',
    background: '#fafafa',
    marginBottom: 10,
    transition: 'box-shadow .15s',
  },
  descItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  descName: {
    fontWeight: 600,
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
  },
  descPrice: {
    fontSize: 13,
    color: '#6b7280',
  },
  tagRef: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 600,
    background: '#f0fdf4',
    color: '#16a34a',
    border: '1px solid #bbf7d0',
    padding: '2px 8px',
    borderRadius: 20,
  },
  tagNoRef: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 600,
    background: '#f9fafb',
    color: '#6b7280',
    border: '1px solid #e5e7eb',
    padding: '2px 8px',
    borderRadius: 20,
  },

  /* Totales card */
  totalesCard: {
    background: 'linear-gradient(160deg, #0f2942 0%, #1a4a7a 100%)',
    borderRadius: 16,
    padding: '24px 28px',
    color: '#fff',
    boxShadow: '0 8px 24px rgba(15,41,66,0.25)',
    border: 'none',
  },
  totalesTitle: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.8px',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  totalesRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 10,
  },
  totalesTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    borderTop: '1px solid rgba(255,255,255,0.15)',
    paddingTop: 14,
    marginTop: 8,
    fontSize: 20,
    fontWeight: 700,
    color: '#fff',
  },

  /* Action buttons */
  btnPrimary: {
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 11,
    padding: '12px 20px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all .15s',
    boxShadow: '0 3px 10px rgba(37,99,235,0.3)',
    letterSpacing: '0.1px',
  },
  btnSecondary: {
    background: '#fff',
    color: '#374151',
    border: '1.5px solid #e5e7eb',
    borderRadius: 10,
    padding: '9px 16px',
    fontWeight: 500,
    fontSize: 13,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    transition: 'all .15s',
  },
  btnDanger: {
    background: 'transparent',
    color: '#ef4444',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    transition: 'background .12s',
  },

  btnClear: {
    width: '100%',
    padding: '11px',
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 13,
    border: '1.5px solid #e5e7eb',
    background: '#fff',
    color: '#6b7280',
    cursor: 'pointer',
    letterSpacing: '0.1px',
  },

  /* Input / select */
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #e5e7eb',
    borderRadius: 10,
    fontSize: 13,
    color: '#111827',
    background: '#fff',
    outline: 'none',
    transition: 'border .15s',
    boxSizing: 'border-box' as const,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 6,
    display: 'block',
  },
  select: {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #e5e7eb',
    borderRadius: 10,
    fontSize: 13,
    color: '#111827',
    background: '#fff',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'auto' as const,
  },

  /* Divider */
  divider: {
    height: 1,
    background: '#f0f4f8',
    margin: '18px 0',
  },

  /* Moville alert */
  mobileAlert: {
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 13,
    color: '#9a3412',
    marginTop: 14,
  },
};

// ─── Nav button helper ────────────────────────────────────────────────────────
const NavBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}> = ({ icon, label, onClick, primary }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: primary ? '10px 20px' : '10px 16px',
      margin: '10px 0',
      border: primary ? 'none' : '1px solid transparent',
      borderRadius: 9,
      fontSize: 13,
      fontWeight: primary ? 700 : 500,
      cursor: 'pointer',
      whiteSpace: 'nowrap' as const,
      transition: 'all .15s',
      background: primary
        ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
        : 'transparent',
      color: primary ? '#fff' : '#4b5563',
      boxShadow: primary ? '0 3px 10px rgba(37,99,235,0.25)' : 'none',
    }}
    onMouseEnter={e => {
      if (!primary) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
    }}
    onMouseLeave={e => {
      if (!primary) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
    }}
  >
    {icon}
    {label}
  </button>
);

// ─── Interfaces (unchanged) ───────────────────────────────────────────────────
interface HomePageProps {
  onNavigate: (page: string) => void;
}

interface PagoMultiple {
  forma_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'depositado';
  monto: number;
  numero_referencia?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [pacienteActual, setPacienteActual] = useState<(Paciente & { id: string }) | null>(null);
  const [medicoActual, setMedicoActual] = useState<Medico | null>(null);
  const [sinInfoMedico, setSinInfoMedico] = useState(false);
  const [esServicioMovil, setEsServicioMovil] = useState(false);

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

  // ─── All logic functions UNCHANGED ────────────────────────────────────────
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

  const handleGuardarPaciente = async (
    paciente: Paciente,
    medico: Medico | null,
    sinInfo: boolean,
    esServicioMovilParam: boolean = false,
    establecimiento: string = ''
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
            .insert([{ ...medico, activo: true }])
            .select()
            .single();
          if (medicoError) throw medicoError;
          setMedicoActual(medicoData);
        }
      }

      setPacienteActual(pacienteData);
      setMedicoActual(medico);
      setSinInfoMedico(sinInfo);
      setEsServicioMovil(esServicioMovilParam);
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
    if (esServicioMovil && !establecimientoMovil.trim()) {
      alert('El establecimiento es requerido para servicios móviles.\n\nPor favor, crea un nuevo paciente e ingresa el establecimiento.');
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
          justificacion_especial: ((tipoCobro === 'normal' && !esHorarioNormal()) || (tipoCobro === 'personalizado' && !esServicioMovil)) ? justificacionEspecial : null,
          fecha: format(new Date(), 'yyyy-MM-dd'),
          es_servicio_movil: esServicioMovil,
          movil_establecimiento: esServicioMovil ? establecimientoMovil : null,
          detalle_pagos_multiples: detallePagosMultiples,
          nombre_usuario: localStorage.getItem('nombreUsuarioConrad') || ''
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
  const saveState: 'idle'|'saving'|'saved' = guardando ? 'saving' : consultaGuardada ? 'saved' : 'idle';

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>

      {/* ── HEADER ── */}
      <header style={S.header as React.CSSProperties}>
        <div style={S.headerAccent as React.CSSProperties} />
        <div style={S.headerAccent2 as React.CSSProperties} />
        <div style={S.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={S.logoMark}>
              <Activity size={22} color="#fff" />
            </div>
            <div>
              <h1 style={S.h1}>Centro de Diagnóstico</h1>
              <p style={S.subtitle}>Sistema de Gestión de Consultas</p>
            </div>
          </div>
          <div style={S.dateBlock}>
            <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
              {format(new Date(), "EEEE, dd 'de' MMMM yyyy")}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
              {format(new Date(), 'HH:mm')}
            </div>
          </div>
        </div>
      </header>

      {/* ── NAVBAR ── */}
      <nav style={S.navbar}>
        <div style={S.navInner}>
          <NavBtn primary icon={<Plus size={15} />} label="Nuevo" onClick={() => setShowNuevoModal(true)} />
          <NavBtn icon={<FileText size={15} />} label="Productos" onClick={() => onNavigate('productos')} />
          <NavBtn icon={<Users size={15} />} label="Referentes" onClick={() => onNavigate('referentes')} />
          <NavBtn icon={<Users size={15} />} label="Pacientes" onClick={() => onNavigate('pacientes')} />
          <NavBtn icon={<BarChart3 size={15} />} label="Cuadre Diario" onClick={() => onNavigate('cuadre')} />
          <NavBtn icon={<Calendar size={15} />} label="Cuadre Quincenal" onClick={() => onNavigate('cuadre-quincenal')} />
          <NavBtn icon={<FileSpreadsheet size={15} />} label="Reportes" onClick={() => onNavigate('reportes')} />
          <NavBtn icon={<DollarSign size={15} />} label="Comisiones" onClick={() => onNavigate('comisiones')} />
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <div style={S.content}>

        {/* ── LEFT COLUMN ── */}
        <div style={S.leftCol}>

          {/* Patient info or welcome */}
          {pacienteActual ? (
            <div style={S.card}>
              <div style={{ ...S.cardTitle, marginBottom: 12 }}>
                <div style={S.titleDot} />
                Información del Paciente
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {esServicioMovil && <span style={S.badgeMobile}>📱 Servicio Móvil</span>}
                  {consultaGuardada && <span style={S.badgeSaved}>✓ Guardado</span>}
                </div>
              </div>
              <div style={S.patientGrid}>
                {[
                  ['Nombre', pacienteActual.nombre],
                  ['Edad', `${pacienteActual.edad} años`],
                  ['Teléfono', pacienteActual.telefono],
                  ['Departamento', pacienteActual.departamento],
                  ['Municipio', pacienteActual.municipio],
                ].map(([label, value]) => (
                  <div key={label} style={S.patientField}>
                    <span style={S.fieldLabel}>{label}</span>
                    <span style={S.fieldValue}>{value}</span>
                  </div>
                ))}
                {esServicioMovil && establecimientoMovil && (
                  <div style={{ ...S.patientField, gridColumn: '1 / -1' }}>
                    <span style={S.fieldLabel}>🏥 Establecimiento</span>
                    <span style={{ ...S.fieldValue, color: '#c2410c' }}>{establecimientoMovil}</span>
                  </div>
                )}
              </div>

              {medicoActual && !sinInfoMedico && (
                <>
                  <div style={S.divider} />
                  <div style={{ ...S.cardTitle, marginBottom: 12 }}>
                    <div style={{ ...S.titleDot, background: '#059669' }} />
                    Médico Referente
                  </div>
                  <div style={S.patientGrid}>
                    {[
                      ['Nombre', medicoActual.nombre],
                      ['Teléfono', medicoActual.telefono],
                      ['Departamento', medicoActual.departamento],
                      ['Municipio', medicoActual.municipio],
                    ].map(([label, value]) => (
                      <div key={label} style={S.patientField}>
                        <span style={S.fieldLabel}>{label}</span>
                        <span style={S.fieldValue}>{value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={S.welcomeCard}>
              <span style={S.welcomeIcon}>🏥</span>
              <div style={S.welcomeTitle}>Bienvenido al Centro de Diagnóstico</div>
              <p style={S.welcomeText}>Para comenzar, registra un nuevo paciente</p>
              <button onClick={() => setShowNuevoModal(true)} style={S.btnPrimary}>
                <Plus size={18} /> Crear Nuevo Paciente
              </button>
            </div>
          )}

          {/* Tipo de cobro */}
          <div style={S.card}>
            <div style={S.cardTitle}><div style={S.titleDot} /> Tipo de Cobro</div>
            <div style={S.radioGroup}>
              {([
                { key: 'social', label: 'Social', disabled: esServicioMovil || !!consultaGuardada, note: esServicioMovil ? 'No disponible' : '' },
                { key: 'normal', label: 'Normal', disabled: esServicioMovil || !!consultaGuardada, note: !horarioNormal ? '(Requiere justificación)' : '' },
                { key: 'especial', label: 'Especial', disabled: (horarioNormal && !esServicioMovil) || !!consultaGuardada, note: esServicioMovil ? 'Precio del sistema' : horarioNormal && !esServicioMovil ? 'Solo fuera de horario' : '' },
                { key: 'personalizado', label: 'Personalizado', disabled: !!consultaGuardada, note: esServicioMovil ? 'Editar precios' : '', purple: true },
              ] as any[]).map(opt => (
                <label key={opt.key} style={{
                  ...S.radioLabel,
                  borderColor: tipoCobro === opt.key ? (opt.purple ? '#7c3aed' : '#2563eb') : '#e5e7eb',
                  background: tipoCobro === opt.key ? (opt.purple ? '#f5f3ff' : '#eff6ff') : '#fafafa',
                  color: opt.disabled ? '#9ca3af' : opt.purple ? '#7c3aed' : '#374151',
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  opacity: opt.disabled ? 0.6 : 1,
                }}>
                  <input type="radio" name="tipoCobro" checked={tipoCobro === opt.key}
                    onChange={() => {
                      if (opt.key === 'normal' && !horarioNormal) setShowJustificacion(true);
                      else if (opt.key === 'personalizado') setShowJustificacion(!esServicioMovil);
                      else { setShowJustificacion(false); setJustificacionEspecial(''); }
                      setTipoCobro(opt.key as TipoCobro);
                    }}
                    disabled={opt.disabled}
                    style={{ accentColor: opt.purple ? '#7c3aed' : '#2563eb' }}
                  />
                  <span style={{ fontWeight: tipoCobro === opt.key ? 600 : 500 }}>{opt.label}</span>
                  {opt.note && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 2 }}>{opt.note}</span>}
                </label>
              ))}
            </div>

            {showJustificacion && (tipoCobro === 'normal' && !horarioNormal || (tipoCobro === 'personalizado' && !esServicioMovil)) && (
              <div style={S.justBox}>
                <label style={S.label}>
                  {tipoCobro === 'personalizado' ? 'Justificación y precio personalizado' : 'Justificación para tarifa normal fuera de horario'}
                </label>
                <textarea
                  style={{ ...S.input, resize: 'vertical', minHeight: 68 }}
                  value={justificacionEspecial}
                  onChange={(e) => setJustificacionEspecial(e.target.value)}
                  placeholder={tipoCobro === 'personalizado' ? 'Ej: Por orden del Dr. García, precio especial Q150' : 'Ej: Médico referente solicitó tarifa normal'}
                  rows={2}
                  required
                  disabled={!!consultaGuardada}
                />
                <p style={{ fontSize: 11, color: '#92400e', marginTop: 6 }}>* Esta justificación quedará registrada en el sistema</p>
              </div>
            )}

            {esServicioMovil && (
              <div style={S.mobileAlert}>
                <strong>📱 Servicio Móvil:</strong>{' '}
                {tipoCobro === 'especial' && 'Usando precios especiales del sistema'}
                {tipoCobro === 'personalizado' && 'Puedes editar el precio de cada estudio manualmente'}
              </div>
            )}
          </div>

          {/* Estudios */}
          <div style={S.card}>
            <div style={S.cardTitle}><div style={S.titleDot} /> Estudios</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={S.label}>Estudio</label>
                <Autocomplete
                  label=""
                  options={estudios
                    .filter(e => !esServicioMovil || e.nombre.toUpperCase() === 'RX')
                    .map(e => ({ id: e.id, nombre: e.nombre }))}
                  value={estudioSeleccionado}
                  onChange={(val) => { setEstudioSeleccionado(val); setSubEstudioSeleccionado(''); }}
                  placeholder={esServicioMovil ? 'Solo estudios RX' : 'Seleccione estudio'}
                  disabled={!!consultaGuardada}
                />
              </div>
              <div>
                <label style={S.label}>Sub-Estudio</label>
                <Autocomplete
                  label=""
                  options={subEstudiosFiltrados.map(se => ({ id: se.id || '', nombre: se.nombre }))}
                  value={subEstudioSeleccionado}
                  onChange={setSubEstudioSeleccionado}
                  placeholder="Seleccione sub-estudio"
                  disabled={!estudioSeleccionado || !!consultaGuardada}
                />
              </div>
            </div>
            <button
              onClick={agregarSubEstudio}
              disabled={!subEstudioSeleccionado || !!consultaGuardada}
              style={{
                ...S.btnPrimary,
                width: '100%',
                justifyContent: 'center',
                opacity: (!subEstudioSeleccionado || !!consultaGuardada) ? 0.5 : 1,
                cursor: (!subEstudioSeleccionado || !!consultaGuardada) ? 'not-allowed' : 'pointer',
              }}
            >
              <Plus size={16} />
              Agregar {estudioSeleccionado && descripcion.length > 0 ? 'Otro Estudio' : 'a Descripción'}
            </button>
            {estudioSeleccionado && descripcion.length > 0 && !consultaGuardada && (
              <p style={{ fontSize: 12, color: '#059669', textAlign: 'center', marginTop: 10 }}>
                ✓ Puedes seguir agregando más estudios del mismo tipo
              </p>
            )}
            {consultaGuardada && (
              <p style={{ fontSize: 12, color: '#d97706', textAlign: 'center', marginTop: 10 }}>
                ⚠️ Consulta guardada — No se pueden agregar más estudios
              </p>
            )}
          </div>

          {/* Descripción */}
          <div style={S.card}>
            <div style={S.cardTitle}><div style={S.titleDot} /> Descripción</div>
            {descripcion.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', color: '#9ca3af', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                No hay estudios agregados
              </div>
            ) : (
              <div>
                {descripcion.map((item, index) => {
                  const subEstudio = subEstudios.find(se => se.id === item.sub_estudio_id);
                  return (
                    <div key={index} style={{
                      ...S.descItem,
                      borderLeft: `3px solid ${item.es_referido ? '#10b981' : '#d1d5db'}`,
                    }}>
                      <div style={S.descItemHeader}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={S.descName}>{subEstudio?.nombre}</span>
                            {item.es_referido
                              ? <span style={S.tagRef}>✓ Genera comisión</span>
                              : <span style={S.tagNoRef}>Sin comisión</span>}
                          </div>
                          {tipoCobro === 'personalizado' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, color: '#6b7280' }}>Q</span>
                              <input
                                type="number" step="0.01" min="0"
                                value={item.precio}
                                onChange={(e) => {
                                  const nuevaDescripcion = [...descripcion];
                                  nuevaDescripcion[index].precio = parseFloat(e.target.value) || 0;
                                  setDescripcion(nuevaDescripcion);
                                }}
                                style={{ width: 90, padding: '5px 10px', border: '1.5px solid #a78bfa', borderRadius: 8, fontSize: 13, outline: 'none' }}
                                disabled={!!consultaGuardada}
                              />
                            </div>
                          ) : (
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#1d4ed8' }}>Q {item.precio.toFixed(2)}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {!consultaGuardada && medicoActual && !sinInfoMedico && (
                            <button
                              onClick={() => toggleReferido(index)}
                              style={{
                                padding: '5px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                borderRadius: 8,
                                border: 'none',
                                cursor: 'pointer',
                                background: item.es_referido ? '#d1fae5' : '#f3f4f6',
                                color: item.es_referido ? '#065f46' : '#6b7280',
                                transition: 'all .15s',
                              }}
                            >
                              {item.es_referido ? '✓ Referido' : 'No referido'}
                            </button>
                          )}
                          <button onClick={() => eliminarDeDescripcion(index)} style={S.btnDanger} disabled={!!consultaGuardada}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {!consultaGuardada && (
                        <div style={{ marginTop: 10, borderTop: '1px solid #f0f4f8', paddingTop: 10 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!item.comentarios && item.comentarios.trim() !== ''}
                              onChange={(e) => { if (!e.target.checked) actualizarComentarios(index, ''); }}
                              style={{ accentColor: '#2563eb' }}
                            />
                            Agregar comentarios opcionales
                          </label>
                          {(item.comentarios !== undefined && item.comentarios !== '') || item.comentarios === '' ? (
                            <textarea
                              value={item.comentarios || ''}
                              onChange={(e) => actualizarComentarios(index, e.target.value)}
                              placeholder="Comentarios adicionales sobre este estudio..."
                              style={{ ...S.input, marginTop: 8, resize: 'vertical', minHeight: 56, fontSize: 12 }}
                              rows={2}
                              maxLength={500}
                            />
                          ) : null}
                        </div>
                      )}
                      {consultaGuardada && item.comentarios && item.comentarios.trim() !== '' && (
                        <div style={{ marginTop: 8, padding: '8px 12px', background: '#eff6ff', borderRadius: 8, fontSize: 12 }}>
                          <strong style={{ color: '#1d4ed8' }}>Comentarios:</strong>
                          <p style={{ color: '#374151', marginTop: 4 }}>{item.comentarios}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {medicoActual && !sinInfoMedico && descripcion.length > 0 && !consultaGuardada && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#eff6ff', borderRadius: 10, fontSize: 12, color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                💡 <strong>Control de comisiones:</strong> Usa el botón "Referido" para controlar qué estudios generan comisión al médico.
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={S.rightCol}>

          {/* Facturación */}
          <div style={S.card}>
            <div style={S.cardTitle}><div style={S.titleDot} /> Facturación</div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Requiere Factura</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {[['Sí', true], ['No', false]].map(([lbl, val]) => (
                  <label key={String(lbl)} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 18px', borderRadius: 9, border: '1.5px solid',
                    borderColor: requiereFactura === val ? '#2563eb' : '#e5e7eb',
                    background: requiereFactura === val ? '#eff6ff' : '#fafafa',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  }}>
                    <input type="radio" name="factura"
                      checked={requiereFactura === val}
                      onChange={() => { if (val) setRequiereFactura(true); else { setRequiereFactura(false); setNit(''); } }}
                      disabled={!!consultaGuardada}
                      style={{ accentColor: '#2563eb' }}
                    />
                    {String(lbl)}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>NIT</label>
              <input type="text" style={S.input} value={nit} onChange={(e) => setNit(e.target.value)}
                placeholder="NIT (si aplica)" disabled={!requiereFactura || !!consultaGuardada} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Forma de Pago</label>
              <select
                style={S.select}
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
              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Número de Transferencia *</label>
                <input type="text" style={S.input} value={numeroTransferencia}
                  onChange={(e) => setNumeroTransferencia(e.target.value)}
                  placeholder="Número de referencia" required disabled={!!consultaGuardada} />
              </div>
            )}

            {formaPago === 'tarjeta' && (
              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>
                  Número de Voucher{' '}
                  <span style={{ color: '#d97706', textTransform: 'none', fontWeight: 400 }}>(Opcional)</span>
                </label>
                <input type="text" style={S.input} value={numeroVoucher}
                  onChange={(e) => setNumeroVoucher(e.target.value)}
                  placeholder="Número de voucher" disabled={!!consultaGuardada} />
                {!numeroVoucher && <p style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>⚠️ Sin voucher — pendiente de agregar</p>}
              </div>
            )}

            <div>
              <label style={S.label}>Número de Factura</label>
              <input type="text" style={S.input} value={numeroFactura}
                onChange={(e) => setNumeroFactura(e.target.value)}
                placeholder="Número de factura" disabled={!!consultaGuardada} />
            </div>

            {formaPago === 'multiple' && pagosMultiples.length > 0 && (
              <div style={{ marginTop: 14, background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, color: '#7c3aed', fontSize: 13 }}>💳 Pagos Configurados</span>
                  <button onClick={() => setShowModalPagosMultiples(true)} style={{ fontSize: 12, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer' }} disabled={!!consultaGuardada}>Editar</button>
                </div>
                {pagosMultiples.map((pago, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                    <span style={{ textTransform: 'capitalize' }}>{pago.forma_pago.replace('_', ' ')}</span>
                    <span style={{ fontWeight: 600 }}>Q {pago.monto.toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #e9d5ff', paddingTop: 8, marginTop: 4, fontSize: 14, color: '#7c3aed' }}>
                  <span>Total</span>
                  <span>Q {pagosMultiples.reduce((sum, p) => sum + p.monto, 0).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Totales */}
          <div style={S.totalesCard}>
            <div style={S.totalesTitle}>
              <Activity size={14} />
              Resumen de Cobro
            </div>
            {[
              ['Sub-Total Estudios', totales.subTotal],
              ['Descuento', totales.descuento],
              ['Monto Gravable', totales.montoGravable],
              ['Impuesto', totales.impuesto],
            ].map(([label, val]) => (
              <div key={String(label)} style={S.totalesRow}>
                <span>{label}</span>
                <span style={{ fontWeight: 500 }}>Q {(val as number).toFixed(2)}</span>
              </div>
            ))}
            <div style={S.totalesTotal}>
              <span>Total Ventas</span>
              <span>Q {totales.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button style={S.btnClear} onClick={handleLimpiar}>🗑️ Limpiar todo</button>
            <button
              onClick={handleGuardar}
              style={btnSaveStyle(saveState)}
              disabled={!pacienteActual || descripcion.length === 0 || guardando || !!consultaGuardada}
            >
              {guardando ? '⏳ Guardando...' : consultaGuardada ? '✅ Consulta Guardada' : '💾 Guardar Consulta'}
            </button>
            <button
              onClick={handleImprimir}
              style={btnPrintStyle(!!consultaGuardada)}
              disabled={!consultaGuardada}
            >
              🖨️ Imprimir Recibo
            </button>
            {!consultaGuardada && pacienteActual && descripcion.length > 0 && (
              <p style={{ fontSize: 11, color: '#2563eb', textAlign: 'center', fontWeight: 500 }}>
                ℹ️ Primero debe guardar la consulta para imprimir
              </p>
            )}
            {consultaGuardada && (
              <p style={{ fontSize: 11, color: '#16a34a', textAlign: 'center', fontWeight: 500 }}>
                ✅ Consulta guardada — puede imprimir ahora
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL nuevo paciente ── */}
      <NuevoPacienteModal
        isOpen={showNuevoModal}
        onClose={() => setShowNuevoModal(false)}
        onSave={handleGuardarPaciente}
      />

      {/* ── MODAL pagos múltiples ── */}
      {showModalPagosMultiples && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,41,66,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '32px', maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f2942', margin: 0 }}>💳 Configurar Pagos Múltiples</h2>
              <button onClick={() => setShowModalPagosMultiples(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#6b7280', fontWeight: 700 }}>✕</button>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: '#1e40af', margin: 0 }}><strong>Total a pagar: Q {totales.total.toFixed(2)}</strong></p>
              <p style={{ fontSize: 12, color: '#3b82f6', marginTop: 4, marginBottom: 0 }}>La suma de todos los pagos debe coincidir con el total</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pagosMultiples.map((pago, index) => (
                <div key={index} style={{ border: '1.5px solid #e5e7eb', borderRadius: 14, padding: '16px 18px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontWeight: 600, color: '#0f2942' }}>Pago #{index + 1}</span>
                    {pagosMultiples.length > 1 && (
                      <button onClick={() => eliminarPago(index)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Eliminar</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={S.label}>Forma de Pago</label>
                      <select style={S.select} value={pago.forma_pago} onChange={(e) => actualizarPago(index, 'forma_pago', e.target.value)}>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="depositado">Depositado</option>
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Monto (Q)</label>
                      <input type="number" step="0.01" min="0" style={S.input} value={pago.monto}
                        onChange={(e) => actualizarPago(index, 'monto', parseFloat(e.target.value) || 0)} placeholder="0.00" />
                    </div>
                  </div>
                  {pago.forma_pago === 'transferencia' && (
                    <div style={{ marginTop: 12 }}>
                      <label style={S.label}>Número de Referencia *</label>
                      <input type="text" style={S.input} value={pago.numero_referencia || ''}
                        onChange={(e) => actualizarPago(index, 'numero_referencia', e.target.value)} placeholder="Número de transferencia" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={agregarPago} style={{ ...S.btnSecondary, width: '100%', justifyContent: 'center', marginTop: 16, padding: '11px' }}>
              <Plus size={16} /> Agregar Otro Pago
            </button>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                <span>Total configurado</span>
                <span style={{ color: Math.abs(pagosMultiples.reduce((sum, p) => sum + p.monto, 0) - totales.total) < 0.01 ? '#16a34a' : '#ef4444' }}>
                  Q {pagosMultiples.reduce((sum, p) => sum + p.monto, 0).toFixed(2)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => { setShowModalPagosMultiples(false); setFormaPago('efectivo'); setPagosMultiples([{ forma_pago: 'efectivo', monto: 0 }]); }}
                style={S.btnSecondary}>Cancelar</button>
              <button onClick={() => { if (validarPagosMultiples()) setShowModalPagosMultiples(false); }}
                style={S.btnPrimary}>Confirmar Pagos</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL tipo recibo ── */}
      {showModalTipoRecibo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,41,66,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, maxWidth: 420, width: '100%', padding: '36px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🖨️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f2942', marginBottom: 8 }}>¿Qué recibo desea imprimir?</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Seleccione el tipo de recibo que desea generar</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => imprimirReciboSeleccionado('completo')} style={{
                padding: '16px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff', fontWeight: 700, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
              }}>
                <span>📄 Recibo Completo</span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>con precios</span>
              </button>
              <button onClick={() => imprimirReciboSeleccionado('medico')} style={{
                padding: '16px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#fff', fontWeight: 700, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(5,150,105,0.3)',
              }}>
                <span>🩺 Orden para Médico</span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>sin precios</span>
              </button>
              <button onClick={() => { setShowModalTipoRecibo(false); setDatosReciboTemp(null); }} style={{
                padding: '13px', borderRadius: 12, border: '1.5px solid #e5e7eb',
                background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};