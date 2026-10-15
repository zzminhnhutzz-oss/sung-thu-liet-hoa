// ============================================================
// SỦNG THÚ LIỆT HỎA — Tầng lưu trữ
// Có MONGODB_URI -> dùng MongoDB Atlas (db "sung-thu-liet-hoa")
// Không có        -> dùng file JSON local (data/db.json) để dev/test
// ============================================================
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

let mode = 'file';
let mdb = null;          // MongoDB database handle
let mem = { users: [], pets: [], seq: 1 };

function loadFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      mem.users = raw.users || [];
      mem.pets = raw.pets || [];
      mem.seq = raw.seq || 1;
    }
  } catch (e) {
    console.warn('[db] Không đọc được db.json, dùng DB trống:', e.message);
  }
}

function saveFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(mem, null, 2));
  } catch (e) {
    console.error('[db] Lỗi ghi db.json:', e.message);
  }
}

async function init() {
  if (process.env.MONGODB_URI) {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    mdb = client.db('sung-thu-liet-hoa');
    mode = 'mongo';
    console.log('[db] Đã kết nối MongoDB (db sung-thu-liet-hoa)');
  } else {
    loadFile();
    console.log('[db] Dùng file JSON local (data/db.json)');
  }
}

function getMode() { return mode; }

// ---- helpers chuyển _id mongo -> id string ----
function norm(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

// ================= USERS =================
async function createUser({ username, passwordHash }) {
  const base = {
    username,
    passwordHash,
    coins: 100,
    items: { trap_thuong: 5, trap_xin: 0, potion: 2 },
    party: [],          // [petId...] tối đa 6, giữ thứ tự
    box: [],            // [petId...] kho
    pos: { x: 3, y: 1 },
    starterChosen: false,
    createdAt: new Date().toISOString()
  };
  if (mode === 'mongo') {
    const r = await mdb.collection('users').insertOne(base);
    return { id: String(r.insertedId), ...base };
  }
  const u = { id: 'u' + (mem.seq++), ...base };
  mem.users.push(u);
  saveFile();
  return u;
}

async function findUserByUsername(username) {
  if (mode === 'mongo') return norm(await mdb.collection('users').findOne({ username }));
  return mem.users.find(u => u.username === username) || null;
}

async function findUserById(id) {
  if (mode === 'mongo') {
    const { ObjectId } = require('mongodb');
    try {
      return norm(await mdb.collection('users').findOne({ _id: new ObjectId(id) }));
    } catch { return null; }
  }
  return mem.users.find(u => u.id === id) || null;
}

async function updateUser(id, patch) {
  if (mode === 'mongo') {
    const { ObjectId } = require('mongodb');
    await mdb.collection('users').updateOne({ _id: new ObjectId(id) }, { $set: patch });
    return findUserById(id);
  }
  const u = mem.users.find(x => x.id === id);
  if (u) Object.assign(u, patch);
  saveFile();
  return u || null;
}

// ================= PETS =================
async function createPet({ ownerId, speciesId, level, exp = 0, hp = null }) {
  const { calcStats } = require('./game/engine');
  const maxHp = calcStats(speciesId, level).hp;
  const base = { ownerId, speciesId, level, exp, hp: hp == null ? maxHp : hp, moves: null, caughtAt: new Date().toISOString() };
  if (mode === 'mongo') {
    const r = await mdb.collection('pets').insertOne(base);
    return { id: String(r.insertedId), ...base };
  }
  const p = { id: 'p' + (mem.seq++), ...base };
  mem.pets.push(p);
  saveFile();
  return p;
}

async function getPet(id) {
  if (mode === 'mongo') {
    const { ObjectId } = require('mongodb');
    try {
      return norm(await mdb.collection('pets').findOne({ _id: new ObjectId(id) }));
    } catch { return null; }
  }
  return mem.pets.find(p => p.id === id) || null;
}

// Lấy nhiều pet, GIỮ ĐÚNG thứ tự ids truyền vào
async function getPets(ids) {
  if (!ids || !ids.length) return [];
  if (mode === 'mongo') {
    const { ObjectId } = require('mongodb');
    const oids = ids.map(id => { try { return new ObjectId(id); } catch { return null; } }).filter(Boolean);
    const docs = await mdb.collection('pets').find({ _id: { $in: oids } }).toArray();
    const map = {};
    docs.forEach(d => { map[String(d._id)] = norm(d); });
    return ids.map(id => map[id]).filter(Boolean);
  }
  const map = {};
  mem.pets.forEach(p => { map[p.id] = p; });
  return ids.map(id => map[id]).filter(Boolean);
}

async function updatePet(id, patch) {
  if (mode === 'mongo') {
    const { ObjectId } = require('mongodb');
    await mdb.collection('pets').updateOne({ _id: new ObjectId(id) }, { $set: patch });
    return getPet(id);
  }
  const p = mem.pets.find(x => x.id === id);
  if (p) Object.assign(p, patch);
  saveFile();
  return p || null;
}

async function deletePet(id) {
  if (mode === 'mongo') {
    const { ObjectId } = require('mongodb');
    await mdb.collection('pets').deleteOne({ _id: new ObjectId(id) });
    return;
  }
  mem.pets = mem.pets.filter(p => p.id !== id);
  saveFile();
}

module.exports = {
  init, getMode,
  createUser, findUserByUsername, findUserById, updateUser,
  createPet, getPet, getPets, updatePet, deletePet
};
