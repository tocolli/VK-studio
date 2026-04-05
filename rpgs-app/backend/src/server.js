const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const documentoRoutes = require('./routes/documentoRoutes');

const app = express();

app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// --- AJUSTE DE CAMINHO (O segredo do 404) ---
// Se o server está em: /rpgs-app/backend/src/server.js
// Para chegar em: /rpgs-app/frontend
const frontendPath = path.resolve(__dirname, '..', '..', '..', 'frontend');

console.log("--- VK.STUDIO MOTOR START ---");
console.log("Diretório Atual (__dirname):", __dirname);
console.log("Tentando achar Frontend em:", frontendPath);

// --- ARQUIVOS ESTÁTICOS ---
// Servindo a pasta frontend inteira como estática para o CSS e JS funcionarem
app.use(express.static(frontendPath));

// --- ROTAS DE PÁGINAS ---
app.get(['/', '/login'], (req, res) => {
    res.sendFile(path.join(frontendPath, 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(frontendPath, 'dashboard.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(frontendPath, 'admin.html'));
});

// --- ROTAS API ---
app.use('/api', authRoutes);
app.use('/api', documentoRoutes);

app.get('/api/status', (req, res) => {
    res.json({ msg: "Motor vivo!", folder: frontendPath });
});

// --- DEDO-DURO DE ERROS ---
app.use((err, req, res, next) => {
    console.error("!!! ERRO NO BACKEND DETECTADO !!!");
    console.error(err.stack);
    res.status(500).json({ error: "Erro interno no servidor" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ONLINE NA PORTA ${PORT} ---`);
});