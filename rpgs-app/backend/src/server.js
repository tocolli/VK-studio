const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db'); // Mantive o caminho padrao do seu config
const path = require('path');
const fs = require('fs');

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

app.get('/api/status', async (req, res) => {
    res.json({ status: 'Online', database: 'Conectado ao Aiven!' });
});

// 2. SERVIR ARQUIVOS ESTÁTICOS
// Ajustado para subir ate a raiz e entrar na frontend sem erro de memoria
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

console.log("--- DEBUG DE CAMINHO ---");
console.log("Caminho resolvido para Frontend:", frontendPath);

app.use(express.static(frontendPath));

// 3. ROTA CORINGA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Rota de API inexistente' });
    }

    const indexPath = path.join(frontendPath, 'dashboard.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`O servidor ligou! Mas nao achou o HTML em: ${indexPath}`);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--- VK.STUDIO ATIVO ---`);
    console.log(`Buscando frontend em: ${frontendPath}`);
});