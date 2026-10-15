// ============================================================
// SỦNG THÚ LIỆT HỎA — Client
// ============================================================
const $ = id => document.getElementById(id);
const TILE = 32;

// Bản đồ (đồng bộ với server): # cây, . đường, , cỏ, H nhà hồi máu,
// M cửa hàng, W nước, N dân làng
const MAP = [
  '####################',
  '#H..#.N....,,,,,,..#',
  '#H..#......,,,,,,..#',
  '#.N.#......,,,,,,..#',
  '#...####...,,,,,,..#',
  '#...#......,,,,,,..#',
  '#M..#..WW..,,,,,,..#',
  '#...#..WW..,,,,,,..#',
  '#...#......,,,,,,..#',
  '#....N......N......#',
  '#..,,,,,,,,,,,,,...#',
  '#..,,,,,,,,,,,,,...#',
  '#..,,,,,,,,,,,,,...#',
  '#......N...........#',
  '####################'
];

const STARTER_INFO = [
  { id: 'hoa-ho', name: 'Hỏa Hồ', typeName: 'Hỏa', color: '#ff7043', desc: 'Chú cáo lửa tinh nghịch, chùm đuôi lúc nào cũng phừng phừng cháy.' },
  { id: 'thuy-quy', name: 'Thủy Quy', typeName: 'Thủy', color: '#29b6f6', desc: 'Rùa con hiền lành, trên mai vẽ hình sóng nước uốn lượn.' },
  { id: 'moc-mieu', name: 'Mộc Miêu', typeName: 'Mộc', color: '#43a047', desc: 'Mèo rừng nhanh nhẹn, đôi tai hình chiếc lá xanh mướt.' }
];

const SHOP = {
  trap_thuong: { name: 'Bẫy Thường', price: 50,  desc: 'Bẫy cơ bản, tỉ lệ bắt chuẩn', icon: '🪤' },
  trap_xin:    { name: 'Bẫy Xịn',    price: 150, desc: 'Tỉ lệ bắt x1.6',               icon: '🪤✨' },
  potion:      { name: 'Bình Máu',    price: 40,  desc: 'Hồi 60 HP cho pet trong trận', icon: '🧪' }
};

const TYPE_INFO = {
  kim: ['Kim', '#8d9bb5'], moc: ['Mộc', '#43a047'], thuy: ['Thủy', '#29b6f6'], hoa: ['Hỏa', '#ff7043'],
  tho: ['Thổ', '#a1887f'], phong: ['Phong', '#4dd0e1'], dien: ['Điện', '#fdd835'], quy: ['Quỷ', '#7e57c2']
};

let S = { username: '', coins: 0, items: {}, pos: { x: 3, y: 1 }, party: [], boxCount: 0, facing: 'down' };
let B = null; // battle view
let moving = false;
let battleBusy = false;
let swapBoxId = null;

// ---------------- API ----------------
async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  return r.json();
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add('hidden'), 2600);
}

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

// ---------------- AUTH ----------------
$('tab-login').onclick = () => {
  $('tab-login').classList.add('active'); $('tab-register').classList.remove('active');
  $('form-login').classList.remove('hidden'); $('form-register').classList.add('hidden');
};
$('tab-register').onclick = () => {
  $('tab-register').classList.add('active'); $('tab-login').classList.remove('active');
  $('form-register').classList.remove('hidden'); $('form-login').classList.add('hidden');
};
$('form-login').onsubmit = async e => {
  e.preventDefault();
  const d = await api('/api/auth/login', { method: 'POST', body: { username: $('login-user').value.trim(), password: $('login-pass').value } });
  if (d.error) { $('auth-err').textContent = d.error; return; }
  $('auth-err').textContent = '';
  await loadState();
};
$('form-register').onsubmit = async e => {
  e.preventDefault();
  const d = await api('/api/auth/register', { method: 'POST', body: { username: $('reg-user').value.trim(), password: $('reg-pass').value } });
  if (d.error) { $('auth-err').textContent = d.error; return; }
  $('auth-err').textContent = '';
  await loadState();
};
$('btn-logout').onclick = async () => {
  await api('/api/auth/logout', { method: 'POST' });
  show('screen-auth');
};

// ---------------- STATE ----------------
async function loadState() {
  const st = await api('/api/game/state');
  if (st.error) { toast(st.error); show('screen-auth'); return; }
  S.username = st.username; S.coins = st.coins; S.items = st.items;
  S.pos = st.pos; S.party = st.party; S.boxCount = st.boxCount;
  updateHUD();
  if (!st.starterChosen) { renderStarters(); show('screen-starter'); }
  else if (st.inBattle) { show('screen-game'); drawMap(); await refreshBattle(); }
  else { show('screen-game'); drawMap(); }
}

function updateHUD() {
  $('hud-user').textContent = '👤 ' + S.username;
  $('hud-coins').textContent = '💰 ' + S.coins;
  $('hud-traps').textContent = `🪤 ${S.items.trap_thuong || 0}+${S.items.trap_xin || 0}`;
  $('hud-potions').textContent = '🧪 ' + (S.items.potion || 0);
}

// ---------------- STARTER ----------------
let selectedStarter = null;
function renderStarters() {
  selectedStarter = null;
  $('starter-list').innerHTML = STARTER_INFO.map(s => `
    <div class="starter-card" data-id="${s.id}">
      <img src="/sprites/${s.id}.png" alt="${s.name}">
      <h3>${s.name} <span class="type-badge" style="background:${s.color}">${s.typeName}</span></h3>
      <p>${s.desc}</p>
    </div>`).join('') +
    `<div style="width:100%;margin-top:8px"><button id="btn-confirm-starter" class="btn-primary" style="max-width:300px" disabled>Chọn pet này</button></div>`;
  document.querySelectorAll('.starter-card').forEach(c => {
    c.onclick = () => {
      document.querySelectorAll('.starter-card').forEach(x => x.style.borderColor = '');
      c.style.borderColor = '#ff7043';
      selectedStarter = c.dataset.id;
      $('btn-confirm-starter').disabled = false;
    };
  });
  $('btn-confirm-starter').onclick = async () => {
    if (!selectedStarter) return;
    const d = await api('/api/game/starter', { method: 'POST', body: { speciesId: selectedStarter } });
    if (d.error) { toast(d.error); return; }
    toast(`Chào mừng ${d.pet.name} gia nhập đội! 🎉`);
    await loadState();
  };
}

// ---------------- TILE ART (pixel-art vẽ tay) ----------------
const TILE_IMGS = {};
let tilesReady = false;

function loadTiles() {
  const defs = {
    sheet: '/tiles/tiles.png',
    chars: '/tiles/chars.png',
    houseHeal: '/tiles/house-heal.png',
    houseShop: '/tiles/house-shop.png'
  };
  const loaded = {};
  let n = 0;
  const keys = Object.keys(defs);
  keys.forEach(k => {
    const img = new Image();
    const done = () => { if (++n === keys.length) prepareTiles(loaded); };
    img.onload = () => { loaded[k] = img; done(); };
    img.onerror = done;
    img.src = defs[k];
  });
}

// Tách nền magenta -> trong suốt
function keyOut(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i] > 140 && p[i + 1] < 110 && p[i + 2] > 140) p[i + 3] = 0;
  }
  x.putImageData(d, 0, 0);
  return c;
}

// Cắt sheet thành các ô: cols x rows
function sliceSheet(src, cols, rows) {
  const w = src.width / cols, h = src.height / rows;
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(src, c * w, r * h, w, h, 0, 0, w, h);
      out.push(cv);
    }
  return out;
}

function prepareTiles(L) {
  try {
    if (L.sheet) {
      // thứ tự ô trong sheet 3x2: cỏ, đường, cây / nước, hoa, bụi
      const cells = sliceSheet(L.sheet, 3, 2);
      TILE_IMGS.grass = cells[0]; TILE_IMGS.path = cells[1];
      TILE_IMGS.tree = cells[2]; TILE_IMGS.water = cells[3];
      TILE_IMGS.flower = cells[4]; TILE_IMGS.bush = cells[5];
    }
    if (L.chars) {
      const parts = sliceSheet(keyOut(L.chars), 4, 1);
      TILE_IMGS.player = parts[0];
      TILE_IMGS.npcs = [parts[1], parts[2], parts[3]];
    }
    if (L.houseHeal) TILE_IMGS.houseHeal = keyOut(L.houseHeal);
    if (L.houseShop) TILE_IMGS.houseShop = keyOut(L.houseShop);
    tilesReady = !!(TILE_IMGS.grass && TILE_IMGS.player);
  } catch (e) { console.warn('tile art lỗi:', e); }
  drawMap();
}

// ---------------- MAP ----------------
function drawTileClassic(ctx, t, px, py, x, y) {
  if (t === '#') {
    ctx.fillStyle = '#2e7d3f'; ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = '#5d4037'; ctx.fillRect(px + 13, py + 18, 6, 12);
    ctx.fillStyle = '#1b5e20';
    ctx.beginPath(); ctx.arc(px + 16, py + 12, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath(); ctx.arc(px + 11, py + 15, 7, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 21, py + 15, 7, 0, 7); ctx.fill();
  } else if (t === ',') {
    ctx.fillStyle = '#7cc65f'; ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = '#5da24a'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const gx = px + ((x * 37 + y * 91 + i * 53) % 26) + 3;
      const gy = py + ((x * 17 + y * 41 + i * 29) % 24) + 4;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - 6); ctx.stroke();
    }
  } else if (t === 'W') {
    ctx.fillStyle = '#3f9fd8'; ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px + 5, py + 12); ctx.quadraticCurveTo(px + 10, py + 9, px + 15, py + 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 17, py + 22); ctx.quadraticCurveTo(px + 22, py + 19, px + 27, py + 22); ctx.stroke();
  } else {
    ctx.fillStyle = '#e3c878'; ctx.fillRect(px, py, TILE, TILE);
    if (t === 'H' || t === 'M' || t === 'N') {
      ctx.fillStyle = '#d99a5b'; ctx.fillRect(px + 4, py + 12, 24, 18);
      ctx.fillStyle = t === 'H' ? '#c62828' : t === 'M' ? '#1565c0' : '#7b1fa2';
      ctx.beginPath(); ctx.moveTo(px + 2, py + 13); ctx.lineTo(px + 16, py + 2); ctx.lineTo(px + 30, py + 13); ctx.fill();
      ctx.fillStyle = '#4e342e'; ctx.fillRect(px + 13, py + 20, 7, 10);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(t, px + 16, py + 11);
    }
  }
}

function drawPlayerClassic(ctx) {
  const px = S.pos.x * TILE + 16, py = S.pos.y * TILE + 16;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(px, py + 13, 9, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath(); ctx.roundRect(px - 8, py - 2, 16, 14, 5); ctx.fill();
  ctx.fillStyle = '#ffd9b3';
  ctx.beginPath(); ctx.arc(px, py - 9, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#e53935';
  ctx.beginPath(); ctx.arc(px, py - 11, 8, Math.PI, 0); ctx.fill();
  ctx.fillRect(px - 8, py - 13, 16, 3);
  ctx.fillStyle = '#1a1a1a';
  const ex = S.facing === 'left' ? -2 : S.facing === 'right' ? 2 : 0;
  ctx.beginPath(); ctx.arc(px - 3 + ex, py - 8, 1.3, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(px + 3 + ex, py - 8, 1.3, 0, 7); ctx.fill();
}

function drawMap() {
  const cv = $('map'), ctx = cv.getContext('2d');
  const T = TILE_IMGS;
  if (!tilesReady) {
    for (let y = 0; y < MAP.length; y++)
      for (let x = 0; x < MAP[y].length; x++)
        drawTileClassic(ctx, MAP[y][x], x * TILE, y * TILE, x, y);
    drawPlayerClassic(ctx);
    return;
  }
  let npcIdx = 0;
  for (let y = 0; y < MAP.length; y++) {
    for (let x = 0; x < MAP[y].length; x++) {
      const t = MAP[y][x], px = x * TILE, py = y * TILE;
      // nền
      if (t === ',') ctx.drawImage(T.grass, px, py, TILE, TILE);
      else if (t === 'W') ctx.drawImage(T.water, px, py, TILE, TILE);
      else if (t === '#') ctx.drawImage(T.tree, px, py, TILE, TILE);
      else ctx.drawImage(T.path, px, py, TILE, TILE);
      // hoa/bụi rải rác trên cỏ
      if (t === ',') {
        const h = (x * 37 + y * 91) % 11;
        if (h === 0 && T.flower) ctx.drawImage(T.flower, px, py, TILE, TILE);
        else if (h === 5 && T.bush) ctx.drawImage(T.bush, px, py, TILE, TILE);
      }
      // nhà hồi máu: 2 ô dọc, vẽ phủ từ ô trên
      if (t === 'H' && y + 1 < MAP.length && MAP[y + 1][x] === 'H' && T.houseHeal) {
        ctx.drawImage(T.houseHeal, px - 6, py - 34, TILE + 12, TILE * 2 + 34);
      }
      // cửa hàng: 1 ô
      if (t === 'M' && T.houseShop) {
        ctx.drawImage(T.houseShop, px - 8, py - 30, TILE + 16, TILE + 30);
      }
      // dân làng
      if (t === 'N' && T.npcs) {
        const npc = T.npcs[npcIdx++ % T.npcs.length];
        ctx.drawImage(npc, px + 1, py - 14, TILE - 2, TILE + 14);
      }
    }
  }
  // nhân vật chính
  const px = S.pos.x * TILE, py = S.pos.y * TILE;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(px + 16, py + 27, 9, 4, 0, 0, 7); ctx.fill();
  ctx.drawImage(T.player, px + 1, py - 12, TILE - 2, TILE + 12);
}

async function move(dir) {
  if (moving) return;
  moving = true;
  try {
    S.facing = dir;
    const d = await api('/api/game/move', { method: 'POST', body: { dir } });
    if (d.error) { toast(d.error); return; }
    if (d.ok) {
      S.pos = { x: d.x, y: d.y };
      drawMap();
      if (d.warn) toast(d.warn);
      if (d.encounter) enterBattle(d.encounter.enemy);
    } else drawMap();
  } finally { moving = false; }
}

document.querySelectorAll('.dbtn').forEach(b => {
  b.addEventListener('pointerdown', e => { e.preventDefault(); move(b.dataset.dir); });
});
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
document.addEventListener('keydown', e => {
  const dir = KEYMAP[e.key];
  if (dir && !$('screen-game').classList.contains('hidden')) { e.preventDefault(); move(dir); }
  if ((e.key === ' ' || e.key === 'Enter') && !$('screen-game').classList.contains('hidden')) { e.preventDefault(); doInteract(); }
});

async function doInteract() {
  const d = await api('/api/game/interact', { method: 'POST' });
  if (d.error) { toast(d.error); return; }
  if (d.type === 'heal') { toast(d.msg); await quickRefresh(); }
  else if (d.type === 'shop') openShop();
  else toast(d.msg || 'Không có gì ở đây.');
}
$('btn-interact').onclick = doInteract;

async function quickRefresh() {
  const st = await api('/api/game/state');
  if (!st.error) {
    S.coins = st.coins; S.items = st.items; S.party = st.party; S.boxCount = st.boxCount;
    updateHUD();
  }
}

// ---------------- BATTLE ----------------
function battleLog(msg) {
  const el = $('battle-log');
  const div = document.createElement('div');
  div.textContent = msg;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function setHp(fillEl, textEl, hp, maxHp) {
  const pct = Math.max(0, Math.round(hp / maxHp * 100));
  fillEl.style.width = pct + '%';
  fillEl.className = 'hpfill' + (pct <= 25 ? ' low' : pct <= 50 ? ' mid' : '');
  textEl.textContent = `${hp}/${maxHp}`;
}

// Tách nền trắng của sprite pet (flood-fill từ viền) -> trong suốt, có cache
const _spriteCache = {};
function setPetSprite(imgEl, src) {
  if (_spriteCache[src]) { imgEl.src = _spriteCache[src]; return; }
  const img = new Image();
  img.onload = () => {
    try {
      const w = img.width, h = img.height;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, w, h), p = d.data;
      const seen = new Uint8Array(w * h);
      const stack = [];
      for (let bx = 0; bx < w; bx++) { stack.push(bx, bx + (h - 1) * w); }
      for (let by = 1; by < h - 1; by++) { stack.push(by * w, by * w + w - 1); }
      while (stack.length) {
        const idx = stack.pop();
        if (seen[idx]) continue;
        seen[idx] = 1;
        const i4 = idx * 4;
        if (!(p[i4] > 240 && p[i4 + 1] > 240 && p[i4 + 2] > 240)) continue;
        p[i4 + 3] = 0;
        const px = idx % w, py = (idx / w) | 0;
        if (px > 0) stack.push(idx - 1);
        if (px < w - 1) stack.push(idx + 1);
        if (py > 0) stack.push(idx - w);
        if (py < h - 1) stack.push(idx + w);
      }
      x.putImageData(d, 0, 0);
      _spriteCache[src] = c.toDataURL();
    } catch (e) { _spriteCache[src] = src; }
    imgEl.src = _spriteCache[src];
  };
  img.onerror = () => { imgEl.src = src; };
  img.src = src;
}

function renderBattle() {
  const E = B.enemy, P = B.player;
  document.querySelectorAll('.fighter').forEach(f => f.classList.remove('fainted'));
  setPetSprite($('b-enemy-sprite'), E.sprite);
  $('b-enemy-name').textContent = E.name;
  $('b-enemy-lv').textContent = 'Lv' + E.level;
  const et = $('b-enemy-type'); et.textContent = E.typeName; et.style.background = E.typeColor;
  setHp($('b-enemy-hp'), $('b-enemy-hptext'), E.hp, E.maxHp);

  setPetSprite($('b-player-sprite'), P.sprite);
  $('b-player-name').textContent = P.name;
  $('b-player-lv').textContent = 'Lv' + P.level;
  const pt = $('b-player-type'); pt.textContent = P.typeName; pt.style.background = P.typeColor;
  setHp($('b-player-hp'), $('b-player-hptext'), P.hp, P.maxHp);
  if (P.expNext) $('b-player-exp').style.width = Math.min(100, Math.round(P.exp / P.expNext * 100)) + '%';
}

function enterBattle(enemy) {
  show('screen-battle');
  $('battle-log').innerHTML = '';
  $('battle-menu').classList.remove('hidden');
  $('battle-sub').classList.add('hidden');
  battleLog(`Một con ${enemy.name} hoang dã (cấp ${enemy.level}) xuất hiện!`);
  refreshBattle();
}

async function refreshBattle() {
  const d = await api('/api/game/battle');
  if (!d.battle) { exitToMap(); return; }
  B = d.battle;
  renderBattle();
  if (B.needSwitch) { battleLog('Hãy chọn pet khác ra trận!'); showPartySub(true); }
}

function hideSub() { $('battle-sub').classList.add('hidden'); $('battle-sub').innerHTML = ''; }

document.querySelectorAll('.btn-battle').forEach(b => {
  b.onclick = () => {
    const act = b.dataset.act;
    hideSub();
    if (battleBusy) return;
    if (act === 'fight') showMovesSub();
    else if (act === 'trap') showTrapSub();
    else if (act === 'switch') showPartySub(false);
    else doBattle({ action: act });
  };
});

function showMovesSub() {
  const sub = $('battle-sub');
  sub.classList.remove('hidden');
  sub.innerHTML = B.player.moves.map(m => {
    const ti = TYPE_INFO[m.type] || ['?', '#999'];
    return `
    <button class="sub-btn" data-m="${m.id}">
      <b>${m.name}</b> <span class="type-badge" style="background:${ti[1]}">${ti[0]}</span><br>
      <small>Sức mạnh ${m.power} • Chính xác ${m.acc}%</small>
    </button>`;
  }).join('');
  sub.querySelectorAll('.sub-btn').forEach(b => b.onclick = () => doBattle({ action: 'fight', move: b.dataset.m }));
}

function showTrapSub() {
  const sub = $('battle-sub');
  sub.classList.remove('hidden');
  sub.innerHTML = `
    <button class="sub-btn" data-k="trap_thuong">🪤 <b>Bẫy Thường</b><br><small>Còn: ${S.items.trap_thuong || 0}</small></button>
    <button class="sub-btn" data-k="trap_xin">🪤✨ <b>Bẫy Xịn (x1.6)</b><br><small>Còn: ${S.items.trap_xin || 0}</small></button>`;
  sub.querySelectorAll('.sub-btn').forEach(b => b.onclick = () => doBattle({ action: 'trap', kind: b.dataset.k }));
}

function showPartySub(forced) {
  const sub = $('battle-sub');
  sub.classList.remove('hidden');
  sub.innerHTML = B.party.map((p, i) => `
    <button class="sub-btn" data-i="${i}" ${p.hp <= 0 || i === B.activeIdx ? 'disabled' : ''}>
      <b>${p.name}</b> Lv${p.level}<br><small>HP ${p.hp}/${p.maxHp}${p.hp <= 0 ? ' (gục)' : ''}${i === B.activeIdx ? ' (đang đánh)' : ''}</small>
    </button>`).join('');
  sub.querySelectorAll('.sub-btn').forEach(b => b.onclick = () => doBattle({ action: 'switch', index: +b.dataset.i }));
  if (forced) battleLog('⚠️ Pet đã gục — bắt buộc đổi pet!');
}

function setBattleBusy(v) {
  battleBusy = v;
  document.querySelectorAll('.btn-battle').forEach(b => b.disabled = v);
}

// ---------------- HIỆU ỨNG TRẬN ĐẤU ----------------
const wait = ms => new Promise(r => setTimeout(r, ms));
const STAT_NAMES_VN = { atk: 'Tấn công', def: 'Phòng thủ', spd: 'Tốc độ' };

function arenaPos(fighterEl) {
  const a = document.querySelector('.arena').getBoundingClientRect();
  const r = fighterEl.getBoundingClientRect();
  return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 };
}

// Chùm hạt vỡ ra khi trúng đòn
function burst(x, y, color, n = 10) {
  const arena = document.querySelector('.arena');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'particle';
    s.style.background = color;
    s.style.left = x + 'px'; s.style.top = y + 'px';
    arena.appendChild(s);
    const ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 55;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
    s.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.15)`, opacity: 0 }
    ], { duration: 450 + Math.random() * 350, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => s.remove();
  }
}

// Chữ bay (sát thương, TRƯỢT, buff...)
function floatText(x, y, text, cls = '') {
  const arena = document.querySelector('.arena');
  const el = document.createElement('div');
  el.className = 'dmg-num ' + cls;
  el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  arena.appendChild(el);
  el.animate([
    { transform: 'translate(-50%,0) scale(.6)', opacity: 0 },
    { transform: 'translate(-50%,-16px) scale(1.15)', opacity: 1, offset: .25 },
    { transform: 'translate(-50%,-72px) scale(1)', opacity: 0 }
  ], { duration: 950, easing: 'ease-out' }).onfinish = () => el.remove();
}

// Tia sáng buff (bay lên) / debuff (rơi xuống)
function sparkles(x, y, color, up = true, n = 12) {
  const arena = document.querySelector('.arena');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'particle spark';
    s.style.background = color;
    s.style.left = (x + (Math.random() - .5) * 70) + 'px';
    s.style.top = (y + (Math.random() - .5) * 40) + 'px';
    arena.appendChild(s);
    const dy = up ? -(60 + Math.random() * 60) : (60 + Math.random() * 60);
    s.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(-50%, calc(-50% + ${dy}px)) scale(.2)`, opacity: 0 }
    ], { duration: 700 + Math.random() * 400, easing: 'ease-out' }).onfinish = () => s.remove();
  }
}

function setHpBar(who, toHp, maxHp) {
  const fill = who === 'me' ? $('b-player-hp') : $('b-enemy-hp');
  const text = who === 'me' ? $('b-player-hptext') : $('b-enemy-hptext');
  const pct = Math.max(0, Math.round(toHp / maxHp * 100));
  fill.style.width = pct + '%';
  fill.className = 'hpfill' + (pct <= 25 ? ' low' : pct <= 50 ? ' mid' : '');
  text.textContent = `${toHp}/${maxHp}`;
}

async function playHitFx(ev) {
  const foeEl = document.querySelector('.fighter.foe');
  const meEl = document.querySelector('.fighter.me');
  const atkEl = ev.by === 'me' ? meEl : foeEl;
  const tgtEl = ev.to === 'me' ? meEl : foeEl;
  const spr = tgtEl.querySelector('.psprite');
  const ap = arenaPos(atkEl);
  floatText(ap.x, ap.y - 60, ev.moveName, 'movename');
  atkEl.classList.add(ev.by === 'me' ? 'lunge-me' : 'lunge-foe');
  await wait(320);
  atkEl.classList.remove('lunge-me', 'lunge-foe');
  const { x, y } = arenaPos(tgtEl);
  burst(x, y, ev.moveColor, ev.crit ? 18 : 11);
  spr.classList.add('flash');
  tgtEl.classList.add('hit-shake');
  floatText(x, y - 46, (ev.crit ? 'CHÍ MẠNG ' : '') + '-' + ev.dmg, ev.crit ? 'crit' : '');
  if (ev.eff > 1) floatText(x, y - 88, 'SIÊU HIỆU QUẢ!', 'eff-up');
  else if (ev.eff < 1) floatText(x, y - 88, 'không hiệu quả…', 'eff-down');
  if (ev.crit || ev.eff > 1) {
    const arena = document.querySelector('.arena');
    arena.classList.add('shake');
    setTimeout(() => arena.classList.remove('shake'), 450);
  }
  setHpBar(ev.to, ev.toHp, ev.maxHp);
  await wait(680);
  spr.classList.remove('flash');
  tgtEl.classList.remove('hit-shake');
}

async function playMissFx(ev) {
  const tgtEl = document.querySelector(ev.by === 'me' ? '.fighter.foe' : '.fighter.me');
  const atkEl = document.querySelector(ev.by === 'me' ? '.fighter.me' : '.fighter.foe');
  const ap = arenaPos(atkEl);
  if (ev.moveName) floatText(ap.x, ap.y - 60, ev.moveName, 'movename');
  const { x, y } = arenaPos(tgtEl);
  floatText(x, y - 40, 'TRƯỢT!', 'miss');
  await wait(650);
}

async function playStatFx(ev) {
  const tgtEl = document.querySelector(ev.to === 'me' ? '.fighter.me' : '.fighter.foe');
  const atkEl = document.querySelector(ev.by === 'me' ? '.fighter.me' : '.fighter.foe');
  const ap = arenaPos(atkEl);
  floatText(ap.x, ap.y - 60, ev.moveName, 'movename');
  await wait(300);
  const { x, y } = arenaPos(tgtEl);
  const isBuff = ev.t === 'buff';
  sparkles(x, y, isBuff ? '#69f0ae' : '#ce93d8', isBuff, 14);
  floatText(x, y - 52, `${STAT_NAMES_VN[ev.stat]} ${isBuff ? '↑' : '↓'}`, isBuff ? 'buff' : 'debuff');
  await wait(800);
}

async function playHealFx(ev) {
  const tgtEl = document.querySelector('.fighter.me');
  const { x, y } = arenaPos(tgtEl);
  sparkles(x, y, '#69f0ae', true, 12);
  floatText(x, y - 52, '+' + ev.amount, 'heal');
  setHpBar('me', ev.toHp, ev.maxHp);
  await wait(750);
}

async function playFaintFx(ev) {
  const tgtEl = document.querySelector(ev.who === 'me' ? '.fighter.me' : '.fighter.foe');
  tgtEl.classList.add('fainted');
  await wait(850);
}

async function playBattleEvents(events) {
  for (const ev of events || []) {
    if (ev.t === 'hit') await playHitFx(ev);
    else if (ev.t === 'miss') await playMissFx(ev);
    else if (ev.t === 'buff' || ev.t === 'debuff') await playStatFx(ev);
    else if (ev.t === 'heal') await playHealFx(ev);
    else if (ev.t === 'faint') await playFaintFx(ev);
    else if (ev.t === 'trap') {
      const tgtEl = document.querySelector('.fighter.foe');
      tgtEl.classList.add('hit-shake');
      await wait(500);
      tgtEl.classList.remove('hit-shake');
    } else if (ev.t === 'switch') {
      const tgtEl = document.querySelector('.fighter.me');
      tgtEl.classList.remove('fainted');
      const { x, y } = arenaPos(tgtEl);
      burst(x, y, '#ffffff', 12);
      await wait(400);
    }
  }
}

async function doBattle(body) {
  setBattleBusy(true);
  hideSub();
  try {
    const d = await api('/api/game/battle', { method: 'POST', body });
    if (d.error) { toast(d.error); return; }
    B = { enemy: d.enemy, player: d.player, party: d.party, needSwitch: d.needSwitch, activeIdx: d.activeIdx };
    renderBattle();
    await playBattleEvents(d.events); // diễn hoạt đòn đánh trước khi hiện log
    (d.log || []).forEach(battleLog);
    renderBattle(); // đồng bộ lại sau hiệu ứng
    await quickRefresh();
    if (d.over) showBattleEnd(d);
    else if (d.needSwitch) showPartySub(true);
  } finally { setBattleBusy(false); }
}

function showBattleEnd(d) {
  $('battle-menu').classList.add('hidden');
  const sub = $('battle-sub');
  sub.classList.remove('hidden');
  const titles = { win: '🏆 Chiến thắng!', caught: '🎉 Bắt thành công!', run: '🏃 Chạy thoát!', lose: '💀 Thua trận...' };
  let html = `<div style="grid-column:1/-1;text-align:center"><h3>${titles[d.result] || ''}</h3>`;
  if (d.caughtInfo) html += `<p>${d.caughtInfo.placement === 'party' ? 'Đã vào đội hình của bạn.' : 'Đội hình đầy — đã gửi vào Hộp.'}</p>`;
  if (d.rewards && (d.rewards.coins || d.rewards.exp)) {
    if (d.rewards.coins > 0) html += `<p>💰 +${d.rewards.coins} xu &nbsp; ✨ +${d.rewards.exp} EXP</p>`;
    if (d.rewards.coins < 0) html += `<p>💰 ${d.rewards.coins} xu</p>`;
  }
  if (d.rewards && d.rewards.events) {
    d.rewards.events.forEach(ev => {
      if (ev.type === 'levelup') html += `<p>⬆️ ${ev.name} lên cấp ${ev.level}!</p>`;
      if (ev.type === 'evo') html += `<p>🎉 <b>${ev.from} TIẾN HÓA thành ${ev.to}!</b></p>`;
    });
  }
  html += `<br><button id="btn-battle-continue" class="btn-primary">Tiếp tục</button></div>`;
  sub.innerHTML = html;
  $('btn-battle-continue').onclick = exitToMap;
}

async function exitToMap() {
  hideSub();
  $('battle-log').innerHTML = '';
  await loadState();
}

// ---------------- MODAL ----------------
function openModal(title, html) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
  $('modal').classList.remove('hidden');
}
$('modal-close').onclick = () => { $('modal').classList.add('hidden'); swapBoxId = null; };
$('modal').addEventListener('click', e => { if (e.target === $('modal')) { $('modal').classList.add('hidden'); swapBoxId = null; } });

function petRowHtml(p, opts = {}) {
  const pct = Math.max(0, Math.round(p.hp / p.maxHp * 100));
  return `<div class="pet-row">
    <img src="${p.sprite}" alt="">
    <div class="grow">
      <div class="pname">${p.name} <span class="lv">Lv${p.level}</span>
        <span class="type-badge" style="background:${p.typeColor}">${p.typeName}</span></div>
      <div class="mini-hpbar"><div style="width:${pct}%"></div></div>
      <div style="font-size:11px;color:#9fb3d1">HP ${p.hp}/${p.maxHp} • EXP ${p.exp}/${p.expNext}</div>
      <div>${p.moves.map(m => `<span class="move-tag">${m.name}</span>`).join('')}</div>
    </div>
    <div>${opts.actions || ''}</div>
  </div>`;
}

$('btn-party').onclick = async () => {
  await quickRefresh();
  openModal('🎒 Đội hình (' + S.party.length + '/6)',
    S.party.map((p, i) => petRowHtml(p, {
      actions: S.party.length > 1 ? `<button class="btn-mini" data-dep="${i}">Cất vào hộp</button>` : ''
    })).join('') ||
    '<p class="muted">Chưa có pet nào.</p>');
  document.querySelectorAll('[data-dep]').forEach(b => b.onclick = async () => {
    const d = await api('/api/game/box/deposit', { method: 'POST', body: { index: +b.dataset.dep } });
    if (d.error) toast(d.error); else { await quickRefresh(); $('btn-party').onclick(); }
  });
};

$('btn-box').onclick = async () => {
  await quickRefresh();
  const d = await api('/api/game/box');
  if (d.error) { toast(d.error); return; }
  const boxPets = d.box;
  let html = '<h4 style="margin-bottom:8px">📦 Trong hộp (' + boxPets.length + ')</h4>';
  html += boxPets.map(p => petRowHtml(p, {
    actions: `<button class="btn-mini" data-wd="${p.id}" ${S.party.length >= 6 ? 'disabled' : ''}>Ra đội hình</button>
              <button class="btn-mini" data-sw="${p.id}">Đổi</button>`
  })).join('') || '<p class="muted">Hộp trống.</p>';
  html += '<h4 style="margin:12px 0 8px">🎒 Đội hình hiện tại</h4>';
  html += S.party.map((p, i) => petRowHtml(p, {
    actions: swapBoxId ? `<button class="btn-mini" data-pick="${i}">Đổi lấy pet đã chọn</button>` : ''
  })).join('');
  if (swapBoxId) html = `<p style="margin-bottom:8px;color:#ffd54f">Đang chọn pet trong hộp để đổi — bấm "Đổi lấy pet đã chọn" ở đội hình.</p>` + html;
  openModal('📦 Hộp pet', html);

  document.querySelectorAll('[data-wd]').forEach(b => b.onclick = async () => {
    const r = await api('/api/game/box/withdraw', { method: 'POST', body: { petId: b.dataset.wd } });
    if (r.error) toast(r.error); else { await quickRefresh(); $('btn-box').onclick(); }
  });
  document.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => { swapBoxId = b.dataset.sw; $('btn-box').onclick(); });
  document.querySelectorAll('[data-pick]').forEach(b => b.onclick = async () => {
    const r = await api('/api/game/box/swap', { method: 'POST', body: { index: +b.dataset.pick, petId: swapBoxId } });
    if (r.error) toast(r.error);
    swapBoxId = null;
    await quickRefresh(); $('btn-box').onclick();
  });
};

function openShop() {
  const body = Object.entries(SHOP).map(([id, it]) => `
    <div class="shop-row">
      <div style="font-size:28px">${it.icon}</div>
      <div class="grow"><b>${it.name}</b> — ${it.price} xu<br><small style="color:#9fb3d1">${it.desc}</small></div>
      <div class="qty-row">
        <button data-dec="${id}">−</button><span id="qty-${id}">1</span><button data-inc="${id}">+</button>
        <button class="btn-mini" data-buy="${id}">Mua</button>
      </div>
    </div>`).join('') +
    `<p class="muted">💰 Xu của bạn: <b id="shop-coins">${S.coins}</b></p>`;
  openModal('🏪 Cửa hàng', body);
  const qty = {};
  document.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => {
    const id = b.dataset.inc; qty[id] = Math.min(10, (qty[id] || 1) + 1);
    $('qty-' + id).textContent = qty[id];
  });
  document.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => {
    const id = b.dataset.dec; qty[id] = Math.max(1, (qty[id] || 1) - 1);
    $('qty-' + id).textContent = qty[id];
  });
  document.querySelectorAll('[data-buy]').forEach(b => b.onclick = async () => {
    const id = b.dataset.buy;
    const d = await api('/api/game/shop', { method: 'POST', body: { item: id, qty: qty[id] || 1 } });
    if (d.error) toast(d.error); else { toast(d.msg); await quickRefresh(); $('shop-coins').textContent = S.coins; }
  });
}

$('btn-help').onclick = async () => {
  const d = await api('/api/game/chart');
  if (d.error) { toast(d.error); return; }
  const keys = Object.keys(d.types);
  let html = '<p class="muted" style="margin-bottom:8px">Hàng = hệ tấn công, cột = hệ phòng thủ. <b style="color:#66bb6a">x2</b> siêu hiệu quả, <b style="color:#ef5350">x½</b> không hiệu quả.</p>';
  html += '<table class="chart"><tr><th></th>' + keys.map(k => `<th><span class="type-badge" style="background:${d.colors[k]}">${d.types[k]}</span></th>`).join('') + '</tr>';
  keys.forEach(atk => {
    html += `<tr><th><span class="type-badge" style="background:${d.colors[atk]}">${d.types[atk]}</span></th>` +
      keys.map(def => {
        const v = d.chart[atk][def];
        const c = v > 1 ? '#66bb6a' : v < 1 ? '#ef5350' : '#9fb3d1';
        return `<td style="color:${c};font-weight:bold">${v > 1 ? 'x2' : v < 1 ? 'x½' : '–'}</td>`;
      }).join('') + '</tr>';
  });
  html += '</table><p class="muted" style="margin-top:8px">Chiêu cùng hệ với pet được tăng 1.5x sát thương (STAB).</p>';
  openModal('❓ Bảng khắc hệ', html);
};

// ---------------- BOOT ----------------
(async function boot() {
  loadTiles(); // tải tile art (xong tự vẽ lại map)
  const me = await api('/api/auth/me');
  if (me && !me.error) await loadState();
  else show('screen-auth');
})();
