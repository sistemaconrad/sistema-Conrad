import React, { useState, useEffect } from 'react';
import { X, Save, Download, FileText, Settings, ChevronDown, ChevronUp, Eye, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle,
  Table, TableRow, TableCell, WidthType, ShadingType,
  Header, Footer, PageNumber, TabStopType, TabStopPosition, LevelFormat
} from 'docx';

interface InformeMedicoModalProps {
  paciente: {
    id: string; consulta_id: string; nombre: string; edad: string;
    fecha: string; estudios: string[]; medico_referente: string;
  };
  onClose: () => void;
  onSaved: () => void;
}

const FIRMA_KEY = 'conrad_firma_medico';
const firmaDefecto = {
  nombre: 'Dra. Karen Mercedes Bolaños Granados',
  especialidad: 'Médico Radiólogo',
  colegiado: 'No. Colegiado 16,857',
  lugar: 'Chimaltenango'
};

export const InformeMedicoModal: React.FC<InformeMedicoModalProps> = ({ paciente, onClose, onSaved }) => {
  const [descripcion, setDescripcion] = useState('');
  const [impresion, setImpresion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [informeExistente, setInformeExistente] = useState<any>(null);
  const [mostrarConfigFirma, setMostrarConfigFirma] = useState(false);
  const [incluirFirma, setIncluirFirma] = useState(true);
  const [generandoWord, setGenerandoWord] = useState(false);
  const [firma, setFirma] = useState(() => {
    try { const s = localStorage.getItem(FIRMA_KEY); return s ? JSON.parse(s) : firmaDefecto; }
    catch { return firmaDefecto; }
  });

  useEffect(() => { cargarInforme(); }, []);

  const cargarInforme = async () => {
    try {
      const { data } = await supabase.from('informes_medicos').select('*').eq('consulta_id', paciente.consulta_id).single();
      if (data) { setInformeExistente(data); setDescripcion(data.contenido?.descripcion || ''); setImpresion(data.conclusion || ''); }
    } catch {}
    setLoading(false);
  };

  const obtenerTipoEstudio = (e: string) => {
    const up = (e || '').toUpperCase();
    if (up.includes('TAC') || up.includes('TOMOG')) return 'TAC';
    if (up.includes('RX') || up.includes('RAYO')) return 'RX';
    if (up.includes('USG') || up.includes('ULTRA')) return 'USG';
    if (up.includes('EKG') || up.includes('ELECTRO')) return 'EKG';
    if (up.includes('MAMO')) return 'MAMO';
    return 'GENERAL';
  };

  const guardarInforme = async () => {
    if (!descripcion || !impresion) { alert('⚠️ Por favor llena todos los campos obligatorios'); return; }
    setGuardando(true);
    try {
      const datos = {
        consulta_id: paciente.consulta_id, paciente_id: paciente.id,
        tipo_estudio: obtenerTipoEstudio(paciente.estudios[0]),
        nombre_estudio: paciente.estudios[0] || 'Estudio General',
        contenido: { descripcion }, conclusion: impresion, estado: 'borrador'
      };
      if (informeExistente) {
        await supabase.from('informes_medicos').update(datos).eq('id', informeExistente.id);
      } else {
        await supabase.from('informes_medicos').insert([datos]);
      }
      alert('✅ Informe guardado'); onSaved(); onClose();
    } catch (e: any) { alert('❌ Error: ' + e.message); }
    setGuardando(false);
  };

  // ─── GENERADOR WORD — UNA SOLA HOJA, MÁXIMA COMPRESIÓN ───────────────────
  const generarWord = async () => {
    setGenerandoWord(true);
    try {
      const gt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
      const fechaStr = gt.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });

      // Colores corporativos
      const AZUL = '1e3a8a';
      const AZUL_CLARO = 'EEF2FF';
      const GRIS = '6B7280';
      const NEGRO = '111827';

      const bordeCelda = { style: BorderStyle.SINGLE, size: 1, color: 'C7D2FE' };
      const bordes = { top: bordeCelda, bottom: bordeCelda, left: bordeCelda, right: bordeCelda };
      const sinBorde = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
      const sinBordes = { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde };

      // Helper: texto compacto
      const txt = (t: string, opts: any = {}) => new TextRun({ text: t, font: 'Calibri', size: 18, color: NEGRO, ...opts });
      const par = (children: any[], align = AlignmentType.LEFT, spacing = { before: 0, after: 60 }) =>
        new Paragraph({ children, alignment: align, spacing });

      // Fila de la tabla de datos del paciente
      const filaDato = (etiqueta: string, valor: string) => new TableRow({
        children: [
          new TableCell({
            borders: bordes, width: { size: 1800, type: WidthType.DXA },
            shading: { fill: AZUL_CLARO, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 120, right: 80 },
            children: [new Paragraph({ children: [txt(etiqueta, { bold: true, size: 17, color: AZUL })] })]
          }),
          new TableCell({
            borders: bordes, width: { size: 7560, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 120, right: 80 },
            children: [new Paragraph({ children: [txt(valor, { size: 17 })] })]
          })
        ]
      });

      // Texto descripción — convertir saltos de línea
      const lineasDescripcion = descripcion.split('\n').filter(l => l.trim());
      const lineasImpresion = impresion.split('\n').filter(l => l.trim());

      // Párrafos descripción — compactos
      const parrafosDesc = lineasDescripcion.map(linea =>
        new Paragraph({
          children: [txt(linea, { size: 19 })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 0, after: 80 }
        })
      );

      // Párrafos impresión
      const parrafosImp = lineasImpresion.map((linea, i) =>
        new Paragraph({
          numbering: { reference: 'diagnostico', level: 0 },
          children: [txt(linea, { size: 19 })],
          spacing: { before: 0, after: 60 }
        })
      );

      // Sección firma derecha alineada
      const secFirma = incluirFirma ? [
        new Paragraph({ children: [], spacing: { before: 200, after: 0 } }),
        new Paragraph({
          children: [
            new TextRun({ text: '\t', font: 'Calibri' }),
            txt('_'.repeat(35), { color: '9CA3AF', size: 18 })
          ],
          tabStops: [{ type: TabStopType.CENTER, position: TabStopPosition.MAX }],
          alignment: AlignmentType.RIGHT,
          spacing: { before: 0, after: 60 }
        }),
        new Paragraph({
          children: [txt(firma.nombre, { bold: true, size: 18 })],
          alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 40 }
        }),
        new Paragraph({
          children: [txt(firma.especialidad, { italics: true, size: 17, color: GRIS })],
          alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 40 }
        }),
        new Paragraph({
          children: [txt(firma.colegiado, { size: 17, color: GRIS })],
          alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 }
        }),
      ] : [
        new Paragraph({ children: [], spacing: { before: 280, after: 0 } }),
        new Paragraph({
          children: [txt('_'.repeat(35), { color: '9CA3AF', size: 18 })],
          alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 60 }
        }),
        new Paragraph({
          children: [txt('Nombre, firma y sello del médico', { italics: true, size: 16, color: GRIS })],
          alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 }
        }),
      ];

      const doc = new Document({
        numbering: {
          config: [{
            reference: 'diagnostico',
            levels: [{
              level: 0, format: LevelFormat.BULLET, text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 240 } }, run: { color: AZUL, font: 'Calibri', size: 19 } }
            }]
          }]
        },
        styles: {
          default: { document: { run: { font: 'Calibri', size: 19, color: NEGRO } } }
        },
        sections: [{
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              // Márgenes ajustados para caber en una hoja — top/bottom más pequeños
              margin: { top: 720, right: 1080, bottom: 720, left: 1080 }
            }
          },

          // ── ENCABEZADO ──────────────────────────────────────────────────
          headers: {
            default: new Header({
              children: [
                // Línea de color arriba del encabezado
                new Paragraph({
                  border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: AZUL, space: 6 } },
                  spacing: { before: 0, after: 100 },
                  children: [
                    txt('CENTRO DE DIAGNÓSTICO CONRAD', { bold: true, size: 24, color: AZUL }),
                    txt('    ·    ', { size: 20, color: 'C7D2FE' }),
                    txt(`${firma.lugar}, Guatemala`, { size: 18, color: GRIS }),
                    // Empujar a la derecha con espacio
                    new TextRun({ text: '       ', font: 'Calibri', size: 18 }),
                    txt('INFORME MÉDICO', { bold: true, size: 20, color: AZUL }),
                    txt('   ' + fechaStr, { size: 16, color: GRIS }),
                  ]
                }),
              ]
            })
          },

          // ── PIE DE PÁGINA ───────────────────────────────────────────────
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'C7D2FE', space: 4 } },
                  spacing: { before: 60, after: 0 },
                  alignment: AlignmentType.CENTER,
                  children: [
                    txt('Documento generado por Sistema Conrad  ·  Página ', { size: 14, color: 'C7D2FE' }),
                    new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 14, color: 'C7D2FE' }),
                  ]
                })
              ]
            })
          },

          children: [
            // ── BLOQUE: DATOS DEL PACIENTE ─────────────────────────────
            new Paragraph({
              children: [txt('DATOS DEL PACIENTE', { bold: true, size: 18, color: AZUL })],
              spacing: { before: 80, after: 80 }
            }),
            new Table({
              width: { size: 9360, type: WidthType.DXA },
              columnWidths: [1800, 7560],
              rows: [
                filaDato('Nombre:', paciente.nombre.toUpperCase()),
                filaDato('Edad:', paciente.edad),
                filaDato('Referente:', paciente.medico_referente !== 'SIN INFORMACIÓN'
                  ? `Dr/Dra. ${paciente.medico_referente.toUpperCase()}`
                  : 'SIN INFORMACIÓN'),
                filaDato('Estudio:', paciente.estudios.join(', ').toUpperCase()),
                filaDato('Fecha:', fechaStr),
              ]
            }),

            // Nota de cortesía
            new Paragraph({
              children: [
                txt('Estimado/a médico/a, agradecemos su referencia. A continuación presentamos los resultados del estudio realizado.',
                  { italics: true, size: 17, color: GRIS })
              ],
              spacing: { before: 120, after: 80 }
            }),

            // ── TÍTULO DEL ESTUDIO ────────────────────────────────────
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: AZUL, space: 4 } },
              spacing: { before: 60, after: 120 },
              children: [
                txt((paciente.estudios[0] || 'ESTUDIO MÉDICO').toUpperCase(), { bold: true, size: 24, color: NEGRO }),
              ]
            }),

            // ── DESCRIPCIÓN ──────────────────────────────────────────
            new Paragraph({
              children: [txt('DESCRIPCIÓN', { bold: true, size: 18, color: AZUL })],
              spacing: { before: 60, after: 80 }
            }),
            ...parrafosDesc,

            // ── IMPRESIÓN DIAGNÓSTICA ────────────────────────────────
            new Paragraph({
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E0E7FF', space: 6 } },
              children: [txt('IMPRESIÓN DIAGNÓSTICA', { bold: true, size: 18, color: AZUL })],
              spacing: { before: 120, after: 80 }
            }),
            ...parrafosImp,

            // ── FIRMA ────────────────────────────────────────────────
            ...secFirma,
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Informe_${paciente.nombre.replace(/\s+/g, '_')}_${(paciente.estudios[0] || 'estudio').replace(/\s+/g, '_')}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) { alert('❌ Error al generar Word: ' + e.message); }
    setGenerandoWord(false);
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-indigo-100 border-t-indigo-600 mx-auto" style={{ borderWidth: 3 }} />
        <p className="mt-3 text-gray-500 text-sm">Cargando informe...</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #4f46e5 100%)' }}
          className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 rounded-xl p-2">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {informeExistente ? 'Editar Informe' : 'Crear Informe Médico'}
              </h2>
              <p className="text-indigo-200 text-xs mt-0.5">{paciente.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Datos paciente — banda compacta */}
        <div className="bg-indigo-50/60 border-b border-indigo-100 px-6 py-3">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            {[
              { label: 'Paciente', value: paciente.nombre, bold: true },
              { label: 'Edad', value: paciente.edad },
              { label: 'Referente', value: paciente.medico_referente },
              { label: 'Estudio', value: paciente.estudios.join(', '), color: 'text-indigo-700 font-semibold' },
            ].map(d => (
              <div key={d.label}>
                <span className="text-gray-400 text-xs">{d.label}: </span>
                <span className={`${d.bold ? 'font-bold text-gray-900' : 'text-gray-700'} ${d.color || ''}`}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Descripción */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-5 rounded-full bg-indigo-600" />
              <label className="font-bold text-gray-800 text-sm">Descripción del estudio *</label>
            </div>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={9}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none leading-relaxed text-gray-700 placeholder-gray-300"
              placeholder="Describe detalladamente los hallazgos del estudio..." />
            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
              <Sparkles size={11} /> Los saltos de línea se respetan en el documento Word
            </p>
          </div>

          {/* Impresión Diagnóstica */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-5 rounded-full bg-violet-600" />
              <label className="font-bold text-gray-800 text-sm">Impresión Diagnóstica *</label>
            </div>
            <textarea value={impresion} onChange={e => setImpresion(e.target.value)} rows={5}
              className="w-full px-4 py-3 border border-violet-200 bg-violet-50/30 rounded-xl text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none leading-relaxed text-gray-700 placeholder-gray-300"
              placeholder={"- Hallazgo principal\n- Segundo hallazgo\n- Conclusión"} />
            <p className="text-xs text-gray-400 mt-1.5">Cada línea se convierte en un punto en el documento</p>
          </div>

          {/* Config firma — colapsable */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <button onClick={() => setMostrarConfigFirma(!mostrarConfigFirma)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2">
                <Settings size={15} className="text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">Firma del documento</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${incluirFirma ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                  {incluirFirma ? `${firma.nombre}` : 'Sin firma'}
                </span>
              </div>
              {mostrarConfigFirma ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
            </button>
            {mostrarConfigFirma && (
              <div className="p-4 space-y-4 border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={incluirFirma} onChange={e => setIncluirFirma(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-600" />
                  <span className="text-sm text-gray-700">Incluir firma en el documento</span>
                </label>
                {incluirFirma && (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Nombre del médico', key: 'nombre', placeholder: 'Dra. Karen Bolaños' },
                      { label: 'Especialidad', key: 'especialidad', placeholder: 'Médico Radiólogo' },
                      { label: 'No. Colegiado', key: 'colegiado', placeholder: 'No. Colegiado 16,857' },
                      { label: 'Ciudad', key: 'lugar', placeholder: 'Chimaltenango' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                        <input type="text" value={(firma as any)[f.key]}
                          onChange={e => setFirma({ ...firma, [f.key]: e.target.value })}
                          placeholder={f.placeholder}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { localStorage.setItem(FIRMA_KEY, JSON.stringify(firma)); alert('✅ Firma guardada'); setMostrarConfigFirma(false); }}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
                    💾 Guardar para siempre
                  </button>
                  <button onClick={() => setFirma(firmaDefecto)} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50">
                    Restaurar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
            Cancelar
          </button>
          <div className="flex gap-3">
            <button onClick={guardarInforme} disabled={guardando}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-50">
              <Save size={16} />
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={generarWord} disabled={generandoWord || !descripcion || !impresion}
              className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #1e3a8a, #4f46e5)' }}>
              <Download size={16} />
              {generandoWord ? 'Generando...' : 'Descargar Word'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};