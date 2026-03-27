const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const fs = require('fs');

// 1. IMPORTANTE: Comente o DB temporariamente se o erro persistir
// const db = require('./config/db'); 

const authRoutes = require('./routes/authRoutes');
const documentoRoutes = require('./routes/documentoRoutes');

const app = express();

app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// Caminho absoluto para evitar Status 11
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

// LOG DE DEBUG PARA O RENDER (Olhe isso no painel!)
console.log("--- INICIANDO VK.STUDIO ---");
console.log("Diretório atual (__dirname):", __dirname);
console.log("Pasta Frontend calculada:", frontendPath);

app.use(express.static(frontendPath));

app.use('/api', authRoutes);
app.use('/api', documentoRoutes); 

app.get('/api/status', (req, res) => {
    res.json({ status: 'Online', info: 'Se voce ve isso, o server NAO morreu.' });
});

app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'dashboard.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`Servidor ON, mas nao achou o HTML em: ${indexPath}`);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--- SERVIDOR RODANDO NA PORTA ${PORT} ---`);
});