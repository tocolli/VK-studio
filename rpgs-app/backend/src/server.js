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

// MIDDLEWARES BASE
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// --- 1. CONFIGURAÇÃO DE CAMINHOS (ESTRUTURA RPG-APP) ---
// Como as pastas estão dentro de rpgs-app, precisamos incluir isso no caminho
const frontendPath = path.join(process.cwd(), 'rpgs-app', 'frontend'); 

// Libera arquivos estáticos (CSS, JS, Imagens)
app.use(express.static(frontendPath));

// Log de diagnóstico para o terminal do Render
console.log("--- VK.STUDIO DIAGNÓSTICO FINAL ---");
console.log("Raiz (CWD):", process.cwd());
console.log("Buscando Frontend em:", frontendPath);

try {
    const arquivos = fs.readdirSync(frontendPath);
    console.log("Arquivos detectados:", arquivos);
} catch (e) {
    console.error("ERRO: Ainda não encontrei a pasta no caminho:", frontendPath);
    // Tenta listar a raiz para a gente ver o que tem lá
    console.log("Conteúdo da raiz do projeto:", fs.readdirSync(process.cwd()));
}

// --- 2. ROTAS DA API ---
app.use('/api', authRoutes);
app.use('/api', documentoRoutes); 

app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'Online', 
        database: 'Conectado ao Aiven!',
        info: 'VK.Studio API operacional' 
    });
});

// --- 3. ROTAS DE PÁGINAS EXPLÍCITAS ---
const enviarArquivo = (res, nomeArquivo) => {
    const filePath = path.join(frontendPath, nomeArquivo);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`ERRO AO ENVIAR ${nomeArquivo}:`, err.path);
            if (!res.headersSent) {
                res.status(404).send(`VK.Studio: Arquivo ${nomeArquivo} não encontrado no caminho: ${filePath}`);
            }
        }
    });
};

app.get(['/', '/login'], (req, res) => enviarArquivo(res, 'login.html'));
app.get('/dashboard', (req, res) => enviarArquivo(res, 'dashboard.html'));

// --- 4. ROTA CORINGA (Fallback final) ---
app.get(/.*/, (req, res) => {
    if (!req.path.startsWith('/api')) {
        enviarArquivo(res, 'login.html');
    }
});

// --- INICIALIZAÇÃO ---
const PORT = process.env.PORT || 10000;

const start = async () => {
    try {
        console.log("Iniciando motor VK.Studio...");
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`--- VK.STUDIO ATIVO ---`);
            console.log(`Porta: ${PORT}`);
            console.log(`Caminho Front definido: ${frontendPath}`);
        });
    } catch (err) {
        console.error("ERRO FATAL NA INICIALIZAÇÃO:", err.message);
        process.exit(1);
    }
};

start();