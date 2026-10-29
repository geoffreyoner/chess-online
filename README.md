# Chess Online

Aplikasi web catur online multiplayer, mobile-first, dengan server sebagai satu-satunya sumber kebenaran (authoritative). Dibangun dengan Node.js, Express, Socket.IO, dan chess.js. Tanpa framework frontend, tanpa build step, tanpa database.

## Fitur

- Dua pemain (Putih & Hitam) per room, maksimal dua penonton.
- Room privat dengan kode 5 karakter (crypto-random).
- Validasi langkah, hasil akhir, dan jam sepenuhnya di server.
- Reconnect token (SHA-256 hashed di server).
- Tema gelap (default) dan terang dengan animasi transisi Ripple.
- Animasi pergerakan bidak yang mulus (slide animation).
- Efek suara real-time (Web Audio API) saat melangkah, skak, atau selesai.
- Fitur Paste pintar (otomatis mendeteksi kode room dari link).
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
2. Isi nama dan pilih time control.
3. Klik **Create room**. Kamu otomatis jadi Putih.
4. Bagikan kode room (atau klik **Copy** pada bagian Invite).
5. Temanmu tinggal membuka link tersebut atau memasukkan kodenya di menu **Join**.

## Pengujian

Aplikasi dilengkapi automated test (Node.js test runner):

```bash
npm test
```

## Batasan yang Diketahui

- State disimpan di memori proses. Restart server menghapus semua room yang sedang aktif.
- Tidak kompatibel dengan multi-instance tanpa shared state (misalnya Redis).
- Klaim threefold repetition dan fifty-move rule dilakukan manual oleh pemain, bukan otomatis.

## Lisensi

Didistribusikan di bawah [MIT License](LICENSE).

<div align="center">

Dibuat dengan ❤️ oleh Goomys

</div>