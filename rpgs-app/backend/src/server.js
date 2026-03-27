const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Se o DB estiver dando erro, deixe comentado até o site abrir
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
    res.json({ status: 'Online', info: 'VK.Studio API ativa!' });
});

// 2. CONFIGURAÇÃO DO FRONTEND (O segredo está aqui)
// Considerando Root Directory: backend
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

// Servir arquivos estáticos (CSS, JS, Imagens)
app.use(express.static(frontendPath));

// 3. ROTA CORINGA (Linha 34 aproximada)
app.get('*', (req, res) => {
    // Evita loop infinito se a API falhar
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Rota de API nao encontrada' });
    }

    const indexPath = path.join(frontendPath, 'dashboard.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Visual 10/10 nao encontrado. Verifique a pasta frontend.");
    }
});

// O RENDER DEFINE A PORTA AUTOMATICAMENTE
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ONLINE NA PORTA ${PORT} ---`);
});