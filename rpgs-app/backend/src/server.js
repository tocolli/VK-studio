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

// --- CONFIGURAÇÃO DE CAMINHOS ---
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

console.log("--- VK.STUDIO ENGINE ---");
console.log("Frontend Path:", frontendPath);

// Libera os arquivos estáticos (CSS, JS, Imagens)
app.use(express.static(frontendPath));

// --- ROTAS API ---
app.use('/api', authRoutes);
app.use('/api', documentoRoutes);

// --- ENTREGA DE ARQUIVOS (FORÇA BRUTA COM FS) ---
const serveFile = (res, file) => {
    const target = path.join(frontendPath, file);
    
    // Verificamos se o arquivo existe fisicamente
    if (fs.existsSync(target)) {
        try {
            // Lemos o conteúdo do HTML como texto puro
            const htmlContent = fs.readFileSync(target, 'utf8');
            
            // Forçamos o cabeçalho para HTML e enviamos a string
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(htmlContent);
        } catch (err) {
            console.error(`ERRO AO LER ${file}:`, err);
            return res.status(500).send("Erro interno ao ler arquivo.");
        }
    } else {
        console.error(`ARQUIVO NÃO ENCONTRADO: ${target}`);
        return res.status(404).send("VK.Studio: HTML não localizado no servidor.");
    }
};

// Rotas de Páginas
app.get(['/', '/login'], (req, res) => serveFile(res, 'login.html'));
app.get('/dashboard', (req, res) => serveFile(res, 'dashboard.html'));

// Rota Coringa (Fallback)
app.get(/.*/, (req, res) => {
    // Se não for API e não for um arquivo (não tem ponto no nome)
    if (!req.path.startsWith('/api') && !req.path.includes('.')) {
        serveFile(res, 'login.html');
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ONLINE ---`);
});