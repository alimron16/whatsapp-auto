# 📲 WhatsApp Auto-Reply Dashboard

Proyek ini adalah sistem **Customer Service otomatis berbasis WhatsApp** yang dilengkapi dengan **dashboard web interaktif** untuk memantau pesan masuk, status, dan balasan.

## ✨ Fitur Utama
- 🔗 **Integrasi WhatsApp** menggunakan [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).
- 🤖 **Auto-reply AI** dengan Gemini API (balasan sopan, formal, ringkas, sesuai waktu pagi/siang/sore/malam).
- 🗂️ **Database SQLite** untuk menyimpan pesan inbound/outbound dan attachment.
- 📊 **Dashboard Web**:
  - Filter pencarian (WA ID / isi pesan).
  - Filter status (pending / selesai).
  - Sortir berdasarkan waktu (terbaru / terlama).
  - Export data ke Excel (CSV).
  - Tampilan modern dengan aksen biru–merah, badge status interaktif, dan animasi hover.
- 📎 **Attachment Handling**: unduh dan simpan media (gambar, file, audio, video).
- ⚙️ **Filter Logika**:
  - Abaikan pesan dari nomor/grup tertentu.
  - Abaikan pesan terlalu panjang (>200 karakter).
  - Proses hanya pesan dengan keyword relevan.

## 🛠️ Teknologi
- **Node.js** + **Express**
- **whatsapp-web.js**
- **SQLite3**
- **Gemini API**
- **EJS** untuk templating dashboard
- **HTML/CSS/JS** untuk UI interaktif

## 🚀 Cara Menjalankan
1. Clone repo:
   ```bash
   git clone https://github.com/username/whatsapp-auto.git
   cd whatsapp-auto