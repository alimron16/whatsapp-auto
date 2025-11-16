const path = require('path');
const fs = require('fs');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const db = require('./db');
const gemini = require('./gemini');
const qrcode = require('qrcode-terminal');

// Helper: Load excluded numbers dari file excluded.json (bisa diubah via UI)
function loadExcludedNumbers() {
  try {
    const filePath = path.join(__dirname, 'excluded.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading excluded.json:', e);
  }
  return [];
}

// keyword filter
// Jika keyword kosong/undefined, semua pesan akan di-process
// Jika ada keyword, hanya pesan yang mengandung keyword (case-insensitive) yang akan di-proses
const KEYWORD_FILTER = [
      "kode","tujuan","cek","tolong","up","update","bantu","sore","siang","pagi","tim",
      "gimana","gmn","lama","hc","marah","validasi","refund","batalkan","batal","diproses",
      "proses","Menunggu Jawaban","trx","Mhn tunggu trx sblmnya selesai","bagaimana"
  // Kosongkan array ini jika ingin proses semua pesan tanpa filter
];



const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', qr => {
  // tampilkan QR di terminal
  qrcode.generate(qr, { small: true });
});


client.on('ready', () => {
  console.log('WhatsApp siap!');
  // Dapatkan nomor diri sendiri untuk mengabaikan pesan outgoing
  client.getWWebVersion().then((v) => {
    console.log('WhatsApp Web version:', v);
  });
});


client.on('message', async (msg) => {
  try {
    const wa_id = msg.from;

    // Skip jika pesan dari diri sendiri (outgoing message)
    if (msg.fromMe) {
      console.log('Pesan dari diri sendiri, diabaikan');
      return;
    }

  
    // Skip jika nomor/grup ada di daftar excluded (load dinamis dari file)
    const EXCLUDED_NUMBERS = loadExcludedNumbers();
    if (EXCLUDED_NUMBERS.includes(wa_id)) {
      console.log('Pesan dari', wa_id, 'dikecualikan (terdaftar di excluded.json)');
      return;
    }

    let text = msg.body || null;

    // Tolak pesan bila lebih dari 200 karakter (setelah normalisasi whitespace)
    const normalizedText = text ? text.replace(/\s+/g, ' ').trim() : '';
    if (normalizedText.length > 200) {
      console.log('Pesan melebihi 200 karakter, diabaikan. length=', normalizedText.length, 'preview=', normalizedText.substring(0, 80));
      return;
    }
    text = normalizedText || null;

    // Filter berdasarkan keyword (jika KEYWORD_FILTER ada)
    if (KEYWORD_FILTER.length > 0) {
      const hasKeyword = KEYWORD_FILTER.some(keyword => 
        text && text.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (!hasKeyword) {
        console.log('Pesan tidak mengandung keyword, diabaikan:', text?.substring(0, 50));
        return;
      }
    }

    // Simpan inbound
    const inboundId = await db.insertMessage({
      wa_id,
      direction: 'inbound',
      text,
      status: 'pending'
    });

    // Jika pesan media, unduh dan simpan sebagai attachment
    if (msg.hasMedia) {
      const media = await msg.downloadMedia();
      const buffer = Buffer.from(media.data, 'base64');
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
      const filename = `${Date.now()}_${msg.id.id}.${mimeToExt(media.mimetype)}`;
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buffer);

      await db.insertAttachment({
        message_id: inboundId,
        type: media.mimetype.startsWith('image/') ? 'image' : 'file',
        path: filePath,
        mime: media.mimetype,
        size: buffer.length
      });
    }

    // Auto-reply via Gemini
    const replyText = await gemini.generateReply(text);
    await msg.reply(replyText);

    // Do NOT mark conversation as 'selesai' when Gemini auto-replies for the first time.
    // Keep status as 'pending' so a human operator can review/close it later.
    await db.insertMessage({
      wa_id,
      direction: 'outbound',
      text: replyText,
      status: 'pending',
      auto_replied: 1
    });

  } catch (e) {
    console.error('Handle message error:', e);
  }
});

function mimeToExt(mime) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf'
  };
  return map[mime] || 'bin';
}

// Helper untuk kirim teks
async function sendText(to, text) {
  return client.sendMessage(to, text);
}

// Helper untuk kirim media dari path file
async function sendMedia(to, filePath, mime) {
  try {
    const data = fs.readFileSync(filePath);
    const b64 = data.toString('base64');
    const media = new MessageMedia(mime, b64, path.basename(filePath));
    return await client.sendMessage(to, media);
  } catch (err) {
    console.error('sendMedia error:', err, 'filePath:', filePath);
    throw err;
  }
}

client.initialize();

module.exports = {
  client,
  sendText,
  sendMedia
};