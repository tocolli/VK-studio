const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// TESTE DE ROTA (Sem banco de dados, sem rotas externas)
app.get('/api/teste', (req, res) => {
    res.json({ mensagem: "SERVIDOR RODANDO!" });
});

// CAMINHO DO FRONTEND
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'dashboard.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Server ON, mas HTML nao achado.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- VK.STUDIO LIGADO NA PORTA ${PORT} ---`);
});