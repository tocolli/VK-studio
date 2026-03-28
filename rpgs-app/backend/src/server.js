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
// __dirname é /backend/src. Subimos 2 níveis para chegar na raiz 'rpgs-app' e entrar em 'frontend'
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

console.log("--- DEBUG RENDER ---");
console.log("Local do Script (src):", __dirname);
console.log("Buscando frontend em:", frontendPath);

app.use(express.static(frontendPath));

// 3. ROTA CORINGA (Ajustada para Express 5)
app.get('/*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Rota de API inexistente' });
    }

    const indexPath = path.join(frontendPath, 'dashboard.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`VK.Studio: Servidor ON, mas não localizou o HTML em: ${indexPath}`);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ATIVO ---`);
    console.log(`Porta: ${PORT}`);
    console.log(`Frontend resolvida em: ${frontendPath}`);
});