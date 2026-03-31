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

// 1. ROTAS DA API
app.use('/api', authRoutes);
app.use('/api', documentoRoutes); 

app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'Online', 
        database: 'Conectado ao Aiven!',
        info: 'VK.Studio API operacional' 
    });
});

// 2. CONFIGURAÇÃO DO FRONTEND (Caminho absoluto seguro para o Render)
// Tente estas duas linhas no lugar da antiga:
const rootPath = path.resolve(__dirname, '../../'); // Sobe para a raiz do projeto
const frontendPath = path.join(rootPath, 'frontend'); 

// LOG DE VERIFICAÇÃO (Olhe isso no terminal do Render após o push)
console.log("--- SCAN DE DIRETÓRIO ---");
console.log("Raiz do projeto:", rootPath);
console.log("Conteúdo da raiz:", fs.readdirSync(rootPath)); // Isso vai listar as pastas no log
// 3. ROTAS DE PÁGINAS EXPLÍCITAS
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

// 4. ROTA CORINGA (RegExp para Node 22)
app.get(/.*/, (req, res) => {
    // Se não for API, tenta entregar o login.html
    if (!req.path.startsWith('/api')) {
        const filePath = path.join(frontendPath, 'login.html');
        res.sendFile(filePath, (err) => {
            if (err && !res.headersSent) {
                res.status(404).send("VK.Studio: Página não encontrada.");
            }
        });
    }
});

// --- AJUSTE FINAL DE INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;

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