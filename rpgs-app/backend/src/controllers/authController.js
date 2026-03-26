const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const authController = {
    async cadastrar(req, res) {
        const { nome, email, senha, confirmaSenha } = req.body;

        // Log para ver o que o formulário está mandando
        console.log("--- TENTATIVA DE CADASTRO ---");
        console.log({ nome, email, senha });

        if (!nome || !email || !senha) {
            return res.status(400).json({ error: 'Preencha todos os campos, mestre.' });
        }

        try {
            const salt = await bcrypt.genSalt(10);
            const senhaHash = await bcrypt.hash(senha, salt);

            // Nomes exatos das colunas do Reset que fizemos
            const query = 'INSERT INTO usuarios (nome, email, senha_hash, cargo) VALUES (?, ?, ?, ?)';
            
            await db.query(query, [nome, email, senhaHash, 'jogador']);

            res.status(201).json({ message: 'Conta forjada com sucesso!' });
        } catch (err) {
            console.error("ERRO NO CADASTRO:", err.message);
            res.status(500).json({ error: 'Erro no banco: ' + err.message });
        }
    },

    async login(req, res) {
        const { email, senha } = req.body;
        try {
            const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
            const usuario = rows[0];

            if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            const token = jwt.sign(
                { id: usuario.id, cargo: usuario.cargo },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({ token, user: { nome: usuario.nome, cargo: usuario.cargo } });
        } catch (err) {
            res.status(500).json({ error: 'Erro no servidor.' });
        }
    },

    async listarTodos(req, res) {
        try {
            const [rows] = await db.query('SELECT nome, email, cargo FROM usuarios');
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: 'Erro ao listar.' });
        }
    }
};

module.exports = authController;