const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Importação das rotas
const authRoutes = require('./routes/authRoutes');
const documentoRoutes = require('./routes/documentoRoutes');

const app = express();

// MIDDLEWARES
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// 1. ROTAS DA API (Sempre no topo)
app.use('/api', authRoutes);
app.use('/api', documentoRoutes); 

app.get('/api/status', (req, res) => {
    res.json({ status: 'Online', info: 'VK.Studio API ativa!' });
});

// 2. CONFIGURAÇÃO DO FRONTEND
// Se o Root Directory no Render for 'backend', o caminho é esse:
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

// Servir arquivos estáticos (CSS, JS, Imagens)
app.use(express.static(frontendPath));

// 3. ROTA CORINGA
app.get('*', (req, res) => {
    // Se for uma tentativa errada de acessar API, retorna erro JSON
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Rota de API nao encontrada' });
    }

    const indexPath = path.join(frontendPath, 'dashboard.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`O servidor ligou, mas nao achou o HTML em: ${indexPath}`);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--- VK.STUDIO ONLINE NA PORTA ${PORT} ---`);
});