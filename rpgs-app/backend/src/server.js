const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configurações e rotas
const db = require('./config/db'); 
const authRoutes = require('./routes/authRoutes');
const documentoRoutes = require('./routes/documentoRoutes');

const app = express();

// MIDDLEWARES
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// 1. ROTAS DA API (Sempre vêm primeiro)
app.use('/api', authRoutes);
app.use('/api', documentoRoutes); 

app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'Online', 
        database: 'Conectado ao Aiven!',
        info: 'VK.Studio API operacional' 
    });
});

// 2. CONFIGURAÇÃO DO FRONTEND
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

// 3. ROTAS DE PÁGINAS (Definidas explicitamente para não dar erro)

// Se acessar a raiz ou /login, manda pro login.html
app.get(['/', '/login'], (req, res) => {
    res.sendFile(path.join(frontendPath, 'login.html'));
});

// Rota específica para o dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(frontendPath, 'dashboard.html'));
});

// 4. ROTA CORINGA (Fallback final)
// Se não for API e não for uma das rotas acima, manda pro login por segurança
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(frontendPath, 'login.html'));
    } else {
        res.status(404).json({ erro: 'Rota de API inexistente' });
    }
});

// --- AJUSTE FINAL DE INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;

const start = async () => {
    try {
        console.log("Tentando inicializar motor VK.Studio...");
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`--- VK.STUDIO ATIVO ---`);
            console.log(`Porta: ${PORT}`);
            console.log(`Frontend: ${frontendPath}`);
        });
    } catch (err) {
        console.error("ERRO FATAL NA INICIALIZAÇÃO:", err.message);
        process.exit(1);
    }
};

start();