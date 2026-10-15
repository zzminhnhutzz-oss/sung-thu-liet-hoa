// ============================================================
// SỦNG THÚ LIỆT HỎA — Server (Express + session + game API)
// ============================================================
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const store = require('./db');
const D = require('./game/data');
const eng = require('./game/engine');

const app = express();
const PORT = process.env.PORT || 3000;

// Giải mã assets base64 -> PNG khi khởi động.
// (GitHub MCP không đẩy được file nhị phân nên ảnh lưu dạng text base64
//  trong assets/**.b64 và được giải mã tại đây, giữ đúng cấu trúc thư mục.)
(function decodeAssets() {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, 'assets');
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.b64')) continue;
      // battle-bg.jpg.b64 -> battle-bg.jpg ; tiles.b64 -> tiles.png
      let rel = path.relative(root, p).replace(/\.b64$/, '');
      if (!/\.(png|jpg|jpeg|gif|webp)$/i.test(rel)) rel += '.png';
      const dst = path.join(__dirname, 'public', rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, Buffer.from(fs.readFileSync(p, 'utf8').trim(), 'base64'));
    }
  }
  try {
    if (fs.existsSync(root)) { walk(root); console.log('[assets] Đã giải mã assets base64 -> public/'); }
  } catch (e) { console.error('[assets] Lỗi giải mã:', e.message); }
})();

app.use(express.json());
app.use(express.static('public'));

// ---- Session: MongoStore khi có MONGODB_URI, không thì memory ----
const sessCfg = {
  secret: process.env.SESSION_SECRET || 'dev-secret-sung-thu-liet-hoa-doi-khi-deploy',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 3600 * 1000 }
};
if (process.env.MONGODB_URI) {
  try {
    const MongoStore = require('connect-mongo');
    sessCfg.store = MongoStore.create({ mongoUrl: process.env.MONGODB_URI, dbName: 'sung-thu-liet-hoa' });
    console.log('[session] Dùng MongoStore');
  } catch (e) {
    console.warn('[session] Không dùng được MongoStore:', e.message);
  }
}
app.use(session(sessCfg));

// ---- Trận đấu đang diễn ra (lưu RAM theo userId) ----
const battles = new Map();

function needLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Bạn chưa đăng nhập!' });
  next();
}

async function petDetail(pet) {
  const sp = D.SPECIES[pet.speciesId];
  const stats = eng.calcStats(pet.speciesId, pet.level);
  const hp = Math.min(pet.hp, stats.hp);
  return {
    id: pet.id, speciesId: pet.speciesId, name: sp.name,
    type: sp.type, typeName: D.TYPES[sp.type], typeColor: D.TYPE_COLORS[sp.type],
    level: pet.level, exp: pet.exp || 0, expNext: eng.expNext(pet.level),
    hp, maxHp: stats.hp,
    moves: (pet.moves || sp.moves).map(m => ({ id: m, ...D.MOVES[m] })),
    sprite: '/sprites/' + pet.speciesId + '.png',
    desc: sp.desc
  };
}

function fighterFromPet(pet) {
  const sp = D.SPECIES[pet.speciesId];
  const stats = eng.calcStats(pet.speciesId, pet.level);
  return {
    petId: pet.id, speciesId: pet.speciesId, name: sp.name, type: sp.type,
    level: pet.level, exp: pet.exp || 0, stats,
    maxHp: stats.hp, hp: Math.min(pet.hp, stats.hp),
    moves: (pet.moves || sp.moves).slice(),
    stages: { atk: 0, def: 0, spd: 0 }
  };
}

function makeWild() {
  const { speciesId, level } = eng.pickWild();
  const sp = D.SPECIES[speciesId];
  const stats = eng.calcStats(speciesId, level);
  return {
    petId: null, speciesId, name: sp.name, type: sp.type,
    level, exp: 0, stats, maxHp: stats.hp, hp: stats.hp,
    moves: sp.moves.slice(), wild: true,
    stages: { atk: 0, def: 0, spd: 0 }
  };
}

function fighterView(f) {
  return {
    name: f.name, speciesId: f.speciesId, type: f.type,
    typeName: D.TYPES[f.type], typeColor: D.TYPE_COLORS[f.type],
    level: f.level, hp: f.hp, maxHp: f.maxHp,
    exp: f.exp || 0, expNext: eng.expNext(f.level),
    sprite: '/sprites/' + f.speciesId + '.png',
    moves: f.moves.map(m => ({ id: m, ...D.MOVES[m] }))
  };
}

async function persistBattleParty(b) {
  for (const f of b.party) {
    if (!f.petId) continue;
    await store.updatePet(f.petId, { hp: f.hp, level: f.level, exp: f.exp, speciesId: f.speciesId });
  }
}

// Chia EXP + tiền + xử lý lên cấp & tiến hóa sau khi thắng/bắt được
async function grantRewards(b, user, log) {
  const foe = b.wild;
  const sp = D.SPECIES[foe.speciesId];
  const baseExp = Math.floor(sp.expYield * foe.level / 5);
  const coins = 15 + foe.level * 4;
  const events = [];
  const activeF = b.party[b.activeIdx];

  for (const f of b.party) {
    if (!f.petId || f.hp <= 0) continue;
    const gain = Math.floor(baseExp * (f === activeF ? 1 : 0.3));
    f.exp += gain;
    while (f.exp >= eng.expNext(f.level)) {
      f.exp -= eng.expNext(f.level);
      f.level++;
      const oldMax = f.maxHp;
      f.stats = eng.calcStats(f.speciesId, f.level);
      f.maxHp = f.stats.hp;
      f.hp = Math.min(f.maxHp, f.hp + Math.floor(f.maxHp * 0.3));
      events.push({ type: 'levelup', name: f.name, level: f.level });
      log.push(`${f.name} lên cấp ${f.level}!`);
      const evo = D.SPECIES[f.speciesId].evo;
      if (evo && f.level >= evo.at) {
        const oldName = f.name;
        const ratio = f.hp / oldMax;
        f.speciesId = evo.to;
        const nsp = D.SPECIES[evo.to];
        f.name = nsp.name;
        f.type = nsp.type;
        f.stats = eng.calcStats(f.speciesId, f.level);
        f.maxHp = f.stats.hp;
        f.hp = Math.max(1, Math.round(f.maxHp * ratio));
        events.push({ type: 'evo', from: oldName, to: f.name });
        log.push(`🎉 ${oldName} TIẾN HÓA thành ${f.name}!`);
      }
    }
  }
  await persistBattleParty(b);
  const newCoins = user.coins + coins;
  await store.updateUser(user.id, { coins: newCoins });
  return { exp: baseExp, coins, events, newCoins };
}

// ==================== AUTH ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username || ''))
      return res.status(400).json({ error: 'Tên tài khoản 3-20 ký tự, chỉ gồm chữ, số và gạch dưới.' });
    if (!password || password.length < 4)
      return res.status(400).json({ error: 'Mật khẩu tối thiểu 4 ký tự.' });
    if (await store.findUserByUsername(username))
      return res.status(400).json({ error: 'Tên tài khoản này đã có người dùng.' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await store.createUser({ username, passwordHash });
    req.session.userId = user.id;
    res.json({ ok: true, username });
  } catch (e) { res.status(500).json({ error: 'Lỗi server: ' + e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = await store.findUserByUsername(username || '');
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash)))
      return res.status(400).json({ error: 'Sai tên tài khoản hoặc mật khẩu.' });
    req.session.userId = user.id;
    res.json({ ok: true, username: user.username });
  } catch (e) { res.status(500).json({ error: 'Lỗi server: ' + e.message }); }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', needLogin, async (req, res) => {
  const user = await store.findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Phiên hết hạn.' });
  res.json({ username: user.username, starterChosen: user.starterChosen });
});

// ==================== GAME STATE ====================
app.get('/api/game/state', needLogin, async (req, res) => {
  try {
    const user = await store.findUserById(req.session.userId);
    const party = await store.getPets(user.party);
    res.json({
      username: user.username,
      coins: user.coins,
      items: user.items,
      pos: user.pos,
      party: await Promise.all(party.map(petDetail)),
      boxCount: user.box.length,
      inBattle: battles.has(user.id),
      starterChosen: user.starterChosen
    });
  } catch (e) { res.status(500).json({ error: 'Lỗi server: ' + e.message }); }
});

app.post('/api/game/starter', needLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { speciesId } = req.body || {};
    if (!D.STARTERS.includes(speciesId))
      return res.status(400).json({ error: 'Pet khởi đầu không hợp lệ.' });
    const user = await store.findUserById(userId);
    if (user.starterChosen)
      return res.status(400).json({ error: 'Bạn đã chọn pet khởi đầu rồi.' });
    const pet = await store.createPet({ ownerId: userId, speciesId, level: 5, exp: 0 });
    await store.updateUser(userId, { party: [pet.id], starterChosen: true });
    res.json({ ok: true, pet: await petDetail(pet) });
  } catch (e) { res.status(500).json({ error: 'Lỗi server: ' + e.message }); }
});

// ==================== DI CHUYỂN ====================
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

app.post('/api/game/move', needLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    if (battles.has(userId))
      return res.status(400).json({ error: 'Đang trong trận đấu!' });
    const user = await store.findUserById(userId);
    const d = DIRS[req.body && req.body.dir];
    if (!d) return res.status(400).json({ error: 'Hướng không hợp lệ.' });
    const nx = user.pos.x + d[0], ny = user.pos.y + d[1];
    const row = D.MAP[ny];
    const tile = row ? row[nx] : undefined;
    if (!tile || '#HWMN'.includes(tile))
      return res.json({ ok: false, x: user.pos.x, y: user.pos.y });

    await store.updateUser(userId, { pos: { x: nx, y: ny } });

    let encounter = null;
    if (tile === ',') {
      const pets = await store.getPets(user.party);
      const fighters = pets.map(fighterFromPet);
      if (!fighters.some(f => f.hp > 0)) {
        return res.json({ ok: true, x: nx, y: ny, warn: 'Pet đã kiệt sức! Hãy về nhà H hồi máu.' });
      }
      if (Math.random() < D.ENCOUNTER_RATE) {
        const wild = makeWild();
        // pet đầu tiên còn sống ra trận
        const firstAlive = fighters.findIndex(f => f.hp > 0);
        battles.set(userId, {
          userId, wild, party: fighters, activeIdx: firstAlive,
          over: false, needSwitch: false
        });
        encounter = { enemy: fighterView(wild) };
      }
    }
    res.json({ ok: true, x: nx, y: ny, encounter });
  } catch (e) { res.status(500).json({ error: 'Lỗi server: ' + e.message }); }
});

// ==================== TRẬN ĐẤU ====================
app.get('/api/game/battle', needLogin, async (req, res) => {
  const b = battles.get(req.session.userId);
  if (!b || b.over) return res.json({ battle: null });
  res.json({
    battle: {
      enemy: fighterView(b.wild),
      player: fighterView(b.party[b.activeIdx]),
      party: b.party.map(f => ({ name: f.name, level: f.level, hp: f.hp, maxHp: f.maxHp })),
      needSwitch: b.needSwitch,
      activeIdx: b.activeIdx
    }
  });
});

app.post('/api/game/battle', needLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const b = battles.get(userId);
    if (!b || b.over)
      return res.status(400).json({ error: 'Không có trận đấu nào đang diễn ra.' });
    const user = await store.findUserById(userId);
    const { action } = req.body || {};
    const log = [];
    const events = []; // hiệu ứng cho client: hit/miss/buff/debuff/heal/faint/trap/switch
    const me = () => b.party[b.activeIdx];
    const foe = b.wild;
    const STAT_NAMES = { atk: 'Tấn công', def: 'Phòng thủ', spd: 'Tốc độ' };

    // Dùng 1 chiêu (sát thương hoặc hiệu ứng), đẩy event cho client diễn hoạt
    function useMove(att, def, mvId, by) {
      const mv = D.MOVES[mvId];
      const to = by === 'me' ? 'foe' : 'me';
      if (mv.effect) {
        if (Math.random() * 100 > mv.acc) {
          log.push(`${att.name} dùng ${mv.name} nhưng thất bại!`);
          events.push({ t: 'miss', by, moveName: mv.name });
          return;
        }
        const target = mv.effect.target === 'self' ? att : def;
        const chg = eng.applyStages(target, mv.effect.stat, mv.effect.stages);
        const sname = STAT_NAMES[mv.effect.stat];
        if (chg === 0) {
          log.push(`${att.name} dùng ${mv.name} nhưng không có tác dụng!`);
          events.push({ t: 'nostat', by });
        } else {
          const dir = chg > 0 ? 'tăng' : 'giảm';
          log.push(`${att.name} dùng ${mv.name}: ${target.name} ${sname} ${dir}!`);
          events.push({
            t: chg > 0 ? 'buff' : 'debuff', by,
            to: mv.effect.target === 'self' ? by : to,
            stat: mv.effect.stat, moveName: mv.name
          });
        }
        return;
      }
      const r = eng.calcDamage(att, def, mvId);
      if (r.miss) {
        log.push(`${att.name} dùng ${mv.name} nhưng đánh trượt!`);
        events.push({ t: 'miss', by, moveName: mv.name });
      } else {
        def.hp = Math.max(0, def.hp - r.dmg);
        log.push(`${att.name} dùng ${mv.name}, gây ${r.dmg} sát thương cho ${def.name}!${r.crit ? ' (Chí mạng!)' : ''}${eng.effText(r.eff)}`);
        events.push({
          t: 'hit', by, to, dmg: r.dmg, crit: r.crit, eff: r.eff,
          moveName: mv.name, moveType: mv.type,
          moveColor: D.TYPE_COLORS[mv.type] || '#fff',
          toHp: def.hp, maxHp: def.maxHp
        });
        if (def.hp <= 0) events.push({ t: 'faint', who: to });
      }
    }

    function foeStrike(target) {
      const mvId = foe.moves[Math.floor(Math.random() * foe.moves.length)];
      useMove(foe, target, mvId, 'foe');
    }

    function meStrike(mvId) {
      useMove(me(), foe, mvId, 'me');
    }

    // true nếu pet ra trận đã gục (đã xử lý thua / yêu cầu đổi)
    async function checkMeFaint() {
      const m = me();
      if (m.hp > 0) return false;
      log.push(`${m.name} đã gục ngã!`);
      if (!b.party.some(f => f.hp > 0)) { await endLose(); return true; }
      b.needSwitch = true;
      log.push('Hãy chọn pet khác ra trận!');
      return true;
    }

    async function endWin() {
      b.over = true; b.result = 'win';
      log.push(`Đã đánh bại ${foe.name} hoang dã!`);
      b.rewards = await grantRewards(b, user, log);
      log.push(`Nhận ${b.rewards.coins} xu và ${b.rewards.exp} EXP!`);
    }

    async function endLose() {
      b.over = true; b.result = 'lose';
      log.push('Toàn bộ pet của bạn đã gục ngã...');
      const fresh = await store.findUserById(userId);
      const pets = await store.getPets(fresh.party);
      for (const p of pets) {
        const st = eng.calcStats(p.speciesId, p.level);
        await store.updatePet(p.id, { hp: st.hp });
      }
      for (const f of b.party) f.hp = f.maxHp;
      const lost = Math.floor(fresh.coins * 0.1);
      const newCoins = fresh.coins - lost;
      await store.updateUser(userId, { pos: { ...D.START_POS }, coins: newCoins });
      b.rewards = { coins: -lost, exp: 0, events: [], newCoins };
      log.push(`Bạn được đưa về Làng Lá, mất ${lost} xu. Pet đã hồi phục!`);
    }

    if (action === 'fight') {
      if (b.needSwitch) return res.status(400).json({ error: 'Pet đã gục, hãy đổi pet khác!' });
      const m = me();
      if (m.hp <= 0) return res.status(400).json({ error: 'Pet đã gục!' });
      const mvId = req.body.move;
      if (!m.moves.includes(mvId)) return res.status(400).json({ error: 'Chiêu thức không hợp lệ.' });
      if (eng.effSpd(m) >= eng.effSpd(foe)) {
        meStrike(mvId);
        if (foe.hp <= 0) await endWin();
        else { foeStrike(m); await checkMeFaint(); }
      } else {
        foeStrike(m);
        if (!(await checkMeFaint())) {
          meStrike(mvId);
          if (foe.hp <= 0) await endWin();
        }
      }
    } else if (action === 'trap') {
      if (b.needSwitch) return res.status(400).json({ error: 'Pet đã gục, hãy đổi pet khác!' });
      const kind = req.body.kind === 'trap_xin' ? 'trap_xin' : 'trap_thuong';
      const u2 = await store.findUserById(userId);
      if ((u2.items[kind] || 0) <= 0)
        return res.status(400).json({ error: 'Hết bẫy rồi! Ghé cửa hàng (nhà M) mua thêm nhé.' });
      await store.updateUser(userId, { items: { ...u2.items, [kind]: u2.items[kind] - 1 } });
      log.push(`Bạn ném ${D.ITEM_NAMES[kind]}!`);
      events.push({ t: 'trap', by: 'me' });
      if (eng.rollCatch(foe.speciesId, foe.hp, foe.maxHp, kind)) {
        b.over = true; b.result = 'caught';
        b.rewards = await grantRewards(b, user, log);
        const pet = await store.createPet({ ownerId: userId, speciesId: foe.speciesId, level: foe.level, exp: 0 });
        const u3 = await store.findUserById(userId);
        let placement;
        if (u3.party.length < 6) {
          await store.updateUser(userId, { party: [...u3.party, pet.id] });
          placement = 'party';
        } else {
          await store.updateUser(userId, { box: [...u3.box, pet.id] });
          placement = 'box';
        }
        b.caughtInfo = { name: D.SPECIES[pet.speciesId].name, placement };
        log.push(`🎉 Bắt thành công ${b.caughtInfo.name}! ${placement === 'party' ? 'Đã vào đội hình.' : 'Đội hình đầy, đã gửi vào Hộp.'}`);
        log.push(`Nhận ${b.rewards.coins} xu và ${b.rewards.exp} EXP!`);
      } else {
        log.push('Ôi không, nó thoát ra khỏi bẫy rồi!');
        foeStrike(me());
        await checkMeFaint();
      }
    } else if (action === 'potion') {
      if (b.needSwitch) return res.status(400).json({ error: 'Pet đã gục, hãy đổi pet khác!' });
      const u2 = await store.findUserById(userId);
      if ((u2.items.potion || 0) <= 0)
        return res.status(400).json({ error: 'Hết Bình Máu rồi!' });
      const m = me();
      if (m.hp >= m.maxHp) return res.status(400).json({ error: 'Pet đang đầy máu!' });
      await store.updateUser(userId, { items: { ...u2.items, potion: u2.items.potion - 1 } });
      m.hp = Math.min(m.maxHp, m.hp + 60);
      log.push(`Bạn cho ${m.name} uống Bình Máu (+60 HP)!`);
      events.push({ t: 'heal', by: 'me', to: 'me', amount: 60, toHp: m.hp, maxHp: m.maxHp });
      foeStrike(m);
      await checkMeFaint();
    } else if (action === 'switch') {
      const idx = req.body.index;
      const target = b.party[idx];
      if (idx == null || !target || target.hp <= 0 || idx === b.activeIdx)
        return res.status(400).json({ error: 'Không thể đổi sang pet này.' });
      const wasForced = b.needSwitch;
      b.activeIdx = idx;
      b.needSwitch = false;
      log.push(`Ra trận nào, ${target.name}!`);
      events.push({ t: 'switch', by: 'me', to: 'me' });
      if (!wasForced) { foeStrike(target); await checkMeFaint(); }
    } else if (action === 'run') {
      if (Math.random() < 0.7) {
        b.over = true; b.result = 'run';
        log.push('Bạn chạy thoát thành công!');
        await persistBattleParty(b);
      } else {
        log.push('Chạy không thoát!');
        foeStrike(me());
        await checkMeFaint();
      }
    } else {
      return res.status(400).json({ error: 'Hành động không hợp lệ.' });
    }

    const out = {
      log,
      events,
      over: b.over,
      player: fighterView(b.party[b.activeIdx]),
      party: b.party.map(f => ({ name: f.name, level: f.level, hp: f.hp, maxHp: f.maxHp })),
      enemy: fighterView(foe),
      needSwitch: b.needSwitch,
      activeIdx: b.activeIdx
    };
    if (b.over) {
      out.result = b.result;
      if (b.rewards) out.rewards = b.rewards;
      if (b.caughtInfo) out.caughtInfo = b.caughtInfo;
      battles.delete(userId);
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: 'Lỗi server: ' + e.message }); }
});

// ==================== TƯƠNG TÁC (nhà H / nhà M) ====================
app.post('/api/game/interact', needLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    if (battles.has(userId)) return res.status(400).json({ error: 'Đang trong trận đấu!' });
    const user = await store.findUserById(userId);
    const { x, y } = user.pos;
    const near = [[0, 1], [0, -1], [1, 0], [-1, 0]]
      .map(([dx, dy]) => (D.MAP[y + dy] || '')[x + dx]);
    if (near.includes('H')) {
      const pets = await store.getPets(user.party);
      for (const p of pets) {
        const st = eng.calcStats(p.speciesId, p.level);
        await store.updatePet(p.id, { hp: st.hp });
      }
      return res.json({ type: 'heal', msg: '✨ Pet của bạn đã được hồi phục hoàn toàn!' });
    }
    if (near.includes('M')) return res.json({ type: 'shop' });
    res.json({ type: null, msg: 'Xung quanh không có gì đặc biệt.' });
  } catch (e) { res.status(500).json({ error: 'Lỗi server: ' + e.message }); }
});

// ==================== CỬA HÀNG ====================
app.post('/api/game/shop', needLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { item, qty } = req.body || {};
    const it = D.SHOP[item];
    if (!it) return res.status(400).json({ error: 'Món hàng không tồn tại.' });
    const q = Math.max(1, Math.min(10, parseInt(qty) || 1));
    const cost = it.price * q;
    const user = await store.findUserById(userId);
    if (user.coins < cost)
      return res.status(400).json({ error: `Không đủ xu! Cần ${cost} xu.` });
    await store.updateUser(userId, {
      coins: user.coins - cost,
      items: { ...user.items, [item]: (user.items[item] || 0) + q }
    });
    res.json({ ok: true, msg: `Đã mua ${q} x ${it.name} (${cost} xu).` });
  } catch (e) { res.status(500).json({ error: 'Lỗi server: ' + e.message }); }
});

// ==================== HỘP PET ====================
app.get('/api/game/box', needLogin, async (req, res) => {
  try {
    const user = await store.findUserById(req.session.userId);
    const pets = await store.getPets(user.box);
    res.json({ box: await Promise.all(pets.map(petDetail)) });
  } catch (e) { res.status(500).json({ error: 'Lỗi server: ' + e.message }); }
});

app.post('/api/game/box/deposit', needLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await store.findUserById(userId);
    const idx = req.body.index;
    if (user.party.length <= 1)
      return res.status(400).json({ error: 'Đội hình phải giữ ít nhất 1 pet!' });
    const petId = user.party[idx];
    if (!petId) return res.status(400).json({ error: 'Pet không tồn tại.' });
    const party = user.party.filter((_, i) => i !== idx);
    await store.updateUser(userId, { party, box: [...user.box, petId] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Lỗi server: ' + e.message }); }
});

app.post('/api/game/box/withdraw', needLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await store.findUserById(userId);
    const { petId } = req.body || {};
    if (user.party.length >= 6)
      return res.status(400).json({ error: 'Đội hình đã đầy (6 pet)!' });
    if (!user.box.includes(petId))
      return res.status(400).json({ error: 'Pet không có trong hộp.' });
    await store.updateUser(userId, {
      party: [...user.party, petId],
      box: user.box.filter(id => id !== petId)
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Lỗi server: ' + e.message }); }
});

app.post('/api/game/box/swap', needLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await store.findUserById(userId);
    const { index, petId } = req.body || {};
    const outId = user.party[index];
    if (!outId || !user.box.includes(petId))
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ.' });
    const party = user.party.slice();
    party[index] = petId;
    const box = user.box.filter(id => id !== petId);
    box.push(outId);
    await store.updateUser(userId, { party, box });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Lỗi server: ' + e.message }); }
});

// Bảng khắc hệ cho modal trợ giúp
app.get('/api/game/chart', needLogin, (req, res) => {
  res.json({ types: D.TYPES, colors: D.TYPE_COLORS, chart: D.CHART });
});

// DEBUG chỉ dùng khi test local (ALLOW_DEBUG=1), không bật trên production
if (process.env.ALLOW_DEBUG === '1') {
  app.post('/api/debug/set-level', needLogin, async (req, res) => {
    const user = await store.findUserById(req.session.userId);
    const pet = await store.getPet(user.party[req.body.index || 0]);
    if (!pet) return res.status(400).json({ error: 'Không có pet' });
    const lv = Math.max(1, Math.min(50, parseInt(req.body.level) || 5));
    const st = eng.calcStats(pet.speciesId, lv);
    const exp = Math.max(0, parseInt(req.body.exp) || 0);
    await store.updatePet(pet.id, { level: lv, exp, hp: st.hp });
    res.json({ ok: true, level: lv });
  });
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- Boot ----
store.init()
  .then(() => app.listen(PORT, () => console.log(`🔥 Sủng Thú Liệt Hỏa chạy ở cổng ${PORT} (db: ${store.getMode()})`)))
  .catch(e => { console.error('Không khởi động được:', e); process.exit(1); });
