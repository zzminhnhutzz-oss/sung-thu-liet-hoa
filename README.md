# 🔥 Sủng Thú Liệt Hỏa

Game web bắt pet phong cách VQSV: Liệt Hỏa — **nội dung gốc** (tên pet, cốt truyện tự sáng tác, không dùng tài sản bản quyền của game cũ).

## Tính năng (MVP)

- Đăng ký / đăng nhập tài khoản (mật khẩu băm bcrypt)
- Chọn 1 trong 3 pet khởi đầu (Hỏa Hồ / Thủy Quy / Mộc Miêu)
- Bản đồ đi lại (phím mũi tên / WASD / nút bấm trên điện thoại)
- Gặp pet hoang trong bụi cỏ → đánh theo lượt
- 8 hệ tương sinh tương khắc: Kim, Mộc, Thủy, Hỏa, Thổ, Phong, Điện, Quỷ
- Ném bẫy bắt pet (Bẫy Thường / Bẫy Xịn), pet lên cấp → **tiến hóa** đổi hình
- Đội hình 6 pet + Hộp chứa, nhà Hồi máu miễn phí, Cửa hàng mua bẫy/bình máu

## Chạy local

```bash
cd sung-thu-liet-hoa
npm install
node server.js        # http://localhost:3000
```

Không có `MONGODB_URI` thì dùng file JSON `data/db.json` (đủ để dev/test).

## Deploy lên Render

1. Tạo repo GitHub mới (private), push code lên.
2. Tạo **Web Service** mới trên Render, trỏ vào repo.
   - Build Command: `npm install`
   - Start Command: `node server.js`
3. Thêm biến môi trường:
   - `MONGODB_URI`: copy từ service shop (chung cụm Atlas, DB riêng `sung-thu-liet-hoa`)
   - `SESSION_SECRET`: chuỗi ngẫu nhiên dài
4. Deploy → mở URL là chơi.

## Cấu trúc

```
server.js          API + battle engine (logic trận đấu chạy 100% server)
db.js              Lưu trữ: MongoDB Atlas (có MONGODB_URI) hoặc file JSON
game/data.js       16 loài pet, 16 chiêu, bảng khắc hệ, bản đồ, shop
game/engine.js     Sát thương, EXP, tỉ lệ bắt
public/            Giao diện: index.html, style.css, app.js
public/sprites/    Sprite pet (pixel-art vẽ mới, 16 loài)
```
