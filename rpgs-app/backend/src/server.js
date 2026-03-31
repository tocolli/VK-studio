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

// --- CONFIGURAÇÃO DE CAMINHOS (ESTRUTURA HIERÁRQUICA) ---
// Local: DC_STUDIO/rpgs-app/backend/src/server.js
// Subir 1 (..): backend/src -> backend
// Subir 2 (..): backend -> rpgs-app (onde a pasta frontend vive)
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

console.log("--- VK.STUDIO ENGINE SCAN ---");
console.log("Diretório Atual (__dirname):", __dirname);
console.log("Caminho Calculado para Frontend:", frontendPath);

// Verificação física da pasta (Essencial para o log do Render)
try {
    if (fs.existsSync(frontendPath)) {
        const arquivos = fs.readdirSync(frontendPath);
        console.log("✅ ALVO ATINGIDO! Arquivos encontrados:", arquivos);
    } else {
        console.error("❌ ERRO: A pasta frontend não foi achada em:", frontendPath);
        // Lista o que tem dois níveis acima para a gente se localizar
        console.log("Conteúdo de rpgs-app:", fs.readdirSync(path.resolve(__dirname, '..', '..')));
    }
} catch (e) {
    console.log("Erro ao escanear pastas.");
}

// Libera os arquivos estáticos (CSS, JS, Imagens)
app.use(express.static(frontendPath));

// --- ROTAS API ---
app.use('/api', authRoutes);
app.use('/api', documentoRoutes);

app.get('/api/status', (req, res) => {
    res.json({ status: 'Online', database: 'Conectado!' });
});

// --- ENTREGA DE ARQUIVOS (FORÇA BRUTA COM UTF-8) ---
const serveFile = (res, file) => {
    const target = path.join(frontendPath, file);
    
    if (fs.existsSync(target)) {
        try {
            const htmlContent = fs.readFileSync(target, 'utf8');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(htmlContent);
        } catch (err) {
            console.error(`ERRO AO LER ${file}:`, err);
            return res.status(500).send("Erro interno ao ler arquivo.");
        }
    } else {
        console.error(`ARQUIVO NÃO ENCONTRADO: ${target}`);
        return res.status(404).send(`VK.Studio: ${file} não localizado.`);
    }
};

// Rotas de Páginas
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