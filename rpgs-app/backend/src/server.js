const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Importação das suas configurações e rotas
// Certifique-se de que o caminho do db.js está correto (./config/db ou ./db)
const db = require('./config/db'); 
const authRoutes = require('./routes/authRoutes');
const documentoRoutes = require('./routes/documentoRoutes');

const app = express();

// MIDDLEWARES (Essenciais para o funcionamento da API e do CORS)
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// 1. ROTAS DA API (Devem vir antes de servir o Frontend)
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
// __dirname está em backend/src. 
// '../../' sobe para backend e depois para a raiz (rpgs-app), onde está a pasta frontend.
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

// Servir arquivos estáticos (CSS, JS, Imagens da pasta frontend)
app.use(express.static(frontendPath));

// 3. ROTA CORINGA (Para o Dashboard e navegação SPA)
app.get('*', (req, res) => {
    // Evita que erros em chamadas de API tentem carregar o HTML
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Rota de API inexistente' });
    }

    const indexPath = path.join(frontendPath, 'dashboard.html');
    
    // Verificação de segurança para o Render não dar Status 1/11
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`VK.Studio: Servidor ON, mas não localizou o HTML em: ${indexPath}`);
    }
});

// CONFIGURAÇÃO DA PORTA PARA O RENDER
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ATIVO ---`);
    console.log(`Servidor rodando na porta: ${PORT}`);
    console.log(`Caminho do Frontend: ${frontendPath}`);
});