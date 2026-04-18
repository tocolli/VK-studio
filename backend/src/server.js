// backend/src/server.js
const path = require('path');

// Carrega .env sempre a partir da raiz do projeto (2 níveis acima deste arquivo)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const { initializeDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 10000;

// Caminho absoluto para /frontend — independente de onde o processo foi iniciado
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');

// Valida que a pasta frontend existe antes de subir
if (!fs.existsSync(FRONTEND_DIR)) {
  console.error(`❌ Pasta frontend não encontrada em: ${FRONTEND_DIR}`);
  console.error('   Certifique-se de rodar: node backend/src/server.js');
  process.exit(1);
}

// ===== MIDDLEWARES GLOBAIS =====
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== ROTAS DA API (antes do static, para ter prioridade) =====
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/documentos', require('./routes/documentos'));
app.use('/api/fichas',     require('./routes/fichas'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV || 'development' });
});

// 404 para qualquer /api/* não mapeado acima
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, message: 'Rota de API não encontrada.' });
});

// ===== FRONTEND ESTÁTICO =====
// Serve SOMENTE o conteúdo de /frontend — backend e node_modules nunca são expostos
app.use(express.static(FRONTEND_DIR, {
  index: false,          // Desativa index automático para controlarmos a rota '/' manualmente
  dotfiles: 'ignore',    // Nunca servir .env ou arquivos ocultos
}));

// ===== ROTAS HTML EXPLÍCITAS (sem extensão na URL) =====
// A ordem importa: rotas específicas antes do fallback

app.get('/', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'dashboard.html'));
});

app.get('/forja', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'forja.html'));
});

// Fallback final: qualquer rota não reconhecida → login
// (evita 404 em refresh de SPA; não causa loop pois o JS decide o redirecionamento)
app.use((_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ===== INICIALIZAÇÃO =====
async function iniciar() {
  try {
    await initializeDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n⚔️  VK.Studio rodando na porta ${PORT}`);
      console.log(`🌐  http://localhost:${PORT}`);
      console.log(`📁  Servindo frontend de: ${FRONTEND_DIR}`);
      console.log(`🔧  Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (err) {
    console.error('❌ Falha ao iniciar o servidor:', err.message);
    process.exit(1);
  }
}

iniciar();
