// backend/src/controllers/documentoController.js
const { pool } = require('../config/database');

const SISTEMAS = {
  'Decadência Cinza':      ['Livro de Regras','Itens','Bestiário','Armas Brancas','Armas de Fogo','Armaduras','Classes','Veículos','Magias/Rituais'],
  'Oceano Estrelado':      ['Livro de Regras','Itens','Bestiário','Armas Brancas','Armas de Fogo','Armaduras','Classes','Embarcações','Magias/Rituais','Tripulação'],
  'Cavaleiros de Armadura':['Livro de Regras','Itens','Bestiário','Armas Brancas','Armas de Fogo','Armaduras','Classes','Montaria','Magias/Rituais'],
};

const TAGS_RARIDADE = ['D-','D','D+','C-','C','C+','B-','B','B+','A-','A','A+','S-','S','S+','X'];

async function listar(req, res) {
  try {
    const isMestre = req.user?.role === 'mestre';
    const { sistema, categoria, tag } = req.query;
    const conditions = [];
    const params = [];
    if (!isMestre) { conditions.push('d.visibilidade = "publico"'); }
    if (sistema)   { conditions.push('d.sistema = ?');   params.push(sistema); }
    if (categoria) { conditions.push('d.categoria = ?'); params.push(categoria); }
    if (req.query.busca) {
      conditions.push('(d.titulo LIKE ? OR d.tags LIKE ?)');
      params.push(`%${req.query.busca}%`, `%${req.query.busca}%`);
    }
    if (req.query.tag) {
      conditions.push('d.tags LIKE ?');
      params.push(`%${req.query.tag}%`);
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const [rows] = await pool.execute(
      `SELECT d.*, u.nome as autor_nome FROM documentos d JOIN users u ON d.autor_id = u.id ${where} ORDER BY d.created_at DESC`,
      params
    );
    return res.json({ success: true, documentos: rows, sistemas: SISTEMAS });
  } catch (err) {
    console.error('Erro ao listar documentos:', err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function getSistemas(req, res) {
  return res.json({ success: true, sistemas: SISTEMAS, tags: TAGS_RARIDADE });
}

async function buscarPorId(req, res) {
  try {
    const { id } = req.params;
    const isMestre = req.user?.role === 'mestre';
    const [rows] = await pool.execute(
      `SELECT d.*, u.nome as autor_nome FROM documentos d JOIN users u ON d.autor_id = u.id WHERE d.id = ?`, [id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Não encontrado.' });
    const doc = rows[0];
    if (!isMestre && doc.visibilidade === 'privado') return res.status(403).json({ success: false, message: 'Acesso negado.' });
    return res.json({ success: true, documento: doc });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function criar(req, res) {
  try {
    const { titulo, conteudo, sistema, categoria, visibilidade, tag_raridade } = req.body;
    const imagem_url = req.file?.path || null;
    if (!titulo) return res.status(400).json({ success: false, message: 'Título é obrigatório.' });
    const tags = req.body.tags || '';
    const [result] = await pool.execute(
  `INSERT INTO documentos (titulo, conteudo, sistema, categoria, visibilidade, autor_id, imagem_url, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [titulo, conteudo || '', sistema || 'Decadência Cinza', categoria || 'Livro de Regras', visibilidade || 'publico', req.user.id, imagem_url, tags]
);
    return res.status(201).json({ success: true, message: 'Documento criado!', id: result.insertId });
  } catch (err) {
    console.error('Erro ao criar documento:', err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function atualizar(req, res) {
  try {
    const { id } = req.params;
    const { titulo, conteudo, sistema, categoria, visibilidade, tag_raridade } = req.body;
    const imagem_url = req.file?.path;
    const tags = req.body.tags || '';
    let query = `UPDATE documentos SET titulo=?, conteudo=?, sistema=?, categoria=?, visibilidade=?, tags=?`;
    const params = [titulo, conteudo, sistema, categoria, visibilidade, tags];
    if (imagem_url) { query += `, imagem_url=?`; params.push(imagem_url); }
    query += ` WHERE id=?`;
    params.push(id);
    await pool.execute(query, params);
    return res.json({ success: true, message: 'Documento atualizado!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function deletar(req, res) {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM documentos WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Documento removido.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, deletar, getSistemas };
