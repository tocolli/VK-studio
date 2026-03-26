const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/authRoutes');
const documentoRoutes = require('./routes/documentoRoutes');

const app = express();

// MIDDLEWARES (A ordem importa!)
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// 1. ROTAS DA API (Sempre vêm primeiro)
app.use('/api', authRoutes);
app.use('/api', documentoRoutes); 

app.get('/api/status', async (req, res) => {
    res.json({ status: 'Online', database: 'Conectado ao Aiven!' });
});

// 2. SERVIR ARQUIVOS ESTÁTICOS (CSS, JS, Imagens)
// O caminho correto saindo de backend/src para chegar em frontend
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// 3. ROTA CORINGA (Sempre por último)
// Se não for uma rota de API, ele entrega o HTML
app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'dashboard.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Visual 10/10 nao encontrado na pasta frontend.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--- VK.STUDIO ATIVO ---`);
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
});