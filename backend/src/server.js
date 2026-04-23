// backend/src/server.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const { initializeDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 10000;
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');

if (!fs.existsSync(FRONTEND_DIR)) {
  console.error(`❌ Pasta frontend não encontrada em: ${FRONTEND_DIR}`);
  process.exit(1);
}

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/documentos', require('./routes/documentos'));
app.use('/api/fichas',     require('./routes/fichas'));
app.use('/api/admin',      require('./routes/admin'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'Rota não encontrada.' }));

// Frontend
app.use(express.static(FRONTEND_DIR, { index: false, dotfiles: 'ignore' }));
app.get('/',          (_req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(FRONTEND_DIR, 'dashboard.html')));
app.get('/forja',     (_req, res) => res.sendFile(path.join(FRONTEND_DIR, 'forja.html')));
app.get('/admin',     (_req, res) => res.sendFile(path.join(FRONTEND_DIR, 'admin.html')));
app.get('/perfil',    (_req, res) => res.sendFile(path.join(FRONTEND_DIR, 'perfil.html')));
app.use((_req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

async function iniciar() {
  try {
    await initializeDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n⚔️  VK.Studio na porta ${PORT}`);
      console.log(`📁  Frontend: ${FRONTEND_DIR}\n`);
    });
  } catch (err) {
    console.error('❌ Falha ao iniciar:', err.message);
    process.exit(1);
  }
}
iniciar();
