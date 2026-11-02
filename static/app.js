'use strict';

const $ = s => document.querySelector(s);

let FRAMES = [];            // [{name, rows, cols, bytes, path, columns:[{name,dtype}]}]
const OPEN = new Set();     // expanded frame names
const CARDS = [];           // newest first
let RUNNING = false;
let REVEAL = null;          // frame to scroll to on the next rail render


/* ---------------- themes ---------------- */
const THEMES = {
  daylight: { label: 'Daylight', v: {
    bg:'#e9ebef', panel:'#ffffff', panel2:'#f6f7f9', panel3:'#f2f4f7', zebra:'#fbfcfd',
    line:'#dadfe5', line2:'#ebeff3', ink:'#171b20', ink2:'#404a55', ink3:'#636e7a', ink4:'#a8b0ba',
    accent:'#2f6feb', accentOn:'#ffffff', accentWeak:'#e8f0fd', accentInk:'#1b3f87', accentLine:'#b9cdf3',
    rowHover:'#f1f5fb', rowSel:'#eaf2fd', rowSelHover:'#dfebfb',
    nullTrack:'#dfe3e8', nullFill:'#c8912f', ckBorder:'#c3ccd6',
    goodWeak:'#e6f4ec', good:'#12784f', bad:'#b42318', warn:'#a35f00',
    hFloat:'#157d4e', hInt:'#4149bb', hStr:'#96601a', hBool:'#25708f', hDate:'#6b3fa8' } },
  fog: { label: 'Fog', v: {
    bg:'#d9dde2', panel:'#f0f2f5', panel2:'#e6e9ed', panel3:'#eaedf1', zebra:'#edf0f3',
    line:'#c6ccd4', line2:'#dde1e7', ink:'#14171b', ink2:'#3d444c', ink3:'#646d77', ink4:'#8d959f',
    accent:'#2a64d8', accentOn:'#ffffff', accentWeak:'#dde8fa', accentInk:'#17376f', accentLine:'#adc3ea',
    rowHover:'#e3ebf6', rowSel:'#dde8f9', rowSelHover:'#d4e2f7',
    nullTrack:'#cfd5dc', nullFill:'#b8822a', ckBorder:'#b4bcc6',
    goodWeak:'#dfeee7', good:'#0f6f49', bad:'#a01f14', warn:'#8a5200',
    hFloat:'#126b43', hInt:'#3b42a8', hStr:'#875413', hBool:'#1f627e', hDate:'#5d3595' } },
  steel: { label: 'Steel', v: {
    bg:'#282b2f', panel:'#31353a', panel2:'#373b41', panel3:'#2d3136', zebra:'#35393e',
    line:'#454b53', line2:'#3b4148', ink:'#eef1f4', ink2:'#c2c9d1', ink3:'#9aa2ac', ink4:'#6f7681',
    accent:'#6ba1ff', accentOn:'#0c1a2e', accentWeak:'rgba(107,161,255,.16)', accentInk:'#c3d8ff',
    accentLine:'rgba(107,161,255,.42)',
    rowHover:'#3c4249', rowSel:'#2e3f55', rowSelHover:'#354a66',
    nullTrack:'#4a515a', nullFill:'#e0a94e', ckBorder:'#6a727d',
    goodWeak:'rgba(90,200,150,.16)', good:'#6fd3a4', bad:'#ff8a7a', warn:'#e0a94e',
    hFloat:'#6fd3a4', hInt:'#a3aeff', hStr:'#e8b06c', hBool:'#77c6e6', hDate:'#c39cf5' } },
  charcoal: { label: 'Charcoal', v: {
    bg:'#191a1b', panel:'#202122', panel2:'#262728', panel3:'#1d1e1f', zebra:'#232425',
    line:'#333436', line2:'#292a2c', ink:'#ececed', ink2:'#b9b9bc', ink3:'#8e8e93', ink4:'#636367',
    accent:'#7aa2ff', accentOn:'#0d1729', accentWeak:'rgba(122,162,255,.15)', accentInk:'#c9d9ff',
    accentLine:'rgba(122,162,255,.4)',
    rowHover:'#28292a', rowSel:'#222834', rowSelHover:'#282f3c',
    nullTrack:'#37383a', nullFill:'#d9a24a', ckBorder:'#5e5f63',
    goodWeak:'rgba(90,200,150,.15)', good:'#6fce9f', bad:'#ff8a7a', warn:'#d9a24a',
    hFloat:'#68c994', hInt:'#9fa9ff', hStr:'#e2aa66', hBool:'#72bfdf', hDate:'#bd95f2' } },
  slate: { label: 'Slate', v: {
    bg:'#161a20', panel:'#1d222a', panel2:'#232932', panel3:'#191e25', zebra:'#20252d',
    line:'#2e3641', line2:'#252c36', ink:'#e7ecf2', ink2:'#b3bdc9', ink3:'#83909e', ink4:'#566170',
    accent:'#4a8cff', accentOn:'#071426', accentWeak:'rgba(74,140,255,.15)', accentInk:'#b8cffe',
    accentLine:'rgba(74,140,255,.4)',
    rowHover:'#242b34', rowSel:'#192638', rowSelHover:'#1e2f45',
    nullTrack:'#333b46', nullFill:'#d9a04a', ckBorder:'#4b5562',
    goodWeak:'rgba(70,190,140,.15)', good:'#5fd0a0', bad:'#ff8a7a', warn:'#d9a04a',
    hFloat:'#57c98a', hInt:'#8f9dff', hStr:'#e5a95f', hBool:'#6cb8dc', hDate:'#b98ef0' } },
  navy: { label: 'Navy', v: {
    bg:'#0f141e', panel:'#151b27', panel2:'#1a212f', panel3:'#121824', zebra:'#181e2b',
    line:'#25303f', line2:'#1d2634', ink:'#e3eaf6', ink2:'#abb7cb', ink3:'#7b8ba3', ink4:'#526074',
    accent:'#5b9dff', accentOn:'#061020', accentWeak:'rgba(91,157,255,.16)', accentInk:'#bdd6ff',
    accentLine:'rgba(91,157,255,.42)',
    rowHover:'#1c2432', rowSel:'#152439', rowSelHover:'#192c45',
    nullTrack:'#2b3547', nullFill:'#dfa748', ckBorder:'#445269',
    goodWeak:'rgba(80,195,150,.15)', good:'#63cfa4', bad:'#ff8a7a', warn:'#dfa748',
    hFloat:'#5fcb92', hInt:'#94a4ff', hStr:'#e3ab63', hBool:'#6fbada', hDate:'#bb93f1' } }
};

function applyTheme(name) {
  const t = THEMES[name] || THEMES.charcoal;
  const st = document.documentElement.style;
  for (const [k, val] of Object.entries(t.v)) st.setProperty('--' + k, val);
  document.documentElement.dataset.theme = name;
  try { localStorage.setItem('wb-theme', name); } catch (e) {}
  const sel = document.getElementById('themeSel');
  if (sel && sel.value !== name) sel.value = name;
}

/* ---------------- helpers ---------------- */
const fmtBytes = n => {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB';
  return n + ' B';
};
const fmtInt = n => n.toLocaleString('en-GB');
const dtClass = t => {
  if (t.startsWith('float')) return 'f';
  if (t.startsWith('int')) return 'i';
  if (t.startsWith('bool')) return 'b';
  if (t.startsWith('datetime')) return 'd';
  return 's';
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function api(path, body) {
  const r = await fetch(path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({ error: 'bad response' }));
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}

/* What a column click should insert depends on where the caret is.
   inside a quote:      on='            -> cell_id
   just after = ( [ ,:  on=             -> 'cell_id'
   anywhere else:                       -> drive_test['cell_id']           */
function columnTextFor(el, frameName, colName) {
  const v = el.value;
  const a = el.selectionStart ?? v.length;
  const before = v.slice(0, a);
  const odd = q => ((before.split(q).length - 1) % 2) === 1;
  const q = odd("'") ? "'" : odd('"') ? '"' : null;
  if (q) {
    // finish the token for them, unless they already typed the closing quote
    const after = v.slice(el.selectionEnd ?? a);
    return after.trimStart().startsWith(q) ? colName : colName + q;
  }
  const tail = before.replace(/\s+$/, '');
  // frame[  ->  close the subscription for them
  if (/\[$/.test(tail)) return `'${colName}']`;
  if (/[=(,:]$/.test(tail)) {
    const after = v.slice(el.selectionEnd ?? a);
    // they already typed the quotes: on=''  ->  fill the middle
    if (/^\s*['"]/.test(after)) return colName;
    return `'${colName}'`;
  }
  return `${frameName}['${colName}']`;
}

function insertAtCursor(text) {
  const el = $('#run');
  const a = el.selectionStart ?? el.value.length;
  const b = el.selectionEnd ?? a;
  el.value = el.value.slice(0, a) + text + el.value.slice(b);
  const pos = a + text.length;
  el.focus();
  el.setSelectionRange(pos, pos);
  el.dispatchEvent(new Event('input'));
}

/* ---------------- rail ---------------- */
function renderFrames() {
  $('#fcount').textContent = FRAMES.length + (FRAMES.length === 1 ? ' frame' : ' frames');
  const el = $('#frames');
  if (!FRAMES.length) {
    el.innerHTML = '<div style="padding:14px 12px;font-size:11.5px;color:var(--ink4)">' +
      'Nothing loaded. Use + Add file.</div>';
    return;
  }
  el.innerHTML = FRAMES.map(f => {
    const open = OPEN.has(f.name);
    const pending = f.loaded === false;
    const cols = open ? `<div class="cols">${f.columns.map(c => {
      const insText = c.index ? `${f.name}.index` : `${f.name}['${c.name}']`;
      return `<div class="colrow" data-frame="${esc(f.name)}" data-col="${esc(c.name)}" ${c.index ? 'data-idx="1"' : ''} title="insert ${esc(insText)}">
         <span class="cn">${esc(c.name)}${c.index ? '<span class="idxmark">index</span>' : ''}</span>
         <span class="cd dtype ${dtClass(c.dtype)}">${esc(c.dtype)}</span>
       </div>`;
    }).join('')}</div>` : '';
    return `<div class="frame ${open ? 'open' : ''} ${pending ? 'pending' : ''}" data-name="${esc(f.name)}">
      <div class="frow">
        <span class="caret ${open ? 'open' : ''}" data-toggle="1">${pending ? '·' : '›'}</span>
        <span class="fname" data-name="${esc(f.name)}">${esc(f.name)}</span>
        <button class="fx" data-drop="${esc(f.name)}" title="remove">×</button>
      </div>
      ${f.origin ? (f.origin === f.source
        ? `<div class="fsrc" title="loaded from ${esc(f.path)}">${esc(f.source)}</div>`
        : `<div class="fsrc code" data-origin="${esc(f.name)}"
              title="click to see the full expression">${esc(f.origin)}</div>`) : ''}
      <div class="fmeta">${fmtInt(f.rows)} × ${f.cols}${pending ? ' · <span class="notloaded">not loaded</span>' : ' · ' + fmtBytes(f.bytes)}</div>
      ${cols}
    </div>`;
  }).join('');

  el.querySelectorAll('.fname').forEach(n => n.onclick = e => {
    e.stopPropagation();
    const f = FRAMES.find(x => x.name === n.dataset.name);
    if (f && f.loaded === false) return loadFrame(f.name);
    insertAtCursor(n.dataset.name);
  });
  el.querySelectorAll('[data-toggle]').forEach(c => c.onclick = e => {
    e.stopPropagation();
    const name = c.closest('.frame').dataset.name;
    OPEN.has(name) ? OPEN.delete(name) : OPEN.add(name);
    renderFrames();
  });
  el.querySelectorAll('[data-drop]').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    const name = b.dataset.drop;
    try {
      const r = await api('/api/drop', { name });
      FRAMES = r.frames; OPEN.delete(name); renderFrames(); autosave();
    } catch (err) { toast(err.message); }
  });
  el.querySelectorAll('.fsrc.code').forEach(d => d.onclick = e => {
    e.stopPropagation();
    showOrigin(d.dataset.origin);
  });
  el.querySelectorAll('.colrow').forEach(c => c.onclick = () =>
    insertAtCursor(c.dataset.idx ? `${c.dataset.frame}.index`
                                 : columnTextFor($('#run'), c.dataset.frame, c.dataset.col)));

  // re-rendering resets the rail to the top: bring the frame we just made into view
  if (REVEAL) {
    const target = [...el.querySelectorAll('.frame')].find(f => f.dataset.name === REVEAL);
    if (target) {
      target.scrollIntoView({ block: 'nearest' });
      target.classList.add('justadded');
    }
    REVEAL = null;
  }
}

let PLOTLY_PROMISE = null;
function ensurePlotly() {
  if (window.Plotly) return Promise.resolve();
  if (!PLOTLY_PROMISE) {
    PLOTLY_PROMISE = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '/plotly.min.js';
      s.onload = () => res();
      s.onerror = () => rej(new Error('plotly.min.js failed to load'));
      document.head.appendChild(s);
    });
  }
  return PLOTLY_PROMISE;
}

async function drawChart(holder) {
  try {
    await ensurePlotly();
  } catch (e) {
    holder.innerHTML = `<div class="errmsg">${esc(e.message)}</div>`;
    return;
  }
  const spec = holder._spec || {};
  const layout = Object.assign({}, spec.layout, {
    template: 'plotly_dark',
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#b9b9bc', size: 11 },
    margin: { l: 54, r: 18, t: 28, b: 42 },
    height: 340,
    autosize: true,
  });
  Plotly.newPlot(holder, spec.data || [], layout,
                 { responsive: true, displaylogo: false,
                   modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'] });
}

async function showOrigin(name) {
  let info;
  try { info = await api('/api/origin', { name }); } catch (e) { toast(e.message); return; }
  const code = info.code || '(no expression recorded)';
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="picker" style="width:min(760px,94%)">
    <h3>how <span style="text-transform:none;letter-spacing:0;color:var(--ink2)">${esc(name)}</span> was made</h3>
    <pre class="originpre">${esc(code)}</pre>
    <div class="pfoot" style="justify-content:space-between">
      <span style="font-size:11px;color:var(--ink4)">${esc(info.path || 'created by an expression')}</span>
      <span style="display:flex;gap:8px">
        <button class="ghost" data-ocopy="1">Copy</button>
        <button class="ghost" data-oclose="1">Close</button>
      </span>
    </div>
  </div>`;
  document.body.appendChild(scrim);
  const close = () => scrim.remove();
  scrim.querySelector('[data-oclose]').onclick = close;
  scrim.onclick = e => { if (e.target === scrim) close; };
  scrim.querySelector('[data-ocopy]').onclick = async () => {
    const ok = await copyText(code);
    toast(ok ? 'copied the expression' : 'clipboard blocked — select the text and press ⌘C', !ok);
  };
  scrim.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

async function loadFrame(name) {
  try {
    const r = await api('/api/load', { name });
    FRAMES = r.frames || FRAMES;
    if (r.error) { toast(r.error); renderFrames(); return; }
    OPEN.add(name);
    renderFrames();
    toast(`loaded ${name} in ${r.elapsed} s`, false);
  } catch (e) { toast(e.message); }
}

let SAVE_TIMER = null;
function autosave() {
  clearTimeout(SAVE_TIMER);
  SAVE_TIMER = setTimeout(() => {
    api('/api/session/save', {
      auto: true,
      transcript: CARDS.slice().reverse().map(c => c.code).filter(Boolean),
      history: HISTORY,
    }).catch(() => { /* autosave is best effort; never interrupt the user for it */ });
  }, 1200);
}

function toast(msg, bad = true) {
  const d = document.createElement('div');
  d.textContent = msg;
  const skin = bad
    ? 'background:#332222;color:#ff8a7a;border:1px solid #5a2b2b'
    : 'background:#1e2b24;color:#6fce9f;border:1px solid #2f4a3b';
  d.style.cssText = 'position:fixed;top:52px;right:16px;' + skin +
    ';padding:9px 15px;border-radius:8px;font-size:12px;z-index:40;max-width:640px;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.5)';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 4200);
}

/* navigator.clipboard needs a secure context. This app runs on plain http over
   the LAN, so it is unavailable there — fall back to the old execCommand path. */
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}

/* ---------------- cards ---------------- */
let RENDERING = false;

function renderCards() {
  if (RENDERING) return;
  RENDERING = true;
  try { paintCards(); } finally { RENDERING = false; }
}

function paintCards() {
  const host = $('#cards');
  const empty = $('#empty');
  // clear first: returning early for the empty state used to leave the last
  // card in the DOM underneath the "No results yet" overlay
  host.querySelectorAll('.card').forEach(n => { if (n.parentNode) n.parentNode.removeChild(n); });
  if (!CARDS.length) {
    empty.style.display = '';
    // "add a file" is wrong advice once files are already in the tree
    const h2 = empty.querySelector('h2'), par = empty.querySelector('p');
    h2.textContent = FRAMES.length ? 'Nothing run yet' : 'No results yet';
    par.innerHTML = (FRAMES.length ? 'Type' : 'Add a file, then type')
      + ' pandas in the bar below and press <b>Enter</b>. '
      + 'Assign with <code>name = ...</code> to keep a frame.';
    return;
  }
  empty.style.display = 'none';
  const frag = document.createDocumentFragment();
  for (const c of CARDS) frag.appendChild(cardEl(c));
  host.appendChild(frag);
  host.querySelectorAll('.card').forEach(decorate);
  host.querySelectorAll('.chart').forEach(drawChart);
}

/* parquet wins on big frames and loses badly on small ones — the footer said so
   by putting PARQUET first on a 12-row result, which is just wrong. Suggest by size. */
function exportButtons(c) {
  const rows = (c.card && c.card.total) || 0;
  const big = rows > 200000;
  const mk = (fmt, label, hint, primary) =>
    `<a class="tiny" style="text-decoration:none" title="${hint}"
        href="/api/export?name=${encodeURIComponent(c.lastFrame)}&fmt=${fmt}">
       <button class="tiny ${primary ? '' : 'ghost'}">${label}</button></a>`;
  const parq = mk('parquet', 'PARQUET',
    big ? 'about a quarter the size of CSV at this row count' : 'bigger than CSV below a few thousand rows',
    big);
  const csv = mk('csv', 'CSV', 'plain text, opens anywhere', !big);
  return big ? parq + csv : csv + parq;
}

function decorate(card) {
  const gw = card.querySelector('.gridwrap');
  if (!gw) return;
  const t = gw.querySelector('table');
  if (!t) return;
  const overX = t.scrollWidth > gw.clientWidth + 1;
  const overY = t.scrollHeight > gw.clientHeight + 1;
  gw.classList.toggle('overx', overX);
  gw.classList.toggle('overy', overY);
  const note = card.querySelector('.note');
  if (note) {
    const base = note.dataset.base || (note.dataset.base = note.textContent);
    note.textContent = base + (overX ? ' · scroll sideways →' : '');
  }
}

function cardEl(c) {
  const wrap = document.createElement('div');
  if (!c.card && !c.error) {
    wrap.className = 'card restored';
    wrap.innerHTML = `
      <div class="chead">
        <span class="expr">${esc(c.code)}</span>
        <span class="cmeta">restored — not run</span>
      </div>
      <div class="cfoot">
        <span class="note"></span>
        <button class="tiny ghost" data-load="1" title="put this expression back in the run box">↩</button>
        <button class="tiny ghost" data-copy="1" title="copy the expression text">Copy</button>
        <button class="tiny ghost" data-dismiss="1" title="remove this from view">×</button>
      </div>`;
    wireCard(wrap, c);
    return wrap;
  }
  if (c.error) {
    wrap.className = 'card err';
    wrap.innerHTML = `
      <div class="chead">
        <span class="expr">${esc(c.code || '')}</span>
        <span class="cmeta">${c.elapsed != null ? c.elapsed + ' s' : ''}</span>
      </div>
      <div class="errmsg">${esc(c.error)}</div>
      <div class="cfoot">
        <span class="note"></span>
        <button class="tiny ghost" data-load="1" title="put this expression back in the run box to fix it">↩</button>
        <button class="tiny ghost" data-copy="1" title="copy the expression text">Copy</button>
        <button class="tiny ghost" data-dismiss="1" title="remove this error from view">×</button>
      </div>`;
    wireCard(wrap, c);
    return wrap;
  }

  // the grid shows the index as a column; say so, or the count disagrees with the tree
  const shape = c.card && c.card.kind === 'frame'
    ? (c.card.indexed
        ? `${fmtInt(c.card.total)} × ${c.card.columns.length - 1} + index`
        : `${fmtInt(c.card.total)} × ${c.card.columns.length}`)
    : 'value';
  let created = (c.created && c.created.length)
    ? `<span class="newchip">new frame ${esc(c.created.join(', '))}</span>` : '';
  if (!created && c.assigned && c.assigned.length) {
    created = `<span class="newchip">${c.kept ? 'named' : 'updated'} ${esc(c.assigned.join(', '))}</span>`;
  }

  let body = '';
  if (c.card && c.card.kind === 'frame') {
    const cols = c.card.columns;
    let rowsData = c.card.rows;
    if (c.sort) {
      const i = cols.indexOf(c.sort.col);
      if (i > -1) {
        const dir = c.sort.dir === 'desc' ? -1 : 1;
        rowsData = rowsData.slice().sort((a, b) => {
          const x = a[i], y = b[i];
          if (x === null || x === undefined) return 1;
          if (y === null || y === undefined) return -1;
          if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
          return String(x).localeCompare(String(y)) * dir;
        });
      }
    }
    const head = '<tr>' + cols.map(n => {
      const on = c.sort && c.sort.col === n;
      const mark = on ? (c.sort.dir === 'desc' ? ' ↓' : ' ↑') : '';
      return `<th data-sort="${esc(n)}" title="sort the rows shown">${esc(n)}${mark}</th>`;
    }).join('') + '</tr>';
    const rows = rowsData.map(r => '<tr>' + r.map(v => {
      const isNull = v === null || v === undefined;
      const isNum = !isNull && typeof v === 'number';
      const shown = isNum && !Number.isInteger(v) ? String(Number(v.toPrecision(7))) : v;
      return `<td class="${isNum ? 'num' : ''} ${isNull ? 'null' : ''}">${isNull ? 'null' : esc(shown)}</td>`;
    }).join('') + '</tr>').join('');
    body = `<div class="gridwrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
  } else if (c.card && c.card.kind === 'value') {
    body = `<div class="errmsg" style="color:var(--ink2)">${esc(c.card.value)}</div>`;
  }

  let shownNote = '';
  if (c.card && c.card.kind === 'frame') {
    const bits = [];
    bits.push(`${c.card.columns.length} columns`);
    if (c.card.shown < c.card.total) bits.push(`first ${c.card.shown} of ${fmtInt(c.card.total)} rows`);
    if (c.sort) bits.push('sorted the rows shown only');
    shownNote = bits.join(' · ');
  }

  if (c.card && c.card.kind === 'image') {
    const imgs = c.card.images || [];
    const kb = imgs.reduce((n, i) => n + i.bytes, 0) / 1000;
    wrap.className = 'card';
    wrap.innerHTML = `
      <div class="chead">
        <span class="expr">${esc(c.code)}</span>
        <span class="cmeta">${imgs.length} figure${imgs.length === 1 ? '' : 's'} · ${kb.toFixed(0)} KB · <b>${c.elapsed ?? '?'} s</b></span>
      </div>
      <div class="imgs ${imgs.length > 1 ? 'multi' : ''}">${imgs.map((im, i) =>
        `<img alt="figure ${i + 1}" src="data:image/png;base64,${im.b64}">`).join('')}</div>
      <div class="cfoot">
        <span class="note">rendered with matplotlib, ${imgs.length === 1 ? 'one figure' : imgs.length + ' figures'}</span>
        <button class="tiny ghost" data-load="1" title="put this expression back in the run box">↩</button>
        <button class="tiny ghost" data-savepng="1" title="save the PNG">PNG</button>
        <button class="tiny ghost" data-copy="1" title="copy the expression text">Copy</button>
        <button class="tiny ghost" data-dismiss="1" title="remove this result from view">×</button>
      </div>`;
    wireCard(wrap, c);
    return wrap;
  }

  if (c.card && c.card.kind === 'chart') {
    wrap.className = 'card';
    wrap.innerHTML = `
      <div class="chead">
        <span class="expr">${esc(c.code)}</span>
        <span class="cmeta">${c.card.traces} traces · ${fmtInt(c.card.points)} points · <b>${c.elapsed ?? '?'} s</b></span>
      </div>
      <div class="chart"></div>
      <div class="cfoot">
        <span class="note">${(c.card.bytes / 1e6).toFixed(2)} MB of figure JSON</span>
        <button class="tiny ghost" data-load="1" title="put this expression back in the run box">↩</button>
        <button class="tiny ghost" data-png="1" title="save this chart as a PNG">PNG</button>
        <button class="tiny ghost" data-copy="1" title="copy the expression text">Copy</button>
        <button class="tiny ghost" data-dismiss="1" title="remove this result from view">×</button>
      </div>`;
    const holder = wrap.querySelector('.chart');
    holder._spec = c.card.spec;
    wireCard(wrap, c);
    return wrap;
  }

  wrap.className = 'card';
  wrap.innerHTML = `
    <div class="chead">
      <span class="expr" title="click to load this expression back into the run box">${esc(c.code)}</span>
      ${created}
      <span class="cmeta">${shape} · <b>${c.elapsed ?? '?'} s</b></span>
    </div>
    ${body}
    <div class="cfoot">
      <span class="note">${shownNote}</span>
      <button class="tiny ghost" data-load="1" title="put this expression back in the run box">↩</button>
      <button class="tiny ghost" data-expand="1" title="taller table">⤢</button>
      ${c.card && c.card.kind === 'frame' && !(c.assigned && c.assigned.length)
        ? '<button class="tiny" data-keep="1" title="keep this result as a named frame, without re-running it">Save as…</button>' : ''}
      <button class="tiny ghost" data-copy="1" title="copy the expression text">Copy</button>
      ${c.lastFrame ? exportButtons(c) : ''}
      <button class="tiny ghost" data-dismiss="1" title="remove this result from view">×</button>
    </div>`;
  wireCard(wrap, c);
  return wrap;
}

/* footer wiring shared by result cards and error cards */
function wireCard(wrap, c) {
  const exprEl = wrap.querySelector('.expr');
  if (exprEl) {
    exprEl.title = 'click to edit this expression — Enter runs it';
    exprEl.onclick = () => {
      const inp = document.createElement('input');
      inp.className = 'exprinput';
      inp.value = c.code || '';
      exprEl.replaceWith(inp);
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
      inp.onkeydown = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const code = inp.value.trim();
          if (!code) { renderCards(); return; }
          inp.onblur = null;          // removing this card would fire it mid-render
          $('#run').value = code;
          runCode();
        }
        if (e.key === 'Escape') { e.preventDefault(); inp.onblur = null; renderCards(); }
      };
      inp.onblur = () => { inp.onblur = null; if (inp.isConnected) renderCards(); };
    };
  }
  wrap.querySelectorAll('th[data-sort]').forEach(th => th.onclick = () => {
    const col = th.dataset.sort;
    if (c.sort && c.sort.col === col) {
      c.sort = c.sort.dir === 'asc' ? { col, dir: 'desc' } : null;
    } else {
      c.sort = { col, dir: 'asc' };
    }
    renderCards();
  });
  const load = wrap.querySelector('[data-load]');
  if (load) load.onclick = () => insertAtCursor(c.code);
  const exp = wrap.querySelector('[data-expand]');
  if (exp) exp.onclick = () => {
    wrap.querySelector('.gridwrap').classList.toggle('tall');
    decorate(wrap);
  };
  const cp = wrap.querySelector('[data-copy]');
  if (cp) cp.onclick = async () => {
    const ok = await copyText(c.code);
    if (ok) { toast('copied the expression line — paste with ⌘V', false); return; }
    // never claim success. Over plain http the clipboard API is blocked, so hand
    // the text back selected and let the browser's own ⌘C do the work.
    const el = $('#run');
    el.value = c.code;
    el.focus();
    el.setSelectionRange(0, c.code.length);
    autoGrow();
    toast('http origin — the clipboard API is blocked here, so the expression is '
        + 'selected in the run box. Press ⌘C.', true);
  };
  const keep = wrap.querySelector('[data-keep]');
  if (keep) keep.onclick = () => {
    const foot = wrap.querySelector('.cfoot');
    foot.innerHTML = `<span class="note">keep as</span>
      <input class="keepname" spellcheck="false" placeholder="name" autocomplete="off">
      <button class="tiny" data-keepgo="1">Save</button>
      <button class="tiny ghost" data-keepcancel="1">Cancel</button>`;
    const inp = foot.querySelector('.keepname');
    inp.focus();
    const save = async () => {
      const name = inp.value.trim();
      if (!name) return;
      try {
        const r = await api('/api/keep', { rid: c.rid, name, code: c.code });
        FRAMES = r.frames; REVEAL = name; renderFrames();
        toast(`kept as ${name} — no re-run`, false);
        c.assigned = [name]; c.rid = null; c.kept = true;
        renderCards();
      } catch (e) { toast(e.message); }
    };
    inp.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.preventDefault(); renderCards(); }
    };
    foot.querySelector('[data-keepgo]').onclick = save;
    foot.querySelector('[data-keepcancel]').onclick = () => renderCards();
  };
  const sp = wrap.querySelector('[data-savepng]');
  if (sp) sp.onclick = () => {
    const im = wrap.querySelector('.imgs img');
    if (!im) return;
    const a = document.createElement('a');
    a.href = im.src;
    a.download = 'figure.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const png = wrap.querySelector('[data-png]');
  if (png) png.onclick = () => {
    const holder = wrap.querySelector('.chart');
    if (!window.Plotly || !holder) return;
    Plotly.downloadImage(holder, { format: 'png', width: 1400, height: 800,
                                   filename: 'chart' });
  };
  const dis = wrap.querySelector('[data-dismiss]');
  if (dis) dis.onclick = () => {
    const i = CARDS.indexOf(c);
    if (i > -1) CARDS.splice(i, 1);
    renderCards();
  };
}

/* ---------------- run ---------------- */
async function runCode() {
  const el = $('#run');
  const code = el.value.trim();
  if (!code || RUNNING) return;
  RUNNING = true;
  try {
    const r = await api('/api/run', { code });
    if (HISTORY[HISTORY.length - 1] !== code) HISTORY.push(code);
    FRAMES = r.frames || FRAMES;
    const card = {
      code: r.code || code, elapsed: r.elapsed, card: r.card, rid: r.card && r.card.rid,
      created: r.created || [], assigned: r.assigned || [], error: r.error || null,
      lastFrame: (r.created && r.created.length) ? r.created[r.created.length - 1]
        : (r.assigned && r.assigned.length) ? r.assigned[r.assigned.length - 1] : null,
    };
    CARDS.unshift(card);
    renderCards();
    renderFrames();
    autosave();
    if (r.created && r.created.length) OPEN.add(r.created[r.created.length - 1]);
    if (!r.error) el.value = '';
    autoGrow();
  } catch (err) {
    CARDS.unshift({ code, error: err.message, elapsed: null });
    renderCards();
  } finally {
    RUNNING = false;
    el.focus();
  }
}

function autoGrow() {
  const el = $('#run');
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

/* ---------------- staged file picker ---------------- */
async function openPicker() {
  let files = [];
  try { files = (await api('/api/files', {})).files; } catch (e) { toast(e.message); return; }
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="picker">
    <h3>open a file</h3>
    <div style="display:flex;gap:8px;padding:0 14px 12px">
      <input id="pickPath" placeholder="/Users/you/data/drive_test.csv" spellcheck="false"
             style="flex:1;font-family:var(--mono);font-size:11.5px;background:var(--panel2);
                    color:var(--ink);border:1px solid var(--line);border-radius:7px;
                    padding:7px 10px;outline:none">
      <button id="pickGo">Open</button>
    </div>
    <h3 style="padding-top:4px">or pick from the data folder</h3>
    ${files.map(f => `<div class="frow2" data-path="${esc(f.path)}" data-name="${esc(f.name)}">
        <span class="fn">${esc(f.name)}</span><span class="fs">${fmtBytes(f.bytes)}</span></div>`).join('')}
    <div class="pfoot"><button class="ghost" id="pickCancel">Cancel</button></div>
  </div>`;
  document.body.appendChild(scrim);
  const close = () => scrim.remove();
  scrim.querySelector('#pickCancel').onclick = close;
  scrim.onclick = e => { if (e.target === scrim) close(); };
  const pathIn = scrim.querySelector('#pickPath');
  const go = () => {
    const v = pathIn.value.trim();
    if (!v) return;
    close();
    openPreview(v);
  };
  scrim.querySelector('#pickGo').onclick = go;
  pathIn.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  setTimeout(() => pathIn.focus(), 40);
  scrim.querySelectorAll('.frow2').forEach(r => r.onclick = () => {
    close();
    openPreview(r.dataset.path);
  });
}

/* ---------------- import sheet ---------------- */
async function openPreview(path) {
  let p;
  try { p = await api('/api/preview', { path }); } catch (e) { toast(e.message); return; }

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  const rowsEst = p.rows_est ? '~' + fmtInt(p.rows_est) + ' rows' : '';
  sheet.innerHTML = `
    <div class="sheethead">
      <span class="fn">${esc(p.file)}</span>
      <span class="fm">${fmtBytes(p.bytes)} · ${rowsEst} · ${p.cols.length} columns</span>
      <span class="pill">preview ${p.elapsed} s</span>
      <span class="fm">profile on ${fmtInt(p.sampled_rows || 2000)} rows</span>
      <span class="grow" style="flex:1"></span>
      <button class="ghost" id="shAll">Select all</button>
      <button class="ghost" id="shNone">None</button>
      <button class="ghost" id="shCancel">Cancel</button>
    </div>
    <div class="sheetbody">
      <table><thead><tr>
        <th style="width:38px">#</th><th style="width:30px"></th>
        <th style="width:190px">Column</th><th style="width:70px">Type</th>
        <th style="width:76px">Nulls</th><th style="width:64px">Distinct</th>
        <th style="width:150px">Most common</th><th>Row 1</th><th>Row 2</th>
      </tr></thead><tbody id="shRows"></tbody></table>
    </div>
    <div class="sheetfoot">
      <label for="frameName">Name</label>
      <input id="frameName" value="${esc(p.suggested_name)}" spellcheck="false">
      <span class="nameerr" id="nameErr"></span>
      <span style="flex:1"></span>
      <span class="sumline" id="shSum"></span>
      <button class="primary" id="shImport">Import</button>
    </div>`;
  $('#main').appendChild(sheet);

  const picked = new Set(p.cols.map(c => c.name));
  let IMPORTING = false;

  function draw() {
    $('#shRows').innerHTML = p.cols.map((c, i) => {
      const on = picked.has(c.name);
      const nulls = c.nullpct > 0
        ? `<span class="nullbar"><i style="width:${Math.min(100, c.nullpct)}%"></i></span><span class="nullpct">${c.nullpct}%</span>`
        : '<span class="nullpct" style="opacity:.45">0</span>';
      const distinct = (c.distinct === null || c.distinct === undefined) ? '' : fmtInt(c.distinct);
      const top = c.top
        ? `<span class="samples">${esc(c.top)}</span><span class="nullpct">${fmtInt(c.topn)}</span>`
        : '<span class="null" style="font-size:10px">—</span>';
      return `<tr class="${on ? 'on' : ''}" data-col="${esc(c.name)}" title="${esc(c.range || '')}">
        <td class="cnum">${i + 1}</td>
        <td><span class="ck">${on ? '✓' : ''}</span></td>
        <td class="cnm">${esc(c.name)}</td>
        <td><span class="dtype ${dtClass(c.dtype)}">${c.dtype}</span></td>
        <td>${nulls}</td>
        <td class="cnum">${distinct}</td>
        <td>${top}</td>
        ${c.samples.slice(0, 2).map(s => `<td class="samples">${s === '' ? '<span class="null">null</span>' : esc(s)}</td>`).join('')}
      </tr>`;
    }).join('');
    $('#shRows').querySelectorAll('tr').forEach(tr => tr.onclick = () => {
      const n = tr.dataset.col;
      picked.has(n) ? picked.delete(n) : picked.add(n);
      draw();
    });
    $('#shSum').innerHTML = `<b>${picked.size}</b> of ${p.cols.length} selected`;
    if (!IMPORTING) $('#shImport').textContent = `Import ${picked.size} columns`;
    validateName();
  }

  function validateName() {
    const v = $('#frameName').value.trim();
    const ok = /^[A-Za-z_][A-Za-z0-9_]*$/.test(v) && !RESERVED.has(v);
    const taken = FRAMES.some(f => f.name === v);
    const bad = !ok || taken;
    $('#frameName').classList.toggle('bad', bad && v.length > 0);
    $('#nameErr').textContent = !v.length ? ''
      : taken ? 'name already used' : ok ? '' : 'letters, digits, _ only';
    $('#shImport').disabled = bad || picked.size === 0;
    return !bad;
  }

  async function doImport() {
    if (!validateName() || !picked.size) return;
    IMPORTING = true;
    $('#shImport').disabled = true;
    $('#shImport').textContent = 'Importing…';
    try {
      const r = await api('/api/import', {
        path: p.path, name: $('#frameName').value.trim(), usecols: [...picked],
      });
      FRAMES = r.frames;
      OPEN.add(r.name);
      REVEAL = r.name;
      renderFrames();
      sheet.remove();
      insertAtCursor(r.name);
      toast(`imported ${r.name} — ${fmtInt(r.rows)} × ${r.cols} in ${r.elapsed} s`, false);
      autosave();
    } catch (e) {
      toast(e.message);
      IMPORTING = false;
      $('#shImport').disabled = false;
      draw();
    }
  }

  $('#shImport').onclick = doImport;
  $('#shCancel').onclick = () => sheet.remove();
  $('#shAll').onclick = () => { p.cols.forEach(c => picked.add(c.name)); draw(); };
  $('#shNone').onclick = () => { picked.clear(); draw(); };
  $('#frameName').oninput = validateName;
  sheet.addEventListener('keydown', e => {
    if (e.key === 'Escape') sheet.remove();
    if (e.key === 'Enter' && (e.target.id === 'frameName' || e.metaKey || e.ctrlKey)) {
      e.preventDefault(); doImport();
    }
  });
  draw();
  setTimeout(() => $('#frameName')?.focus(), 30);
}

const RESERVED = new Set(('False None True and as assert async await break class continue def del elif else '
  + 'except finally for from global if import in is lambda nonlocal not or pass raise return try while '
  + 'with yield pd np print len sum min max list dict set str int float abs round sorted').split(' '));

/* ---------------- boot ---------------- */
const themeSel = document.getElementById('themeSel');
themeSel.innerHTML = Object.entries(THEMES)
  .map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('');
let savedTheme = 'charcoal';
try { savedTheme = localStorage.getItem('wb-theme') || 'charcoal'; } catch (e) {}
applyTheme(savedTheme);
themeSel.onchange = () => applyTheme(themeSel.value);

/* ---------------- rail: drag to resize, double-click to collapse ---------------- */
(function railControls() {
  const rail = document.querySelector('.rail');
  const grip = document.getElementById('railGrip');
  let savedW = '286', savedHidden = '';

  try {
    savedW = localStorage.getItem('wb-railw') || '286';
    savedHidden = localStorage.getItem('wb-railhidden') || '';
  } catch (e) {}
  document.documentElement.style.setProperty('--railw', savedW + 'px');
  if (savedHidden === '1') rail.classList.add('hidden');

  const remember = () => {
    try {
      localStorage.setItem('wb-railw',
        parseInt(getComputedStyle(document.documentElement).getPropertyValue('--railw'), 10) || 286);
      localStorage.setItem('wb-railhidden', rail.classList.contains('hidden') ? '1' : '');
    } catch (e) {}
  };

  let dragging = false;
  grip.addEventListener('mousedown', e => {
    if (rail.classList.contains('hidden')) return;
    dragging = true;
    document.body.classList.add('dragging');
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const left = document.body.getBoundingClientRect().left;
    const w = Math.max(180, Math.min(620, e.clientX - left));
    document.documentElement.style.setProperty('--railw', w + 'px');
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('dragging');
    remember();
  });

  const toggle = () => { rail.classList.toggle('hidden'); remember(); };
  grip.addEventListener('dblclick', toggle);
  window.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggle(); }
  });
})();

$('#addFile').onclick = openPicker;

/* session restart: two clicks, because it throws away every frame */
let RESET_ARMED = false;
let RESET_TIMER = null;
$('#saveBtn').onclick = async () => {
  const first = FRAMES.find(f => f.source);
  const label = (first ? first.source.replace(/\.[^.]+$/, '') : 'session');
  try {
    const r = await api('/api/session/save', {
      transcript: CARDS.slice().reverse().map(c => c.code).filter(Boolean),
      history: HISTORY,
      label,
    });
    toast(`saved ${r.file}`, false);
  } catch (e) { toast(e.message); }
};

$('#sessBtn').onclick = async () => {
  let sessions = [];
  try { sessions = (await api('/api/session/list', {})).sessions; } catch (e) { toast(e.message); return; }
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="picker" style="width:min(620px,94%)">
    <h3>saved sessions</h3>
    ${sessions.length ? sessions.map(s => `<div class="frow2" data-file="${esc(s.file)}">
        <span class="fn" style="flex:0 0 210px">${esc(s.file)}</span>
        <span class="fs" style="flex:1;color:var(--ink3)">${s.frames} frames · ${s.cells} cells</span>
        <span class="fs">${esc((s.saved || '').replace('T', ' ').replace('Z', ''))}</span>
      </div>`).join('') : '<div style="padding:16px;color:var(--ink3);font-size:12px">nothing saved yet</div>'}
    <div class="pfoot"><button class="ghost" id="sessClose">Close</button></div>
  </div>`;
  document.body.appendChild(scrim);
  const close = () => scrim.remove();
  scrim.querySelector('#sessClose').onclick = close;
  scrim.onclick = e => { if (e.target === scrim) close; };
  scrim.querySelectorAll('.frow2').forEach(row => row.onclick = async () => {
    try {
      const r = await api('/api/session/open', { file: row.dataset.file });
      FRAMES = r.frames || [];
      OPEN.clear();
      CARDS.length = 0;
      for (const code of (r.transcript || []).slice().reverse()) CARDS.push({ code });
      HISTORY.length = 0;
      (r.history || []).forEach(h => HISTORY.push(h));
      renderFrames();
      renderCards();
      close();
      toast(`opened ${row.dataset.file} — ${FRAMES.length} frames, none loaded yet`, false);
    } catch (e) { toast(e.message); }
  });
};

$('#notebookBtn').onclick = async () => {
  try {
    const r = await api('/api/notebook', { cells: CARDS.slice().reverse().map(c => c.code) });
    const blob = new Blob([JSON.stringify(r.notebook, null, 1)], { type: 'application/x-ipynb+json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = r.filename || 'session.ipynb';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(`exported ${r.notebook.cells.length} cells to ${a.download}`, false);
  } catch (e) { toast(e.message); }
};

$('#resetBtn').onclick = async () => {
  const btn = $('#resetBtn');
  if (!RESET_ARMED) {
    RESET_ARMED = true;
    btn.textContent = 'sure? loses frames';
    btn.classList.add('danger');
    clearTimeout(RESET_TIMER);
    RESET_TIMER = setTimeout(() => {
      RESET_ARMED = false;
      btn.textContent = 'restart';
      btn.classList.remove('danger');
    }, 4000);
    return;
  }
  clearTimeout(RESET_TIMER);
  RESET_ARMED = false;
  btn.textContent = 'restarting…';
  btn.classList.remove('danger');
  try {
    const r = await api('/api/reset', {});
    FRAMES = r.frames || [];
    OPEN.clear();
    CARDS.length = 0;
    HISTORY.length = 0;
    renderFrames();
    renderCards();
    toast(`session restarted in ${r.elapsed} s — frames, bindings and imports cleared`, false);
  } catch (e) {
    toast(e.message);
  } finally {
    btn.textContent = 'restart';
  }
};

/* what the run box can reach without an import */
$('#envBtn').onclick = async () => {
  let env = [];
  try { env = (await api('/api/env', {})).env; } catch (e) { toast(e.message); return; }
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="picker" style="width:min(560px,92%)">
    <h3>preloaded into the run box</h3>
    ${env.map(e => `<div class="frow2" style="cursor:default">
        <span class="fn" style="flex:0 0 96px">${esc(e.alias)}</span>
        <span class="fs" style="flex:1;color:var(--ink3)">${esc(e.module)}</span>
        ${e.version
          ? `<span class="fs" style="color:var(--good)">${esc(e.version)}</span>`
          : `<span class="fs" style="color:var(--bad)" title="${esc(e.error || '')}">not installed</span>`}
      </div>`).join('')}
    <div class="pfoot" style="justify-content:space-between">
      <span style="font-size:11px;color:var(--ink4)">edit config.py to change this list</span>
      <button class="ghost" id="envClose">Close</button>
    </div>
  </div>`;
  document.body.appendChild(scrim);
  scrim.querySelector('#envClose').onclick = () => scrim.remove();
  scrim.onclick = e => { if (e.target === scrim) scrim.remove(); };
};

const run = $('#run');
const HISTORY = [];
let HIST_IDX = -1;

run.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); HIST_IDX = -1; runCode(); return; }
  // up/down walk the expressions you already ran, like any REPL
  if (e.key === 'ArrowUp' && run.selectionStart === 0 && HISTORY.length) {
    e.preventDefault();
    HIST_IDX = Math.min(HIST_IDX + 1, HISTORY.length - 1);
    run.value = HISTORY[HIST_IDX];
    run.setSelectionRange(0, 0);
    autoGrow();
  }
  if (e.key === 'ArrowDown' && HIST_IDX >= 0) {
    e.preventDefault();
    HIST_IDX -= 1;
    if (HIST_IDX < 0) { run.value = ''; }
    else { run.value = HISTORY[HIST_IDX]; }
    run.setSelectionRange(0, 0);
    autoGrow();
  }
});
run.addEventListener('input', autoGrow);
// no dead lookups here: `$('#clock')` referenced an element that no longer exists,
// threw, and silently killed the initial render and the workspace sync below
renderFrames();
renderCards();
run.focus();

// the workspace lives on the server, like a kernel: a page reload must not orphan it
(async () => {
  try {
    const r = await api('/api/session/state', {});
    if (r.frames && r.frames.length) {
      FRAMES = r.frames;
      if (r.transcript && r.transcript.length && !CARDS.length) {
        r.transcript.slice().reverse().forEach(code => {
          if (!CARDS.length || CARDS[CARDS.length - 1].code !== code) CARDS.push({ code });
        });
      }
      (r.history || []).forEach(h => HISTORY.push(h));
      renderFrames();
      renderCards();
    }
  } catch (e) {
    // a silent catch here hid a broken sync from both of us for a while
    console.error('workspace sync failed', e);
    toast('could not read the server workspace — ' + e.message);
  }
})();
