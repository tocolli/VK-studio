const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    // Pega o token do header 'Authorization: Bearer TOKEN'
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Salva os dados do usuário (id, cargo) na requisição
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
};

// Exportando como objeto para bater com as chaves { verificarToken } nas rotas
module.exports = { verificarToken };