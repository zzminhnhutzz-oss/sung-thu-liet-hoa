// ============================================================
// SỦNG THÚ LIỆT HỎA — Dữ liệu game (bản MVP)
// Toàn bộ tên pet, cốt truyện là sáng tác gốc, không lấy từ game cũ.
// ============================================================

// 8 hệ
const TYPES = {
  kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa',
  tho: 'Thổ', phong: 'Phong', dien: 'Điện', quy: 'Quỷ'
};

const TYPE_COLORS = {
  kim: '#8d9bb5', moc: '#43a047', thuy: '#29b6f6', hoa: '#ff7043',
  tho: '#a1887f', phong: '#4dd0e1', dien: '#fdd835', quy: '#7e57c2'
};

// Bảng khắc hệ: mỗi hệ mạnh x2 với 2 hệ kế tiếp, yếu x0.5 với 2 hệ trước đó
// Thứ tự vòng: Kim -> Mộc -> Thủy -> Hỏa -> Thổ -> Phong -> Điện -> Quỷ -> Kim
const CHART = {
  kim:   { kim: 1, moc: 2,   thuy: 2,   hoa: 1,   tho: 1,   phong: 1,   dien: 0.5, quy: 0.5 },
  moc:   { kim: 0.5, moc: 1,  thuy: 2,   hoa: 2,   tho: 1,   phong: 1,   dien: 1,   quy: 0.5 },
  thuy:  { kim: 0.5, moc: 0.5, thuy: 1,  hoa: 2,   tho: 2,   phong: 1,   dien: 1,   quy: 1   },
  hoa:   { kim: 1,   moc: 0.5, thuy: 0.5, hoa: 1,  tho: 2,   phong: 2,   dien: 1,   quy: 1   },
  tho:   { kim: 1,   moc: 1,   thuy: 0.5, hoa: 0.5, tho: 1,  phong: 2,   dien: 2,   quy: 1   },
  phong: { kim: 1,   moc: 1,   thuy: 1,   hoa: 0.5, tho: 0.5, phong: 1,  dien: 2,   quy: 2   },
  dien:  { kim: 2,   moc: 1,   thuy: 1,   hoa: 1,   tho: 0.5, phong: 0.5, dien: 1,  quy: 2   },
  quy:   { kim: 2,   moc: 2,   thuy: 1,   hoa: 1,   tho: 1,   phong: 0.5, dien: 0.5, quy: 1   }
};

// Chiêu thức: id -> { name, type, power, acc }
const MOVES = {
  'tra-thep':  { name: 'Trảo Thép',    type: 'kim',   power: 40, acc: 100 },
  'kiem-khi':  { name: 'Kiếm Khí',     type: 'kim',   power: 65, acc: 95  },
  'day-leo':   { name: 'Dây Leo Quấn', type: 'moc',   power: 40, acc: 100 },
  'la-sac':    { name: 'Lá Sắc',       type: 'moc',   power: 65, acc: 95  },
  'phun-nuoc': { name: 'Phun Nước',    type: 'thuy',  power: 40, acc: 100 },
  'song-than': { name: 'Sóng Thần',    type: 'thuy',  power: 70, acc: 90  },
  'lua-nho':   { name: 'Lửa Nhỏ',      type: 'hoa',   power: 40, acc: 100 },
  'hoa-cau':   { name: 'Hỏa Cầu',      type: 'hoa',   power: 65, acc: 95  },
  'dao-dat':   { name: 'Đào Đất',      type: 'tho',   power: 40, acc: 100 },
  'dia-chan':  { name: 'Địa Chấn',     type: 'tho',   power: 70, acc: 90  },
  'gio-loc':   { name: 'Gió Lốc',      type: 'phong', power: 40, acc: 100 },
  'phong-nhan':{ name: 'Phong Nhận',   type: 'phong', power: 65, acc: 95  },
  'tia-dien':  { name: 'Tia Lửa Điện', type: 'dien',  power: 40, acc: 100 },
  'sam-set':   { name: 'Sấm Sét',      type: 'dien',  power: 70, acc: 90  },
  'bong-ma':   { name: 'Bóng Ma',      type: 'quy',   power: 45, acc: 100 },
  'hon-doat':  { name: 'Hồn Đoạt',     type: 'quy',   power: 65, acc: 95  }
};

// Loài pet: id -> { name, type, base:{hp,atk,def,spd}, catchRate, expYield, moves, evo?, desc }
const SPECIES = {
  // --- 3 pet khởi đầu ---
  'hoa-ho': {
    name: 'Hỏa Hồ', type: 'hoa', base: { hp: 45, atk: 55, def: 40, spd: 60 },
    expYield: 64, moves: ['lua-nho', 'tra-thep', 'gio-loc'],
    evo: { to: 'viem-ho-vuong', at: 16 },
    desc: 'Chú cáo lửa tinh nghịch, chùm đuôi lúc nào cũng phừng phừng cháy.'
  },
  'viem-ho-vuong': {
    name: 'Viêm Hồ Vương', type: 'hoa', base: { hp: 70, atk: 85, def: 65, spd: 90 },
    expYield: 140, moves: ['hoa-cau', 'lua-nho', 'kiem-khi'],
    desc: 'Chúa tể loài cáo lửa, chiếc bờm rực cháy như vầng mặt trời.'
  },
  'thuy-quy': {
    name: 'Thủy Quy', type: 'thuy', base: { hp: 55, atk: 50, def: 65, spd: 40 },
    expYield: 64, moves: ['phun-nuoc', 'dao-dat', 'day-leo'],
    evo: { to: 'hai-quy-than', at: 16 },
    desc: 'Rùa con hiền lành, trên mai vẽ hình sóng nước uốn lượn.'
  },
  'hai-quy-than': {
    name: 'Hải Quy Thần', type: 'thuy', base: { hp: 85, atk: 75, def: 95, spd: 55 },
    expYield: 140, moves: ['song-than', 'phun-nuoc', 'dia-chan'],
    desc: 'Thần rùa của biển cả, mỗi bước đi đều tạo nên sóng lớn.'
  },
  'moc-mieu': {
    name: 'Mộc Miêu', type: 'moc', base: { hp: 50, atk: 55, def: 50, spd: 65 },
    expYield: 64, moves: ['day-leo', 'tra-thep', 'phun-nuoc'],
    evo: { to: 'lam-mieu-vuong', at: 16 },
    desc: 'Mèo rừng nhanh nhẹn, đôi tai hình chiếc lá xanh mướt.'
  },
  'lam-mieu-vuong': {
    name: 'Lâm Miêu Vương', type: 'moc', base: { hp: 75, atk: 90, def: 70, spd: 95 },
    expYield: 140, moves: ['la-sac', 'day-leo', 'phong-nhan'],
    desc: 'Vua mèo của rừng xanh, móng vuốt sắc bén như lá.'
  },
  // --- Pet hoang ---
  'thiet-trung': {
    name: 'Thiết Trùng', type: 'kim', base: { hp: 50, atk: 60, def: 70, spd: 35 },
    catchRate: 0.45, expYield: 60, moves: ['tra-thep', 'dao-dat', 'day-leo'],
    evo: { to: 'cuong-giap-trung', at: 14 },
    desc: 'Bọ sắt cứng cáp, lớp vỏ sáng loáng như thép được mài.'
  },
  'cuong-giap-trung': {
    name: 'Cương Giáp Trùng', type: 'kim', base: { hp: 75, atk: 90, def: 100, spd: 50 },
    catchRate: 0.2, expYield: 120, moves: ['kiem-khi', 'tra-thep', 'dia-chan'],
    desc: 'Bọ giáp thép, đôi càng chém đứt cả đá tảng.'
  },
  'phong-dieu': {
    name: 'Phong Điểu', type: 'phong', base: { hp: 45, atk: 55, def: 40, spd: 80 },
    catchRate: 0.45, expYield: 58, moves: ['gio-loc', 'tra-thep', 'tia-dien'],
    evo: { to: 'bao-dieu', at: 14 },
    desc: 'Chim én của gió, bay nhanh hơn cả một cái chớp mắt.'
  },
  'bao-dieu': {
    name: 'Bão Điểu', type: 'phong', base: { hp: 70, atk: 85, def: 60, spd: 110 },
    catchRate: 0.18, expYield: 125, moves: ['phong-nhan', 'gio-loc', 'sam-set'],
    desc: 'Đại bàng bão tố, mỗi lần vỗ cánh đều tạo nên lốc xoáy.'
  },
  'dien-thu': {
    name: 'Điện Thử', type: 'dien', base: { hp: 45, atk: 60, def: 40, spd: 85 },
    catchRate: 0.4, expYield: 62, moves: ['tia-dien', 'tra-thep', 'gio-loc'],
    evo: { to: 'loi-thu-vuong', at: 18 },
    desc: 'Chuột điện tinh nghịch, hai má lúc nào cũng tích đầy điện.'
  },
  'loi-thu-vuong': {
    name: 'Lôi Thử Vương', type: 'dien', base: { hp: 70, atk: 95, def: 60, spd: 115 },
    catchRate: 0.15, expYield: 130, moves: ['sam-set', 'tia-dien', 'kiem-khi'],
    desc: 'Vua chuột sấm, chiếc đuôi phóng ra những tia chớp chói lòa.'
  },
  'tho-hung': {
    name: 'Thổ Hùng', type: 'tho', base: { hp: 60, atk: 65, def: 60, spd: 35 },
    catchRate: 0.45, expYield: 65, moves: ['dao-dat', 'tra-thep', 'lua-nho'],
    evo: { to: 'nham-hung-vuong', at: 14 },
    desc: 'Gấu đất mũm mĩm, sở thích lớn nhất là đào hang ngủ trưa.'
  },
  'nham-hung-vuong': {
    name: 'Nham Hùng Vương', type: 'tho', base: { hp: 90, atk: 100, def: 90, spd: 45 },
    catchRate: 0.18, expYield: 130, moves: ['dia-chan', 'dao-dat', 'hoa-cau'],
    desc: 'Gấu đá khổng lồ, một cú đấm cũng đủ làm rung chuyển mặt đất.'
  },
  'quy-hoa': {
    name: 'Quỷ Hỏa', type: 'quy', base: { hp: 50, atk: 65, def: 50, spd: 70 },
    catchRate: 0.3, expYield: 85, moves: ['bong-ma', 'tia-dien', 'gio-loc'],
    evo: { to: 'ma-hoa-quy', at: 20 },
    desc: 'Đốm lửa ma trơi lập lòe, rất thích trêu chọc người đi đêm.'
  },
  'ma-hoa-quy': {
    name: 'Ma Hỏa Quỷ', type: 'quy', base: { hp: 75, atk: 100, def: 70, spd: 95 },
    catchRate: 0.12, expYield: 150, moves: ['hon-doat', 'bong-ma', 'sam-set'],
    desc: 'Quỷ lửa hắc ám, ngọn lửa tím đen nuốt chửng mọi ánh sáng.'
  }
};

const STARTERS = ['hoa-ho', 'thuy-quy', 'moc-mieu'];

// Bản đồ 20x15: # cây, . đường, , cỏ (gặp pet), H nhà hồi máu, M cửa hàng,
// W nước, N dân làng (trang trí, không đi xuyên được)
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

const START_POS = { x: 3, y: 1 };
const ENCOUNTER_RATE = 0.15;

// Bảng pet hoang trong cỏ: { species, min, max, w }
const ENCOUNTERS = [
  { species: 'thiet-trung', min: 2,  max: 5,  w: 25 },
  { species: 'phong-dieu',  min: 2,  max: 5,  w: 25 },
  { species: 'tho-hung',    min: 3,  max: 6,  w: 20 },
  { species: 'dien-thu',    min: 4,  max: 7,  w: 15 },
  { species: 'quy-hoa',     min: 6,  max: 9,  w: 10 },
  { species: 'bao-dieu',    min: 10, max: 12, w: 5  }
];

// Cửa hàng
const SHOP = {
  trap_thuong: { name: 'Bẫy Thường', price: 50,  desc: 'Bẫy cơ bản, tỉ lệ bắt chuẩn' },
  trap_xin:    { name: 'Bẫy Xịn',    price: 150, desc: 'Tỉ lệ bắt x1.6' },
  potion:      { name: 'Bình Máu',   price: 40,  desc: 'Hồi 60 HP cho pet trong trận' }
};

const ITEM_NAMES = { trap_thuong: 'Bẫy Thường', trap_xin: 'Bẫy Xịn', potion: 'Bình Máu' };

module.exports = {
  TYPES, TYPE_COLORS, CHART, MOVES, SPECIES, STARTERS,
  MAP, START_POS, ENCOUNTER_RATE, ENCOUNTERS, SHOP, ITEM_NAMES
};
