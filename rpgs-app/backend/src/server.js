const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const documentoRoutes = require('./routes/documentoRoutes');

const app = express();
const path = require('path');

// Diz ao Express para servir os arquivos da pasta frontend (ajuste o nome se for 'public' ou outro)
app.use(express.static(path.join(__dirname, '../frontend'))); 

// Faz com que qualquer rota que não seja da API mande o dashboard.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dashboard.html'));
});
// MIDDLEWARES (A ordem importa!)
app.use(cors()); 
app.use(express.json()); // <--- SEU ERRO ESTÁ AQUI
app.use(express.urlencoded({ extended: true })); 

// ROTAS
app.use('/api', authRoutes);
app.use('/api', documentoRoutes); 

app.get('/api/status', async (req, res) => {
    res.json({ status: 'Online', database: 'Conectado ao Aiven!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--- VK.STUDIO ATIVO ---`);
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
});