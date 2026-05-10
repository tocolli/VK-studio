// backend/src/controllers/sessaoController.js
const { pool } = require('../config/database');
const { cloudinary } = require('../config/cloudinary');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Upload específico para mapas
const mapaStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vkstudio/mapas',
    allowed_formats: ['jpg','jpeg','png','webp'],
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  },
});
const uploadMapa = multer({ storage: mapaStorage, limits: { fileSize: 15 * 1024 * 1024 } });

// Gera código único de 8 chars
function gerarCodigo() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// ── SESSÕES ──────────────────────────────────────────────────────────
async function listarSessoes(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT s.*, u.nome as mestre_nome,
              m.nome as mapa_nome, m.imagem_url as mapa_url
       FROM sessoes_mesa s
       JOIN users u ON s.mestre_id = u.id
       LEFT JOIN mapas_mesa m ON s.mapa_ativo_id = m.id
       WHERE s.mestre_id = ? OR s.status = 'ativa'
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, sessoes: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function criarSessao(req, res) {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ success: false, message: 'Nome obrigatório.' });

    let codigo;
    let tentativas = 0;
    do {
      codigo = gerarCodigo();
      const [exists] = await pool.execute('SELECT id FROM sessoes_mesa WHERE codigo = ?', [codigo]);
      if (!exists.length) break;
      tentativas++;
    } while (tentativas < 10);

    const [result] = await pool.execute(
      'INSERT INTO sessoes_mesa (nome, codigo, mestre_id) VALUES (?, ?, ?)',
      [nome, codigo, req.user.id]
    );

    return res.status(201).json({ success: true, sessao: { id: result.insertId, nome, codigo } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function buscarSessao(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT s.*, u.nome as mestre_nome,
              m.nome as mapa_nome, m.imagem_url as mapa_url,
              m.largura_grid, m.altura_grid, m.tamanho_cel
       FROM sessoes_mesa s
       JOIN users u ON s.mestre_id = u.id
       LEFT JOIN mapas_mesa m ON s.mapa_ativo_id = m.id
       WHERE s.id = ? OR s.codigo = ?`,
      [id, id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Sessão não encontrada.' });
    return res.json({ success: true, sessao: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function encerrarSessao(req, res) {
  try {
    const { id } = req.params;
    await pool.execute(
      'UPDATE sessoes_mesa SET status = "encerrada" WHERE id = ? AND mestre_id = ?',
      [id, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

// ── MAPAS ────────────────────────────────────────────────────────────
async function listarMapas(req, res) {
  try {
    const { sessaoId } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM mapas_mesa WHERE sessao_id = ? ORDER BY created_at DESC',
      [sessaoId]
    );
    return res.json({ success: true, mapas: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function uploadMapaHandler(req, res) {
  try {
    const { sessaoId } = req.params;
    const { nome, largura_grid, altura_grid, tamanho_cel } = req.body;
    const imagem_url = req.file?.path;

    if (!imagem_url) return res.status(400).json({ success: false, message: 'Imagem obrigatória.' });

    const [result] = await pool.execute(
      `INSERT INTO mapas_mesa (sessao_id, nome, imagem_url, largura_grid, altura_grid, tamanho_cel)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessaoId, nome || 'Mapa', imagem_url,
       parseInt(largura_grid) || 20,
       parseInt(altura_grid)  || 20,
       parseInt(tamanho_cel)  || 60]
    );

    // Cria fog of war vazio para este mapa
    const cols = parseInt(largura_grid) || 20;
    const rows2 = parseInt(altura_grid) || 20;
    const celulas = JSON.stringify(
      Array.from({ length: rows2 }, () => Array(cols).fill(1)) // 1 = coberto
    );
    await pool.execute(
      'INSERT INTO fog_of_war (sessao_id, mapa_id, celulas) VALUES (?, ?, ?)',
      [sessaoId, result.insertId, celulas]
    );

    return res.status(201).json({ success: true, id: result.insertId, imagem_url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function selecionarMapa(req, res) {
  try {
    const { sessaoId, mapaId } = req.params;
    await pool.execute(
      'UPDATE sessoes_mesa SET mapa_ativo_id = ? WHERE id = ? AND mestre_id = ?',
      [mapaId, sessaoId, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function deletarMapa(req, res) {
  try {
    const { mapaId } = req.params;
    await pool.execute('DELETE FROM mapas_mesa WHERE id = ?', [mapaId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

// ── TOKENS ───────────────────────────────────────────────────────────
async function listarTokens(req, res) {
  try {
    const { sessaoId, mapaId } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM tokens_mesa WHERE sessao_id = ? AND mapa_id = ?',
      [sessaoId, mapaId]
    );
    return res.json({ success: true, tokens: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function criarToken(req, res) {
  try {
    const { sessaoId, mapaId } = req.params;
    const { nome, imagem_url, pos_x, pos_y, tamanho, cor, hp_atual, hp_max, ficha_id, jogador_id } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO tokens_mesa
         (sessao_id, mapa_id, nome, imagem_url, pos_x, pos_y, tamanho, cor, hp_atual, hp_max, ficha_id, jogador_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessaoId, mapaId, nome, imagem_url || null,
       parseInt(pos_x)||0, parseInt(pos_y)||0,
       parseInt(tamanho)||1, cor||'#c9a84c',
       parseInt(hp_atual)||10, parseInt(hp_max)||10,
       ficha_id||null, jogador_id||null]
    );

    const [token] = await pool.execute('SELECT * FROM tokens_mesa WHERE id = ?', [result.insertId]);
    return res.status(201).json({ success: true, token: token[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function atualizarToken(req, res) {
  try {
    const { tokenId } = req.params;
    const { pos_x, pos_y, hp_atual, hp_max, visivel, nome, cor, dados_extras } = req.body;

    const campos = [];
    const params = [];
    if (pos_x !== undefined) { campos.push('pos_x=?'); params.push(parseInt(pos_x)); }
    if (pos_y !== undefined) { campos.push('pos_y=?'); params.push(parseInt(pos_y)); }
    if (hp_atual !== undefined) { campos.push('hp_atual=?'); params.push(parseInt(hp_atual)); }
    if (hp_max !== undefined)   { campos.push('hp_max=?');   params.push(parseInt(hp_max)); }
    if (visivel !== undefined)  { campos.push('visivel=?');  params.push(visivel ? 1 : 0); }
    if (nome)        { campos.push('nome=?'); params.push(nome); }
    if (cor)         { campos.push('cor=?');  params.push(cor); }
    if (dados_extras){ campos.push('dados_extras=?'); params.push(JSON.stringify(dados_extras)); }

    if (!campos.length) return res.status(400).json({ success: false, message: 'Nada para atualizar.' });
    params.push(tokenId);
    await pool.execute(`UPDATE tokens_mesa SET ${campos.join(',')} WHERE id=?`, params);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function deletarToken(req, res) {
  try {
    const { tokenId } = req.params;
    await pool.execute('DELETE FROM tokens_mesa WHERE id = ?', [tokenId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

// ── FOG OF WAR ───────────────────────────────────────────────────────
async function getFog(req, res) {
  try {
    const { sessaoId, mapaId } = req.params;
    const [rows] = await pool.execute(
      'SELECT celulas FROM fog_of_war WHERE sessao_id = ? AND mapa_id = ?',
      [sessaoId, mapaId]
    );
    if (!rows.length) return res.json({ success: true, celulas: null });
    return res.json({ success: true, celulas: JSON.parse(rows[0].celulas) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function atualizarFog(req, res) {
  try {
    const { sessaoId, mapaId } = req.params;
    const { celulas } = req.body;
    const celStr = typeof celulas === 'string' ? celulas : JSON.stringify(celulas);
    await pool.execute(
      `INSERT INTO fog_of_war (sessao_id, mapa_id, celulas)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE celulas = VALUES(celulas)`,
      [sessaoId, mapaId, celStr]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

// ── CHAT ─────────────────────────────────────────────────────────────
async function buscarChat(req, res) {
  try {
    const { sessaoId } = req.params;
    const [rows] = await pool.execute(
      `SELECT m.*, u.avatar_url
       FROM mensagens_chat m
       JOIN users u ON m.usuario_id = u.id
       WHERE m.sessao_id = ? AND (m.tipo != 'privado' OR m.usuario_id = ?)
       ORDER BY m.created_at ASC LIMIT 200`,
      [sessaoId, req.user.id]
    );
    return res.json({ success: true, mensagens: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

module.exports = {
  listarSessoes, criarSessao, buscarSessao, encerrarSessao,
  listarMapas, uploadMapaHandler, selecionarMapa, deletarMapa,
  listarTokens, criarToken, atualizarToken, deletarToken,
  getFog, atualizarFog,
  buscarChat,
  uploadMapa,
};
