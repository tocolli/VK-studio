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

// --- DIAGNÓSTICO DE CAMINHOS (ESTRUTURA COM PACKAGE.JSON NO BACKEND) ---
// __dirname é: .../rpgs-app/backend/src
// Subir 1: .../rpgs-app/backend
// Subir 2: .../rpgs-app/ (ONDE ESTÁ A FRONTEND)
const pathBase = path.resolve(__dirname, '..', '..', 'frontend');

// LOG DE VERIFICAÇÃO (Olhe isso no Render!)
console.log("--- VK.STUDIO PATH DIAGNOSIS ---");
console.log("Onde o server.js mora (__dirname):", __dirname);
console.log("Onde o npm start rodou (CWD):", process.cwd());

// Tentativa de definir o caminho final
let frontendPath = pathBase;

if (!fs.existsSync(frontendPath)) {
    console.log("⚠️ Caminho padrão falhou. Tentando busca via Raiz do Repositório...");
    // Tenta: /opt/render/project/src/rpgs-app/frontend
    frontendPath = path.join(process.cwd(), '..', 'frontend');
}

console.log("Caminho Final Escolhido:", frontendPath);

// Middleware de arquivos estáticos (CSS/JS)
app.use(express.static(frontendPath));

// Rotas API
app.use('/api', authRoutes);
app.use('/api', documentoRoutes);

// --- FUNÇÃO DE ENTREGA (BLINDADA) ---
const entregarPagina = (res, arquivo) => {
    const caminhoArquivo = path.join(frontendPath, arquivo);
    
    try {
        if (fs.existsSync(caminhoArquivo)) {
            const buffer = fs.readFileSync(caminhoArquivo);
            console.log(`✅ Enviando ${arquivo} (${buffer.length} bytes)`);
            
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Length': buffer.length,
                'Cache-Control': 'no-store' // Força o navegador a não usar cache branco
            });
            return res.end(buffer);
        } else {
            console.error(`❌ ERRO: ${arquivo} não existe em ${caminhoArquivo}`);
            // Se falhar, lista o que tem na pasta para o log nos ajudar
            try { console.log("Conteúdo da pasta tentada:", fs.readdirSync(frontendPath)); } catch(e){}
            return res.status(404).send(`Erro: ${arquivo} não encontrado no servidor.`);
        }
    } catch (err) {
        console.error("ERRO DE LEITURA:", err);
        return res.status(500).send("Erro interno ao ler disco.");
    }
};

// Rotas de Páginas
app.get(['/', '/login'], (req, res) => entregarPagina(res, 'login.html'));
app.get('/dashboard', (req, res) => entregarPagina(res, 'dashboard.html'));

// Fallback SPA
app.get(/.*/, (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.includes('.')) {
        return entregarPagina(res, 'login.html');
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ONLINE PORTA ${PORT} ---`);
});