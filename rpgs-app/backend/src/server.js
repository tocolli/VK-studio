const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const documentoRoutes = require('./routes/documentoRoutes');

const app = express();

app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// --- O ALVO REAL (Baseado na árvore de pastas da imagem) ---
// Saindo de: rpgs-app/backend/src/server.js
// Subindo 2 níveis para chegar na raiz da rpgs-app
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

console.log("--- VK.STUDIO AUTO-SCAN ---");
console.log("Server.js em:", __dirname);
console.log("Buscando Frontend em:", frontendPath);

// Verificação física imediata
if (fs.existsSync(frontendPath)) {
    console.log("✅ PASTA LOCALIZADA! Conteúdo:", fs.readdirSync(frontendPath));
} else {
    console.error("❌ PASTA NÃO LOCALIZADA. Verifique a estrutura no Git.");
}

// Middleware para servir CSS, JS e Imagens
app.use(express.static(frontendPath));

// Rotas API
app.use('/api', authRoutes);
app.use('/api', documentoRoutes);

// --- FUNÇÃO DE ENTREGA (SEM FALHAS) ---
const entregarPagina = (res, arquivo) => {
    const caminhoArquivo = path.join(frontendPath, arquivo);
    
    if (fs.existsSync(caminhoArquivo)) {
        const buffer = fs.readFileSync(caminhoArquivo);
        console.log(`Enviando ${arquivo} - ${buffer.length} bytes`);
        
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': buffer.length,
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache'
        });
        return res.end(buffer);
    } else {
        console.error(`ERRO: ${arquivo} não encontrado em ${caminhoArquivo}`);
        return res.status(404).send("VK.Studio: Arquivo HTML não encontrado.");
    }
};

// Rotas de Páginas
app.get(['/', '/login'], (req, res) => entregarPagina(res, 'login.html'));
app.get('/dashboard', (req, res) => entregarPagina(res, 'dashboard.html'));

// Rota Coringa para arquivos não encontrados (SPA fallback)
app.get(/.*/, (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.includes('.')) {
        return entregarPagina(res, 'login.html');
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- MOTOR VK.STUDIO OPERACIONAL NA PORTA ${PORT} ---`);
});