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

// --- CAMINHO CALCULADO (O ALVO QUE O LOG CONFIRMOU) ---
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

// LOG DE INICIALIZAÇÃO
console.log("--- VK.STUDIO MOTOR START ---");
console.log("Pasta Frontend:", frontendPath);

// ROTA DE TESTE (Pra gente saber se o servidor está respondendo QUALQUER COISA)
app.get('/api/status', (req, res) => {
    res.json({ msg: "Motor vivo!", db: "Conectado" });
});

// --- FUNÇÃO DE ENTREGA MANUAL (SEM INTERMEDIÁRIOS) ---
const serveHTML = (res, fileName) => {
    const filePath = path.join(frontendPath, fileName);
    
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            console.log(`Lendo ${fileName}: ${content.length} caracteres.`);
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Length', Buffer.byteLength(content));
            return res.status(200).send(content);
        } else {
            console.error(`ERRO: ${fileName} não existe.`);
            return res.status(404).send("Arquivo nao encontrado no servidor.");
        }
    } catch (e) {
        console.error("ERRO DE LEITURA:", e);
        return res.status(500).send("Erro interno de leitura.");
    }
};

// ROTAS DE PÁGINAS
app.get(['/', '/login'], (req, res) => serveHTML(res, 'login.html'));
app.get('/dashboard', (req, res) => serveHTML(res, 'dashboard.html'));
app.get('/admin', (req, res) => entregarPagina(res, 'admin.html'));
app.get('/admin.html', (req, res) => entregarPagina(res, 'admin.html'));

// SERVIR CSS/JS MANUALMENTE (Se o express.static falhar, isso aqui salva)
app.use('/css', express.static(path.join(frontendPath, 'css')));
app.use('/js', express.static(path.join(frontendPath, 'js')));
app.use('/img', express.static(path.join(frontendPath, 'img')));

// ROTAS API
app.use('/api', authRoutes);
app.use('/api', documentoRoutes);

const PORT = process.env.PORT || 10000;

app.use((err, req, res, next) => {
    console.error("!!! ERRO CRÍTICO NO BACKEND !!!");
    console.error("Mensagem:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ error: "Erro interno", detalhes: err.message });
});
// Captura erros de rotas que não aparecem no log
app.use((err, req, res, next) => {
    console.error("!!! ERRO NO BACKEND DETECTADO !!!");
    console.error("Mensagem:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ error: "Erro interno no servidor", detalhes: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO ONLINE NA PORTA ${PORT} ---`);
});