import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, FolderPlus, Upload, Folder, FileText, File, 
  Download, Trash2, X, Plus, Search, Image, Table,
  ChevronRight, Home, Eye, Shield, Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { registrarLog } from '../utils/registrarLog';
import { AutorizacionModal } from '../components/AutorizacionModal';

interface DocumentosPageProps { onBack: () => void; }

const COLORES = [
  { id: 'blue',   label: 'Azul',     bg: 'bg-blue-500',    light: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200' },
  { id: 'emerald',label: 'Verde',    bg: 'bg-emerald-500', light: 'bg-emerald-50',text: 'text-emerald-600',border: 'border-emerald-200' },
  { id: 'violet', label: 'Violeta',  bg: 'bg-violet-500',  light: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
  { id: 'amber',  label: 'Naranja',  bg: 'bg-amber-500',   light: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-200' },
  { id: 'red',    label: 'Rojo',     bg: 'bg-red-500',     light: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-200' },
  { id: 'slate',  label: 'Gris',     bg: 'bg-slate-500',   light: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200' },
];

const getColor = (id: string) => COLORES.find(c => c.id === id) || COLORES[0];

const getFileIcon = (tipo: string) => {
  if (!tipo) return <File size={20} className="text-slate-400" />;
  if (tipo.includes('pdf'))   return <FileText size={20} className="text-red-500" />;
  if (tipo.includes('image')) return <Image size={20} className="text-purple-500" />;
  if (tipo.includes('sheet') || tipo.includes('excel') || tipo.includes('csv')) return <Table size={20} className="text-emerald-500" />;
  if (tipo.includes('word') || tipo.includes('document')) return <FileText size={20} className="text-blue-500" />;
  return <File size={20} className="text-slate-400" />;
};

const formatSize = (bytes: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const DocumentosPage: React.FC<DocumentosPageProps> = ({ onBack }) => {
  const [carpetas, setCarpetas] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [carpetaActual, setCarpetaActual] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  const [showNuevaCarpeta, setShowNuevaCarpeta] = useState(false);
  const [nombreCarpeta, setNombreCarpeta] = useState('');
  const [descCarpeta, setDescCarpeta] = useState('');
  const [colorCarpeta, setColorCarpeta] = useState('blue');

  const [showAutorizacion, setShowAutorizacion] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{tipo: 'carpeta'|'documento', id: string, nombre: string} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const usuario = localStorage.getItem('usernameConrad') || '';
  const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || '';
  const rol = localStorage.getItem('rolUsuarioConrad') || '';
  const esAdmin = rol === 'admin' || usuario === 'admin';

  useEffect(() => { cargarCarpetas(); }, []);
  useEffect(() => { if (carpetaActual) cargarDocumentos(carpetaActual.id); }, [carpetaActual]);

  const cargarCarpetas = async () => {
    setLoading(true);
    const { data } = await supabase.from('carpetas_documentos').select('*').order('nombre');
    setCarpetas(data || []);
    setLoading(false);
  };

  const cargarDocumentos = async (carpetaId: string) => {
    setLoading(true);
    const { data } = await supabase.from('documentos')
      .select('*').eq('carpeta_id', carpetaId).order('created_at', { ascending: false });
    setDocumentos(data || []);
    setLoading(false);
  };

  const crearCarpeta = async () => {
    if (!nombreCarpeta.trim()) { alert('Ingresa un nombre'); return; }
    const { error } = await supabase.from('carpetas_documentos').insert([{
      nombre: nombreCarpeta.trim(), descripcion: descCarpeta.trim() || null,
      color: colorCarpeta, created_by: nombreUsuario
    }]);
    if (error) { alert('Error: ' + error.message); return; }
    setShowNuevaCarpeta(false);
    setNombreCarpeta(''); setDescCarpeta(''); setColorCarpeta('blue');
    cargarCarpetas();
  };

  const subirArchivo = async (file: File) => {
    if (!carpetaActual) return;
    setSubiendo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${carpetaActual.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('documentos').insert([{
        carpeta_id: carpetaActual.id, nombre: file.name,
        storage_path: path, url: urlData.publicUrl,
        tipo_archivo: file.type, tamano: file.size,
        subido_por: usuario, nombre_usuario: nombreUsuario, rol_usuario: rol
      }]);
      if (dbErr) throw dbErr;
      cargarDocumentos(carpetaActual.id);
    } catch (e: any) { alert('Error al subir: ' + e.message); }
    setSubiendo(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    Array.from(files).forEach(subirArchivo);
    e.target.value = '';
  };

  const solicitarEliminar = (tipo: 'carpeta' | 'documento', id: string, nombre: string) => {
    setPendingDelete({ tipo, id, nombre });
    setShowAutorizacion(true);
  };

  const ejecutarEliminar = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.tipo === 'carpeta') {
        // Eliminar archivos del storage
        const { data: docs } = await supabase.from('documentos').select('storage_path').eq('carpeta_id', pendingDelete.id);
        if (docs?.length) {
          await supabase.storage.from('documentos').remove(docs.map(d => d.storage_path));
        }
        await supabase.from('carpetas_documentos').delete().eq('id', pendingDelete.id);
        await registrarLog({
          modulo: 'documentos',
          accion: 'eliminar',
          tipo_registro: 'carpeta',
          descripcion: `Carpeta eliminada: "${pendingDelete.nombre}"`,
          detalles: { nombre: pendingDelete.nombre, tipo: 'carpeta' }
        });
        setCarpetaActual(null);
        cargarCarpetas();
      } else {
        const { data: doc } = await supabase.from('documentos').select('storage_path').eq('id', pendingDelete.id).single();
        if (doc) await supabase.storage.from('documentos').remove([doc.storage_path]);
        await supabase.from('documentos').delete().eq('id', pendingDelete.id);
        await registrarLog({
          modulo: 'documentos',
          accion: 'eliminar',
          tipo_registro: 'documento',
          descripcion: `Documento eliminado: "${pendingDelete.nombre}"`,
          detalles: { nombre: pendingDelete.nombre, tipo: 'documento' }
        });
        cargarDocumentos(carpetaActual.id);
      }
    } catch (e: any) { alert('Error al eliminar: ' + e.message); }
    setPendingDelete(null);
  };

  const carpetasFiltradas = carpetas.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()));
  const docsFiltrados = documentos.filter(d => d.nombre.toLowerCase().includes(search.toLowerCase()));

  // ── VISTA CARPETAS ──
  const VistaCarpetas = () => (
    <div className="space-y-6">
      {/* Buscador + Nueva Carpeta */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Buscar carpeta..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
        </div>
        <button onClick={() => setShowNuevaCarpeta(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm shadow-indigo-200 transition-all hover:shadow-md">
          <FolderPlus size={15} /> Nueva Carpeta
        </button>
      </div>

      {/* Grid Carpetas */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent" /></div>
      ) : carpetasFiltradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <Folder size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-slate-500 font-semibold">No hay carpetas aún</p>
          <p className="text-slate-400 text-sm mt-1">Crea una carpeta para comenzar a organizar documentos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {carpetasFiltradas.map(c => {
            const col = getColor(c.color);
            return (
              <div key={c.id} className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer"
                onClick={() => { setCarpetaActual(c); setSearch(''); }}>
                <div className={`${col.bg} h-2`} />
                <div className="p-5">
                  <div className={`${col.light} rounded-2xl p-3 w-fit mb-3`}>
                    <Folder size={24} className={col.text} />
                  </div>
                  <p className="font-black text-slate-800 text-sm leading-tight">{c.nombre}</p>
                  {c.descripcion && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{c.descripcion}</p>}
                  <p className="text-xs text-slate-300 mt-2">Por {c.created_by || 'Sistema'}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); solicitarEliminar('carpeta', c.id, c.nombre); }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── VISTA DOCUMENTOS ──
  const VistaDocumentos = () => {
    const col = getColor(carpetaActual.color);
    return (
      <div className="space-y-5">
        {/* Header carpeta */}
        <div className={`${col.light} border ${col.border} rounded-2xl p-5 flex items-center justify-between`}>
          <div className="flex items-center gap-4">
            <div className={`${col.bg} rounded-2xl p-3`}>
              <Folder size={22} className="text-white" />
            </div>
            <div>
              <p className="font-black text-slate-800 text-lg">{carpetaActual.nombre}</p>
              {carpetaActual.descripcion && <p className="text-sm text-slate-500 mt-0.5">{carpetaActual.descripcion}</p>}
              <p className="text-xs text-slate-400 mt-1">{documentos.length} documento{documentos.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={subiendo}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all disabled:opacity-50">
              {subiendo ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Subiendo...</> : <><Upload size={15} />Subir Archivo</>}
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
          </div>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Buscar documento..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
        </div>

        {/* Lista documentos */}
        {loading ? (
          <div className="flex justify-center py-14"><div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent" /></div>
        ) : docsFiltrados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-14 text-center">
            <Upload size={40} className="mx-auto mb-3 text-slate-200" />
            <p className="text-slate-500 font-semibold">Esta carpeta está vacía</p>
            <p className="text-slate-400 text-sm mt-1">Sube archivos usando el botón de arriba</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Archivo','Subido por','Tamaño','Fecha','Acciones'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {docsFiltrados.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.tipo_archivo)}
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{doc.nombre}</p>
                          {doc.descripcion && <p className="text-xs text-slate-400">{doc.descripcion}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-slate-700">{doc.nombre_usuario || doc.subido_por}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${
                        doc.rol_usuario === 'admin' ? 'bg-red-50 text-red-600' :
                        doc.rol_usuario === 'doctor' ? 'bg-blue-50 text-blue-600' :
                        doc.rol_usuario === 'secretaria' ? 'bg-emerald-50 text-emerald-600' :
                        'bg-slate-50 text-slate-600'
                      }`}>{doc.rol_usuario}</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">{formatSize(doc.tamano)}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {new Date(doc.created_at).toLocaleDateString('es-GT')}<br/>
                      <span className="text-slate-300">{new Date(doc.created_at).toLocaleTimeString('es-GT', {hour:'2-digit',minute:'2-digit',hour12:true})}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Ver">
                          <Eye size={14} />
                        </a>
                        <a href={doc.url} download={doc.nombre}
                          className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors" title="Descargar">
                          <Download size={14} />
                        </a>
                        <button onClick={() => solicitarEliminar('documento', doc.id, doc.nombre)}
                          className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── HEADER ── */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%)'}}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-indigo-200 hover:text-white mb-5 text-sm font-medium transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Volver al Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                <Folder size={24} className="text-indigo-200" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Repositorio de Documentos</h1>
                <p className="text-indigo-300 text-sm mt-0.5">Almacenamiento compartido para todos los usuarios</p>
              </div>
            </div>
            {/* Stats */}
            <div className="hidden md:flex items-center gap-6">
              <div className="text-right">
                <p className="text-2xl font-black text-white">{carpetas.length}</p>
                <p className="text-xs text-indigo-300 uppercase tracking-wide">Carpetas</p>
              </div>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mt-5 text-sm">
            <button onClick={() => { setCarpetaActual(null); setSearch(''); }}
              className="flex items-center gap-1 text-indigo-300 hover:text-white transition-colors">
              <Home size={13} /> Inicio
            </button>
            {carpetaActual && (
              <>
                <ChevronRight size={13} className="text-indigo-500" />
                <span className="text-white font-bold">{carpetaActual.nombre}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {carpetaActual ? <VistaDocumentos /> : <VistaCarpetas />}
      </div>

      {/* ── Modal Nueva Carpeta ── */}
      {showNuevaCarpeta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
              style={{background:'linear-gradient(135deg,#1e1b4b,#312e81)'}}>
              <div className="flex items-center gap-3">
                <div className="bg-white/15 rounded-xl p-2"><FolderPlus size={16} className="text-white" /></div>
                <p className="text-white font-black text-sm">Nueva Carpeta</p>
              </div>
              <button onClick={() => setShowNuevaCarpeta(false)} className="text-indigo-200 hover:text-white p-1 rounded-lg hover:bg-white/10"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nombre *</label>
                <input type="text" value={nombreCarpeta} onChange={e => setNombreCarpeta(e.target.value)}
                  placeholder="Ej: Informes Médicos, Protocolos..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Descripción</label>
                <input type="text" value={descCarpeta} onChange={e => setDescCarpeta(e.target.value)}
                  placeholder="Descripción opcional..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORES.map(c => (
                    <button key={c.id} onClick={() => setColorCarpeta(c.id)}
                      className={`w-8 h-8 rounded-xl ${c.bg} transition-all ${colorCarpeta === c.id ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`} />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNuevaCarpeta(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-semibold">Cancelar</button>
                <button onClick={crearCarpeta}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-2.5 rounded-xl font-bold text-sm shadow-sm">
                  Crear Carpeta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Autorización ── */}
      {showAutorizacion && pendingDelete && (
        <AutorizacionModal
          accion={`Eliminar ${pendingDelete.tipo}`}
          detalles={`Se eliminará: "${pendingDelete.nombre}". Esta acción no se puede deshacer.`}
          onAutorizado={() => { setShowAutorizacion(false); ejecutarEliminar(); }}
          onCancelar={() => { setShowAutorizacion(false); setPendingDelete(null); }}
        />
      )}
    </div>
  );
};