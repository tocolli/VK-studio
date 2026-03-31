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

// --- O ALVO ---
// Subindo de /backend/src para /rpgs-app/frontend
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

// LOG DE VERIFICAÇÃO FINAL
console.log("--- VK.STUDIO BOOT ---");
console.log("Caminho absoluto:", frontendPath);

// Middleware de arquivos estáticos (CSS/JS)
app.use(express.static(frontendPath));

// Rotas API
app.use('/api', authRoutes);
app.use('/api', documentoRoutes);

// --- FUNÇÃO DE ENTREGA BRUTA (SEM INTERMEDIÁRIOS) ---
const entregarPagina = (res, arquivo) => {
    const caminhoArquivo = path.join(frontendPath, arquivo);
    
    try {
        if (fs.existsSync(caminhoArquivo)) {
            const buffer = fs.readFileSync(caminhoArquivo);
            console.log(`Entregando ${arquivo} - Tamanho: ${buffer.length} bytes`);
            
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Length': buffer.length,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            return res.end(buffer);
        } else {
            console.error(`ERRO FATAL: ${arquivo} não existe em ${caminhoArquivo}`);
            return res.status(404).send("Erro: Arquivo HTML nao encontrado no servidor.");
        }
    } catch (err) {
        console.error("ERRO DE LEITURA:", err);
        return res.status(500).send("Erro interno ao ler disco.");
    }
};

// Rotas de Páginas
app.get('/', (req, res) => entregarPagina(res, 'login.html'));
app.get('/login', (req, res) => entregarPagina(res, 'login.html'));
app.get('/dashboard', (req, res) => entregarPagina(res, 'dashboard.html'));

// Fallback para rotas não mapeadas (SPA behavior)
app.get(/.*/, (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.includes('.')) {
        return entregarPagina(res, 'login.html');
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ONLINE: PORTA ${PORT} ---`);
});