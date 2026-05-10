// backend/src/server.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express    = require('express');
const cors       = require('cors');
const fs         = require('fs');
const http       = require('http');
const { Server } = require('socket.io');
const { initializeDatabase } = require('./config/database');
const { iniciarSocket }      = require('./socket');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] },
  transports: ['websocket','polling'],
});

const PORT         = process.env.PORT || 10000;
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');

if (!fs.existsSync(FRONTEND_DIR)) {
  console.error('Pasta frontend não encontrada: ' + FRONTEND_DIR);
  process.exit(1);
}

app.use(cors({ origin:'*', methods:['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders:['Content-Type','Authorization'] }));
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true, limit:'10mb' }));

// Rotas API
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/documentos', require('./routes/documentos'));
app.use('/api/fichas',     require('./routes/fichas'));
app.use('/api/admin',      require('./routes/admin'));
app.use('/api/sessoes',    require('./routes/sessoes'));

app.get('/api/health', (_req,res) => res.json({ status:'ok', ts: new Date().toISOString() }));
app.use('/api', (_req,res) => res.status(404).json({ success:false, message:'Rota não encontrada.' }));

// Socket.IO
iniciarSocket(io);

// Frontend estático
app.use(express.static(FRONTEND_DIR, { index:false, dotfiles:'ignore' }));

const PAGINAS = {
  '/':                 'index.html',
  '/dashboard':        'dashboard.html',
  '/forja':            'forja.html',
  '/admin':            'admin.html',
  '/perfil':           'perfil.html',
  '/mesa':             'mesa.html',
  '/ficha-cavaleiros': 'ficha-cavaleiros.html',
  '/ficha-decadencia': 'ficha-decadencia.html',
  '/ficha-oceano':     'ficha-oceano.html',
};

Object.entries(PAGINAS).forEach(([rota, arquivo]) => {
  app.get(rota, (_req,res) => res.sendFile(path.join(FRONTEND_DIR, arquivo)));
});

app.use((_req,res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

async function iniciar() {
  try {
    await initializeDatabase();
    server.listen(PORT, '0.0.0.0', () => {
      console.log('\n⚔️  VK.Studio na porta ' + PORT);
      console.log('🔌  Socket.IO ativo\n');
    });
  } catch (err) {
    console.error('Falha ao iniciar:', err.message);
    process.exit(1);
  }
}
iniciar();
