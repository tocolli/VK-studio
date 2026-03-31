const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Rotas
const authRoutes = require('./routes/authRoutes');
const documentoRoutes = require('./routes/documentoRoutes');

const app = express();

app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// --- CONFIGURAÇÃO DE CAMINHOS (ESTRUTURA: rpgs-app/backend/src/server.js) ---
// Subimos dois níveis (.. e ..) para sair de 'src' e 'backend', chegando na raiz 'rpgs-app'
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

// LOG DE PRECISÃO PARA O RENDER
console.log("--- VK.STUDIO PATH FINDER ---");
console.log("Onde o server.js está:", __dirname);
console.log("Caminho calculado para o Frontend:", frontendPath);

try {
    const arquivos = fs.readdirSync(frontendPath);
    console.log("✅ SUCESSO! Arquivos encontrados:", arquivos);
} catch (e) {
    console.error("❌ ERRO: O caminho calculado está errado.");
    console.log("Conteúdo da pasta atual:", fs.readdirSync(path.join(__dirname, '..', '..')));
}

// Libera os arquivos estáticos (CSS, JS)
app.use(express.static(frontendPath));

// --- ROTAS API ---
app.use('/api', authRoutes);
app.use('/api', documentoRoutes);

// --- ENTREGA DE ARQUIVOS ---
const serveFile = (res, file) => {
    const target = path.join(frontendPath, file);
    
    // Forçamos o navegador a ler como HTML para evitar tela branca "vazia"
    res.setHeader('Content-Type', 'text/html');
    
    res.sendFile(target, (err) => {
        if (err) {
            console.error(`FALHA AO ENVIAR ${file}:`, err.path);
            if (!res.headersSent) {
                res.status(404).send("VK.Studio: Erro ao localizar arquivo HTML.");
            }
        }
    });
};

app.get(['/', '/login'], (req, res) => serveFile(res, 'login.html'));
app.get('/dashboard', (req, res) => serveFile(res, 'dashboard.html'));

// Rota Coringa (Fallback)
app.get(/.*/, (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.includes('.')) {
        serveFile(res, 'login.html');
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ONLINE NA PORTA ${PORT} ---`);
});