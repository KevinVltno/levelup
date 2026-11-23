# LevelUp

**Naik level, sedikit demi sedikit, setiap hari.**

LevelUp adalah habit tracker berbahasa Indonesia dengan checklist, quest bertimer, XP, rank, leaderboard, dan AI companion. Dashboard demo langsung terbuka ketika belum masuk. Data demo contoh dan perubahan pada hari berjalan disimpan di browser.

## Tahap implementasi

1. **Skema dan autentikasi.** Supabase Auth membuat profil saat pendaftaran. Next.js Proxy menyegarkan sesi cookie dan memeriksa akses halaman admin. RLS dan RPC memeriksa izin di database.
2. **Habit.** Template dikelompokkan menurut nama dan kategori, lalu pengguna memilih tingkat kesulitan. Urutan rekomendasi mengikuti kategori habit aktif dan jumlah hari terlewat. Habit custom memiliki target durasi, checklist, jadwal hari aktif, dan pengingat dalam aplikasi.
3. **Quest.** Database mengundi hingga tiga quest harian, satu mingguan, dan satu spesial sesuai habit dan pool yang tersedia. Quest tersimpan per periode. Start, pause, resume, cancel, dan reward memakai waktu database. Supabase Cron menyelesaikan atau menggagalkan quest saat pengguna sedang offline.
4. **XP, level, dan rank.** Template memakai reward tetap. Durasi aktual custom dicatat pengguna dengan reward 2 XP/menit dan batas gabungan 100 XP/hari. Kurva level memakai total `50 × level × (level − 1)`. Rank E, D, C, B, A, S, dan National Level mulai dari level 1, 5, 10, 20, 35, 50, dan 75. Quest gagal atau streak habit yang putus dapat memotong sampai 5 XP per kejadian.
5. **AI Companion.** Nara memakai Gemini melalui Route Handler. Balasan dialirkan ke UI dan disimpan dengan riwayat per akun. Database membatasi 20 pesan pengguna per jam.
6. **Admin.** Admin dapat mencari pengguna dan mengubah peran, membuat, mengedit, atau menonaktifkan template dan pool, serta melihat statistik global dan leaderboard.

Hari dan jadwal pengingat memakai WIB (Asia/Jakarta). Pekan dimulai Senin. Pengingat bisa muncul saat aplikasi terbuka dan dikirim sebagai Web Push ke perangkat yang sudah memberi izin. Satu quest per akun dapat berjalan dalam satu waktu. Membatalkan timer mengembalikan quest ke kondisi siap dengan durasi penuh. Checklist habit dan reward quest dapat diperoleh secara terpisah.

## Struktur proyek

```text
app/
  page.tsx                 Dashboard, habit, quest, progres, leaderboard, chat
  masuk/page.tsx            Form masuk dan pendaftaran
  admin/page.tsx            Panel admin
  auth/confirm/route.ts     Verifikasi email dan pembuatan sesi
  api/
    auth/route.ts           Masuk, daftar, keluar
    commands/route.ts       Mutasi habit, quest, dan admin
    dashboard/route.ts      Snapshot data dan waktu database
    chat/route.ts           Riwayat dan streaming Gemini
components/                 UI dashboard, timer, form, chat, dan admin
lib/                        Supabase, Gemini, validasi, dan model data
proxy.ts                    Middleware Next.js 16
public/levelup.svg          Identitas orisinal LevelUp
supabase/
  migrations/               Skema, RLS, trigger, fungsi XP/quest, rank
  seed.sql                  Template, pool quest, badge
  cron.sql                  Job penyelesaian quest
.env.example                Daftar konfigurasi
```

## Jalankan lokal

Gunakan Node.js 22 atau lebih baru.

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Buka `http://localhost:3000`. Di macOS dan Linux, gunakan `npm` dan `cp` sebagai pengganti `npm.cmd` dan `Copy-Item`.

### Sambungkan Supabase

1. Buat proyek Supabase. Jalankan `supabase/migrations/202611230001_levelup.sql`, lalu `supabase/seed.sql` dan `supabase/cron.sql` di SQL Editor. Periksa job `levelup-settle-quests` pada Integrations → Cron. Job berjalan setiap menit dan mencatat timestamp penyelesaian sesuai akhir countdown. [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart)
2. Di Authentication → URL Configuration, atur Site URL ke `http://localhost:3000` untuk pengujian lokal. Gunakan proyek Supabase terpisah untuk produksi agar email mengarah ke lingkungan yang sesuai.
3. Di Authentication → Email Templates, setel tautan **Confirm signup** ke `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Jika mengaktifkan konfirmasi email untuk pengguna publik, atur SMTP produksi di Supabase. [Supabase Auth untuk Next.js](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)
4. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` di `.env.local`. Isi `SUPABASE_SERVICE_ROLE_KEY` untuk penyimpanan balasan Nara. Buat API key di Google AI Studio, isi `GEMINI_API_KEY`, dan isi `GEMINI_MODEL` dengan ID model yang tersedia untuk key tersebut. Mulai ulang server. [SDK resmi Gemini](https://googleapis.github.io/js-genai/)
5. Daftar dari **Masuk / Daftar** dan verifikasi email jika diminta. Untuk menunjuk admin pertama, salin User UID dari Authentication → Users, lalu jalankan SQL berikut dengan UID tersebut.

```sql
update public.profiles
set role = 'admin'
where id = '<USER_UID>';
```

Muat ulang dashboard untuk membuka **Panel admin**. Hanya pengaturan Supabase yang berawalan `NEXT_PUBLIC_` yang dimaksudkan untuk akses publik. Simpan service-role key dan Gemini API key di environment server.

## Deploy ke Vercel

1. Push kode proyek ke repositori Git dan impor repositori di Vercel sebagai proyek Next.js. Pilih Node.js 22 atau lebih baru.
2. Isi variabel dari `.env.example` pada **Settings → Environment Variables** di lingkungan Production. Siapkan variabel Preview bila memakai database dan key pengujian. Deploy atau redeploy setelah menyimpan perubahan. [Environment Variables di Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables)
3. Ubah Supabase Auth **Site URL** untuk proyek produksi ke domain HTTPS Vercel atau domain kustom. Tambahkan URL konfirmasi ke pengaturan Redirect URLs bila diperlukan. Pastikan Cron aktif pada database produksi.
4. Daftar dengan akun pengujian, lalu cek verifikasi email, pencatatan habit, timer setelah refresh, balasan Nara, dan akses admin.

## Pengingat Web Push

Jalankan semua migrasi di folder `supabase/migrations/` sesuai urutan. Buat pasangan VAPID dengan `npx web-push generate-vapid-keys`. Setel `PUSH_PUBLIC_KEY`, `PUSH_PRIVATE_KEY`, `PUSH_SUBJECT` (URL HTTPS aplikasi), dan `PUSH_CRON_SECRET` (token acak) di environment server. Di Supabase Vault, simpan URL HTTPS rute `/api/push/reminders` dengan nama `push_cron_url` dan token yang sama dengan nama `push_cron_secret`. Jalankan `supabase/push-cron.sql` setelah itu.

Di HP Android, buka LevelUp di browser yang mendukung Web Push, masuk, buka ikon lonceng, lalu pilih **Aktifkan notifikasi HP**. Di iPhone atau iPad, tambahkan LevelUp ke Layar Utama dan buka ikonnya sebelum memberi izin. Setel jam pengingat untuk setiap habit dari menu **Habit**. [Dukungan Web Push di perangkat Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)

## Pemeriksaan build

```powershell
npm.cmd run lint
npm.cmd run build
```
