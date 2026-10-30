# Chess Online

Platform game online multiplayer (saat ini **Catur** dan **Tic-Tac-Toe**), mobile-first, dengan server sebagai satu-satunya sumber kebenaran (authoritative). Dibangun dengan Node.js, Express, Socket.IO, dan chess.js. Tanpa framework frontend, tanpa build step, tanpa database.

## Fitur

- Dua game dalam satu platform: **Catur** dan **Tic-Tac-Toe**, dipilih saat membuat room.
- Dua pemain per room (Putih/X dan Hitam/O), maksimal dua penonton.
- Room privat dengan kode 5 karakter (crypto-random).
- Validasi langkah, hasil akhir, dan jam sepenuhnya di server.
- Time control 3 / 5 / 10 menit atau tanpa batas, dengan increment opsional.
- Tawaran remis, menyerah, dan rematch (kedua pemain harus setuju, sisi bertukar).
- Quick Chat: pesan cepat siap pakai yang tampil untuk semua orang di room.
- Reconnect token (SHA-256 hashed di server).
- Tema gelap (default) dan terang dengan animasi transisi Ripple.
- Animasi pergerakan bidak yang mulus (slide animation).
- Efek suara real-time (Web Audio API) dengan tombol mute.
- Fitur Paste pintar (otomatis mendeteksi kode room dari link).
- Export PGN untuk game catur.
- Dapat di-install sebagai PWA.
- UI/UX minimalis terinspirasi Vercel.

## Persyaratan

- [Node.js](https://nodejs.org/) (LTS, versi >= 18)
- Git (untuk clone repo)

## Instalasi (Windows / macOS / Linux)

1. Clone repository:

   ```bash
   git clone https://github.com/geoffreyoner/chess-online.git
   cd chess-online
   ```

2. Install dependensi:

   ```bash
   npm install
   ```

3. Jalankan server:

   ```bash
   npm start
   ```

   Server berjalan di http://localhost:3000. Buka browser dan mulai bermain.

## Konfigurasi Environment (Opsional)

Untuk mengubah port atau origin, salin `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Lalu edit isinya, misalnya `PORT=8080`. Daftar variabel lengkap ada di `.env.example`.

## Instalasi Khusus Android (Termux)

Untuk menjalankan server langsung dari HP Android:

```bash
pkg update && pkg upgrade
pkg install nodejs-lts git
git clone https://github.com/geoffreyoner/chess-online.git
cd chess-online
npm install
npm start
```

## Bermain Online (Tanpa VPS / Port Forwarding)

Jika server berjalan lokal (laptop atau Termux) dan kamu ingin bermain dengan teman yang jauh, gunakan tunnel seperti Cloudflare:

1. Pastikan server sudah berjalan (`npm start`).
2. Di tab terminal baru, jalankan:

   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   ```

   Di Termux, bisa juga install lewat `pkg install cloudflared`.

3. Bagikan link `https://...trycloudflare.com` yang muncul ke temanmu.

> **Catatan:** link tunnel berubah setiap kali dijalankan ulang, jadi link dan room lama tidak bisa dipakai lagi.

## Membuat & Join Room

1. Buka aplikasi di browser.
2. Isi nama, pilih game (**Chess** atau **Tic-Tac-Toe**), lalu pilih time control.
3. Klik **Create room**. Kamu otomatis jadi Putih (di Tic-Tac-Toe: **X**, yang jalan duluan).
4. Bagikan kode room (atau klik **Copy** pada bagian Invite).
5. Temanmu tinggal membuka link tersebut atau memasukkan kodenya di menu **Join**. Jenis game ditentukan oleh room, jadi pemain yang join tidak perlu memilih lagi.

## Aturan Tic-Tac-Toe

- Papan 3x3. Pembuat room bermain sebagai **X** dan jalan duluan, lawannya **O**.
- Menang dengan tiga tanda sejajar (horizontal, vertikal, atau diagonal). Papan penuh tanpa pemenang berarti seri.
- Jam, tawaran remis, menyerah, dan rematch bekerja sama seperti di catur. Klaim remis dan export PGN hanya ada di catur.

## Struktur Proyek

```text
src/
  server.js          Express + Socket.IO
  config.js          Konfigurasi dari environment
  games/             Engine tiap game (factory pattern)
    index.js           getEngine(gameType)
    chess.js           Aturan catur (chess.js)
    tictactoe.js       Aturan Tic-Tac-Toe
  services/          roomService, timerService, tokenService
  socket/            roomHandlers (room:*) dan gameHandlers (game:*, chat)
  middleware/        Validasi payload dan rate limiting
  utils/             Logger dan error
public/              Frontend (ES modules vanilla JS), CSS, PWA
tests/               Automated test
```

Server menyimpan `gameType` di tiap room dan memilih engine dari situ. Payload `game:move` divalidasi sesuai jenis game: catur memakai `{ from, to, promotion?, requestId }`, Tic-Tac-Toe memakai `{ index, requestId? }`.

## Menambah Game Baru

1. Buat engine di `src/games/<nama>.js` yang mengekspor `create`, `start`, `endGame`, `applyMove`, `resign`, `offerDraw`, `respondDraw`, `claimDraw`, `canClaimDraw`, dan `handleTimeout`.
2. Daftarkan di `src/games/index.js`.
3. Tambahkan nama game ke daftar yang diizinkan di `src/middleware/validation.js` dan `src/services/roomService.js` (`SUPPORTED_GAMES`).
4. Tambahkan parser payload langkahnya di `MOVE_PARSERS` pada `src/socket/gameHandlers.js`, dan bentuk snapshot-nya di `buildGameView` pada `roomService.js`.
5. Tambahkan tombol di lobby dan rendering papannya di frontend (`public/js/game.js`).

## Pengujian

Aplikasi dilengkapi automated test (Node.js test runner):

```bash
npm test
```

## Batasan yang Diketahui

- State disimpan di memori proses. Restart server menghapus semua room yang sedang aktif.
- Tidak kompatibel dengan multi-instance tanpa shared state (misalnya Redis).
- Klaim threefold repetition dan fifty-move rule dilakukan manual oleh pemain, bukan otomatis.
- Quick Chat hanya mendukung pesan singkat (maksimal 100 karakter, dibatasi 15 pesan per menit per koneksi).

## Lisensi

Didistribusikan di bawah [MIT License](LICENSE).

<div align="center">

Dibuat dengan ❤️ oleh Goomys

</div>
