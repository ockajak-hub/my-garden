'use strict';

/* ============================================================
   app.js — UI wiring: tabs, map, modal, toasts, confetti
   ============================================================ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let state = loadState();
let currentTab = 'garden';
let editingTreeId = null;
let selectedEmoji = '🌳';
let selectedMonths = [];

// Plum has no Unicode emoji, so it uses a tiny inline SVG icon.
const PLUM = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
  "<circle cx='32' cy='38' r='20' fill='#7b3fa0'/>" +
  "<ellipse cx='24' cy='30' rx='7' ry='5' fill='#a06bc0' opacity='.6'/>" +
  "<path d='M32 18c0-7 6-12 13-12-1 7-6 12-13 12z' fill='#4c8a34'/>" +
  "<path d='M32 19c-2 3-2 6-1 8' stroke='#6b4a2f' stroke-width='3' fill='none' stroke-linecap='round'/>" +
  "</svg>");

const SPECIES = ['🌳','🌲','🍎','🍊','🍐','🍑','🍒', PLUM, '🌺'];

function iconHtml(v){
  if(typeof v === 'string' && v.startsWith('data:image/svg+xml')){
    return `<img class="ico" src="${v}" alt="">`;
  }
  return escapeHtml(v);
}

/* ---------------- small helpers ---------------- */

function toast(msg, kind = ''){
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 4200);
}

function confetti(x, y){
  const layer = $('#confetti');
  const colors = ['#3e7d4f','#8bc34a','#ffc107','#42a5f5','#ff7043','#ffffff','#f48fb1'];
  for(let i = 0; i < 26; i++){
    const s = document.createElement('span');
    s.className = 'confetti-bit';
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 130;
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.background = colors[i % colors.length];
    if(i % 3 === 0) s.style.borderRadius = '50%';
    s.style.setProperty('--dx', (Math.cos(a) * v).toFixed(0) + 'px');
    s.style.setProperty('--dy', (Math.sin(a) * v * 0.9 - 40).toFixed(0) + 'px');
    s.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    layer.appendChild(s);
    setTimeout(() => s.remove(), 1300);
  }
}

function announceBadges(badges){
  badges.forEach((b, i) =>
    setTimeout(() => toast(`🏆 Badge unlocked: ${b.icon} ${b.name}!`, 'badge'), 400 * (i + 1)));
}

/* ---------------- tabs ---------------- */

function switchTab(name){
  currentTab = name;
  $$('#tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + name));
}

/* ---------------- actions ---------------- */

const CARE_UI = {
  water: { icon: '💧', verb: 'Water', past: 'watered', note: 'Watered' },
  prune: { icon: '✂️', verb: 'Prune', past: 'pruned',  note: 'Pruned' },
  treat: { icon: '🧪', verb: 'Treat', past: 'treated', note: 'Treated' },
};

function markCare(id, type, x, y){
  const tree = state.trees.find(t => t.id === id);
  if(!tree) return;
  const ui = CARE_UI[type];
  if(!ui) return;
  const today = todayStr();
  if(type === 'water') tree.lastWatered = today;
  else if(type === 'prune') tree.lastPruned = today;
  else if(type === 'treat') tree.lastTreated = today;

  let note = ui.note;
  if(type === 'treat' && tree.treatmentProduct) note += ': ' + tree.treatmentProduct;
  pushHistory(tree, type, note);

  const label = ui.past.charAt(0).toUpperCase() + ui.past.slice(1) + ' ' + tree.name;
  const fresh = registerCare(state, type, label, ui.icon);
  saveState(state);
  renderAll();
  if(x !== undefined) confetti(x, y);
  toast(`+${POINTS[type]} pts — ${ui.past} ${tree.name}`);
  announceBadges(fresh);
}

/* ---------------- render: stats + banner ---------------- */

function renderStats(){
  $('#stat-points').textContent = state.game.points;
  $('#stat-streak').textContent = state.game.streak;
  $('#stat-trees').textContent = state.trees.length;
  const due = dueTasks(state).length;
  $('#stat-due').textContent = due;
  $('#chip-due').classList.toggle('alert', due > 0);

  const banner = $('#due-banner');
  if(due){
    banner.innerHTML = `<b>📋 ${due} task${due > 1 ? 's' : ''} due</b>
      <a href="#" id="go-tasks" class="link">go to Tasks →</a>`;
    $('#go-tasks').onclick = e => { e.preventDefault(); switchTab('tasks'); renderAll(); };
  } else if(state.trees.length){
    banner.innerHTML = '<span class="dim">🌤️ All waterings and prunings are up to date.</span>';
  } else {
    banner.innerHTML = '';
  }
}

/* ---------------- render: map ---------------- */

function renderMap(){
  const layer = $('#trees-layer');
  layer.innerHTML = '';
  $('#garden-empty').hidden = state.trees.length > 0;
  for(const t of state.trees){
    const b = document.createElement('button');
    b.className = 'tree' + (isDueTree(t) ? ' due' : '');
    b.style.left = t.x + '%';
    b.style.top = t.y + '%';
    b.title = t.name;
    b.innerHTML = `<span class="sprite">${iconHtml(t.emoji)}</span><span class="tname">${escapeHtml(t.name)}</span>`;
    b.addEventListener('pointerdown', e => startDrag(e, t, b));
    layer.appendChild(b);
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function startDrag(e, tree, btn){
  if(e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY;
  let moved = false;

  const move = ev => {
    if(!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) moved = true;
    if(!moved) return;
    const r = $('#map').getBoundingClientRect();
    const x = Math.min(97, Math.max(3, (ev.clientX - r.left) / r.width * 100));
    const y = Math.min(94, Math.max(6, (ev.clientY - r.top) / r.height * 100));
    btn.style.left = x + '%';
    btn.style.top = y + '%';
    btn.classList.add('dragging');
  };

  const up = ev => {
    window.removeEventListener('pointermove', move);
    btn.classList.remove('dragging');
    if(moved){
      const r = $('#map').getBoundingClientRect();
      tree.x = Math.round(Math.min(97, Math.max(3, (ev.clientX - r.left) / r.width * 100)));
      tree.y = Math.round(Math.min(94, Math.max(6, (ev.clientY - r.top) / r.height * 100)));
      saveState(state);
    } else {
      openTreeModal(tree);
    }
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
}

/* ---------------- render: tasks ---------------- */

function renderTasks(){
  const wrap = $('#tasks-list');
  const items = dueTasks(state);
  if(!items.length){
    wrap.innerHTML = `<div class="empty">🎉 All caught up — nothing due right now!<br>
      <span class="dim">A task appears when a tree needs water, or when one of its prune months begins.</span></div>`;
    return;
  }
  let html = `<p class="sub">${items.length} task${items.length > 1 ? 's' : ''} due · complete them for points!</p>`;
  for(const it of items){
    const over = it.over > 0
      ? ` · <b class="over">overdue ${it.over} d</b>`
      : `<span class="dim"> · due today</span>`;
    const ui = CARE_UI[it.type];
    const product = it.type === 'treat' && it.tree.treatmentProduct
      ? ` <span class="dim">· ${escapeHtml(it.tree.treatmentProduct)}</span>` : '';
    html += `<div class="row task">
      <span class="t-emoji">${iconHtml(it.tree.emoji)}</span>
      <span class="t-name">${ui.icon} <b>${escapeHtml(it.tree.name)}</b> — ${ui.verb}${product}${over}</span>
      <button class="btn primary sm" data-care="${it.tree.id}:${it.type}">Done ✔ +${POINTS[it.type]}</button>
    </div>`;
  }
  wrap.innerHTML = html;
  $$('[data-care]', wrap).forEach(btn =>
    btn.addEventListener('click', e => {
      const [id, type] = btn.dataset.care.split(':');
      markCare(id, type, e.clientX, e.clientY);
    }));
}

/* ---------------- render: history ---------------- */

function renderHistory(){
  const wrap = $('#history-list');
  const g = state.game;
  let html = `<div class="sum-cards">
    <div class="sum"><b>💧 ${g.totalWaterings}</b><span>waterings</span></div>
    <div class="sum"><b>✂️ ${g.totalTrims}</b><span>prunings</span></div>
    <div class="sum"><b>🧪 ${g.totalTreatments || 0}</b><span>treatments</span></div>
    <div class="sum"><b>🔥 ${g.bestStreak}</b><span>best streak (days)</span></div>
    <div class="sum"><b>💎 ${g.points}</b><span>points</span></div>
  </div>`;
  if(!state.log.length){
    html += '<div class="empty">No activity yet — water or prune a tree to start your story! 🌿</div>';
  } else {
    html += state.log.map(l =>
      `<div class="h-row"><span>${l.icon}</span><span>${escapeHtml(l.label)}</span>
        <span class="dim">${fmtDate(l.date)}${l.points ? ' · +' + l.points : ''}</span></div>`).join('');
  }
  wrap.innerHTML = html;
}

/* ---------------- render: badges ---------------- */

function renderBadges(){
  const owned = state.game.badges.length;
  $('#badge-progress').textContent = `Unlocked ${owned} / ${BADGES.length} badges`;
  $('#badge-grid').innerHTML = BADGES.map(b => {
    const has = state.game.badges.includes(b.id);
    return `<div class="badge ${has ? 'on' : 'off'}">
      <span>${has ? b.icon : '🔒'}</span><b>${b.name}</b>
      <span class="dim">${b.desc}</span></div>`;
  }).join('');
}

/* ---------------- render: settings / map chrome ---------------- */

// Size the map box to the background image's real proportions.
function applyMapAspect(){
  const map = $('#map');
  const a = state.map.background ? state.map.bgAspect : null;
  map.classList.toggle('fit', !!a);
  map.style.aspectRatio = a ? String(a) : '';
}

function renderSettings(){
  const img = $('#map-bg');
  if(state.map.background){
    // older saves may not have the aspect yet: measure it once loaded
    img.onload = () => {
      if(state.map.background && !state.map.bgAspect && img.naturalHeight){
        state.map.bgAspect = img.naturalWidth / img.naturalHeight;
        saveState(state);
        applyMapAspect();
      }
    };
    img.src = state.map.background;
    img.hidden = false;
  } else {
    img.onload = null;
    img.removeAttribute('src');
    img.hidden = true;
  }
  applyMapAspect();
  $('#btn-bg-remove').disabled = !state.map.background;
  $('#grid-chk').checked = state.map.grid;
  const gridChk2 = $('#grid-chk2');
  if(gridChk2) gridChk2.checked = state.map.grid;
  $('#map').classList.toggle('grid', state.map.grid);
}

function renderAll(){
  renderStats();
  renderMap();
  renderTasks();
  renderHistory();
  renderBadges();
  renderSettings();
}

/* ---------------- modal: tree details ---------------- */

function openTreeModal(tree){
  editingTreeId = tree ? tree.id : null;
  const modal = $('#tree-modal');
  const name = $('#tm-name');
  const emoji = $('#tm-emoji');
  const planted = $('#tm-planted');
  const water = $('#tm-water');
  const notes = $('#tm-notes');
  const treatProduct = $('#tm-treat-product');

  if(tree){
    name.value = tree.name || '';
    emoji.innerHTML = iconHtml(tree.emoji);
    selectedEmoji = tree.emoji;
    planted.value = tree.planted || '';
    water.value = tree.waterEveryDays || 7;
    treatProduct.value = tree.treatmentProduct || '';
    notes.value = tree.notes || '';
    $('#tm-title').textContent = 'Edit tree';
    $('#tm-sub').textContent = 'Change details or care schedule';
    $('#tm-delete').hidden = false;
    $('#tm-care-now').hidden = false;
    $('#tm-next').innerHTML = '';
    $('#tm-history').innerHTML = '';
  } else {
    name.value = '';
    emoji.innerHTML = iconHtml('🌳');
    selectedEmoji = '🌳';
    planted.value = todayStr();
    water.value = 7;
    treatProduct.value = '';
    notes.value = '';
    $('#tm-title').textContent = 'New tree';
    $('#tm-sub').textContent = 'Add a tree to your garden';
    $('#tm-delete').hidden = true;
    $('#tm-care-now').hidden = true;
    $('#tm-next').innerHTML = '';
    $('#tm-history').innerHTML = '';
  }

  const months = []; for(let i = 1; i <= 12; i++) months.push(i);
  const monthsChk = months.map(m => {
    const btn = document.createElement('button');
    btn.className = 'month';
    btn.textContent = MONTHS[m-1];
    btn.dataset.month = m;
    if(tree && (tree.pruneMonths || []).includes(m)) btn.classList.add('on');
    btn.onclick = () => { btn.classList.toggle('on'); };
    return btn;
  });
  $('#tm-months').replaceChildren(...monthsChk);

  // Treatment months use the same chip picker as pruning
  const treatChk = months.map(m => {
    const btn = document.createElement('button');
    btn.className = 'month';
    btn.textContent = MONTHS[m-1];
    btn.dataset.month = m;
    if(tree && (tree.treatmentMonths || []).includes(m)) btn.classList.add('on');
    btn.onclick = () => { btn.classList.toggle('on'); };
    return btn;
  });
  $('#tm-treat-months').replaceChildren(...treatChk);

  // Update the emoji selector
  const ems = $('#tm-species');
  ems.innerHTML = '';
  SPECIES.forEach(e => {
    const b = document.createElement('button');
    b.className = 'emoji';
    b.innerHTML = iconHtml(e);
    b.onclick = () => {
      selectedEmoji = e;
      emoji.innerHTML = iconHtml(e);
      $$('#tm-species .emoji').forEach(x => x.classList.toggle('on', x === b));
    };
    if(tree ? tree.emoji === e : e === '🌳') b.classList.add('on');
    ems.appendChild(b);
  });

  // Update the next care info
  const next = [];
  if(tree){
    const w = waterDue(tree);
    if(w.next) next.push(`💧 Next watering: ${fmtDate(w.next)}`);
    const p = pruneDueInfo(tree);
    if(p.due) next.push('✂️ Needs pruning');
    else if(p.months.length){
      const nextM = p.months.filter(m => m > new Date().getMonth() + 1).shift();
      if(nextM) {
        const m = MONTHS[nextM - 1];
        next.push(`✂️ Prunes next: ${m}`);
      } else {
        const m = MONTHS[p.months[0] - 1];
        next.push(`✂️ Prunes next: ${m} (next year)`);
      }
    }

    const x = treatmentDue(tree);
    if(x.due) next.push('🧪 Needs chemical treatment');
    else if(x.months.length) next.push('🧪 Treatment months: ' + x.months.map(m => MONTHS[m-1]).join(', '));

    $('#tm-history').innerHTML =
      `<h4>History:</h4><div class="history">${tree.history.map(h =>
        `<div>${fmtDate(h.date)} — ${h.note}</div>`).join('')}</div>`;
  }

  if(next.length){
    $('#tm-next').innerHTML = `<h4>Next care:</h4><p>${next.join('<br/>')}</p>`;
  } else {
    $('#tm-next').innerHTML = '<p class="dim">Next care will be shown here once you water, prune or treat.</p>';
  }

  modal.hidden = false;
}

function saveTree(){
  const name = $('#tm-name').value.trim();
  if(!name){
    toast('Please give your tree a name', 'error');
    return;
  }
  const planted = $('#tm-planted').value;
  const water = Number($(tm-water').value);
  const treatProduct = $('#tm-treat-product').value.trim();
  const notes = $('#tm-notes').value;

  const months = $$('#tm-months .month.on').map(b => Number(b.dataset.month));
  const treatMonths = $$('#tm-treat-months .month.on').map(b => Number(b.dataset.month));

  if(editingTreeId){
    // Update existing tree
    const tree = state.trees.find(t => t.id === editingTreeId);
    if(tree){
      tree.name = name;
      tree.emoji = selectedEmoji;
      tree.planted = planted;
      tree.waterEveryDays = water;
      tree.treatmentMonths = treatMonths;
      tree.treatmentProduct = treatProduct;
      tree.pruneMonths = months;
      tree.notes = notes;
    }
  } else {
    // Create new tree
    const tree = makeTree({ name, emoji: selectedEmoji, x: 50, y: 50, planted, waterEveryDays: water, treatmentMonths: treatMonths, treatmentProduct: treatProduct, pruneMonths: months, notes });
    state.trees.push(tree);
    addLog(state, '🌱', `Planted ${tree.name}`, POINTS.plant);
    registerCare(state, 'plant', undefined, '');
  }

  saveState(state);
  renderAll();
  toast(editingTreeId ? 'Tree updated!' : 'Tree planted! 🌱');
  closeTreeModal();
}

function deleteTree(){
  if(!editingTreeId) return;
  const idx = state.trees.findIndex(t => t.id === editingTreeId);
  if(idx >= 0){
    const name = state.trees[idx].name;
    state.trees.splice(idx, 1);
    saveState(state);
    renderAll();
    toast(`Deleted ${name}`);
  }
  closeTreeModal();
}

function closeTreeModal(){
  $('#tree-modal').hidden = true;
  editingTreeId = null;
}

function uploadBgImage(e){
  const file = e.target.files[0];
  if(!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const data = ev.target.result;
    const probe = new Image();
    probe.onload = () => {
      state.map.background = data;
      state.map.bgAspect = probe.naturalWidth / probe.naturalHeight;
      if(!saveState(state)){
        toast('Image is too large for browser storage — try a smaller photo', 'error');
      }
      renderAll();
      toast('🖼️ Background set — map sized to the photo');
    };
    probe.onerror = () => toast('Could not read that image', 'error');
    probe.src = data;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function resetGarden(){
  if(!confirm('This will delete everything in your garden! Are you sure?')) return;
  const s = freshState();
  state = s;
  saveState(s);
  renderAll();
  toast('Garden cleared!');
}

function exportData(){
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-garden-backup.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function importData(e){
  const file = e.target.files[0];
  if(!file || file.type !== 'application/json') return;
  const reader = new FileReader();
  reader.onload = ev => {
    try{
      const imported = JSON.parse(ev.target.result);
      const s = normalizeState(imported);
      if(s.trees.length || s.log.length){
        state = s;
        saveState(s);
        renderAll();
        toast('Backup restored!');
      } else {
        toast('This file doesn’t contain garden data', 'error');
      }
    } catch(ex) {
      toast('Error reading backup file', 'error');
    }
  };
  reader.readAsText(file);
}

/* ---------------- init app ---------------- */

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  $$('#tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Modal actions
  $('#btn-plant').addEventListener('click', () => openTreeModal(null));
  $('#tm-save').addEventListener('click', saveTree);
  $('#tm-delete').addEventListener('click', deleteTree);
  $('#tm-cancel').addEventListener('click', closeTreeModal);
  $('#tm-close').addEventListener('click', closeTreeModal);

  // Quick care from inside the tree dialog
  $('#tm-water-btn').addEventListener('click', () => {
    if(!editingTreeId) return;
    markCare(editingTreeId, 'water');
    openTreeModal(state.trees.find(t => t.id === editingTreeId));
  });
  $('#tm-prune-btn').addEventListener('click', () => {
    if(!editingTreeId) return;
    markCare(editingTreeId, 'prune');
    openTreeModal(state.trees.find(t => t.id === editingTreeId));
  });
  $('#tm-treat-btn').addEventListener('click', () => {
    if(!editingTreeId) return;
    markCare(editingTreeId, 'treat');
    openTreeModal(state.trees.find(t => t.id === editingTreeId));
  });

  // Close dialog: click on backdrop or press Esc
  $('#tree-modal').addEventListener('click', e => {
    if(e.target.id === 'tree-modal') closeTreeModal();
  });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && !$('#tree-modal').hidden) closeTreeModal();
  });

  // Background image upload
  $('#btn-bg-upload').addEventListener('click', () => $('#bg-file').click());
  $('#bg-file').addEventListener('change', uploadBgImage);

  // Settings actions
  $('#btn-bg-remove').addEventListener('click', () => {
    state.map.background = null;
    state.map.bgAspect = null;
    saveState(state);
    renderAll();
    toast('Background removed');
  });

  $('#btn-export').addEventListener('click', exportData);
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', importData);
  $('#btn-reset').addEventListener('click', resetGarden);

  // Map grid toggle
  $$('#grid-chk, #grid-chk2').forEach(el => el.addEventListener('change', e => {
    state.map.grid = e.target.checked;
    saveState(state);
    renderAll();
  }));

  // Init
  renderAll();

  // Show tasks tab if any due
  const due = dueTasks(state);
  if(due.length) switchTab('tasks');
});