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

// --- 1. CONFIGURAÇÃO DE CAMINHOS (ORDEM CRÍTICA) ---
// Primeiro definimos onde os arquivos estão
const rootPath = path.resolve(__dirname, '../../'); 
const frontendPath = path.join(rootPath, 'frontend'); 

// Agora liberamos o acesso à pasta para o CSS e JS funcionarem
app.use(express.static(frontendPath));

// Logs para o seu terminal do Render
console.log("--- VK.STUDIO ENGINE SCAN ---");
console.log("Raiz detectada:", rootPath);
try {
    console.log("Conteúdo da raiz:", fs.readdirSync(rootPath));
} catch(e) {
    console.log("Erro ao listar diretório raiz");
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

// --- 3. ROTAS DE PÁGINAS ---
app.get(['/', '/login'], (req, res) => {
    const filePath = path.join(frontendPath, 'login.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error("ERRO AO ENVIAR LOGIN:", err.path);
            res.status(404).send("VK.Studio: Arquivo de Login não encontrado.");
        }
    });
});

app.get('/dashboard', (req, res) => {
    const filePath = path.join(frontendPath, 'dashboard.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error("ERRO AO ENVIAR DASHBOARD:", err.path);
            res.status(404).send("VK.Studio: Arquivo de Dashboard não encontrado.");
        }
    });
});

// --- 4. ROTA CORINGA (RegExp para Node 22 / Express 5) ---
app.get(/.*/, (req, res) => {
    if (!req.path.startsWith('/api')) {
        const filePath = path.join(frontendPath, 'login.html');
        res.sendFile(filePath, (err) => {
            if (err && !res.headersSent) {
                res.status(404).send("VK.Studio: Página não encontrada.");
            }
        });
    }
});

// --- INICIALIZAÇÃO ---
const PORT = process.env.PORT || 10000; // Porta padrão do Render

const start = async () => {
    try {
        console.log("Tentando inicializar motor VK.Studio...");
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`--- VK.STUDIO ATIVO ---`);
            console.log(`Porta: ${PORT}`);
            console.log(`Caminho Front: ${frontendPath}`);
        });
    } catch (err) {
        console.error("ERRO FATAL NA INICIALIZAÇÃO:", err.message);
        process.exit(1);
    }
};

start();