'use strict';

/* ============================================================
   store.js — state model, persistence and care-date logic
   ============================================================ */

const STORAGE_KEY = 'garden-app-v1';

function defaultState(){
  return {
    trees: [],
    map: { grid: true, background: null, bgAspect: null },
    game: {
      points: 0,
      streak: 0,
      bestStreak: 0,
      lastCareDay: null,      // 'YYYY-MM-DD' of the last day with care
      totalWaterings: 0,
      totalTrims: 0,
      totalTreatments: 0,
      badges: [],
    },
    log: [],                  // { date, icon, label, points } newest first
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  }catch(e){
    console.warn('Could not load saved state, starting fresh.', e);
    return defaultState();
  }
}

function saveState(state){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  }catch(e){
    // most likely: localStorage quota (e.g. huge background image)
    console.error('Save failed', e);
    return false;
  }
}

function normalizeState(parsed){
  const d = defaultState();
  if(!parsed || typeof parsed !== 'object') return d;
  const st = Object.assign(d, parsed);
  st.trees = Array.isArray(parsed.trees) ? parsed.trees : [];
  st.game = Object.assign(d.game, parsed.game || {});
  st.map  = Object.assign(d.map,  parsed.map  || {});
  st.log  = Array.isArray(parsed.log) ? parsed.log : [];
  return st;
}

function freshState(){
  const s = defaultState();
  saveState(s);
  return s;
}

/* ---------------- ids & dates ---------------- */

function uid(){
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function pad(n){ return String(n).padStart(2, '0'); }
function dayStr(d){ return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
function todayStr(){ return dayStr(new Date()); }
function parseDay(s){ const [y, m, d] = s.split('-').map(Number); return new Date(y, m-1, d); }
function addDays(s, n){ const d = parseDay(s); d.setDate(d.getDate() + n); return dayStr(d); }
function daysBetween(a, b){ return Math.round((parseDay(b) - parseDay(a)) / 864e5); }
function fmtDate(s){
  if(!s) return '—';
  return parseDay(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ---------------- care rules ---------------- */

// When is the next watering due?
function waterDue(tree, today = todayStr()){
  if(!tree.waterEveryDays) tree.waterEveryDays = 7;
  if(!tree.lastWatered) return { due: true, daysOverdue: 0, next: '' };
  const next = addDays(tree.lastWatered, tree.waterEveryDays);
  if(next > today) return { due: false, daysOverdue: 0, next };
  return { due: true, daysOverdue: daysBetween(next, today), next: '' };
}

// Chemical treatments (fertilizer, spray...): due once when a
// selected month arrives, until it has been done in that month.
function treatmentDue(tree, today = todayStr()){
  const months = tree.treatmentMonths || [];
  if(!months.length) return { due: false, months };
  const t = parseDay(today);
  const treatedThisMonth = tree.lastTreated &&
    parseDay(tree.lastTreated).getMonth() === t.getMonth() &&
    parseDay(tree.lastTreated).getFullYear() === t.getFullYear();
  return { due: months.includes(t.getMonth() + 1) && !treatedThisMonth, months };
}

// Pruning: due once when a selected prune month is active,
// until it has actually been pruned in that month.
function pruneDueInfo(tree, today = todayStr()){
  const months = tree.pruneMonths || [];
  if(!months.length) return { due: false, months };
  const t = parseDay(today);
  const month = t.getMonth() + 1;
  const prunedThisMonth = tree.lastPruned &&
    parseDay(tree.lastPruned).getMonth() === t.getMonth() &&
    parseDay(tree.lastPruned).getFullYear() === t.getFullYear();
  return { due: months.includes(month) && !prunedThisMonth, months };
}

// All tasks due right now, most overdue first.
function dueTasks(state){
  const out = [];
  for(const t of state.trees){
    const w = waterDue(t);
    if(w.due) out.push({ tree: t, type: 'water', over: w.daysOverdue });
    const p = pruneDueInfo(t);
    if(p.due) out.push({ tree: t, type: 'prune', over: 0 });
    const x = treatmentDue(t);
    if(x.due) out.push({ tree: t, type: 'treat', over: 0 });
  }
  out.sort((a, b) => (b.over - a.over) || a.tree.name.localeCompare(b.tree.name));
  return out;
}

function isDueTree(tree){
  return waterDue(tree).due || pruneDueInfo(tree).due || treatmentDue(tree).due;
}

/* ---------------- trees & log ---------------- */

function makeTree(data){
  return {
    id: uid(),
    name: data.name || 'New tree',
    emoji: data.emoji || '🌳',
    x: data.x ?? 50,              // position in % of the map
    y: data.y ?? 50,
    planted: data.planted || todayStr(),
    waterEveryDays: Number(data.waterEveryDays) || 7,
    lastWatered: null,
    lastPruned: null,
    treatmentMonths: data.treatmentMonths || [],
    lastTreated: null,
    treatmentProduct: data.treatmentProduct || '',
    pruneMonths: data.pruneMonths || [],
    notes: data.notes || '',
    history: [{ date: todayStr(), type: 'planted', note: 'Planted in the garden' }],
  };
}

function addLog(state, icon, label, points = 0){
  state.log.unshift({ date: todayStr(), icon, label, points });
  if(state.log.length > 600) state.log.length = 600;
}

function pushHistory(tree, type, note){
  tree.history.unshift({ date: todayStr(), type, note });
  if(tree.history.length > 200) tree.history.length = 200;
}
