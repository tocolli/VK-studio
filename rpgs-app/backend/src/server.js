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

// 1. ROTAS DA API
app.use('/api', authRoutes);
app.use('/api', documentoRoutes); 

app.get('/api/status', async (req, res) => {
    res.json({ status: 'Online', database: 'Conectado ao Aiven!' });
});

// 2. SERVIR ARQUIVOS ESTÁTICOS
// Usando path.resolve para criar um caminho absoluto e evitar o Status 11
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

app.use(express.static(frontendPath));

// 3. ROTA CORINGA
app.get('*', (req, res) => {
    // Se for uma tentativa de acessar API que não existe, retorna 404 JSON
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Rota de API não encontrada' });
    }

    const indexPath = path.join(frontendPath, 'dashboard.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Mensagem de debug para sabermos onde ele está procurando no Render
        res.status(404).send(`Visual 10/10 nao encontrado em: ${frontendPath}`);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--- VK.STUDIO ATIVO ---`);
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
});