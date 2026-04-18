// backend/src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const MESTRE_EMAIL = 'vitorbarbosatocolli@gmail.com';

function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      role: usuario.role,
      nome: usuario.nome,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function registrar(req, res) {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ success: false, message: 'Preencha todos os campos.' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ success: false, message: 'Senha deve ter no mínimo 6 caracteres.' });
    }

    const [existente] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existente.length > 0) {
      return res.status(409).json({ success: false, message: 'E-mail já cadastrado.' });
    }

    const senhaHash = await bcrypt.hash(senha, 12);
    // O e-mail mestre sempre recebe role 'mestre'
    const role = email.toLowerCase() === MESTRE_EMAIL.toLowerCase() ? 'mestre' : 'jogador';

    const [result] = await pool.execute(
      'INSERT INTO users (nome, email, senha, role) VALUES (?, ?, ?, ?)',
      [nome, email.toLowerCase(), senhaHash, role]
    );

    const usuario = { id: result.insertId, email: email.toLowerCase(), role, nome };
    const token = gerarToken(usuario);

    return res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso!',
      token,
      usuario: { id: usuario.id, nome, email: usuario.email, role },
    });
  } catch (err) {
    console.error('Erro ao registrar:', err);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
}

async function login(req, res) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios.' });
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
    }

    const usuario = rows[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
    }

    // Garante que o mestre sempre tem a role correta
    if (usuario.email === MESTRE_EMAIL.toLowerCase() && usuario.role !== 'mestre') {
      await pool.execute('UPDATE users SET role = ? WHERE id = ?', ['mestre', usuario.id]);
      usuario.role = 'mestre';
    }

    const token = gerarToken(usuario);

    return res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso!',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        avatar_url: usuario.avatar_url,
      },
    });
  } catch (err) {
    console.error('Erro ao fazer login:', err);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
}

async function perfil(req, res) {
  try {
    const [rows] = await pool.execute(
      'SELECT id, nome, email, role, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }
    return res.json({ success: true, usuario: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

module.exports = { registrar, login, perfil };
