import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

interface EstadisticasPageProps {
  onBack: () => void;
}

export const EstadisticasPage: React.FC<EstadisticasPageProps> = ({ onBack }) => {
  const [fechaInicio, setFechaInicio] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [estadisticas, setEstadisticas] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      // Consultas totales
      const { data: consultas, error: errorConsultas } = await supabase
        .from('consultas')
        .select(`
          *,
          pacientes(nombre, edad),
          detalle_consultas(precio)
        `)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin);

      if (errorConsultas) throw errorConsultas;

      // Calcular estadísticas
      const totalConsultas = consultas?.length || 0;
      const totalPacientes = new Set(consultas?.map(c => c.paciente_id)).size;
      const totalIngresos = consultas?.reduce((sum, c) => {
        const totalConsulta = c.detalle_consultas.reduce((s: number, d: any) => s + d.precio, 0);
        return sum + totalConsulta;
      }, 0) || 0;

      // Por tipo de cobro
      const porTipoCobro = consultas?.reduce((acc: any, c: any) => {
        acc[c.tipo_cobro] = (acc[c.tipo_cobro] || 0) + 1;
        return acc;
      }, {});

      // Por forma de pago
      const porFormaPago = consultas?.reduce((acc: any, c: any) => {
        acc[c.forma_pago] = (acc[c.forma_pago] || 0) + 1;
        return acc;
      }, {});

      // Estudios más realizados
      const todosDetalles = consultas?.flatMap(c => c.detalle_consultas) || [];
      
      const { data: subEstudios } = await supabase
        .from('sub_estudios')
        .select('id, nombre');

      const estudiosCount = todosDetalles.reduce((acc: any, d: any) => {
        acc[d.sub_estudio_id] = (acc[d.sub_estudio_id] || 0) + 1;
        return acc;
      }, {});

      const estudiosTop = Object.entries(estudiosCount)
        .map(([id, count]) => ({
          nombre: subEstudios?.find(s => s.id === id)?.nombre || 'Desconocido',
          cantidad: count
        }))
        .sort((a: any, b: any) => b.cantidad - a.cantidad)
        .slice(0, 10);

      setEstadisticas({
        totalConsultas,
        totalPacientes,
        totalIngresos,
        porTipoCobro,
        porFormaPago,
        estudiosTop,
        promedioConsulta: totalConsultas > 0 ? totalIngresos / totalConsultas : 0
      });

    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      alert('Error al cargar estadísticas');
    }
    setLoading(false);
  };

  const exportarDatos = async () => {
    try {
      const { data } = await supabase
        .from('consultas')
        .select(`
          *,
          pacientes(*),
          medicos(*),
          detalle_consultas(*, sub_estudios(*))
        `)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin);

      // Convertir a CSV
      const csv = convertirACSV(data || []);
      
      // Descargar
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estadisticas_${fechaInicio}_${fechaFin}.csv`;
      a.click();
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('Error al exportar datos');
    }
  };

  const convertirACSV = (data: any[]) => {
    const headers = [
      'Fecha',
      'Paciente',
      'Edad Paciente',
      'Médico',
      'Tipo Cobro',
      'Forma Pago',
      'Estudios',
      'Total'
    ].join(',');

    const rows = data.map(c => {
      const estudios = c.detalle_consultas.map((d: any) => d.sub_estudios.nombre).join('; ');
      const total = c.detalle_consultas.reduce((s: number, d: any) => s + d.precio, 0);
      
      return [
        c.fecha,
        c.pacientes.nombre,
        c.pacientes.edad,
        c.medicos?.nombre || 'Sin info',
        c.tipo_cobro,
        c.forma_pago,
        `"${estudios}"`,
        total
      ].join(',');
    });

    return [headers, ...rows].join('\n');
  };

  const getTipoCobro = (tipo: string) => {
    const tipos: any = { normal: 'Normal', social: 'Social', especial: 'Especial' };
    return tipos[tipo] || tipo;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white p-4 shadow-lg">
        <div className="container mx-auto flex items-center gap-4">
          <button onClick={onBack} className="hover:bg-blue-600 p-2 rounded">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold">Estadísticas</h1>
        </div>
      </header>

      <div className="container mx-auto p-4">
        {/* Filtros */}
        <div className="card mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label">Fecha Inicio</label>
              <input
                type="date"
                className="input-field"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Fecha Fin</label>
              <input
                type="date"
                className="input-field"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
            <button onClick={cargarEstadisticas} className="btn-primary">
              Generar Reporte
            </button>
            <button onClick={exportarDatos} className="btn-secondary flex items-center gap-2">
              <Download size={18} />
              Exportar CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-lg text-gray-600">Cargando estadísticas...</p>
          </div>
        ) : estadisticas ? (
          <>
            {/* Resumen general */}
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <div className="card bg-blue-50">
                <p className="text-sm text-gray-600 mb-1">Total Consultas</p>
                <p className="text-3xl font-bold text-blue-700">{estadisticas.totalConsultas}</p>
              </div>
              
              <div className="card bg-green-50">
                <p className="text-sm text-gray-600 mb-1">Total Pacientes</p>
                <p className="text-3xl font-bold text-green-700">{estadisticas.totalPacientes}</p>
              </div>
              
              <div className="card bg-purple-50">
                <p className="text-sm text-gray-600 mb-1">Ingresos Totales</p>
                <p className="text-3xl font-bold text-purple-700">Q {estadisticas.totalIngresos.toFixed(2)}</p>
              </div>
              
              <div className="card bg-orange-50">
                <p className="text-sm text-gray-600 mb-1">Promedio por Consulta</p>
                <p className="text-3xl font-bold text-orange-700">Q {estadisticas.promedioConsulta.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Por tipo de cobro */}
              <div className="card">
                <h3 className="text-lg font-bold mb-4">Consultas por Tipo de Cobro</h3>
                <div className="space-y-2">
                  {Object.entries(estadisticas.porTipoCobro).map(([tipo, cantidad]: any) => (
                    <div key={tipo} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium">{getTipoCobro(tipo)}</span>
                      <span className="text-blue-700 font-bold">{cantidad}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Por forma de pago */}
              <div className="card">
                <h3 className="text-lg font-bold mb-4">Consultas por Forma de Pago</h3>
                <div className="space-y-2">
                  {Object.entries(estadisticas.porFormaPago).map(([forma, cantidad]: any) => (
                    <div key={forma} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium capitalize">{forma.replace(/_/g, ' ')}</span>
                      <span className="text-green-700 font-bold">{cantidad}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estudios más realizados */}
              <div className="card md:col-span-2">
                <h3 className="text-lg font-bold mb-4">Top 10 Estudios Más Realizados</h3>
                <div className="space-y-2">
                  {estadisticas.estudiosTop.map((estudio: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-gray-400">#{index + 1}</span>
                        <span className="font-medium">{estudio.nombre}</span>
                      </div>
                      <span className="text-purple-700 font-bold">{estudio.cantidad} veces</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Selecciona un rango de fechas y genera el reporte</p>
          </div>
        )}
      </div>
    </div>
  );
};
