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

// --- DIAGNÓSTICO DE PASTAS (O SEGREDO ESTÁ AQUI) ---
const raiz = process.cwd();
console.log("--- VK.STUDIO EXPLORER ---");
console.log("ONDE ESTOU (Raiz):", raiz);

// Função para tentar achar a pasta frontend em qualquer lugar
let frontendPath = "";
if (fs.existsSync(path.join(raiz, 'frontend'))) {
    frontendPath = path.join(raiz, 'frontend');
} else if (fs.existsSync(path.join(raiz, 'rpgs-app', 'frontend'))) {
    frontendPath = path.join(raiz, 'rpgs-app', 'frontend');
} else {
    // Se não achou em nenhum, lista tudo para a gente ver o erro no log
    console.log("ERRO: Pasta 'frontend' sumiu! Conteúdo da raiz:", fs.readdirSync(raiz));
    frontendPath = path.join(raiz, 'frontend'); // Fallback
}

console.log("CAMINHO DEFINIDO:", frontendPath);
app.use(express.static(frontendPath));

// --- ROTAS API ---
app.use('/api', authRoutes);
app.use('/api', documentoRoutes);

// --- ENTREGA DE ARQUIVOS (BLINDADA) ---
const serveFile = (res, file) => {
    const target = path.join(frontendPath, file);
    res.sendFile(target, (err) => {
        if (err) {
            console.error(`FALHA AO ENVIAR ${file}:`, err.path);
            res.status(404).send(`VK.Studio: Arquivo ${file} nao encontrado no servidor.`);
        }
    });
};

app.get(['/', '/login'], (req, res) => serveFile(res, 'login.html'));
app.get('/dashboard', (req, res) => serveFile(res, 'dashboard.html'));

app.get(/.*/, (req, res) => {
    if (!req.path.startsWith('/api')) serveFile(res, 'login.html');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ONLINE NA PORTA ${PORT} ---`);
});