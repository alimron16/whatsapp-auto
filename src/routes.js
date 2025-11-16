const path = require('path');
const fs = require('fs');
const express = require('express');
const router = express.Router();
const db = require('./db');
const { sendText, sendMedia } = require('./whatsapp');

// Path untuk file excluded numbers
const excludedFilePath = path.join(__dirname, 'excluded.json');

// Helper: Load excluded numbers dari file
function loadExcluded() {
  try {
    if (fs.existsSync(excludedFilePath)) {
      return JSON.parse(fs.readFileSync(excludedFilePath, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading excluded.json:', e);
  }
  return [];
}

// Helper: Save excluded numbers ke file
function saveExcluded(data) {
  fs.writeFileSync(excludedFilePath, JSON.stringify(data, null, 2));
}

// List pesan inbound
router.get('/messages', async (req, res) => {
  const messages = await db.getAllMessages();
  res.render('messages', { messages });
});

// Detail thread + balas
router.get('/messages/:id', async (req, res) => {
  const message = await db.getMessage(req.params.id);
  if (!message) return res.status(404).send('Not found');
  const thread = await db.getThreadByWaId(message.wa_id);

  // Ambil attachments untuk masing-masing message
  const attachmentsMap = {};
  for (const m of thread) {
    const atts = await db.getAttachmentsByMessage(m.id);
    // Tambahkan url/filename yang aman untuk digunakan di view (hindari split('/') di client)
    attachmentsMap[m.id] = atts.map(a => ({
      ...a,
      filename: path.basename(a.path),
      url: '/uploads/' + path.basename(a.path)
    }));
  }

  res.render('message_show', { message, thread, attachmentsMap });
});

// Balas teks (dan optional: lampiran yang di-paste)
router.post('/messages/:id/reply', async (req, res) => {
  const { text, filePath, mime } = req.body;
  const msg = await db.getMessage(req.params.id);
  if (!msg) return res.status(404).send('Not found');

  try {
    // Kirim teks jika ada
    if (text && text.trim().length > 0) {
      await sendText(msg.wa_id, text.trim());
      await db.insertMessage({
        wa_id: msg.wa_id,
        direction: 'outbound',
        text: text.trim(),
        status: 'selesai'
      });
    }

    // Kirim file jika ada (dari paste/upload)
    if (filePath && mime && fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      await sendMedia(msg.wa_id, filePath, mime);

      const outId = await db.insertMessage({
        wa_id: msg.wa_id,
        direction: 'outbound',
        text: null,
        status: 'selesai'
      });

      await db.insertAttachment({
        message_id: outId,
        type: mime.startsWith('image/') ? 'image' : 'file',
        path: filePath,
        mime: mime,
        size: stats.size
      });
    }

    // Tandai inbound selesai
    await db.updateStatus(msg.id, 'selesai');
    res.redirect(`/messages/${msg.id}`);
  } catch (err) {
    console.error('Reply error:', err);
    res.status(500).send('Gagal mengirim balasan: ' + (err.message || err));
  }
});

// Balas dengan file yang diupload/paste (path dari /upload)
router.post('/messages/:id/reply-attachment', async (req, res) => {
  const { filePath, mime } = req.body;
  const msg = await db.getMessage(req.params.id);
  if (!msg) return res.status(404).send('Not found');
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).send('File tidak ditemukan');
    }

    const stats = fs.statSync(filePath);
    await sendMedia(msg.wa_id, filePath, mime || guessMime(filePath));

    const outId = await db.insertMessage({
      wa_id: msg.wa_id,
      direction: 'outbound',
      text: null,
      status: 'selesai'
    });

    await db.insertAttachment({
      message_id: outId,
      type: (mime || guessMime(filePath)).startsWith('image/') ? 'image' : 'file',
      path: filePath,
      mime: mime || guessMime(filePath),
      size: stats.size
    });

    await db.updateStatus(msg.id, 'selesai');
    res.redirect(`/messages/${msg.id}`);
  } catch (err) {
    console.error('Reply attachment error:', err);
    res.status(500).send('Gagal mengirim lampiran: ' + (err.message || err));
  }
});

// Hapus pesan inbound (beserta attachments)
router.post('/messages/:id/delete', async (req, res) => {
  const msg = await db.getMessage(req.params.id);
  if (!msg) return res.status(404).send('Not found');

  // Hapus attachments file fisik
  const atts = await db.getAttachmentsByMessage(msg.id);
  for (const a of atts) {
    if (a.path && fs.existsSync(a.path)) {
      try { fs.unlinkSync(a.path); } catch {}
    }
  }

  await db.deleteMessage(msg.id);
  res.redirect('/messages');
});

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

// ===== ROUTES untuk kelola pengecualian =====
router.get('/excluded', (req, res) => {
  const excludedNumbers = loadExcluded();
  res.render('excluded', { excludedNumbers });
});

router.post('/excluded/add', (req, res) => {
  const { number } = req.body;
  if (!number || !number.trim()) {
    return res.status(400).send('Nomor/Grup tidak boleh kosong');
  }
  
  const cleanNum = number.trim();
  let excluded = loadExcluded();
  
  if (!excluded.includes(cleanNum)) {
    excluded.push(cleanNum);
    saveExcluded(excluded);
    console.log('Tambah excluded:', cleanNum);
  }
  
  res.redirect('/excluded');
});

router.post('/excluded/delete', (req, res) => {
  const { number } = req.body;
  if (!number) return res.status(400).send('Nomor/Grup tidak ditemukan');
  
  let excluded = loadExcluded();
  excluded = excluded.filter(n => n !== number);
  saveExcluded(excluded);
  console.log('Hapus excluded:', number);
  
  res.redirect('/excluded');
});

module.exports = router;