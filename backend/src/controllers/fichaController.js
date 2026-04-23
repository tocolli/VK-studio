// backend/src/controllers/fichaController.js
const { pool } = require('../config/database');

// ── helper: registra log de atividade ──────────────────────────────────────
async function registrarLog(conn, { usuario_id, usuario_nome, ficha_id, personagem_nome, campo, valor_anterior, valor_novo }) {
  try {
    await conn.execute(
      `INSERT INTO atividades_fichas
         (usuario_id, usuario_nome, ficha_id, personagem_nome, campo, valor_anterior, valor_novo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [usuario_id, usuario_nome, ficha_id, personagem_nome, campo, valor_anterior, valor_novo]
    );
  } catch (e) {
    // Não quebra o fluxo principal se o log falhar
    console.error('Log de atividade falhou:', e.message);
  }
}

// ── detecta diferenças entre dois objetos de atributos ─────────────────────
function detectarMudancas(anterior, novo) {
  const mudancas = [];
  const toFlat = (obj, prefix = '') => {
    for (const [k, v] of Object.entries(obj || {})) {
      if (k.startsWith('_') || k === 'alma' || k === 'habilidades' || k === 'qualidades' || k === 'defeitos' || k === 'itens' || k === 'caracteristicas') continue;
      const key = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        toFlat(v, key);
      } else {
        mudancas.push({ key, val: v });
      }
    }
  };
  const flatAnterior = {};
  const flatNovo = {};
  toFlat(anterior, ''); toFlat(novo, '');
  // Reconstrói
  const flatA = {}; toFlat(anterior); 
  // Simplificado: compara campos raiz e arrays de status
  const CAMPOS_STATUS = ['vida','sanidade','estamina','saciedade','sede','energia'];
  const CAMPOS_SIMPLES = ['nome_personagem','sistema'];
  const diffs = [];

  // Arrays de status [atual, max]
  for (const campo of CAMPOS_STATUS) {
    const a = anterior?.[campo];
    const n = novo?.[campo];
    if (JSON.stringify(a) !== JSON.stringify(n)) {
      diffs.push({
        campo,
        anterior: Array.isArray(a) ? `${a[0]}/${a[1]}` : String(a ?? '—'),
        novo:     Array.isArray(n) ? `${n[0]}/${n[1]}` : String(n ?? '—'),
      });
    }
  }

  // Atributos base (Físico, Social, etc.)
  const atrsA = {};
  const atrsN = {};
  const IGNORAR = new Set([...CAMPOS_STATUS,'_pericias','_periciasProf','rd_roupa','dinheiro','gasto_fixo','renda','idade','profissao','expectativa_vida','habilidades','qualidades','defeitos','itens','caracteristicas','alma']);
  for (const [k,v] of Object.entries(anterior || {})) {
    if (!IGNORAR.has(k) && typeof v === 'number') atrsA[k] = v;
  }
  for (const [k,v] of Object.entries(novo || {})) {
    if (!IGNORAR.has(k) && typeof v === 'number') atrsN[k] = v;
  }
  for (const k of new Set([...Object.keys(atrsA),...Object.keys(atrsN)])) {
    if (atrsA[k] !== atrsN[k]) {
      diffs.push({ campo: k, anterior: String(atrsA[k] ?? '—'), novo: String(atrsN[k] ?? '—') });
    }
  }

  return diffs;
}

async function listar(req, res) {
  try {
    const isMestre = req.user.role === 'mestre';
    let query = `SELECT f.*, u.nome as jogador_nome FROM fichas f JOIN users u ON f.jogador_id = u.id WHERE f.ativo = 1`;
    const params = [];
    if (!isMestre) { query += ' AND f.jogador_id = ?'; params.push(req.user.id); }
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
      `SELECT f.*, u.nome as jogador_nome FROM fichas f JOIN users u ON f.jogador_id = u.id WHERE f.id = ? AND f.ativo = 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Ficha não encontrada.' });
    const ficha = rows[0];
    if (req.user.role !== 'mestre' && ficha.jogador_id !== req.user.id) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    return res.json({ success: true, ficha });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

async function criar(req, res) {
  const conn = await pool.getConnection();
  try {
    const { nome_personagem, sistema, atributos, jogador_id } = req.body;
    const imagem_url = req.file?.path || null;
    if (!nome_personagem || !atributos) return res.status(400).json({ success: false, message: 'Nome e atributos são obrigatórios.' });
    const targetId = req.user.role === 'mestre' && jogador_id ? jogador_id : req.user.id;
    const atrsJSON = typeof atributos === 'string' ? atributos : JSON.stringify(atributos);
    const [result] = await conn.execute(
      `INSERT INTO fichas (nome_personagem, jogador_id, sistema, atributos, imagem_url) VALUES (?, ?, ?, ?, ?)`,
      [nome_personagem, targetId, sistema || 'Decadência Cinza', atrsJSON, imagem_url]
    );
    await registrarLog(conn, {
      usuario_id: req.user.id,
      usuario_nome: req.user.nome,
      ficha_id: result.insertId,
      personagem_nome: nome_personagem,
      campo: 'ficha',
      valor_anterior: '—',
      valor_novo: 'Ficha criada',
    });
    return res.status(201).json({ success: true, message: 'Ficha criada!', id: result.insertId });
  } catch (err) {
    console.error('Erro ao criar ficha:', err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  } finally { conn.release(); }
}

async function atualizar(req, res) {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { nome_personagem, sistema, atributos } = req.body;
    const imagem_url = req.file?.path;

    // Busca ficha anterior para comparar
    const [fichaAnt] = await conn.execute(
      `SELECT f.*, u.nome as jogador_nome FROM fichas f JOIN users u ON f.jogador_id = u.id WHERE f.id = ?`, [id]
    );

    const atrsJSON = typeof atributos === 'string' ? atributos : JSON.stringify(atributos);
    let query = `UPDATE fichas SET nome_personagem=?, sistema=?, atributos=?`;
    const params = [nome_personagem, sistema, atrsJSON];
    if (imagem_url) { query += `, imagem_url=?`; params.push(imagem_url); }
    query += ` WHERE id=?`;
    params.push(id);
    await conn.execute(query, params);

    // Gera logs das mudanças detectadas
    if (fichaAnt.length > 0) {
      const anterior = fichaAnt[0];
      let atrsAntObj = {};
      try { atrsAntObj = typeof anterior.atributos === 'string' ? JSON.parse(anterior.atributos) : anterior.atributos; } catch {}
      let atrsNovoObj = {};
      try { atrsNovoObj = typeof atributos === 'string' ? JSON.parse(atributos) : atributos; } catch {}

      const diffs = detectarMudancas(atrsAntObj, atrsNovoObj);

      // Nome do personagem mudou?
      if (anterior.nome_personagem !== nome_personagem) {
        diffs.push({ campo: 'nome do personagem', anterior: anterior.nome_personagem, novo: nome_personagem });
      }

      for (const d of diffs) {
        await registrarLog(conn, {
          usuario_id: req.user.id,
          usuario_nome: req.user.nome,
          ficha_id: parseInt(id),
          personagem_nome: nome_personagem || anterior.nome_personagem,
          campo: d.campo,
          valor_anterior: d.anterior,
          valor_novo: d.novo,
        });
      }

      // Se não houve diffs detectados, loga salvamento genérico
      if (diffs.length === 0) {
        await registrarLog(conn, {
          usuario_id: req.user.id,
          usuario_nome: req.user.nome,
          ficha_id: parseInt(id),
          personagem_nome: nome_personagem || anterior.nome_personagem,
          campo: 'ficha',
          valor_anterior: '—',
          valor_novo: 'Ficha salva',
        });
      }
    }

    return res.json({ success: true, message: 'Ficha atualizada!' });
  } catch (err) {
    console.error('Erro ao atualizar ficha:', err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  } finally { conn.release(); }
}

async function deletar(req, res) {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const [fichas] = await conn.execute('SELECT nome_personagem FROM fichas WHERE id = ?', [id]);
    await conn.execute('UPDATE fichas SET ativo = 0 WHERE id = ?', [id]);
    if (fichas.length > 0) {
      await registrarLog(conn, {
        usuario_id: req.user.id, usuario_nome: req.user.nome,
        ficha_id: parseInt(id), personagem_nome: fichas[0].nome_personagem,
        campo: 'ficha', valor_anterior: 'Ativa', valor_novo: 'Arquivada',
      });
    }
    return res.json({ success: true, message: 'Ficha arquivada.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  } finally { conn.release(); }
}

module.exports = { listar, buscarPorId, criar, atualizar, deletar };
