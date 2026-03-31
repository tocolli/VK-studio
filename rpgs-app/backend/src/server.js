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

// 1. ROTAS DA API (Vêm primeiro)
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

// Serve arquivos estáticos (CSS, JS, Imagens)
app.use(express.static(frontendPath));

// 3. ROTA CORINGA SIMPLIFICADA (Garante a entrega do HTML)
// Se não começou com /api e não é um arquivo estático conhecido, manda o Dashboard
app.get('*', (req, res) => {
    // Se a requisição for para a API e chegou aqui, é porque a rota não existe
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ erro: 'Rota de API não encontrada' });
    }

    const indexPath = path.join(frontendPath, 'dashboard.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Isso aqui vai aparecer no navegador se o caminho estiver errado
        res.status(404).send(`VK.Studio: HTML não localizado em: ${indexPath}`);
    }
});

// --- INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ATIVO ---`);
    console.log(`Porta: ${PORT}`);
    console.log(`Diretório: ${process.cwd()}`);
    console.log(`Frontend: ${frontendPath}`);
});