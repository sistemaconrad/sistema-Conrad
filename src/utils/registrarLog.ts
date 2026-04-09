/**
 * Helper centralizado para registrar actividad en log_actividad
 * Usado por GastosPage, CuadreDiarioPage, ProductosInventarioPage, etc.
 */
import { supabase } from '../lib/supabase';

const getFechaGuatemala = (): string => {
  const ahora = new Date();
  const gt = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
  const yyyy = gt.getFullYear();
  const mm = String(gt.getMonth() + 1).padStart(2, '0');
  const dd = String(gt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

interface LogParams {
  modulo: string;
  accion: 'crear' | 'editar' | 'eliminar' | 'guardar' | 'exportar';
  tipo_registro: string;
  descripcion: string;
  detalles?: Record<string, any>;
  registro_id?: string;
}

export const registrarLog = async (params: LogParams): Promise<void> => {
  try {
    const usuario      = localStorage.getItem('usernameConrad')      || 'desconocido';
    const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || 'desconocido';
    const rol          = localStorage.getItem('rolUsuarioConrad')     || 'usuario';

    await supabase.rpc('registrar_actividad', {
      p_usuario:              usuario,
      p_nombre_usuario:       nombreUsuario,
      p_rol:                  rol,
      p_modulo:               params.modulo,
      p_accion:               params.accion,
      p_tipo_registro:        params.tipo_registro,
      p_registro_id:          params.registro_id  || null,
      p_detalles:             { descripcion: params.descripcion, ...(params.detalles || {}) },
      p_fecha:                getFechaGuatemala(),
      p_requirio_autorizacion: false,
      p_token_usado:          null
    });
  } catch (e) {
    // El log nunca debe romper el flujo principal
    console.warn('registrarLog error:', e);
  }
};