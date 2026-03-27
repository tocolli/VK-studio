const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Se o seu DB estiver em backend/src/config/db.js, use este caminho:
// const db = require('./config/db'); 

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

app.get('/api/status', (req, res) => {
    res.json({ status: 'Online', info: 'API VK.Studio Ativa' });
});

// 2. CONFIGURAÇÃO DO FRONTEND
// process.cwd() pega a pasta raiz (rpgs-app) se o Root Directory for vazio
// Se o Root Directory for 'backend', ele pega a pasta backend.
const rootDir = process.cwd();
const frontendPath = path.resolve(rootDir, '..', 'frontend');

app.use(express.static(frontendPath));

// 3. ROTA CORINGA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Rota de API nao encontrada' });
    }

    const indexPath = path.join(frontendPath, 'dashboard.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Visual 10/10 nao encontrado. Verifique a pasta frontend na raiz.");
    }
});

// ESCUTANDO A PORTA
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ONLINE NA PORTA ${PORT} ---`);
    console.log(`Localizando Frontend em: ${frontendPath}`);
});