import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy, Plus, Flag, Zap, X, Timer, Crown, Flame, Users, Trash2,
  AlertCircle, Check, ChevronDown, Edit3, Medal,
} from 'lucide-react';

// ======================================================
// F1 25 PIT WALL — Lap Times + Championship League
// ======================================================

const TRACKS = [
  { name: 'Australia',     flag: '🇦🇺', circuit: 'Albert Park',        short: 'AUS' },
  { name: 'China',         flag: '🇨🇳', circuit: 'Shanghai',            short: 'CHN' },
  { name: 'Japan',         flag: '🇯🇵', circuit: 'Suzuka',              short: 'JPN' },
  { name: 'Bahrain',       flag: '🇧🇭', circuit: 'Sakhir',              short: 'BHR' },
  { name: 'Saudi',         flag: '🇸🇦', circuit: 'Jeddah',              short: 'KSA' },
  { name: 'Miami',         flag: '🇺🇸', circuit: 'Miami',               short: 'MIA' },
  { name: 'Imola',         flag: '🇮🇹', circuit: 'Imola',               short: 'IMO' },
  { name: 'Monaco',        flag: '🇲🇨', circuit: 'Monaco',              short: 'MON' },
  { name: 'Spain',         flag: '🇪🇸', circuit: 'Barcelona',           short: 'ESP' },
  { name: 'Canada',        flag: '🇨🇦', circuit: 'Montréal',            short: 'CAN' },
  { name: 'Austria',       flag: '🇦🇹', circuit: 'Red Bull Ring',       short: 'AUT' },
  { name: 'Great Britain', flag: '🇬🇧', circuit: 'Silverstone',         short: 'GBR' },
  { name: 'Belgium',       flag: '🇧🇪', circuit: 'Spa-Francorchamps',   short: 'BEL' },
  { name: 'Hungary',       flag: '🇭🇺', circuit: 'Hungaroring',         short: 'HUN' },
  { name: 'Netherlands',   flag: '🇳🇱', circuit: 'Zandvoort',           short: 'NED' },
  { name: 'Monza',         flag: '🇮🇹', circuit: 'Monza',               short: 'ITA' },
  { name: 'Azerbaijan',    flag: '🇦🇿', circuit: 'Baku City',           short: 'AZE' },
  { name: 'Singapore',     flag: '🇸🇬', circuit: 'Marina Bay',          short: 'SGP' },
  { name: 'Texas',         flag: '🇺🇸', circuit: 'COTA',                short: 'USA' },
  { name: 'Mexico',        flag: '🇲🇽', circuit: 'Mexico City',         short: 'MEX' },
  { name: 'Brazil',        flag: '🇧🇷', circuit: 'Interlagos',          short: 'BRA' },
  { name: 'Las Vegas',     flag: '🇺🇸', circuit: 'Las Vegas Strip',     short: 'LAS' },
  { name: 'Qatar',         flag: '🇶🇦', circuit: 'Lusail',              short: 'QAT' },
  { name: 'Abu Dhabi',     flag: '🇦🇪', circuit: 'Yas Marina',          short: 'UAE' },
];

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const FL_BONUS = 1;

const DRIVER_COLORS = [
  '#E10600', '#00D2BE', '#FFC700', '#0090FF', '#FF87BC',
  '#52E252', '#B6BABD', '#6692FF', '#F58020', '#C41E3A',
];

// NOTE: Initial seed data (drivers + 18 lap times) lives in
// netlify/functions/pitwall.js as INITIAL_STATE. The function serves it on
// first load when the Blobs store is empty.

// Palette — brighter, higher contrast
const C = {
  text:       '#ffffff',
  textDim:    '#cfcfcf',
  textSubtle: '#9a9a9a',
  textMuted:  '#7a7a7a',
  border:     '#2a2a2a',
  borderDim:  '#1f1f1f',
  surface:    '#0f0f0f',
  surface2:   '#0a0a0a',
  surfaceDeep:'#050505',
  red:        '#E10600',
  gold:       '#FFC700',
  silver:     '#D0D0D0',
  bronze:     '#CD7F32',
};

// ======================================================
// UTILITIES
// ======================================================

function parseTimeInput(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d+)[.:](\d{1,2})[.:](\d{1,3})$/);
  if (!m) return null;
  const mi = +m[1], si = +m[2], msi = +m[3].padEnd(3, '0');
  if (si >= 60 || msi >= 1000) return null;
  return mi * 60000 + si * 1000 + msi;
}

function formatTime(ms) {
  if (ms == null || !isFinite(ms)) return '—';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(mm).padStart(3, '0')}`;
}

function formatGap(ms) {
  if (!ms || ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(ms % 1000);
  return `+${s}.${String(mm).padStart(3, '0')}`;
}

function formatDateDMY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(-2)}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function uid(prefix = 'x') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function getTrack(name) {
  return TRACKS.find(t => t.name === name) ||
    { name, flag: '🏁', circuit: name, short: name.slice(0, 3).toUpperCase() };
}

// Storage layer — backed by a Netlify Function + Netlify Blobs.
// Same state is shared by everyone hitting the site.
// localStorage is used purely as an offline-fallback cache.

const API_URL = '/api/pitwall';
const CACHE_KEY = 'pitwall:cache';

async function apiLoad() {
  const res = await fetch(API_URL, { method: 'GET' });
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  return await res.json();
}

async function apiSave(state) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Save failed: ${res.status} ${body}`);
  }
  return await res.json();
}

function cacheSave(state) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch {}
}
function cacheLoad() {
  try {
    const v = localStorage.getItem(CACHE_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

// ======================================================
// MAIN APP
// ======================================================

export default function F1PitWall() {
  const [drivers, setDrivers] = useState([]);
  const [laps, setLaps] = useState([]);
  const [races, setRaces] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [currentSeasonId, setCurrentSeasonId] = useState(null);
  const [tab, setTab] = useState('standings');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  // 'idle' | 'saving' | 'saved' | 'error' | 'offline'
  const [saveStatus, setSaveStatus] = useState('idle');

  // A ref that always holds the latest state. Used by persist() to avoid stale
  // closure bugs when multiple mutations happen before React re-renders.
  const stateRef = useRef({ drivers: [], laps: [], races: [], seasons: [], currentSeasonId: null });

  useEffect(() => {
    stateRef.current = { drivers, laps, races, seasons, currentSeasonId };
  }, [drivers, laps, races, seasons, currentSeasonId]);

  // Apply a freshly-loaded or freshly-received state object to React
  const applyFullState = (state) => {
    setDrivers(state.drivers || []);
    setLaps(state.laps || []);
    setRaces(state.races || []);
    setSeasons(state.seasons || []);
    setCurrentSeasonId(state.currentSeasonId || (state.seasons?.[0]?.id ?? null));
    stateRef.current = {
      drivers: state.drivers || [],
      laps: state.laps || [],
      races: state.races || [],
      seasons: state.seasons || [],
      currentSeasonId: state.currentSeasonId || (state.seasons?.[0]?.id ?? null),
    };
  };

  // Initial load: try API first, fall back to cache if we're offline
  useEffect(() => {
    (async () => {
      // Hydrate instantly from cache while we fetch the real thing
      const cached = cacheLoad();
      if (cached) applyFullState(cached);

      try {
        const fresh = await apiLoad();
        applyFullState(fresh);
        cacheSave(fresh);
        setSaveStatus('saved');
      } catch (e) {
        console.error('Load failed', e);
        if (cached) {
          setSaveStatus('offline');
        } else {
          setSaveStatus('error');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // persist(patch) — merges patch into current state, updates React, saves to API.
  // Optimistic: UI updates immediately, save happens in the background.
  const persist = async (patch) => {
    const next = { ...stateRef.current, ...patch };
    // Update React state from the patch
    if ('drivers' in patch)         setDrivers(next.drivers);
    if ('laps' in patch)            setLaps(next.laps);
    if ('races' in patch)           setRaces(next.races);
    if ('seasons' in patch)         setSeasons(next.seasons);
    if ('currentSeasonId' in patch) setCurrentSeasonId(next.currentSeasonId);
    stateRef.current = next;
    cacheSave(next);

    setSaveStatus('saving');
    try {
      await apiSave(next);
      setSaveStatus('saved');
    } catch (e) {
      console.error('Save failed', e);
      setSaveStatus('error');
    }
  };

  const driversById = useMemo(() => Object.fromEntries(drivers.map(d => [d.id, d])), [drivers]);
  const seasonsById = useMemo(() => Object.fromEntries(seasons.map(s => [s.id, s])), [seasons]);

  const seasonLaps = useMemo(() => laps.filter(l => l.seasonId === currentSeasonId), [laps, currentSeasonId]);
  const seasonRaces = useMemo(() => races.filter(r => r.seasonId === currentSeasonId), [races, currentSeasonId]);

  const standings = useMemo(() => {
    const s = Object.fromEntries(drivers.map(d => [d.id, {
      driver: d, racePoints: 0, flPoints: 0, wins: 0, podiums: 0, fastestLaps: 0, starts: 0,
    }]));
    for (const race of seasonRaces) {
      for (const r of race.results || []) {
        if (!s[r.driverId]) continue;
        s[r.driverId].starts += 1;
        if (r.position && r.position >= 1 && r.position <= POINTS.length) {
          s[r.driverId].racePoints += POINTS[r.position - 1];
        }
        if (r.position === 1) s[r.driverId].wins += 1;
        if (r.position && r.position <= 3) s[r.driverId].podiums += 1;
        if (r.fastestLap) { s[r.driverId].flPoints += FL_BONUS; s[r.driverId].fastestLaps += 1; }
      }
    }
    return Object.values(s)
      .map(x => ({ ...x, total: x.racePoints + x.flPoints }))
      .sort((a, b) => b.total - a.total || b.wins - a.wins || b.podiums - a.podiums);
  }, [drivers, seasonRaces]);

  // Track records: #1 per track (all-time)
  const trackRecords = useMemo(() => {
    const best = {};
    for (const lap of laps) {
      if (!best[lap.trackName] || lap.timeMs < best[lap.trackName].timeMs) best[lap.trackName] = lap;
    }
    return best;
  }, [laps]);

  // Handlers — all go through persist() which updates state and saves to API
  const addLap = async ({ trackName, driverId, timeMs, dateStr }) => {
    const lap = { id: uid('l'), trackName, driverId, timeMs, dateStr, seasonId: currentSeasonId, createdAt: Date.now() };
    await persist({ laps: [...laps, lap] });
  };

  const deleteLap = async (id) => {
    await persist({ laps: laps.filter(l => l.id !== id) });
  };

  // Race submission — also creates lap entries for any driver with a time filled in
  const addRace = async ({ trackName, dateStr, results }) => {
    const raceResults = results.map(r => ({ driverId: r.driverId, position: r.position, fastestLap: r.fastestLap }));
    const newRace = { id: uid('r'), trackName, dateStr, results: raceResults, seasonId: currentSeasonId, createdAt: Date.now() };
    const newLaps = [...laps];
    results.forEach((r, i) => {
      if (r.timeMs) {
        newLaps.push({
          id: uid('l'),
          trackName, driverId: r.driverId, timeMs: r.timeMs, dateStr,
          seasonId: currentSeasonId,
          createdAt: Date.now() + i,
        });
      }
    });
    await persist({ races: [...races, newRace], laps: newLaps });
  };

  const deleteRace = async (id) => {
    await persist({ races: races.filter(r => r.id !== id) });
  };

  const addDriver = async ({ name, color }) => {
    await persist({ drivers: [...drivers, { id: uid('d'), name, color, createdAt: Date.now() }] });
  };

  const deleteDriver = async (id) => {
    await persist({ drivers: drivers.filter(d => d.id !== id) });
  };

  const addSeason = async ({ name }) => {
    const s = { id: uid('s'), name, createdAt: Date.now() };
    await persist({ seasons: [...seasons, s], currentSeasonId: s.id });
  };

  const renameSeason = async (id, name) => {
    await persist({ seasons: seasons.map(s => s.id === id ? { ...s, name } : s) });
  };

  const switchSeason = async (id) => {
    await persist({ currentSeasonId: id });
  };

  const deleteSeason = async (id) => {
    if (seasons.length <= 1) return;
    const nextSeasons = seasons.filter(s => s.id !== id);
    const fallback = nextSeasons[0].id;
    const newLaps = laps.map(l => l.seasonId === id ? { ...l, seasonId: fallback } : l);
    const newRaces = races.map(r => r.seasonId === id ? { ...r, seasonId: fallback } : r);
    await persist({
      seasons: nextSeasons,
      laps: newLaps,
      races: newRaces,
      currentSeasonId: currentSeasonId === id ? fallback : currentSeasonId,
    });
  };

  // Pull fresh state from server (useful after someone else adds a lap)
  const refresh = async () => {
    setSaveStatus('saving');
    try {
      const fresh = await apiLoad();
      applyFullState(fresh);
      cacheSave(fresh);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
    }
  };

  if (loading) return <LoadingScreen />;

  const currentSeason = seasons.find(s => s.id === currentSeasonId);

  return (
    <div
      className="min-h-screen relative"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, #1a0606 0%, #0a0a0a 45%, #050505 100%)',
        color: C.text,
        fontFamily: "'Titillium Web', 'Rajdhani', system-ui, sans-serif",
      }}
    >
      <FontLoader />
      <BackgroundAtmosphere />

      <Header
        tab={tab} setTab={setTab}
        seasons={seasons} currentSeason={currentSeason}
        onSwitchSeason={switchSeason}
        onNewSeason={() => setModal({ type: 'addSeason' })}
        onManageSeasons={() => setModal({ type: 'manageSeasons' })}
        saveStatus={saveStatus}
        onRefresh={refresh}
      />

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 pb-40 pt-2">
        {tab === 'standings' && (
          <StandingsView
            standings={standings} races={seasonRaces} drivers={drivers}
            currentSeason={currentSeason} setModal={setModal}
          />
        )}
        {tab === 'records' && (
          <TrackRecordsView
            records={trackRecords} driversById={driversById} laps={laps}
            seasons={seasons} seasonsById={seasonsById}
            setModal={setModal}
          />
        )}
        {tab === 'laps' && (
          <LapsView
            laps={laps} driversById={driversById} drivers={drivers}
            seasons={seasons} currentSeasonId={currentSeasonId}
            onDelete={deleteLap} setModal={setModal}
          />
        )}
        {tab === 'races' && (
          <RacesView
            races={seasonRaces} driversById={driversById}
            currentSeason={currentSeason}
            onDelete={deleteRace} setModal={setModal}
          />
        )}
        {tab === 'drivers' && (
          <DriversView
            drivers={drivers} standings={standings} laps={seasonLaps}
            onDelete={deleteDriver} setModal={setModal}
          />
        )}
      </main>

      <FAB setModal={setModal} tab={tab} />

      {modal?.type === 'addLap' && (
        <AddLapModal drivers={drivers} onClose={() => setModal(null)}
          onSubmit={async (d) => { await addLap(d); setModal(null); }} />
      )}
      {modal?.type === 'addRace' && (
        <AddRaceModal drivers={drivers} onClose={() => setModal(null)}
          onSubmit={async (d) => { await addRace(d); setModal(null); }} />
      )}
      {modal?.type === 'addDriver' && (
        <AddDriverModal existing={drivers} onClose={() => setModal(null)}
          onSubmit={async (d) => { await addDriver(d); setModal(null); }} />
      )}
      {modal?.type === 'addSeason' && (
        <AddSeasonModal existing={seasons} onClose={() => setModal(null)}
          onSubmit={async (d) => { await addSeason(d); setModal(null); }} />
      )}
      {modal?.type === 'manageSeasons' && (
        <ManageSeasonsModal
          seasons={seasons} currentSeasonId={currentSeasonId}
          racesCount={(sid) => races.filter(r => r.seasonId === sid).length}
          lapsCount={(sid) => laps.filter(l => l.seasonId === sid).length}
          onClose={() => setModal(null)}
          onRename={renameSeason}
          onDelete={(id) => setModal({
            type: 'confirm',
            message: `Delete this season? All its laps and races will be moved into the next remaining season.`,
            onConfirm: () => deleteSeason(id),
          })}
          onSwitch={async (id) => { await switchSeason(id); setModal(null); }}
          onAdd={() => setModal({ type: 'addSeason' })}
        />
      )}
      {modal?.type === 'trackTop10' && (
        <TrackTop10Modal
          trackName={modal.trackName}
          laps={laps}
          driversById={driversById}
          seasonsById={seasonsById}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'confirm' && (
        <ConfirmModal message={modal.message} onCancel={() => setModal(null)}
          onConfirm={async () => { await modal.onConfirm(); setModal(null); }} />
      )}
    </div>
  );
}

// ======================================================
// FONT LOADER
// ======================================================
function FontLoader() {
  useEffect(() => {
    const id = 'pitwall-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Titillium+Web:wght@300;400;600;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap';
    document.head.appendChild(link);
  }, []);
  return null;
}

// ======================================================
// ATMOSPHERE
// ======================================================
function BackgroundAtmosphere() {
  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          height: 3,
          background: 'linear-gradient(90deg, #E10600 0%, #E10600 33%, #FFC700 33%, #FFC700 66%, #ffffff 66%, #ffffff 100%)',
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          top: '10%', left: '-10%', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(225,6,0,0.15) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          bottom: '-10%', right: '-10%', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,199,0,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
    </>
  );
}

// ======================================================
// LOADING
// ======================================================
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: 16, height: 48, background: C.red,
            animation: `pwpulse 1.2s ease-in-out ${i * 0.15}s infinite`,
            boxShadow: `0 0 20px ${C.red}`,
          }} />
        ))}
      </div>
      <style>{`@keyframes pwpulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }`}</style>
    </div>
  );
}

// ======================================================
// HEADER
// ======================================================
function Header({ tab, setTab, seasons, currentSeason, onSwitchSeason, onNewSeason, onManageSeasons, saveStatus, onRefresh }) {
  const tabs = [
    { id: 'standings', label: 'Championship', icon: Trophy },
    { id: 'records',   label: 'Track Records', icon: Zap },
    { id: 'races',     label: 'Races',          icon: Flag },
    { id: 'laps',      label: 'Lap Log',        icon: Timer },
    { id: 'drivers',   label: 'Drivers',        icon: Users },
  ];

  return (
    <header
      className="relative z-10 border-b"
      style={{ borderColor: C.borderDim, background: 'rgba(10,10,10,0.88)', backdropFilter: 'blur(12px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 py-4 sm:py-5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex items-center justify-center font-black text-xl"
              style={{
                width: 44, height: 44, background: C.red,
                clipPath: 'polygon(15% 0, 100% 0, 85% 100%, 0 100%)',
                fontFamily: "'Titillium Web', sans-serif",
              }}
            >
              F1
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: C.textSubtle, letterSpacing: '0.25em' }}>
                F1 25 · CHAMPIONSHIP
              </div>
              <h1
                className="text-xl sm:text-2xl font-black leading-none truncate"
                style={{ fontFamily: "'Titillium Web', sans-serif", letterSpacing: '-0.02em' }}
              >
                PIT <span style={{ color: C.red }}>WALL</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <SyncIndicator status={saveStatus} onRefresh={onRefresh} />
            <SeasonSelector
              seasons={seasons}
              currentSeason={currentSeason}
              onSwitch={onSwitchSeason}
              onNew={onNewSeason}
              onManage={onManageSeasons}
            />
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
          <style>{`header ::-webkit-scrollbar { display: none; }`}</style>
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex items-center gap-2 px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all"
                style={{
                  color: active ? '#fff' : C.textDim,
                  background: active ? C.red : 'rgba(255,255,255,0.04)',
                  clipPath: 'polygon(8% 0, 100% 0, 92% 100%, 0 100%)',
                  letterSpacing: '0.02em',
                }}
              >
                <Icon className="w-4 h-4" strokeWidth={2.5} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

// ======================================================
// SYNC INDICATOR
// ======================================================
function SyncIndicator({ status, onRefresh }) {
  const config = {
    idle:    { dot: '#555',    label: '',        pulse: false },
    saving:  { dot: '#FFC700', label: 'SYNCING', pulse: true  },
    saved:   { dot: '#52E252', label: 'SYNCED',  pulse: false },
    error:   { dot: '#E10600', label: 'ERROR',   pulse: false },
    offline: { dot: '#888',    label: 'OFFLINE', pulse: false },
  }[status] || { dot: '#555', label: '', pulse: false };

  return (
    <button
      onClick={onRefresh}
      title="Click to refresh from server"
      className="hidden sm:flex items-center gap-2 px-3 py-2 transition-colors hover:bg-white/5"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: config.dot,
        animation: config.pulse ? 'pwpulse 1s ease-in-out infinite' : 'none',
      }} />
      {config.label && (
        <span className="text-xs font-bold" style={{ color: C.textDim, letterSpacing: '0.2em' }}>
          {config.label}
        </span>
      )}
    </button>
  );
}

// ======================================================
// SEASON SELECTOR
// ======================================================
function SeasonSelector({ seasons, currentSeason, onSwitch, onNew, onManage }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 transition-colors"
        style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderLeft: `3px solid ${C.red}`,
        }}
      >
        <div className="text-left">
          <div className="text-xs font-bold" style={{ color: C.textSubtle, letterSpacing: '0.25em' }}>ACTIVE SEASON</div>
          <div
            className="text-sm sm:text-base font-black leading-none truncate"
            style={{ fontFamily: "'Titillium Web', sans-serif", maxWidth: 180 }}
          >
            {currentSeason?.name?.toUpperCase() || '—'}
          </div>
        </div>
        <ChevronDown className="w-4 h-4" style={{ color: C.textSubtle, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 overflow-hidden z-40"
          style={{ minWidth: 260, background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
        >
          <div className="px-3 py-2 text-xs font-bold border-b" style={{ color: C.textSubtle, letterSpacing: '0.2em', borderColor: C.borderDim }}>
            SEASONS
          </div>
          <div className="max-h-72 overflow-y-auto">
            {seasons.map(s => {
              const active = s.id === currentSeason?.id;
              return (
                <button
                  key={s.id}
                  onClick={() => { onSwitch(s.id); setOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors hover:bg-white/5"
                  style={{ background: active ? 'rgba(225,6,0,0.10)' : 'transparent' }}
                >
                  <div className="flex items-center gap-2">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? C.red : '#555' }} />
                    <span style={{ color: active ? '#fff' : C.textDim, fontWeight: active ? 700 : 500 }}>{s.name}</span>
                  </div>
                  {active && <Check className="w-4 h-4" style={{ color: C.red }} />}
                </button>
              );
            })}
          </div>
          <div className="border-t" style={{ borderColor: C.borderDim }}>
            <button
              onClick={() => { setOpen(false); onNew(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-white/5"
              style={{ color: C.red }}
            >
              <Plus className="w-4 h-4" /> New season
            </button>
            <button
              onClick={() => { setOpen(false); onManage(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
              style={{ color: C.textDim }}
            >
              <Edit3 className="w-4 h-4" /> Manage seasons
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================================================
// STANDINGS
// ======================================================
function StandingsView({ standings, races, drivers, currentSeason, setModal }) {
  const hasData = races.length > 0;
  const leader = standings[0];
  const totalRaces = races.length;

  return (
    <div className="space-y-6 pt-6">
      <SectionHeader
        title="CHAMPIONSHIP STANDINGS"
        subtitle={`${currentSeason?.name?.toUpperCase() || '—'} · ${totalRaces} ${totalRaces === 1 ? 'RACE' : 'RACES'} · ${drivers.length} DRIVERS`}
      />

      {hasData && leader && leader.total > 0 && (
        <div
          className="relative overflow-hidden p-6 sm:p-8"
          style={{
            background: `linear-gradient(135deg, ${leader.driver.color}22 0%, transparent 60%), ${C.surface}`,
            border: `1px solid ${leader.driver.color}`,
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 20px) 100%, 0 100%)',
          }}
        >
          <div
            className="absolute top-0 right-0"
            style={{ width: 128, height: 128, background: leader.driver.color, opacity: 0.1, clipPath: 'polygon(40% 0, 100% 0, 100% 100%)' }}
          />
          <div className="flex items-start gap-4 relative">
            <Crown className="flex-shrink-0" style={{ width: 32, height: 32, color: C.gold }} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold mb-1" style={{ color: C.gold, letterSpacing: '0.2em' }}>CHAMPIONSHIP LEADER</div>
              <div
                className="text-4xl sm:text-5xl font-black leading-none mb-3 truncate"
                style={{ fontFamily: "'Titillium Web', sans-serif", color: leader.driver.color }}
              >
                {leader.driver.name.toUpperCase()}
              </div>
              <div className="flex flex-wrap gap-6 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                <Stat label="PTS"   value={leader.total}       highlight />
                <Stat label="WINS"  value={leader.wins} />
                <Stat label="POD"   value={leader.podiums} />
                <Stat label="FL"    value={leader.fastestLaps} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.borderDim}` }}>
        <StandingsHeaderRow />
        {standings.map((s, idx) => (
          <StandingsRow key={s.driver.id} row={s} pos={idx + 1} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs" style={{ color: C.textSubtle }}>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: C.surface, border: `1px solid ${C.borderDim}` }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red }} />
          <span>P1–P10: 25-18-15-12-10-8-6-4-2-1</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: C.surface, border: `1px solid ${C.borderDim}` }}>
          <Flame className="w-3 h-3" style={{ color: C.gold }} />
          <span>Fastest Lap: +{FL_BONUS}</span>
        </div>
      </div>

      {!hasData && (
        <EmptyState
          icon={Trophy}
          title="NO RACES THIS SEASON"
          subtitle="Log a race — enter finishing positions and fastest lap times all in one go."
          action={{ label: 'ADD RACE RESULT', onClick: () => setModal({ type: 'addRace' }) }}
        />
      )}
    </div>
  );
}

function StandingsHeaderRow() {
  return (
    <div
      className="flex items-center gap-3 px-3 sm:px-5 py-3 text-xs font-bold border-b"
      style={{ color: C.textSubtle, borderColor: C.borderDim, background: C.surfaceDeep, letterSpacing: '0.15em' }}
    >
      <div style={{ width: 40, flexShrink: 0 }}>POS</div>
      <div className="flex-1">DRIVER</div>
      <div className="text-right" style={{ width: 50, flexShrink: 0 }}>W</div>
      <div className="text-right" style={{ width: 50, flexShrink: 0 }}>POD</div>
      <div className="text-right" style={{ width: 50, flexShrink: 0 }}>FL</div>
      <div className="text-right hidden sm:block" style={{ width: 70, flexShrink: 0 }}>RACES</div>
      <div className="text-right" style={{ width: 70, flexShrink: 0 }}>POINTS</div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div>
      <div className="text-xs font-bold" style={{ color: C.textSubtle, letterSpacing: '0.2em' }}>{label}</div>
      <div className={highlight ? 'text-2xl font-black' : 'text-lg font-bold'} style={{ color: highlight ? C.gold : '#fff' }}>{value}</div>
    </div>
  );
}

function StandingsRow({ row, pos }) {
  const posColor = pos === 1 ? C.gold : pos === 2 ? C.silver : pos === 3 ? C.bronze : C.textDim;
  return (
    <div
      className="flex items-center gap-3 px-3 sm:px-5 py-4 border-b transition-colors hover:bg-white/5"
      style={{ borderColor: '#1a1a1a' }}
    >
      <div
        className="text-xl sm:text-2xl font-black"
        style={{ width: 40, flexShrink: 0, color: posColor, fontFamily: "'Titillium Web', sans-serif" }}
      >
        {pos}
      </div>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div style={{ width: 4, height: 32, flexShrink: 0, background: row.driver.color, boxShadow: `0 0 12px ${row.driver.color}` }} />
        <div className="min-w-0">
          <div className="text-base sm:text-lg font-bold truncate" style={{ color: '#fff' }}>{row.driver.name.toUpperCase()}</div>
          <div className="text-xs" style={{ color: C.textSubtle, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>
            {row.racePoints} + {row.flPoints} FL
          </div>
        </div>
      </div>
      <div className="text-right font-bold text-sm sm:text-base" style={{ width: 50, flexShrink: 0, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{row.wins}</div>
      <div className="text-right font-bold text-sm sm:text-base" style={{ width: 50, flexShrink: 0, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{row.podiums}</div>
      <div className="text-right font-bold text-sm sm:text-base" style={{ width: 50, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", color: row.fastestLaps > 0 ? C.gold : '#fff' }}>{row.fastestLaps}</div>
      <div className="text-right font-bold text-sm hidden sm:block" style={{ width: 70, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", color: C.textDim }}>{row.starts}</div>
      <div
        className="text-right text-xl sm:text-2xl font-black"
        style={{ width: 70, flexShrink: 0, fontFamily: "'Titillium Web', sans-serif", color: pos === 1 ? C.gold : '#fff' }}
      >
        {row.total}
      </div>
    </div>
  );
}

// ======================================================
// TRACK RECORDS (click for top 10)
// ======================================================
function TrackRecordsView({ records, driversById, laps, seasons, seasonsById, setModal }) {
  const recordsSorted = Object.values(records).sort((a, b) => {
    const ai = TRACKS.findIndex(t => t.name === a.trackName);
    const bi = TRACKS.findIndex(t => t.name === b.trackName);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="space-y-6 pt-6">
      <SectionHeader
        title="TRACK RECORDS"
        subtitle={`ALL-TIME BESTS · ${recordsSorted.length} CIRCUITS · ${laps.length} TOTAL LAPS · TAP A CARD FOR TOP 10`}
      />

      {recordsSorted.length === 0 ? (
        <EmptyState
          icon={Timer}
          title="NO LAPS LOGGED"
          subtitle="Add a lap time to claim your first track record."
          action={{ label: 'ADD LAP TIME', onClick: () => setModal({ type: 'addLap' }) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recordsSorted.map(lap => {
            const t = getTrack(lap.trackName);
            const d = driversById[lap.driverId];
            const attempts = laps.filter(l => l.trackName === lap.trackName).length;
            const seasonName = seasonsById[lap.seasonId]?.name;

            // Get top 3 for this track to tease
            const top3 = laps
              .filter(l => l.trackName === lap.trackName)
              .sort((a, b) => a.timeMs - b.timeMs)
              .slice(0, 3);

            return (
              <button
                key={lap.id}
                onClick={() => setModal({ type: 'trackTop10', trackName: lap.trackName })}
                className="text-left p-5 transition-all block w-full hover:translate-x-1"
                style={{
                  background: C.surface,
                  border: `1px solid ${C.borderDim}`,
                  borderLeft: `3px solid ${d?.color || C.red}`,
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{t.flag}</span>
                    <div>
                      <div className="text-xs font-bold" style={{ color: C.textSubtle, letterSpacing: '0.2em' }}>{t.short}</div>
                      <div className="text-sm font-bold" style={{ color: '#fff' }}>{t.name.toUpperCase()}</div>
                    </div>
                  </div>
                  <div className="text-xs font-bold" style={{ color: C.textMuted, letterSpacing: '0.15em' }}>x{attempts}</div>
                </div>

                <div
                  className="text-3xl font-black mb-3 tabular-nums"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: C.gold, letterSpacing: '-0.02em' }}
                >
                  {formatTime(lap.timeMs)}
                </div>

                <div className="flex items-center justify-between text-xs gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div style={{ width: 8, height: 8, flexShrink: 0, background: d?.color || C.textSubtle }} />
                    <span className="font-bold truncate" style={{ color: '#fff' }}>{d?.name?.toUpperCase() || 'UNKNOWN'}</span>
                  </div>
                  <div className="text-right flex-shrink-0" style={{ color: C.textSubtle, fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatDateDMY(lap.dateStr)}
                  </div>
                </div>

                {/* Top 3 teaser */}
                {top3.length > 1 && (
                  <div className="pt-3 space-y-1" style={{ borderTop: `1px solid ${C.borderDim}` }}>
                    {top3.slice(1).map((l, i) => {
                      const dd = driversById[l.driverId];
                      const pos = i + 2;
                      return (
                        <div key={l.id} className="flex items-center gap-2 text-xs">
                          <span style={{
                            width: 20, color: pos === 2 ? C.silver : C.bronze,
                            fontFamily: "'Titillium Web', sans-serif", fontWeight: 800,
                          }}>P{pos}</span>
                          <span className="flex-1 font-bold truncate" style={{ color: C.textDim }}>
                            {dd?.name?.toUpperCase() || '—'}
                          </span>
                          <span className="tabular-nums" style={{ color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                            {formatTime(l.timeMs)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {attempts > 3 && (
                  <div className="text-xs font-bold mt-3" style={{ color: C.red, letterSpacing: '0.2em' }}>
                    TAP FOR TOP 10 →
                  </div>
                )}

                {seasonName && top3.length <= 1 && (
                  <div className="text-xs mt-2 pt-2 border-t" style={{ color: C.textSubtle, borderColor: C.borderDim, letterSpacing: '0.1em' }}>
                    SET IN {seasonName.toUpperCase()}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ======================================================
// TRACK TOP 10 MODAL
// ======================================================
function TrackTop10Modal({ trackName, laps, driversById, seasonsById, onClose }) {
  const t = getTrack(trackName);
  const top10 = laps
    .filter(l => l.trackName === trackName)
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, 10);
  const leaderTime = top10[0]?.timeMs;
  const totalLaps = laps.filter(l => l.trackName === trackName).length;

  return (
    <ModalShell
      title={`${t.flag}  ${t.name.toUpperCase()} · TOP 10`}
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold mb-3" style={{ color: C.textSubtle, letterSpacing: '0.2em' }}>
          <div>{t.circuit?.toUpperCase()}</div>
          <div>{totalLaps} TOTAL {totalLaps === 1 ? 'LAP' : 'LAPS'} LOGGED</div>
        </div>
        {top10.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: C.textDim }}>
            No laps logged for this track yet.
          </div>
        ) : (
          top10.map((lap, idx) => {
            const d = driversById[lap.driverId];
            const pos = idx + 1;
            const posColor = pos === 1 ? C.gold : pos === 2 ? C.silver : pos === 3 ? C.bronze : C.textDim;
            const gap = idx > 0 ? lap.timeMs - leaderTime : 0;
            const seasonName = seasonsById[lap.seasonId]?.name;
            return (
              <div
                key={lap.id}
                className="flex items-center gap-3 px-3 sm:px-4 py-3"
                style={{
                  background: pos === 1 ? 'rgba(255,199,0,0.06)' : C.surfaceDeep,
                  border: `1px solid ${C.borderDim}`,
                  borderLeft: `3px solid ${d?.color || C.textSubtle}`,
                }}
              >
                <div
                  className="font-black text-lg"
                  style={{ width: 36, flexShrink: 0, color: posColor, fontFamily: "'Titillium Web', sans-serif" }}
                >
                  P{pos}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: '#fff' }}>
                    {d?.name?.toUpperCase() || '—'}
                  </div>
                  <div className="text-xs truncate" style={{ color: C.textSubtle, fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatDateDMY(lap.dateStr)}{seasonName ? ` · ${seasonName}` : ''}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div
                    className="text-base sm:text-lg font-bold tabular-nums"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: pos === 1 ? C.gold : '#fff' }}
                  >
                    {formatTime(lap.timeMs)}
                  </div>
                  {idx > 0 && (
                    <div className="text-xs tabular-nums" style={{ color: C.textSubtle, fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatGap(gap)}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </ModalShell>
  );
}

// ======================================================
// LAP LOG
// ======================================================
function LapsView({ laps, driversById, drivers, seasons, currentSeasonId, onDelete, setModal }) {
  const [driverFilter, setDriverFilter] = useState('all');
  const [trackFilter, setTrackFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState(currentSeasonId);
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => { setSeasonFilter(currentSeasonId); }, [currentSeasonId]);

  const uniqueTracks = useMemo(() => [...new Set(laps.map(l => l.trackName))].sort(), [laps]);

  const filtered = useMemo(() => {
    let out = laps;
    if (seasonFilter !== 'all') out = out.filter(l => l.seasonId === seasonFilter);
    if (driverFilter !== 'all') out = out.filter(l => l.driverId === driverFilter);
    if (trackFilter !== 'all') out = out.filter(l => l.trackName === trackFilter);
    if (sortBy === 'date') out = [...out].sort((a, b) => b.dateStr.localeCompare(a.dateStr) || b.createdAt - a.createdAt);
    else if (sortBy === 'time') out = [...out].sort((a, b) => a.timeMs - b.timeMs);
    else if (sortBy === 'track') out = [...out].sort((a, b) => a.trackName.localeCompare(b.trackName));
    return out;
  }, [laps, seasonFilter, driverFilter, trackFilter, sortBy]);

  const trackBests = useMemo(() => {
    const best = {};
    for (const l of laps) {
      if (!best[l.trackName] || l.timeMs < best[l.trackName].timeMs) best[l.trackName] = l;
    }
    return best;
  }, [laps]);

  return (
    <div className="space-y-5 pt-6">
      <SectionHeader title="LAP LOG" subtitle={`${filtered.length} / ${laps.length} LAPS`} />

      <div className="flex flex-wrap gap-2">
        <Select value={seasonFilter} onChange={setSeasonFilter} options={[
          { value: 'all', label: 'All seasons' },
          ...seasons.map(s => ({ value: s.id, label: s.name })),
        ]} />
        <Select value={driverFilter} onChange={setDriverFilter} options={[
          { value: 'all', label: 'All drivers' },
          ...drivers.map(d => ({ value: d.id, label: d.name })),
        ]} />
        <Select value={trackFilter} onChange={setTrackFilter} options={[
          { value: 'all', label: 'All tracks' },
          ...uniqueTracks.map(t => ({ value: t, label: t })),
        ]} />
        <Select value={sortBy} onChange={setSortBy} options={[
          { value: 'date',  label: 'Sort: Newest' },
          { value: 'time',  label: 'Sort: Fastest' },
          { value: 'track', label: 'Sort: Track' },
        ]} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Timer} title="NO LAPS MATCH" subtitle="Try clearing filters or logging a new lap time." />
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.borderDim}` }}>
          <div
            className="flex items-center gap-3 px-3 sm:px-5 py-3 text-xs font-bold border-b"
            style={{ color: C.textSubtle, borderColor: C.borderDim, background: C.surfaceDeep, letterSpacing: '0.15em' }}
          >
            <div style={{ width: 70, flexShrink: 0 }}>TRACK</div>
            <div className="flex-1">DRIVER</div>
            <div className="hidden sm:block" style={{ width: 100, flexShrink: 0 }}>DATE</div>
            <div className="text-right" style={{ width: 110, flexShrink: 0 }}>LAP TIME</div>
            <div style={{ width: 28, flexShrink: 0 }}></div>
          </div>
          {filtered.map(lap => {
            const t = getTrack(lap.trackName);
            const d = driversById[lap.driverId];
            const isRecord = trackBests[lap.trackName]?.id === lap.id;
            return (
              <div
                key={lap.id}
                className="flex items-center gap-3 px-3 sm:px-5 py-3 border-b"
                style={{ borderColor: '#1a1a1a' }}
              >
                <div className="flex items-center gap-2" style={{ width: 70, flexShrink: 0 }}>
                  <span>{t.flag}</span>
                  <span className="text-xs font-bold" style={{ color: C.textDim }}>{t.short}</span>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {d ? (
                    <>
                      <div style={{ width: 4, height: 20, flexShrink: 0, background: d.color }} />
                      <span className="text-sm font-bold truncate" style={{ color: '#fff' }}>{d.name.toUpperCase()}</span>
                    </>
                  ) : (
                    <span className="text-sm italic" style={{ color: C.textSubtle }}>(deleted)</span>
                  )}
                </div>
                <div
                  className="hidden sm:block text-xs"
                  style={{ width: 100, flexShrink: 0, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {formatDateDMY(lap.dateStr)}
                </div>
                <div
                  className="text-right text-base sm:text-lg font-bold tabular-nums flex items-center justify-end gap-2"
                  style={{ width: 110, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", color: isRecord ? C.gold : '#fff' }}
                >
                  {isRecord && <Flame className="w-3.5 h-3.5" style={{ color: C.gold }} />}
                  {formatTime(lap.timeMs)}
                </div>
                <button
                  onClick={() => setModal({ type: 'confirm', message: `Delete this lap time?`, onConfirm: () => onDelete(lap.id) })}
                  className="transition-opacity hover:opacity-100"
                  style={{ width: 28, flexShrink: 0, color: C.red, opacity: 0.5 }}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ======================================================
// RACES
// ======================================================
function RacesView({ races, driversById, currentSeason, onDelete, setModal }) {
  const sorted = [...races].sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  return (
    <div className="space-y-6 pt-6">
      <SectionHeader
        title="RACE RESULTS"
        subtitle={`${currentSeason?.name?.toUpperCase() || '—'} · ${races.length} ${races.length === 1 ? 'RACE' : 'RACES'}`}
      />
      {races.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="NO RACES THIS SEASON"
          subtitle="Log a race — enter finishing positions and fastest lap times in one form."
          action={{ label: 'ADD RACE RESULT', onClick: () => setModal({ type: 'addRace' }) }}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map(race => {
            const t = getTrack(race.trackName);
            const results = [...(race.results || [])].sort((a, b) => a.position - b.position);
            return (
              <div key={race.id} style={{ background: C.surface, border: `1px solid ${C.borderDim}`, borderLeft: `3px solid ${C.red}` }}>
                <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#1a1a1a' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{t.flag}</span>
                    <div>
                      <div className="font-bold" style={{ color: '#fff' }}>{t.name.toUpperCase()}</div>
                      <div className="text-xs" style={{ color: C.textSubtle, fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatDateDMY(race.dateStr)} · {t.circuit}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setModal({ type: 'confirm', message: 'Delete this race? Points will be recalculated.', onConfirm: () => onDelete(race.id) })}
                    className="transition-opacity hover:opacity-100"
                    style={{ color: C.red, opacity: 0.5 }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  {results.map(r => {
                    const d = driversById[r.driverId];
                    const pts = (POINTS[r.position - 1] || 0) + (r.fastestLap ? FL_BONUS : 0);
                    const posColor = r.position === 1 ? C.gold : r.position === 2 ? C.silver : r.position === 3 ? C.bronze : C.textDim;
                    return (
                      <div
                        key={r.driverId}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm border-b"
                        style={{ borderColor: '#1a1a1a' }}
                      >
                        <div
                          className="font-black text-lg"
                          style={{ width: 32, flexShrink: 0, color: posColor, fontFamily: "'Titillium Web', sans-serif" }}
                        >
                          P{r.position}
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div style={{ width: 4, height: 20, flexShrink: 0, background: d?.color || C.textSubtle }} />
                          <span className="font-bold truncate" style={{ color: '#fff' }}>{d?.name?.toUpperCase() || '—'}</span>
                          {r.fastestLap && (
                            <span
                              className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-bold flex-shrink-0"
                              style={{ background: 'rgba(255,199,0,0.15)', color: C.gold, letterSpacing: '0.15em' }}
                            >
                              <Flame className="w-3 h-3" /> FL
                            </span>
                          )}
                        </div>
                        <div
                          className="text-right font-bold tabular-nums"
                          style={{ fontFamily: "'JetBrains Mono', monospace", color: pts > 0 ? '#fff' : C.textSubtle }}
                        >
                          {pts} <span className="text-xs" style={{ color: C.textSubtle }}>PTS</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ======================================================
// DRIVERS
// ======================================================
function DriversView({ drivers, standings, laps, onDelete, setModal }) {
  return (
    <div className="space-y-6 pt-6">
      <SectionHeader title="DRIVERS" subtitle={`${drivers.length} ON THE ROSTER`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {drivers.map(d => {
          const s = standings.find(x => x.driver.id === d.id);
          const lapsCount = laps.filter(l => l.driverId === d.id).length;
          return (
            <div
              key={d.id}
              className="p-5 relative group"
              style={{ background: C.surface, border: `1px solid ${C.borderDim}`, borderLeft: `3px solid ${d.color}` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                  <div
                    className="text-2xl font-black leading-none mb-1 truncate"
                    style={{ color: d.color, fontFamily: "'Titillium Web', sans-serif" }}
                  >
                    {d.name.toUpperCase()}
                  </div>
                  <div className="text-xs" style={{ color: C.textSubtle, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em' }}>
                    {d.color}
                  </div>
                </div>
                <button
                  onClick={() => setModal({
                    type: 'confirm',
                    message: `Remove ${d.name} from the roster? Their lap times and race results will be kept but shown as "(deleted)".`,
                    onConfirm: () => onDelete(d.id),
                  })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: C.red }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <DriverStat label="PTS"  value={s?.total ?? 0} highlight />
                <DriverStat label="WINS" value={s?.wins ?? 0} />
                <DriverStat label="PODS" value={s?.podiums ?? 0} />
                <DriverStat label="LAPS" value={lapsCount} />
              </div>
            </div>
          );
        })}
        <button
          onClick={() => setModal({ type: 'addDriver' })}
          className="p-5 flex flex-col items-center justify-center transition-colors hover:bg-white/5"
          style={{ background: 'transparent', border: `1px dashed ${C.border}`, minHeight: 140 }}
        >
          <Plus className="w-6 h-6 mb-2" style={{ color: C.textSubtle }} />
          <div className="text-xs font-bold" style={{ color: C.textDim, letterSpacing: '0.2em' }}>ADD DRIVER</div>
        </button>
      </div>
    </div>
  );
}

function DriverStat({ label, value, highlight }) {
  return (
    <div className="py-2" style={{ background: C.surfaceDeep }}>
      <div className="text-xl font-black" style={{ color: highlight ? C.gold : '#fff', fontFamily: "'Titillium Web', sans-serif" }}>{value}</div>
      <div className="text-xs font-bold" style={{ color: C.textSubtle, letterSpacing: '0.2em' }}>{label}</div>
    </div>
  );
}

// ======================================================
// SHARED UI
// ======================================================
function SectionHeader({ title, subtitle }) {
  return (
    <div>
      <h2
        className="text-3xl sm:text-4xl font-black leading-none"
        style={{ fontFamily: "'Titillium Web', sans-serif", letterSpacing: '-0.02em' }}
      >
        {title.split(' ').map((w, i, arr) => (
          <span key={i} style={i === arr.length - 1 ? { color: C.red } : {}}>
            {w}{i < arr.length - 1 ? ' ' : ''}
          </span>
        ))}
      </h2>
      <div className="text-xs font-bold mt-2" style={{ color: C.textSubtle, letterSpacing: '0.25em' }}>{subtitle}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="text-center py-16 px-4" style={{ background: C.surface2, border: `1px dashed ${C.borderDim}` }}>
      <Icon className="w-12 h-12 mx-auto mb-4" style={{ color: C.textMuted }} strokeWidth={1.5} />
      <div className="font-black text-lg" style={{ color: C.textDim, fontFamily: "'Titillium Web', sans-serif", letterSpacing: '-0.01em' }}>{title}</div>
      <div className="text-sm mt-1" style={{ color: C.textSubtle }}>{subtitle}</div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-5 py-2 font-bold text-sm"
          style={{ background: C.red, color: '#fff', clipPath: 'polygon(8% 0, 100% 0, 92% 100%, 0 100%)', letterSpacing: '0.15em' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-2 text-sm font-semibold"
      style={{ background: C.surface, border: `1px solid ${C.borderDim}`, color: '#fff', outline: 'none' }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ======================================================
// FAB — dual: ADD LAP always + contextual primary
// ======================================================
function FAB({ setModal, tab }) {
  const actions = [];
  if (tab === 'standings' || tab === 'races') {
    actions.push({ label: 'ADD RACE', primary: true, action: () => setModal({ type: 'addRace' }) });
    actions.push({ label: 'ADD LAP', action: () => setModal({ type: 'addLap' }) });
  } else if (tab === 'drivers') {
    actions.push({ label: 'ADD DRIVER', primary: true, action: () => setModal({ type: 'addDriver' }) });
    actions.push({ label: 'ADD LAP', action: () => setModal({ type: 'addLap' }) });
  } else {
    actions.push({ label: 'ADD LAP', primary: true, action: () => setModal({ type: 'addLap' }) });
  }

  return (
    <div className="fixed z-30 flex flex-col items-end gap-2" style={{ bottom: 20, right: 16 }}>
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={a.action}
          className="flex items-center gap-2 font-black text-sm transition-transform hover:scale-105"
          style={{
            padding: '12px 20px',
            background: a.primary ? C.red : C.surface,
            color: '#fff',
            border: a.primary ? 'none' : `1px solid ${C.border}`,
            boxShadow: a.primary ? '0 0 30px rgba(225,6,0,0.5)' : '0 6px 24px rgba(0,0,0,0.6)',
            letterSpacing: '0.15em',
          }}
        >
          <Plus className="w-5 h-5" strokeWidth={3} />
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ======================================================
// MODAL SHELL
// ======================================================
function ModalShell({ title, onClose, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    const onEsc = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className={`${maxWidth} w-full relative`}
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, border: `1px solid ${C.border}`, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ height: 3, background: `linear-gradient(90deg, ${C.red} 0%, ${C.red} 60%, ${C.gold} 60%, ${C.gold} 100%)` }} />
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10" style={{ borderColor: C.borderDim, background: C.surface }}>
          <h3 className="text-lg font-black" style={{ fontFamily: "'Titillium Web', sans-serif", letterSpacing: '0.02em', color: '#fff' }}>{title}</h3>
          <button onClick={onClose} style={{ color: C.textDim }}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div className="text-xs font-bold mb-1.5" style={{ color: C.textSubtle, letterSpacing: '0.2em' }}>{children}</div>;
}

function Input({ value, onChange, placeholder, type = 'text', autoFocus }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full px-3 py-2.5 text-base"
      style={{ background: C.surfaceDeep, border: `1px solid ${C.border}`, color: '#fff', outline: 'none' }}
    />
  );
}

function NativeSelect({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2.5 text-base"
      style={{ background: C.surfaceDeep, border: `1px solid ${C.border}`, color: '#fff', outline: 'none' }}
    >
      {children}
    </select>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-5 py-2.5 font-black text-sm"
      style={{
        background: C.red, color: '#fff',
        clipPath: 'polygon(8% 0, 100% 0, 92% 100%, 0 100%)',
        letterSpacing: '0.15em', opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-2.5 font-bold text-sm"
      style={{ background: 'transparent', color: C.textDim, border: `1px solid ${C.border}`, letterSpacing: '0.15em' }}
    >
      {children}
    </button>
  );
}

// ======================================================
// ADD LAP
// ======================================================
function AddLapModal({ drivers, onClose, onSubmit }) {
  const [trackName, setTrackName] = useState('Australia');
  const [driverId, setDriverId] = useState(drivers[0]?.id || '');
  const [time, setTime] = useState('');
  const [dateStr, setDateStr] = useState(todayISO());
  const [err, setErr] = useState('');

  const submit = () => {
    const timeMs = parseTimeInput(time);
    if (!timeMs) { setErr('Time must be M:SS.mmm (e.g. 1:20.241)'); return; }
    if (!driverId) { setErr('Pick a driver'); return; }
    onSubmit({ trackName, driverId, timeMs, dateStr });
  };

  return (
    <ModalShell title="NEW LAP TIME" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>TRACK</Label>
          <NativeSelect value={trackName} onChange={setTrackName}>
            {TRACKS.map(t => <option key={t.name} value={t.name}>{t.flag} {t.name} · {t.circuit}</option>)}
          </NativeSelect>
        </div>
        <div>
          <Label>DRIVER</Label>
          <NativeSelect value={driverId} onChange={setDriverId}>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </NativeSelect>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>LAP TIME</Label>
            <input
              value={time}
              onChange={e => { setTime(e.target.value); setErr(''); }}
              placeholder="1:20.241"
              className="w-full px-3 py-2.5 text-lg tabular-nums"
              style={{
                background: C.surfaceDeep,
                border: `1px solid ${err ? C.red : C.border}`,
                color: C.gold, fontFamily: "'JetBrains Mono', monospace", outline: 'none',
              }}
            />
          </div>
          <div>
            <Label>DATE</Label>
            <Input type="date" value={dateStr} onChange={setDateStr} />
          </div>
        </div>
        {err && <div className="text-xs flex items-center gap-2" style={{ color: C.red }}><AlertCircle className="w-3.5 h-3.5" />{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>CANCEL</SecondaryButton>
          <PrimaryButton onClick={submit}>LOG LAP</PrimaryButton>
        </div>
      </div>
    </ModalShell>
  );
}

// ======================================================
// ADD RACE — now with optional lap time per driver
// ======================================================
function AddRaceModal({ drivers, onClose, onSubmit }) {
  const [trackName, setTrackName] = useState('Australia');
  const [dateStr, setDateStr] = useState(todayISO());
  const [positions, setPositions] = useState(
    drivers.reduce((acc, d, i) => ({ ...acc, [d.id]: i + 1 }), {})
  );
  const [times, setTimes] = useState(
    drivers.reduce((acc, d) => ({ ...acc, [d.id]: '' }), {})
  );
  const [flDriverId, setFlDriverId] = useState('');
  const [err, setErr] = useState('');

  const setPos = (id, val) => setPositions({ ...positions, [id]: val });
  const setTime = (id, val) => setTimes({ ...times, [id]: val });

  const submit = () => {
    // Validate times
    for (const d of drivers) {
      const raw = times[d.id]?.trim();
      if (raw && parseTimeInput(raw) == null) {
        setErr(`${d.name}'s time is invalid — use M:SS.mmm (e.g. 1:20.241)`);
        return;
      }
    }
    const results = drivers
      .map(d => ({
        driverId: d.id,
        position: parseInt(positions[d.id], 10) || null,
        fastestLap: flDriverId === d.id,
        timeMs: parseTimeInput(times[d.id]?.trim() || ''),
      }))
      .filter(r => r.position != null && r.position > 0);
    if (results.length === 0) { setErr('Enter at least one position'); return; }
    const posList = results.map(r => r.position);
    if (new Set(posList).size !== posList.length) { setErr('Each driver needs a unique position'); return; }
    onSubmit({ trackName, dateStr, results });
  };

  return (
    <ModalShell title="NEW RACE RESULT" onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>TRACK</Label>
            <NativeSelect value={trackName} onChange={setTrackName}>
              {TRACKS.map(t => <option key={t.name} value={t.name}>{t.flag} {t.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>DATE</Label>
            <Input type="date" value={dateStr} onChange={setDateStr} />
          </div>
        </div>

        <div>
          <Label>FINISHING POSITIONS & FASTEST LAP TIMES</Label>
          <div className="text-xs mb-2" style={{ color: C.textSubtle }}>
            Enter each driver's position (leave blank for DNF/DNS). Optionally add their fastest lap time — it'll auto-populate into track records.
          </div>
          <div className="space-y-2 mt-2">
            {drivers.map(d => (
              <div
                key={d.id}
                className="flex items-center gap-2 px-3 py-2.5 flex-wrap sm:flex-nowrap"
                style={{ background: C.surfaceDeep, border: `1px solid ${C.borderDim}` }}
              >
                <div style={{ width: 4, height: 24, flexShrink: 0, background: d.color }} />
                <div className="font-bold truncate" style={{ minWidth: 70, color: '#fff' }}>{d.name.toUpperCase()}</div>
                <div className="flex-1" />
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={positions[d.id] || ''}
                  onChange={e => setPos(d.id, e.target.value)}
                  placeholder="POS"
                  className="text-center font-bold tabular-nums"
                  style={{
                    width: 58, padding: '6px 6px',
                    background: C.surface, border: `1px solid ${C.border}`,
                    color: '#fff', fontFamily: "'JetBrains Mono', monospace", outline: 'none',
                  }}
                />
                <input
                  type="text"
                  value={times[d.id] || ''}
                  onChange={e => { setTime(d.id, e.target.value); setErr(''); }}
                  placeholder="1:20.241"
                  className="text-center tabular-nums"
                  style={{
                    width: 100, padding: '6px 8px',
                    background: C.surface, border: `1px solid ${C.border}`,
                    color: C.gold, fontFamily: "'JetBrains Mono', monospace", outline: 'none',
                  }}
                />
                <button
                  onClick={() => setFlDriverId(flDriverId === d.id ? '' : d.id)}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-bold"
                  style={{
                    background: flDriverId === d.id ? C.gold : 'transparent',
                    color: flDriverId === d.id ? '#000' : C.gold,
                    border: `1px solid ${C.gold}`,
                    letterSpacing: '0.15em',
                  }}
                  title="Fastest Lap bonus point"
                >
                  <Flame className="w-3 h-3" /> FL
                </button>
              </div>
            ))}
          </div>
          <div className="text-xs mt-3" style={{ color: C.textSubtle }}>
            Points P1–P10: 25-18-15-12-10-8-6-4-2-1 · Fastest Lap tick: +{FL_BONUS}
          </div>
        </div>

        {err && <div className="text-xs flex items-center gap-2" style={{ color: C.red }}><AlertCircle className="w-3.5 h-3.5" />{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>CANCEL</SecondaryButton>
          <PrimaryButton onClick={submit}>LOG RACE</PrimaryButton>
        </div>
      </div>
    </ModalShell>
  );
}

// ======================================================
// ADD DRIVER
// ======================================================
function AddDriverModal({ existing, onClose, onSubmit }) {
  const usedColors = new Set(existing.map(d => d.color));
  const firstFree = DRIVER_COLORS.find(c => !usedColors.has(c)) || DRIVER_COLORS[0];
  const [name, setName] = useState('');
  const [color, setColor] = useState(firstFree);
  const [err, setErr] = useState('');

  const submit = () => {
    if (!name.trim()) { setErr('Driver name required'); return; }
    if (existing.some(d => d.name.toLowerCase() === name.trim().toLowerCase())) { setErr('That driver already exists'); return; }
    onSubmit({ name: name.trim(), color });
  };

  return (
    <ModalShell title="NEW DRIVER" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>DRIVER NAME</Label>
          <Input value={name} onChange={v => { setName(v); setErr(''); }} placeholder="e.g. Chris" autoFocus />
        </div>
        <div>
          <Label>DRIVER COLOUR</Label>
          <div className="grid grid-cols-5 gap-2">
            {DRIVER_COLORS.map(c => {
              const selected = c === color;
              const used = usedColors.has(c) && c !== color;
              return (
                <button
                  key={c}
                  onClick={() => !used && setColor(c)}
                  disabled={used}
                  className="relative transition-transform"
                  style={{
                    height: 40, background: c, opacity: used ? 0.25 : 1,
                    transform: selected ? 'scale(1.08)' : 'scale(1)',
                    boxShadow: selected ? `0 0 12px ${c}` : 'none',
                    border: selected ? '2px solid #fff' : '2px solid transparent',
                  }}
                >
                  {selected && <Check className="w-4 h-4 absolute inset-0 m-auto" style={{ color: '#000' }} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>
        {err && <div className="text-xs flex items-center gap-2" style={{ color: C.red }}><AlertCircle className="w-3.5 h-3.5" />{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>CANCEL</SecondaryButton>
          <PrimaryButton onClick={submit}>ADD DRIVER</PrimaryButton>
        </div>
      </div>
    </ModalShell>
  );
}

// ======================================================
// ADD SEASON
// ======================================================
function AddSeasonModal({ existing, onClose, onSubmit }) {
  const [name, setName] = useState(`Season ${existing.length + 1}`);
  const [err, setErr] = useState('');

  const submit = () => {
    if (!name.trim()) { setErr('Give the season a name'); return; }
    if (existing.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) { setErr('A season with that name already exists'); return; }
    onSubmit({ name: name.trim() });
  };

  return (
    <ModalShell title="NEW SEASON" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="text-sm" style={{ color: C.textDim }}>
          Kick off a fresh championship. Any laps and race results you log from now on will count towards this season. Existing data stays put in its own season.
        </div>
        <div>
          <Label>SEASON NAME</Label>
          <Input value={name} onChange={v => { setName(v); setErr(''); }} placeholder="e.g. Season 2, Spring 2026" autoFocus />
        </div>
        {err && <div className="text-xs flex items-center gap-2" style={{ color: C.red }}><AlertCircle className="w-3.5 h-3.5" />{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>CANCEL</SecondaryButton>
          <PrimaryButton onClick={submit}>START SEASON</PrimaryButton>
        </div>
      </div>
    </ModalShell>
  );
}

// ======================================================
// MANAGE SEASONS
// ======================================================
function ManageSeasonsModal({
  seasons, currentSeasonId, racesCount, lapsCount,
  onClose, onRename, onDelete, onSwitch, onAdd,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  return (
    <ModalShell title="MANAGE SEASONS" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-3">
        {seasons.map(s => {
          const isActive = s.id === currentSeasonId;
          const editing = editingId === s.id;
          return (
            <div
              key={s.id}
              className="p-3"
              style={{
                background: C.surfaceDeep, border: `1px solid ${C.borderDim}`,
                borderLeft: `3px solid ${isActive ? C.red : C.border}`,
              }}
            >
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm"
                    style={{ background: C.surface, border: `1px solid ${C.border}`, color: '#fff', outline: 'none' }}
                    autoFocus
                  />
                  <button
                    onClick={async () => { if (editName.trim()) { await onRename(s.id, editName.trim()); setEditingId(null); } }}
                    style={{ background: C.red, color: '#fff', padding: '6px 12px', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em' }}
                  >SAVE</button>
                  <button
                    onClick={() => setEditingId(null)}
                    style={{ background: 'transparent', color: C.textDim, padding: '6px 12px', fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}` }}
                  >×</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-bold truncate" style={{ color: '#fff' }}>{s.name}</div>
                      {isActive && (
                        <span
                          className="text-xs font-bold px-2 py-0.5 flex-shrink-0"
                          style={{ background: 'rgba(225,6,0,0.18)', color: C.red, letterSpacing: '0.2em' }}
                        >ACTIVE</span>
                      )}
                    </div>
                    <div className="text-xs mt-1" style={{ color: C.textSubtle, fontFamily: "'JetBrains Mono', monospace" }}>
                      {racesCount(s.id)} races · {lapsCount(s.id)} laps
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!isActive && (
                      <button
                        onClick={() => onSwitch(s.id)}
                        className="px-2.5 py-1.5 text-xs font-bold"
                        style={{ background: 'transparent', color: '#fff', border: `1px solid ${C.border}`, letterSpacing: '0.1em' }}
                      >SWITCH</button>
                    )}
                    <button
                      onClick={() => { setEditingId(s.id); setEditName(s.name); }}
                      className="p-1.5"
                      style={{ color: C.textDim }}
                      title="Rename"
                    ><Edit3 className="w-3.5 h-3.5" /></button>
                    {seasons.length > 1 && (
                      <button
                        onClick={() => onDelete(s.id)}
                        className="p-1.5"
                        style={{ color: C.red }}
                        title="Delete"
                      ><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button
          onClick={onAdd}
          className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold"
          style={{ background: 'transparent', border: `1px dashed ${C.border}`, color: C.textDim, letterSpacing: '0.15em' }}
        >
          <Plus className="w-4 h-4" /> NEW SEASON
        </button>
        <div className="flex justify-end pt-2">
          <SecondaryButton onClick={onClose}>DONE</SecondaryButton>
        </div>
      </div>
    </ModalShell>
  );
}

// ======================================================
// CONFIRM
// ======================================================
function ConfirmModal({ message, onCancel, onConfirm }) {
  return (
    <ModalShell title="CONFIRM" onClose={onCancel} maxWidth="max-w-sm">
      <div className="space-y-4">
        <div className="flex gap-3 items-start">
          <AlertCircle className="flex-shrink-0 mt-0.5" style={{ width: 20, height: 20, color: C.red }} />
          <div className="text-sm" style={{ color: C.textDim }}>{message}</div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onCancel}>CANCEL</SecondaryButton>
          <PrimaryButton onClick={onConfirm}>CONFIRM</PrimaryButton>
        </div>
      </div>
    </ModalShell>
  );
}
