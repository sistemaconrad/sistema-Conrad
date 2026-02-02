import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Calendar, DollarSign, Users, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface ComisionesPageProps {
  onBack: () => void;
}

interface MedicoComision {
  medico_id: string;
  medico_nombre: string;
  total_pacientes: number;
  comisiones_por_estudio: { [key: string]: number }; // Dinámico
  total_comision: number;
  pacientes: any[];
  seleccionado: boolean;
}

export const ComisionesPage: React.FC<ComisionesPageProps> = ({ onBack }) => {
  const [fechaInicio, setFechaInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [medicos, setMedicos] = useState<MedicoComision[]>([]);
  const [loading, setLoading] = useState(false);
  const [medicoExpandido, setMedicoExpandido] = useState<string | null>(null);

  useEffect(() => {
    calcularComisiones();
  }, [fechaInicio, fechaFin]);

  const calcularComisiones = async () => {
    setLoading(true);
    try {
      // Obtener todas las consultas del período con médico asignado
      const { data: consultas, error } = await supabase
        .from('consultas')
        .select(`
          *,
          pacientes(nombre, edad),
          medicos(id, nombre),
          detalle_consultas(
            precio,
            sub_estudios(
              nombre,
              estudios(
                id,
                nombre,
                porcentaje_comision
              )
            )
          )
        `)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .not('medico_id', 'is', null)
        .eq('sin_informacion_medico', false)
        .or('anulado.is.null,anulado.eq.false')
        .or('es_servicio_movil.is.null,es_servicio_movil.eq.false');

      if (error) throw error;

      // Agrupar por médico y calcular comisiones
      const medicoMap = new Map<string, MedicoComision>();

      consultas?.forEach(consulta => {
        // NO generar comisión si:
        // 1. tipo_cobro es 'social' o 'personalizado'
        // 2. forma_pago es 'estado_cuenta'
        // 3. es_servicio_movil es true
        if (consulta.tipo_cobro === 'social' || 
            consulta.tipo_cobro === 'personalizado' ||
            consulta.forma_pago === 'estado_cuenta' ||
            consulta.es_servicio_movil === true) {
          return; // Saltar esta consulta
        }

        const medicoId = consulta.medico_id;
        const medicoNombre = consulta.medicos?.nombre || 'Desconocido';

        if (!medicoMap.has(medicoId)) {
          medicoMap.set(medicoId, {
            medico_id: medicoId,
            medico_nombre: medicoNombre,
            total_pacientes: 0,
            comisiones_por_estudio: {}, // Dinámico
            total_comision: 0,
            pacientes: [],
            seleccionado: true
          });
        }

        const medico = medicoMap.get(medicoId)!;
        medico.total_pacientes++;

        // Calcular total de la consulta
        const totalConsulta = consulta.detalle_consultas?.reduce((sum, d) => sum + d.precio, 0) || 0;
        
        // Determinar el tipo de estudio y su porcentaje
        const primerDetalle = consulta.detalle_consultas?.[0];
        const estudioNombre = primerDetalle?.sub_estudios?.estudios?.nombre || 'Otros';
        const porcentaje = primerDetalle?.sub_estudios?.estudios?.porcentaje_comision || 0;
        
        // Calcular comisión sobre el TOTAL de la consulta
        const comisionTotal = totalConsulta * (porcentaje / 100);

        // Agregar a la categoría del estudio (dinámico)
        if (!medico.comisiones_por_estudio[estudioNombre]) {
          medico.comisiones_por_estudio[estudioNombre] = 0;
        }
        medico.comisiones_por_estudio[estudioNombre] += comisionTotal;

        medico.total_comision += comisionTotal;

        medico.pacientes.push({
          nombre: consulta.pacientes?.nombre,
          fecha: consulta.fecha,
          estudios: consulta.detalle_consultas
        });
      });

      setMedicos(Array.from(medicoMap.values()).sort((a, b) => 
        b.total_comision - a.total_comision
      ));
    } catch (error) {
      console.error('Error al calcular comisiones:', error);
      alert('Error al calcular comisiones');
    } finally {
      setLoading(false);
    }
  };

  const toggleSeleccion = (medicoId: string) => {
    setMedicos(medicos.map(m => 
      m.medico_id === medicoId ? { ...m, seleccionado: !m.seleccionado } : m
    ));
  };

  const exportarExcel = async () => {
    const medicosSeleccionados = medicos.filter(m => m.seleccionado);

    if (medicosSeleccionados.length === 0) {
      alert('Seleccione al menos un médico');
      return;
    }

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Comisiones');

    // Obtener todos los estudios únicos (dinámico)
    const estudiosUnicos = new Set<string>();
    medicosSeleccionados.forEach(m => {
      Object.keys(m.comisiones_por_estudio).forEach(estudio => {
        if (m.comisiones_por_estudio[estudio] > 0) {
          estudiosUnicos.add(estudio);
        }
      });
    });
    const estudiosArray = Array.from(estudiosUnicos).sort();

    // Título
    sheet.mergeCells('A1:' + String.fromCharCode(65 + estudiosArray.length + 1) + '1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REPORTE DE COMISIONES MÉDICAS';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E40AF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Período
    sheet.mergeCells('A2:' + String.fromCharCode(65 + estudiosArray.length + 1) + '2');
    const periodCell = sheet.getCell('A2');
    periodCell.value = `Período: ${format(new Date(fechaInicio), 'dd/MM/yyyy')} - ${format(new Date(fechaFin), 'dd/MM/yyyy')}`;
    periodCell.font = { name: 'Calibri', size: 12, bold: true };
    periodCell.alignment = { horizontal: 'center' };
    sheet.getRow(2).height = 20;

    sheet.getRow(3).height = 5;

    // Headers
    sheet.getRow(4).height = 25;
    const headers = ['Médico/Establecimiento', ...estudiosArray, 'TOTAL'];
    headers.forEach((header, idx) => {
      const cell = sheet.getCell(4, idx + 1);
      cell.value = header;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF4F46E5' } },
        bottom: { style: 'thin', color: { argb: 'FF4F46E5' } },
        left: { style: 'thin', color: { argb: 'FF4F46E5' } },
        right: { style: 'thin', color: { argb: 'FF4F46E5' } }
      };
    });

    // Datos
    let row = 5;
    let totalGeneral = 0;
    const totalesPorEstudio: { [key: string]: number } = {};

    medicosSeleccionados.forEach((medico, idx) => {
      sheet.getRow(row).height = 22;
      
      // Nombre del médico
      const nombreCell = sheet.getCell(row, 1);
      nombreCell.value = medico.medico_nombre;
      nombreCell.font = { name: 'Calibri', size: 11 };
      nombreCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF3F4F6' }
      };
      nombreCell.alignment = { vertical: 'middle' };

      // Comisiones por estudio (dinámico)
      estudiosArray.forEach((estudio, eIdx) => {
        const monto = medico.comisiones_por_estudio[estudio] || 0;
        const cell = sheet.getCell(row, eIdx + 2);
        cell.value = monto;
        cell.numFmt = '"Q"#,##0.00';
        cell.font = { name: 'Calibri', size: 11 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF3F4F6' }
        };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };

        // Sumar al total del estudio
        if (!totalesPorEstudio[estudio]) totalesPorEstudio[estudio] = 0;
        totalesPorEstudio[estudio] += monto;
      });

      // Total del médico
      const totalCell = sheet.getCell(row, estudiosArray.length + 2);
      totalCell.value = medico.total_comision;
      totalCell.numFmt = '"Q"#,##0.00';
      totalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF059669' } };
      totalCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF3F4F6' }
      };
      totalCell.alignment = { horizontal: 'right', vertical: 'middle' };

      totalGeneral += medico.total_comision;
      row++;
    });

    // Fila de totales
    row++;
    sheet.getRow(row).height = 28;
    
    const totalLabelCell = sheet.getCell(row, 1);
    totalLabelCell.value = 'TOTALES';
    totalLabelCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    totalLabelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }
    };
    totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Totales por estudio
    estudiosArray.forEach((estudio, idx) => {
      const cell = sheet.getCell(row, idx + 2);
      cell.value = totalesPorEstudio[estudio];
      cell.numFmt = '"Q"#,##0.00';
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }
      };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    // Total general
    const totalGeneralCell = sheet.getCell(row, estudiosArray.length + 2);
    totalGeneralCell.value = totalGeneral;
    totalGeneralCell.numFmt = '"Q"#,##0.00';
    totalGeneralCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    totalGeneralCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' }
    };
    totalGeneralCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Anchos de columna
    sheet.getColumn(1).width = 35;
    estudiosArray.forEach((_, idx) => {
      sheet.getColumn(idx + 2).width = 18;
    });
    sheet.getColumn(estudiosArray.length + 2).width = 18;

    // Descargar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Comisiones_${format(new Date(fechaInicio), 'yyyy-MM')}_CONRAD.xlsx`;
    a.click();
  };

  const totalComisionesSeleccionadas = medicos
    .filter(m => m.seleccionado)
    .reduce((sum, m) => sum + m.total_comision, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button 
            onClick={onBack} 
            className="text-white hover:text-purple-100 mb-4 flex items-center gap-2 transition-colors"
          >
            <ArrowLeft size={20} />
            Volver al Dashboard
          </button>
          <h1 className="text-3xl font-bold">Comisiones Médicas</h1>
          <p className="text-purple-100 mt-2">Cálculo de comisiones por referencias</p>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline mr-2" size={16} />
                Fecha Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline mr-2" size={16} />
                Fecha Fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-end gap-3">
              <button
                onClick={calcularComisiones}
                disabled={loading}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'Calculando...' : 'Actualizar'}
              </button>
              <button
                onClick={exportarExcel}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Download size={18} />
                Exportar Excel
              </button>
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Médicos Seleccionados</p>
                <p className="text-2xl font-bold text-gray-800">
                  {medicos.filter(m => m.seleccionado).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Comisiones</p>
                <p className="text-2xl font-bold text-green-600">
                  Q {totalComisionesSeleccionadas.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Pacientes</p>
                <p className="text-2xl font-bold text-blue-600">
                  {medicos.filter(m => m.seleccionado).reduce((sum, m) => sum + m.total_pacientes, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Médicos */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h2 className="text-lg font-bold text-gray-800">Médicos con Referencias</h2>
            <p className="text-sm text-gray-600">Seleccione los médicos que recibirán comisión</p>
          </div>

          <div className="divide-y">
            {medicos.map(medico => (
              <div key={medico.medico_id} className="p-6">
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={medico.seleccionado}
                    onChange={() => toggleSeleccion(medico.medico_id)}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">{medico.medico_nombre}</h3>
                    <p className="text-sm text-gray-600">
                      {medico.total_pacientes} pacientes referidos
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">
                      Q {medico.total_comision.toFixed(2)}
                    </p>
                    <button
                      onClick={() => setMedicoExpandido(
                        medicoExpandido === medico.medico_id ? null : medico.medico_id
                      )}
                      className="text-sm text-purple-600 hover:text-purple-800"
                    >
                      {medicoExpandido === medico.medico_id ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                  </div>
                </div>

                {/* Detalle expandido */}
                {medicoExpandido === medico.medico_id && (
                  <div className="mt-4 pl-9 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                      {Object.entries(medico.comisiones_por_estudio)
                        .filter(([_, monto]) => monto > 0)
                        .sort((a, b) => b[1] - a[1])
                        .map(([estudio, monto], idx) => {
                          const colores = [
                            'bg-blue-50 text-blue-700',
                            'bg-green-50 text-green-700',
                            'bg-purple-50 text-purple-700',
                            'bg-yellow-50 text-yellow-700',
                            'bg-orange-50 text-orange-700',
                            'bg-pink-50 text-pink-700',
                            'bg-indigo-50 text-indigo-700',
                            'bg-red-50 text-red-700'
                          ];
                          const colorClass = colores[idx % colores.length];
                          
                          return (
                            <div key={estudio} className={`${colorClass.split(' ')[0]} p-3 rounded`}>
                              <p className="text-gray-600 text-xs truncate" title={estudio}>{estudio}</p>
                              <p className={`font-bold ${colorClass.split(' ')[1]}`}>
                                Q {monto.toFixed(2)}
                              </p>
                            </div>
                          );
                        })}
                    </div>

                    <div className="mt-4">
                      <h4 className="font-semibold text-gray-700 mb-2">Pacientes:</h4>
                      <div className="bg-gray-50 rounded p-4 max-h-60 overflow-y-auto">
                        {medico.pacientes.map((p, idx) => (
                          <div key={idx} className="text-sm py-2 border-b last:border-0">
                            <p className="font-medium">{p.nombre}</p>
                            <p className="text-gray-600">{p.fecha}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {medicos.length === 0 && !loading && (
            <div className="p-12 text-center text-gray-500">
              No se encontraron médicos con referencias en este período
            </div>
          )}
        </div>
      </div>
    </div>
  );
};