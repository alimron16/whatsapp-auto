const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function fmtUtc(ts) {
  const d = new Date(ts);
  const YYYY = d.getUTCFullYear();
  const MM = String(d.getUTCMonth() + 1).padStart(2, '0');
  const DD = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
}

function parseParts(raw) {
  const parts = (raw || '').split(/[- :]/).map(Number);
  if (parts.length < 6) return null;
  return parts;
}

function epochFromWibString(raw) {
  const p = parseParts(raw);
  if (!p) return null;
  const [Y, M, D, h, m, s] = p;
  // raw is WIB local time; to get UTC epoch, subtract 7 hours
  return Date.UTC(Y, M - 1, D, h, m, s) - (7 * 3600 * 1000);
}

function epochFromUtcString(raw) {
  try {
    return new Date(raw + 'Z').getTime();
  } catch (e) {
    return null;
  }
}

function shouldConvert(raw) {
  const now = Date.now();
  const eUtc = epochFromUtcString(raw);
  const eWib = epochFromWibString(raw);
  if (!eUtc && !eWib) return false;
  // If UTC interpretation is in the future by >1h but WIB interpretation is not, convert
  if (Number.isFinite(eUtc) && eUtc > now + 3600 * 1000 && Number.isFinite(eWib) && Math.abs(eWib - now) < Math.abs(eUtc - now)) {
    return { from: 'wib', epoch: eWib };
  }
  // If WIB interpretation is far in past (>365 days) but UTC is recent, prefer UTC
  if (Number.isFinite(eWib) && Math.abs(eWib - now) > 365 * 24 * 3600 * 1000 && Number.isFinite(eUtc)) {
    return { from: 'utc', epoch: eUtc };
  }
  // Otherwise, if UTC parse failed and WIB works, convert
  if (!Number.isFinite(eUtc) && Number.isFinite(eWib)) return { from: 'wib', epoch: eWib };
  return false;
}

function migrateTable(table, cb) {
  db.all(`SELECT id, created_at FROM ${table}`, [], (err, rows) => {
    if (err) return cb(err);
    let updates = 0;
    const tasks = rows.map(r => ({ id: r.id, raw: r.created_at }));

    function next(i) {
      if (i >= tasks.length) return cb(null, updates);
      const t = tasks[i];
      const decision = shouldConvert(t.raw);
      if (!decision) return next(i + 1);
      const newUtcString = fmtUtc(decision.epoch);
      db.run(`UPDATE ${table} SET created_at = ? WHERE id = ?`, [newUtcString, t.id], function (e) {
        if (!e) updates++;
        next(i + 1);
      });
    }
    next(0);
  });
}

console.log('Starting timestamp normalization. BACKUP your database before running this.');
console.log('DB:', dbPath);

migrateTable('messages', (err, u1) => {
  if (err) return console.error('Messages migrate error:', err);
  console.log('Messages updated:', u1);
  migrateTable('attachments', (err2, u2) => {
    if (err2) return console.error('Attachments migrate error:', err2);
    console.log('Attachments updated:', u2);
    console.log('Done.');
    db.close();
  });
});
