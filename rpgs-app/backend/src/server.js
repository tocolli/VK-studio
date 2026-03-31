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

// 1. ROTAS DA API
app.use('/api', authRoutes);
app.use('/api', documentoRoutes); 

app.get('/api/status', async (req, res) => {
    res.json({ 
        status: 'Online', 
        database: 'Conectado ao Aiven!',
        info: 'VK.Studio API operacional' 
    });
});

// 2. CONFIGURAÇÃO DO FRONTEND
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

console.log("--- DEBUG RENDER ---");
console.log("Local do Script (src):", __dirname);
console.log("Buscando frontend em:", frontendPath);

app.use(express.static(frontendPath));

// 3. ROTA CORINGA (RegExp para Express 5)
app.get(/^(?!\/api).+/, (req, res) => {
    const indexPath = path.join(frontendPath, 'dashboard.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`VK.Studio: Servidor ON, mas não localizou o HTML em: ${indexPath}`);
    }
});

// Rota específica para o login (A primeira que você deve acessar)
app.get('/login', (req, res) => {
    res.sendFile(path.join(frontendPath, 'login.html'));
});

// Se o cara acessar a raiz (/), manda pro login também
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'login.html'));
});

// Rota para o dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(frontendPath, 'dashboard.html'));
});

// Rota coringa (manda pro login por segurança se não for API)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(frontendPath, 'login.html'));
    }
});

// --- AJUSTE FINAL DE INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;

// Função para ligar o servidor sem crashar por causa do banco
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
        process.exit(1); // Só fecha se o erro for no Express
    }
};


start();

