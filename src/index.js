const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
dotenv.config();

const db = require('./db');
const routes = require('./routes');
const client = require('./whatsapp'); // init WA & listeners

// Pastikan folder uploads ada
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const app = express();
const port = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/uploads', express.static(uploadDir));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Multer untuk upload file biasa
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${ts}_${safeName}`);
  }
});
const upload = multer({ storage });

// Route upload (paste/drag-drop dari dashboard)
app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${file.filename}`;
  res.json({ path: file.path, mime: file.mimetype, url });
});

// Dashboard routes
app.use('/', routes);

// Home redirect
app.get('/', (req, res) => res.redirect('/messages'));

app.listen(port, () => {
  db.init();
  console.log(`Server berjalan di http://localhost:${port}`);
});