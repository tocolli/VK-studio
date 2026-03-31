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

// --- 1. CONFIGURAÇÃO DE CAMINHOS (ESTRUTURA RENDER) ---
// No Render, process.cwd() é a raiz do seu repositório (/opt/render/project/src)
const frontendPath = path.join(process.cwd(), 'frontend'); 

// Libera arquivos estáticos (CSS, JS, Imagens) ANTES das rotas de página
app.use(express.static(frontendPath));

// Log de diagnóstico para o terminal
console.log("--- VK.STUDIO DIAGNÓSTICO ---");
console.log("Pasta Raiz (CWD):", process.cwd());
console.log("Pasta Frontend:", frontendPath);

try {
    const arquivos = fs.readdirSync(frontendPath);
    console.log("Arquivos detectados no Frontend:", arquivos);
} catch (e) {
    console.error("ERRO: Pasta 'frontend' não localizada no caminho acima!");
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
// Função auxiliar para enviar arquivos com segurança
const enviarArquivo = (res, nomeArquivo) => {
    const filePath = path.join(frontendPath, nomeArquivo);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`ERRO AO ENVIAR ${nomeArquivo}:`, err.path);
            if (!res.headersSent) {
                res.status(404).send(`VK.Studio: Arquivo ${nomeArquivo} não encontrado.`);
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
            console.log(`URL: https://vk-studio.onrender.com`);
        });
    } catch (err) {
        console.error("ERRO FATAL NA INICIALIZAÇÃO:", err.message);
        process.exit(1);
    }
};

start();