// ============================================================
// SỦNG THÚ LIỆT HỎA — Engine tính toán (sát thương, exp, bắt pet)
// ============================================================
const { SPECIES, MOVES, CHART, ENCOUNTERS } = require('./data');

// Chỉ số theo level: HP = (2*base+31)*lv/100 + lv + 10 ; các chỉ số khác +5
function calcStats(speciesId, level) {
  const b = SPECIES[speciesId].base;
  return {
    hp:  Math.floor((2 * b.hp + 31) * level / 100) + level + 10,
    atk: Math.floor((2 * b.atk + 31) * level / 100) + 5,
    def: Math.floor((2 * b.def + 31) * level / 100) + 5,
    spd: Math.floor((2 * b.spd + 31) * level / 100) + 5
  };
}

// Exp cần để lên từ level -> level+1
function expNext(level) {
  return 25 * level;
}

// Hệ số theo cấp chỉ số (-3..+3): công thức chuẩn
function stageMult(s) {
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}
function effAtk(f) { return Math.floor(f.stats.atk * stageMult((f.stages || {}).atk || 0)); }
function effDef(f) { return Math.floor(f.stats.def * stageMult((f.stages || {}).def || 0)); }
function effSpd(f) { return Math.floor(f.stats.spd * stageMult((f.stages || {}).spd || 0)); }

// Đổi cấp chỉ số, kẹp -3..+3, trả về mức thay đổi thực tế
function applyStages(f, stat, delta) {
  f.stages = f.stages || { atk: 0, def: 0, spd: 0 };
  const before = f.stages[stat] || 0;
  f.stages[stat] = Math.max(-3, Math.min(3, before + delta));
  return f.stages[stat] - before;
}

// Sát thương theo công thức kinh điển, có STAB 1.5, khắc hệ và chí mạng
function calcDamage(att, def, moveId) {
  const mv = MOVES[moveId];
  if (!mv) return { miss: true, dmg: 0, eff: 1 };
  if (Math.random() * 100 > mv.acc) return { miss: true, dmg: 0, eff: 1 };
  const stab = mv.type === att.type ? 1.5 : 1;
  const eff = (CHART[mv.type] && CHART[mv.type][def.type]) || 1;
  const crit = Math.random() < 0.1;
  const base = Math.floor(Math.floor((2 * att.level / 5 + 2) * mv.power * effAtk(att) / effDef(def)) / 50) + 2;
  const rand = 0.85 + Math.random() * 0.15;
  return { miss: false, dmg: Math.max(1, Math.floor(base * stab * eff * rand * (crit ? 1.5 : 1))), eff, crit };
}

function effText(eff) {
  if (eff > 1) return ' (Siêu hiệu quả!)';
  if (eff < 1) return ' (Không hiệu quả...)';
  return '';
}

// Tỉ lệ bắt: máu càng thấp càng dễ bắt, bẫy xịn x1.6
function catchChance(speciesId, curHp, maxHp, trapKind) {
  const base = SPECIES[speciesId].catchRate || 0.35;
  const hpFactor = (3 * maxHp - 2 * curHp) / (3 * maxHp);
  const trapMod = trapKind === 'trap_xin' ? 1.6 : 1;
  return Math.min(0.95, Math.max(0.03, base * hpFactor * trapMod));
}

function rollCatch(speciesId, curHp, maxHp, trapKind) {
  return Math.random() < catchChance(speciesId, curHp, maxHp, trapKind);
}

// Random pet hoang theo bảng encounters
function pickWild() {
  const total = ENCOUNTERS.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of ENCOUNTERS) {
    r -= e.w;
    if (r <= 0) {
      const level = e.min + Math.floor(Math.random() * (e.max - e.min + 1));
      return { speciesId: e.species, level };
    }
  }
  const e = ENCOUNTERS[0];
  return { speciesId: e.species, level: e.min };
}

module.exports = { calcStats, expNext, calcDamage, effText, catchChance, rollCatch, pickWild, stageMult, effAtk, effDef, effSpd, applyStages };
