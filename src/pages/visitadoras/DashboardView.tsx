import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, MapPin, Users, UserPlus, Stethoscope, Flame, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const fechaLocalGT = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

const inicioSemana = (offset = 0) => {
  const now = new Date();
  const gt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
  const dia = gt.getDay(); // 0=dom
  const lunes = new Date(gt);
  lunes.setDate(gt.getDate() - ((dia + 6) % 7) + offset * 7);
  lunes.setHours(0, 0, 0, 0);
  return lunes.toLocaleDateString('en-CA');
};

const finSemana = (offset = 0) => {
  const inicio = new Date(inicioSemana(offset) + 'T00:00:00');
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  return fin.toLocaleDateString('en-CA');
};

interface Visita {
  id: string;
  medico_nombre: string;
  visitadora_nombre: string;
  created_at: string;
}

interface Prospecto {
  id: string;
  nombre: string;
  activo: boolean;
  es_referente: boolean;
}

export const DashboardView: React.FC = () => {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [totalReferentes, setTotalReferentes] = useState(0);
  const [loading, setLoading] = useState(true);

  const rolUsuario = localStorage.getItem('rolUsuarioConrad');
  const nombreUsuario = localStorage.getItem('nombreUsuarioConrad') || '';
  const esVisitadora = rolUsuario === 'visitadora';

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    // Traer visitas del mes actual para cálculos
    const mesInicio = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
    const [{ data: vis }, { data: prosp }, { count: ref }] = await Promise.all([
      supabase.from('visitas_medicas').select('id,medico_nombre,visitadora_nombre,created_at')
        .gte('created_at', mesInicio + 'T06:00:00.000Z')
        .order('created_at', { ascending: false }),
      supabase.from('medicos').select('id,nombre,activo,es_referente').eq('activo', true),
      supabase.from('medicos').select('*', { count: 'exact', head: true }).eq('es_referente', true).eq('activo', true),
    ]);
    setVisitas(vis || []);
    setProspectos((prosp || []).filter(p => !p.es_referente));
    setTotalReferentes(ref || 0);
    setLoading(false);
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
    </div>
  );

  // Filtrar por visitadora si es rol visitadora
  const misVisitas = esVisitadora ? visitas.filter(v => v.visitadora_nombre === nombreUsuario) : visitas;

  // Esta semana vs semana pasada
  const semActInicio = inicioSemana(0);
  const semActFin    = finSemana(0);
  const semPasInicio = inicioSemana(-1);
  const semPasFin    = finSemana(-1);

  const visitasSemAct = misVisitas.filter(v => {
    const d = fechaLocalGT(v.created_at);
    return d >= semActInicio && d <= semActFin;
  }).length;

  const visitasSemPas = misVisitas.filter(v => {
    const d = fechaLocalGT(v.created_at);
    return d >= semPasInicio && d <= semPasFin;
  }).length;

  const visitasHoy = misVisitas.filter(v => fechaLocalGT(v.created_at) === hoy()).length;

  // Médico más visitado
  const conteoMedico: Record<string, number> = {};
  misVisitas.forEach(v => { conteoMedico[v.medico_nombre] = (conteoMedico[v.medico_nombre] || 0) + 1; });
  const medicoTop = Object.entries(conteoMedico).sort((a, b) => b[1] - a[1])[0];

  // Racha de días consecutivos
  const diasConVisita = new Set(misVisitas.map(v => fechaLocalGT(v.created_at)));
  let racha = 0;
  const checkDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
  while (true) {
    const d = checkDate.toLocaleDateString('en-CA');
    if (diasConVisita.has(d)) { racha++; checkDate.setDate(checkDate.getDate() - 1); }
    else break;
    if (racha > 60) break;
  }

  // % prospectos vs total médicos
  const totalMedicos = totalReferentes + prospectos.length;
  const pctConvertidos = totalMedicos > 0 ? Math.round((totalReferentes / totalMedicos) * 100) : 0;

  // Visitadoras top (solo admin)
  const conteoVisitadora: Record<string, number> = {};
  visitas.forEach(v => { conteoVisitadora[v.visitadora_nombre] = (conteoVisitadora[v.visitadora_nombre] || 0) + 1; });
  const rankingVisitadoras = Object.entries(conteoVisitadora).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Variación semana
  const delta = visitasSemAct - visitasSemPas;
  const pctDelta = visitasSemPas > 0 ? Math.round((delta / visitasSemPas) * 100) : visitasSemAct > 0 ? 100 : 0;

  return (
    <div className="space-y-6">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Visitas hoy */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-teal-100 rounded-xl p-2.5"><MapPin size={18} className="text-teal-600" /></div>
            <span className="text-xs font-bold text-gray-400 uppercase">Hoy</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{visitasHoy}</p>
          <p className="text-sm text-gray-500 mt-1">Visitas del día</p>
        </div>

        {/* Esta semana */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-blue-100 rounded-xl p-2.5"><TrendingUp size={18} className="text-blue-600" /></div>
            {delta !== 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                {delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {Math.abs(pctDelta)}%
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900">{visitasSemAct}</p>
          <p className="text-sm text-gray-500 mt-1">Esta semana</p>
          <p className="text-xs text-gray-400">vs {visitasSemPas} semana pasada</p>
        </div>

        {/* Racha */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-orange-100 rounded-xl p-2.5"><Flame size={18} className="text-orange-500" /></div>
            {racha >= 5 && <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">🔥 Racha</span>}
          </div>
          <p className="text-3xl font-bold text-gray-900">{racha}</p>
          <p className="text-sm text-gray-500 mt-1">Días consecutivos</p>
        </div>

        {/* % Convertidos */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-emerald-100 rounded-xl p-2.5"><Stethoscope size={18} className="text-emerald-600" /></div>
            <span className="text-xs font-bold text-gray-400">{totalReferentes} referentes</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{pctConvertidos}%</p>
          <p className="text-sm text-gray-500 mt-1">Prospectos convertidos</p>
          {/* Mini barra */}
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pctConvertidos}%` }} />
          </div>
        </div>
      </div>

      {/* Médico más visitado */}
      {medicoTop && (
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-3"><Award size={22} className="text-white" /></div>
            <div>
              <p className="text-pink-100 text-sm font-medium">⭐ Médico más visitado del mes</p>
              <p className="text-xl font-bold mt-0.5">{medicoTop[0]}</p>
              <p className="text-pink-200 text-sm">{medicoTop[1]} visita{medicoTop[1] > 1 ? 's' : ''} este mes</p>
            </div>
          </div>
        </div>
      )}

      {/* Ranking visitadoras — solo admin */}
      {!esVisitadora && rankingVisitadoras.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-teal-500" />
            <h3 className="font-bold text-gray-800">Ranking visitadoras — mes actual</h3>
          </div>
          <div className="space-y-3">
            {rankingVisitadoras.map(([nombre, count], i) => {
              const max = rankingVisitadoras[0][1];
              const pct = Math.round((count / max) * 100);
              const medals = ['🥇', '🥈', '🥉', '4°', '5°'];
              return (
                <div key={nombre}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <span>{medals[i]}</span> {nombre}
                    </span>
                    <span className="text-sm font-bold text-teal-600">{count} visitas</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${i === 0 ? 'bg-gradient-to-r from-pink-500 to-rose-500' : 'bg-pink-200'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visitas recientes */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-teal-500" /> Últimas visitas del mes
        </h3>
        {misVisitas.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <MapPin size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin visitas este mes</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {misVisitas.slice(0, 8).map(v => (
              <div key={v.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="bg-teal-50 rounded-lg p-2 shrink-0">
                  <Stethoscope size={13} className="text-teal-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{v.medico_nombre}</p>
                  {!esVisitadora && <p className="text-xs text-gray-400">{v.visitadora_nombre}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">
                    {new Date(v.created_at).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit' })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(v.created_at).toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
