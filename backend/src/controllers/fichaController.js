// backend/src/controllers/fichaController.js
const { pool } = require('../config/database');

async function listar(req, res) {
  try {
    const isMestre = req.user.role === 'mestre';
    let query = `
      SELECT f.*, u.nome as jogador_nome
      FROM fichas f
      JOIN users u ON f.jogador_id = u.id
      WHERE f.ativo = 1
    `;
    const params = [];

    if (!isMestre) {
      query += ' AND f.jogador_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY f.created_at DESC';
    const [rows] = await pool.execute(query, params);
    return res.json({ success: true, fichas: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function buscarPorId(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT f.*, u.nome as jogador_nome FROM fichas f
       JOIN users u ON f.jogador_id = u.id
       WHERE f.id = ? AND f.ativo = 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ficha não encontrada.' });
    }

    const ficha = rows[0];
    if (req.user.role !== 'mestre' && ficha.jogador_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }

    return res.json({ success: true, ficha });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function criar(req, res) {
  try {
    const { nome_personagem, sistema, atributos, jogador_id } = req.body;
    const imagem_url = req.file?.path || null;

    if (!nome_personagem || !atributos) {
      return res.status(400).json({ success: false, message: 'Nome e atributos são obrigatórios.' });
    }

    // Mestre pode criar ficha para qualquer jogador; jogador cria para si mesmo
    const targetJogadorId = req.user.role === 'mestre' && jogador_id ? jogador_id : req.user.id;

    let atributosJSON;
    try {
      atributosJSON = typeof atributos === 'string' ? atributos : JSON.stringify(atributos);
    } catch {
      return res.status(400).json({ success: false, message: 'Atributos JSON inválidos.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO fichas (nome_personagem, jogador_id, sistema, atributos, imagem_url)
       VALUES (?, ?, ?, ?, ?)`,
      [nome_personagem, targetJogadorId, sistema || 'Decadência Cinza', atributosJSON, imagem_url]
    );

    return res.status(201).json({ success: true, message: 'Ficha criada!', id: result.insertId });
  } catch (err) {
    console.error('Erro ao criar ficha:', err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function atualizar(req, res) {
  try {
    const { id } = req.params;
    const { nome_personagem, sistema, atributos } = req.body;
    const imagem_url = req.file?.path;

    const atributosJSON = typeof atributos === 'string' ? atributos : JSON.stringify(atributos);

    let query = `UPDATE fichas SET nome_personagem=?, sistema=?, atributos=?`;
    const params = [nome_personagem, sistema, atributosJSON];

    if (imagem_url) {
      query += `, imagem_url=?`;
      params.push(imagem_url);
    }

    query += ` WHERE id=?`;
    params.push(id);

    await pool.execute(query, params);
    return res.json({ success: true, message: 'Ficha atualizada!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function deletar(req, res) {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE fichas SET ativo = 0 WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Ficha arquivada.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, deletar };
