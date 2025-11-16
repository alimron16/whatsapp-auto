const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function init() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wa_id TEXT,
        direction TEXT, 
        text TEXT,
        status TEXT DEFAULT 'pending',
        auto_replied INTEGER DEFAULT 0,
        created_at TEXT   -- Waktu server, bukan UTC
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER,
        type TEXT,
        path TEXT,
        mime TEXT,
        size INTEGER,
        created_at TEXT,  -- waktu server, bukan UTC
        FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
      )
    `);
  });
}


// Helper: waktu server (tanpa shift timezone)
function nowLocal() {
  const d = new Date();
  const pad = n => n.toString().padStart(2, '0');

  const year   = d.getFullYear();
  const month  = pad(d.getMonth() + 1);
  const day    = pad(d.getDate());
  const hour   = pad(d.getHours());      // <-- JAM SERVER MURNI
  const minute = pad(d.getMinutes());
  const second = pad(d.getSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}



function insertMessage({ wa_id, direction, text, status = 'pending', auto_replied = 0 }) {
  return new Promise((resolve, reject) => {
    const ts = nowLocal();

    db.run(
      `INSERT INTO messages (wa_id, direction, text, status, auto_replied, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [wa_id, direction, text || null, status, auto_replied, ts],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}


function updateStatus(id, status) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE messages SET status = ? WHERE id = ?`, [status, id], function (err) {
      if (err) return reject(err);
      resolve(true);
    });
  });
}


function getAllMessages() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM messages WHERE direction = 'inbound' 
       ORDER BY created_at DESC, id DESC`,
      [],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}


function getMessage(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM messages WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}


function getThreadByWaId(wa_id) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM messages WHERE wa_id = ?
       ORDER BY created_at ASC, id ASC`,
      [wa_id],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}


function deleteMessage(id) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM messages WHERE id = ?`, [id], function (err) {
      if (err) return reject(err);
      resolve(true);
    });
  });
}


function insertAttachment({ message_id, type, path, mime, size }) {
  return new Promise((resolve, reject) => {
    const ts = nowLocal();

    db.run(
      `INSERT INTO attachments (message_id, type, path, mime, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [message_id, type, path, mime, size || null, ts],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}


function getAttachmentsByMessage(message_id) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM attachments WHERE message_id = ?
       ORDER BY created_at ASC`,
      [message_id],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}


module.exports = {
  init,
  insertMessage,
  updateStatus,
  getAllMessages,
  getMessage,
  getThreadByWaId,
  deleteMessage,
  insertAttachment,
  getAttachmentsByMessage
};
