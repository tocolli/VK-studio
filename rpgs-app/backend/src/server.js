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

// --- CAMINHO CALCULADO ---
// Substitua a sua linha antiga por essa lógica:
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

// ADICIONE ESSE LOG LOGO ABAIXO:
console.log("--- DEBUG DE CAMINHO ---");
console.log("Onde o Server acha que está:", __dirname);
console.log("Onde ele está procurando o Frontend:", frontendPath);
console.log("A pasta existe?", fs.existsSync(frontendPath));

console.log("--- VK.STUDIO MOTOR START ---");
console.log("Pasta Frontend:", frontendPath);

// --- FUNÇÃO DE ENTREGA ÚNICA (PADRONIZADA) ---
const entregarPagina = (res, fileName) => {
    const filePath = path.join(frontendPath, fileName);
    
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            console.log(`Lendo ${fileName}: ${content.length} caracteres.`);
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Length', Buffer.byteLength(content));
            return res.status(200).send(content);
        } else {
            console.error(`ERRO: ${fileName} não existe em ${filePath}`);
            return res.status(404).send("Arquivo não encontrado no servidor.");
        }
    } catch (e) {
        console.error("ERRO DE LEITURA:", e);
        return res.status(500).send("Erro interno de leitura.");
    }
};

// --- ROTAS DE PÁGINAS ---
app.get(['/', '/login'], (req, res) => entregarPagina(res, 'login.html'));
app.get('/dashboard', (req, res) => entregarPagina(res, 'dashboard.html'));
app.get('/admin', (req, res) => entregarPagina(res, 'admin.html'));
app.get('/admin.html', (req, res) => entregarPagina(res, 'admin.html'));

// --- ARQUIVOS ESTÁTICOS ---
app.use('/css', express.static(path.join(frontendPath, 'css')));
app.use('/js', express.static(path.join(frontendPath, 'js')));
app.use('/img', express.static(path.join(frontendPath, 'img')));

// --- ROTAS API ---
app.use('/api', authRoutes);
app.use('/api', documentoRoutes);

// ROTA DE TESTE API
app.get('/api/status', (req, res) => {
    res.json({ msg: "Motor vivo!", db: "Conectado" });
});

// --- DEDO-DURO DE ERROS (GLOBAIS) ---
app.use((err, req, res, next) => {
    console.error("!!! ERRO NO BACKEND DETECTADO !!!");
    console.error("Mensagem:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ error: "Erro interno no servidor", detalhes: err.message });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ONLINE NA PORTA ${PORT} ---`);
});