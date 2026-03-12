import React, { useState, useRef } from 'react';
import { ArrowLeft, Upload, CheckCircle, AlertTriangle, Database, X, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface MedicoImport {
  nombre: string;
  clinica: string;
  especialidad: string;
  telefono: string;
  municipio: string;
  municipio_id: string;
  direccion: string;
  referencia: string;
  horario: string;
  especial: string;
  estado?: 'nuevo' | 'actualizado' | 'error' | 'pendiente';
  errorMsg?: string;
}

interface Props { onBack: () => void; }

const MUNICIPIO_MAP: Record<string, string> = {
  'CHIMALTENANGO': '4-1', 'CHIMALTENNAGO': '4-1', 'CHIMALTTENAGO': '4-1',
  'SAN JOSE POAQUIL': '4-2', 'SAN JOSÉ POAQUIL': '4-2',
  'SAN MARTIN JILOTEPEQUE': '4-3', 'SAN MARTÍN JILOTEPEQUE': '4-3',
  'COMALPA': '4-4', 'SAN JUAN COMALPA': '4-4',
  'SANTA APOLONIA': '4-5',
  'TECPAN': '4-6', 'TECPÁN': '4-6', 'TECPAN GUATEMALA': '4-6',
  'PATZUN': '4-7', 'PATZÚN': '4-7',
  'POCHUTA': '4-8',
  'PATZICIA': '4-9', 'PATZICÍA': '4-9',
  'SANTA CRUZ BALANYA': '4-10', 'SANTA CRUZ BALANYÁ': '4-10', 'BALANYA': '4-10',
  'ACATENANGO': '4-11',
  'YEPOCAPA': '4-12', 'YEPCAPA': '4-12',
  'SAN ANDRES ITZAPA': '4-13', 'SAN ANDRÉS ITZAPA': '4-13', 'ITZAPA': '4-13',
  'PARRAMOS': '4-14',
  'ZARAGOZA': '4-15',
  'EL TEJAR': '4-16',
};

const MUNICIPIO_NOMBRE: Record<string, string> = {
  '4-1': 'Chimaltenango', '4-2': 'San José Poaquil', '4-3': 'San Martín Jilotepeque',
  '4-4': 'Comalapa', '4-5': 'Santa Apolonia', '4-6': 'Tecpán', '4-7': 'Patzún',
  '4-8': 'Pochuta', '4-9': 'Patzicía', '4-10': 'Santa Cruz Balanyá', '4-11': 'Acatenango',
  '4-12': 'Yepocapa', '4-13': 'San Andrés Itzapa', '4-14': 'Parramos', '4-15': 'Zaragoza', '4-16': 'El Tejar',
};

function normalizarMunicipio(raw: string): { id: string; nombre: string } {
  const key = raw.toUpperCase().trim().replace(/\s+/g, ' ');
  const id = MUNICIPIO_MAP[key] || '4-1';
  return { id, nombre: MUNICIPIO_NOMBRE[id] || 'Chimaltenango' };
}

export const ImportarMedicosPage: React.FC<Props> = ({ onBack }) => {
  const [medicos, setMedicos] = useState<MedicoImport[]>([]);
  const [cargando, setCargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [paso, setPaso] = useState<'inicio' | 'preview' | 'resultado'>('inicio');
  const [detalle, setDetalle] = useState<MedicoImport | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const procesarExcel = async (file: File) => {
    setCargando(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const hoja = wb.Sheets['BASE DE DATOS ACTUALIZADA FEBRE'];
      if (!hoja) {
        alert('No se encontró la hoja "BASE DE DATOS ACTUALIZADA FEBRE".\nVerifica que sea el archivo correcto.');
        setCargando(false);
        return;
      }
      const rows = XLSX.utils.sheet_to_json<any[]>(hoja, { header: 1 });
      const lista: MedicoImport[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const nombre = row[0] ? String(row[0]).trim() : '';
        if (!nombre) continue;
        const municipioRaw = row[4] ? String(row[4]).trim() : '';
        const { id: municipio_id, nombre: municipioNombre } = normalizarMunicipio(municipioRaw);
        lista.push({
          nombre,
          clinica:      row[1] ? String(row[1]).trim() : '',
          especialidad: row[2] ? String(row[2]).trim() : '',
          telefono:     row[3] ? String(row[3]).trim() : '',
          municipio:    municipioNombre,
          municipio_id,
          direccion:    row[5] ? String(row[5]).trim() : '',
          referencia:   row[6] ? String(row[6]).trim() : '',
          horario:      row[7] ? String(row[7]).trim() : '',
          especial:     row[8] ? String(row[8]).trim() : '',
          estado: 'pendiente',
        });
      }
      setMedicos(lista);
      setPaso('preview');
    } catch (err: any) {
      alert('Error al leer el archivo: ' + (err?.message || err));
    }
    setCargando(false);
  };

  const ejecutarImport = async () => {
    setImportando(true);
    setProgreso(0);
    const { data: existentes } = await supabase.from('medicos').select('id, nombre');
    const mapaExistentes: Record<string, string> = {};
    (existentes || []).forEach((m: any) => { mapaExistentes[m.nombre.trim().toUpperCase()] = m.id; });
    const lista = [...medicos];
    let procesados = 0;
    for (const medico of lista) {
      try {
        const payload = {
          nombre:       medico.nombre,
          clinica:      medico.clinica || null,
          especialidad: medico.especialidad || null,
          telefono:     medico.telefono || '',
          departamento: '4',
          municipio:    medico.municipio_id,
          direccion:    medico.direccion || '',
          referencia:   medico.referencia || null,
          horario:      medico.horario || null,
          especial:     medico.especial || null,
          es_referente: true,
          activo:       true,
        };
        const existeId = mapaExistentes[medico.nombre.trim().toUpperCase()];
        if (existeId) {
          const { error } = await supabase.from('medicos').update(payload).eq('id', existeId);
          medico.estado = error ? 'error' : 'actualizado';
          if (error) medico.errorMsg = error.message;
        } else {
          const { error } = await supabase.from('medicos').insert([payload]);
          medico.estado = error ? 'error' : 'nuevo';
          if (error) medico.errorMsg = error.message;
        }
      } catch (err: any) {
        medico.estado = 'error';
        medico.errorMsg = err?.message || 'Error desconocido';
      }
      procesados++;
      setProgreso(Math.round((procesados / lista.length) * 100));
      if (procesados % 10 === 0) setMedicos([...lista]);
    }
    setMedicos([...lista]);
    setImportando(false);
    setPaso('resultado');
  };

  const stats = {
    total:        medicos.length,
    nuevos:       medicos.filter(m => m.estado === 'nuevo').length,
    actualizados: medicos.filter(m => m.estado === 'actualizado').length,
    errores:      medicos.filter(m => m.estado === 'error').length,
  };

  const medicosVista = medicos.filter(m =>
    !busqueda ||
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    m.municipio.toLowerCase().includes(busqueda.toLowerCase()) ||
    m.clinica.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
      <header style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1d4ed8 100%)' }} className="text-white shadow-xl">
        <div className="container mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={onBack} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-2 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-xl p-2 border border-white/20"><Database size={20} /></div>
            <div>
              <h1 className="text-xl font-black">Importar Médicos Referentes</h1>
              <p className="text-blue-200 text-xs">Todos los médicos se importan como referentes · es_referente = true</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">

        {/* PASO 1 */}
        {paso === 'inicio' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-black text-gray-900 mb-2">Sube tu base de datos de médicos</h2>
            <p className="text-gray-400 text-sm mb-6">Lee la hoja <strong>"BASE DE DATOS ACTUALIZADA FEBRE"</strong> y sube todos los médicos como referentes.</p>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex gap-3">
              <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-800">
                <strong>Todos los médicos se importan con es_referente = true.</strong> Si ya existe un médico con el mismo nombre, se actualizan sus datos. No se borra nada.
              </div>
            </div>

            <div onClick={() => !cargando && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all ${cargando ? 'border-blue-300 bg-blue-50/50' : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50/30'}`}>
              {cargando ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                  <p className="text-blue-600 font-bold">Leyendo Excel...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-blue-100 rounded-2xl p-5"><FileSpreadsheet size={32} className="text-blue-600" /></div>
                  <p className="font-black text-gray-800 text-lg">Selecciona el archivo Excel</p>
                  <p className="text-gray-400 text-sm">FEBRERO_2026.xlsx</p>
                  <span className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold mt-1">Abrir archivo</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => e.target.files?.[0] && procesarExcel(e.target.files[0])} />
            </div>
          </div>
        )}

        {/* PASO 2 */}
        {paso === 'preview' && (
          <div className="space-y-4">
            {/* Stat + botones */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 text-center">
                    <p className="text-2xl font-black text-blue-700">{stats.total}</p>
                    <p className="text-xs font-bold text-blue-400">MÉDICOS REFERENTES</p>
                  </div>
                  <p className="text-sm text-gray-400">Todos se importarán con <span className="text-emerald-600 font-bold">es_referente = true</span></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setMedicos([]); setPaso('inicio'); }}
                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl text-sm font-medium">
                    <ArrowLeft size={14} /> Cambiar archivo
                  </button>
                  <button onClick={ejecutarImport} disabled={importando}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-200">
                    {importando
                      ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />{progreso}% importando...</>
                      : <><Database size={15} /> Importar {stats.total} médicos</>}
                  </button>
                </div>
              </div>

              {importando && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Procesando...</span><span>{progreso}%</span></div>
                  <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-200" style={{ width: `${progreso}%` }} />
                  </div>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-blue-600 font-bold">Nuevos: {stats.nuevos}</span>
                    <span className="text-emerald-600 font-bold">Actualizados: {stats.actualizados}</span>
                    {stats.errores > 0 && <span className="text-red-500 font-bold">Errores: {stats.errores}</span>}
                  </div>
                </div>
              )}

              <div className="mt-3">
                <input type="text" placeholder="Buscar por nombre, municipio o clínica..."
                  value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 grid grid-cols-12 gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
                <span className="col-span-1">#</span>
                <span className="col-span-3">Nombre</span>
                <span className="col-span-2">Clínica</span>
                <span className="col-span-1">Municipio</span>
                <span className="col-span-1">Teléfono</span>
                <span className="col-span-2">Dirección / Referencia</span>
                <span className="col-span-1">Horario</span>
                <span className="col-span-1">Estado</span>
              </div>
              <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
                {medicosVista.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">Sin resultados</div>}
                {medicosVista.map((m, i) => (
                  <div key={i} onClick={() => setDetalle(m)}
                    className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-slate-50/60 transition-colors items-start cursor-pointer">
                    <span className="col-span-1 text-xs text-gray-300 font-mono pt-0.5">{i + 1}</span>
                    <div className="col-span-3 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.nombre}</p>
                      {m.especialidad && <p className="text-xs text-purple-500 truncate">{m.especialidad}</p>}
                    </div>
                    <div className="col-span-2 min-w-0">
                      <p className="text-xs text-gray-500 truncate">{m.clinica || '—'}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-xs text-gray-500 truncate">{m.municipio}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-xs text-gray-600 truncate">{m.telefono || '—'}</p>
                    </div>
                    <div className="col-span-2 min-w-0">
                      {m.direccion && <p className="text-xs text-gray-500 truncate">{m.direccion}</p>}
                      {m.referencia && <p className="text-xs text-blue-500 truncate">📍 {m.referencia}</p>}
                    </div>
                    <div className="col-span-1">
                      <p className="text-xs text-violet-600 truncate">{m.horario || '—'}</p>
                    </div>
                    <div className="col-span-1">
                      {m.estado === 'pendiente'   && <span className="text-xs text-gray-300">—</span>}
                      {m.estado === 'nuevo'       && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Nuevo</span>}
                      {m.estado === 'actualizado' && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">✓ OK</span>}
                      {m.estado === 'error'       && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold" title={m.errorMsg}>Error</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/80 text-xs text-gray-400">
                {medicosVista.length} de {stats.total} · Clic en fila para ver detalle
              </div>
            </div>
          </div>
        )}

        {/* PASO 3 */}
        {paso === 'resultado' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className={`rounded-xl p-2.5 ${stats.errores > 0 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                  {stats.errores > 0 ? <AlertTriangle size={22} className="text-amber-600" /> : <CheckCircle size={22} className="text-emerald-600" />}
                </div>
                <div>
                  <h2 className="font-black text-gray-900">{stats.errores > 0 ? 'Completado con algunos errores' : '¡Importación completada!'}</h2>
                  <p className="text-gray-400 text-sm">Médicos actualizados en Supabase</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                  <p className="text-3xl font-black text-blue-700">{stats.nuevos}</p>
                  <p className="text-xs font-bold text-blue-400 mt-1">NUEVOS</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                  <p className="text-3xl font-black text-emerald-700">{stats.actualizados}</p>
                  <p className="text-xs font-bold text-emerald-400 mt-1">ACTUALIZADOS</p>
                </div>
                <div className={`border rounded-xl p-4 text-center ${stats.errores > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                  <p className={`text-3xl font-black ${stats.errores > 0 ? 'text-red-600' : 'text-gray-300'}`}>{stats.errores}</p>
                  <p className={`text-xs font-bold mt-1 ${stats.errores > 0 ? 'text-red-400' : 'text-gray-300'}`}>ERRORES</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={onBack} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-200">
                  ✓ Volver al sistema
                </button>
                <button onClick={() => { setMedicos([]); setPaso('inicio'); setProgreso(0); setBusqueda(''); }}
                  className="flex items-center gap-2 px-4 py-3 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl text-sm font-medium">
                  <RefreshCw size={14} /> Nueva importación
                </button>
              </div>
            </div>

            {/* Lista resultado */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
              </div>
              <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                {medicosVista.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => setDetalle(m)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.nombre}</p>
                      <p className="text-xs text-gray-400">{m.municipio}</p>
                    </div>
                    <div className="shrink-0">
                      {m.estado === 'nuevo'        && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Nuevo</span>}
                      {m.estado === 'actualizado'  && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">✓ Actualizado</span>}
                      {m.estado === 'error'        && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold" title={m.errorMsg}>❌ Error</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <h3 className="font-black text-gray-900 text-sm pr-4 truncate">{detalle.nombre}</h3>
              <button onClick={() => setDetalle(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl shrink-0"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-2.5">
              {[
                { label: 'Clínica / Establecimiento', value: detalle.clinica },
                { label: 'Especialidad',  value: detalle.especialidad },
                { label: 'Teléfono',     value: detalle.telefono },
                { label: 'Municipio',    value: detalle.municipio },
                { label: 'Dirección',    value: detalle.direccion },
                { label: 'Referencia',   value: detalle.referencia },
                { label: 'Horario',      value: detalle.horario },
                { label: 'Especial',     value: detalle.especial },
              ].map(({ label, value }) => value ? (
                <div key={label} className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
                </div>
              ) : null)}
              {detalle.errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-red-500 font-medium">Error</p>
                  <p className="text-sm text-red-700 mt-0.5">{detalle.errorMsg}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};