// backend/src/controllers/wikiController.js
// Wiki estilo Obsidian: páginas com [[links]], backlinks, grafo, busca e linha do tempo.
//
// Acesso (nível): anônimo=0 vê só 'publico' | jogador logado=1 vê +'jogador' | mestre=2 vê tudo.
// Regra de ouro: uma página que o visitante não pode ver se comporta como se NÃO EXISTISSE
// (404, ausente de backlinks, do grafo e das buscas), para não vazar nem o título.

const { pool } = require('../config/database');
const { VISIBILIDADES, slugify, extrairLinks, visiveisPara } = require('../utils/wiki');

const nivelDe = (req) => (req.user ? (req.user.role === 'mestre' ? 2 : 1) : 0);
const marcas = (arr) => arr.map(() => '?').join(',');
const erro500 = (res, err, ctx) => {
  console.error(`Erro wiki (${ctx}):`, err);
  return res.status(500).json({ success: false, message: 'Erro interno.' });
};

// ─── PÁGINAS ───────────────────────────────────────────────────────────────

async function listarPaginas(req, res) {
  try {
    const vis = visiveisPara(nivelDe(req));
    const [rows] = await pool.execute(
      `SELECT slug, titulo, pasta, visibilidade, updated_at
         FROM wiki_paginas WHERE visibilidade IN (${marcas(vis)})
         ORDER BY pasta, titulo`, vis);
    return res.json({ success: true, paginas: rows });
  } catch (err) { return erro500(res, err, 'listar'); }
}

async function obterPagina(req, res) {
  try {
    const nivel = nivelDe(req);
    const vis = visiveisPara(nivel);
    const slug = slugify(req.params.slug);
    const [rows] = await pool.execute(
      `SELECT p.id, p.slug, p.titulo, p.conteudo, p.pasta, p.visibilidade, p.updated_at, u.nome AS autor_nome
         FROM wiki_paginas p LEFT JOIN users u ON u.id = p.autor_id
        WHERE p.slug = ? AND p.visibilidade IN (${marcas(vis)})`, [slug, ...vis]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Página não encontrada.', precisaLogin: nivel === 0 });
    }
    const pagina = rows[0];

    // Mapa slug -> título das páginas citadas que o visitante pode ver (as demais = "não escrita")
    const links = extrairLinks(pagina.conteudo);
    const existentes = {};
    if (links.length) {
      const slugs = links.map(l => l.slug);
      const [alvos] = await pool.execute(
        `SELECT slug, titulo FROM wiki_paginas
          WHERE slug IN (${marcas(slugs)}) AND visibilidade IN (${marcas(vis)})`, [...slugs, ...vis]);
      alvos.forEach(a => { existentes[a.slug] = a.titulo; });
    }

    const [backlinks] = await pool.execute(
      `SELECT p.slug, p.titulo, p.pasta
         FROM wiki_links l JOIN wiki_paginas p ON p.id = l.origem_id
        WHERE l.destino_slug = ? AND p.id <> ? AND p.visibilidade IN (${marcas(vis)})
        ORDER BY p.titulo`, [slug, pagina.id, ...vis]);

    delete pagina.id;
    return res.json({ success: true, pagina, links: existentes, backlinks });
  } catch (err) { return erro500(res, err, 'obter'); }
}

async function grafo(req, res) {
  try {
    const vis = visiveisPara(nivelDe(req));
    const [paginas] = await pool.execute(
      `SELECT id, slug, titulo, pasta, visibilidade FROM wiki_paginas WHERE visibilidade IN (${marcas(vis)})`, vis);
    const porId = new Map(paginas.map(p => [p.id, p]));
    const porSlug = new Map(paginas.map(p => [p.slug, p]));

    const [ligacoes] = await pool.execute(
      `SELECT l.origem_id, l.destino_slug, l.texto FROM wiki_links l
         JOIN wiki_paginas p ON p.id = l.origem_id WHERE p.visibilidade IN (${marcas(vis)})`, vis);

    const nos = new Map();
    paginas.forEach(p => nos.set(p.slug, {
      id: p.slug, titulo: p.titulo, pasta: p.pasta, visibilidade: p.visibilidade, faltando: false, grau: 0,
    }));
    const arestas = [];
    for (const l of ligacoes) {
      const origem = porId.get(l.origem_id);
      if (!origem || origem.slug === l.destino_slug) continue;
      // Destino inexistente OU escondido do visitante => nó "fantasma" (não escrita), sem vazar nada.
      if (!nos.has(l.destino_slug)) {
        nos.set(l.destino_slug, { id: l.destino_slug, titulo: l.texto, pasta: '', visibilidade: null, faltando: true, grau: 0 });
      }
      arestas.push({ origem: origem.slug, destino: l.destino_slug });
      nos.get(origem.slug).grau++;
      nos.get(l.destino_slug).grau++;
    }
    return res.json({ success: true, nos: [...nos.values()], arestas });
  } catch (err) { return erro500(res, err, 'grafo'); }
}

async function buscar(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, resultados: [] });
    const vis = visiveisPara(nivelDe(req));
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const [rows] = await pool.execute(
      `SELECT slug, titulo, pasta, conteudo FROM wiki_paginas
        WHERE visibilidade IN (${marcas(vis)}) AND (titulo LIKE ? OR conteudo LIKE ?)
        ORDER BY (titulo LIKE ?) DESC, titulo LIMIT 30`, [...vis, like, like, like]);

    const resultados = rows.map(r => {
      const texto = String(r.conteudo || '');
      const i = texto.toLowerCase().indexOf(q.toLowerCase());
      let trecho = '';
      if (i >= 0) {
        const ini = Math.max(0, i - 70);
        trecho = (ini > 0 ? '…' : '') + texto.slice(ini, i + q.length + 130).replace(/\s+/g, ' ') + '…';
      }
      return { slug: r.slug, titulo: r.titulo, pasta: r.pasta, trecho };
    });
    return res.json({ success: true, resultados });
  } catch (err) { return erro500(res, err, 'buscar'); }
}

function lerCorpoPagina(body) {
  const titulo = String(body.titulo || '').trim();
  if (!titulo) return { erro: 'Título é obrigatório.' };
  if (titulo.length > 200) return { erro: 'Título muito longo (máx. 200).' };
  const visibilidade = VISIBILIDADES.includes(body.visibilidade) ? body.visibilidade : 'jogador';
  const pasta = String(body.pasta || '').trim().slice(0, 190);
  const conteudo = String(body.conteudo ?? '');
  return { titulo, visibilidade, pasta, conteudo };
}

async function sincronizarLinks(conn, paginaId, conteudo) {
  await conn.execute('DELETE FROM wiki_links WHERE origem_id = ?', [paginaId]);
  for (const l of extrairLinks(conteudo)) {
    await conn.execute('INSERT INTO wiki_links (origem_id, destino_slug, texto) VALUES (?, ?, ?)',
      [paginaId, l.slug, l.texto]);
  }
}

async function criarPagina(req, res) {
  const dados = lerCorpoPagina(req.body || {});
  if (dados.erro) return res.status(400).json({ success: false, message: dados.erro });
  const slug = slugify(req.body.slug || dados.titulo);
  if (!slug) return res.status(400).json({ success: false, message: 'Título inválido para gerar o endereço.' });

  const conn = await pool.getConnection();
  try {
    const [ja] = await conn.execute('SELECT 1 FROM wiki_paginas WHERE slug = ?', [slug]);
    if (ja.length) return res.status(409).json({ success: false, message: 'Já existe uma página com esse nome.' });
    await conn.beginTransaction();
    const [r] = await conn.execute(
      `INSERT INTO wiki_paginas (slug, titulo, conteudo, pasta, visibilidade, autor_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [slug, dados.titulo, dados.conteudo, dados.pasta, dados.visibilidade, req.user.id]);
    await sincronizarLinks(conn, r.insertId, dados.conteudo);
    await conn.commit();
    return res.status(201).json({ success: true, slug });
  } catch (err) {
    await conn.rollback().catch(() => {});
    return erro500(res, err, 'criar');
  } finally { conn.release(); }
}

// ─── HISTÓRICO (rede de segurança: nada que o mestre salva ou apaga se perde) ─────

const MAX_REVISOES = 50; // por página; as mais antigas saem quando passa disso

/** Guarda o estado ATUAL de uma página (antes de ela mudar ou sumir). */
async function guardarRevisao(conn, pag, acao, editorId) {
  await conn.execute(
    `INSERT INTO wiki_revisoes (pagina_slug, titulo, conteudo, pasta, visibilidade, acao, editor_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [pag.slug, pag.titulo, pag.conteudo, pag.pasta, pag.visibilidade, acao, editorId ?? null]);
  await conn.execute(
    `DELETE FROM wiki_revisoes WHERE pagina_slug = ? AND id NOT IN
       (SELECT id FROM (SELECT id FROM wiki_revisoes WHERE pagina_slug = ? ORDER BY id DESC LIMIT ${MAX_REVISOES}) t)`,
    [pag.slug, pag.slug]);
}

async function atualizarPagina(req, res) {
  const dados = lerCorpoPagina(req.body || {});
  if (dados.erro) return res.status(400).json({ success: false, message: dados.erro });
  const slug = slugify(req.params.slug);

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT id, slug, titulo, conteudo, pasta, visibilidade FROM wiki_paginas WHERE slug = ?', [slug]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Página não encontrada.' });
    const atual = rows[0];
    await conn.beginTransaction();
    // Só guarda versão se algo mudou de fato (salvar sem mexer não enche o histórico)
    if (atual.titulo !== dados.titulo || (atual.conteudo ?? '') !== dados.conteudo ||
        atual.pasta !== dados.pasta || atual.visibilidade !== dados.visibilidade) {
      await guardarRevisao(conn, atual, 'editou', req.user.id);
    }
    // O endereço (slug) não muda ao editar: assim nenhum [[link]] existente quebra.
    await conn.execute(
      `UPDATE wiki_paginas SET titulo = ?, conteudo = ?, pasta = ?, visibilidade = ? WHERE id = ?`,
      [dados.titulo, dados.conteudo, dados.pasta, dados.visibilidade, atual.id]);
    await sincronizarLinks(conn, atual.id, dados.conteudo);
    await conn.commit();
    return res.json({ success: true, slug });
  } catch (err) {
    await conn.rollback().catch(() => {});
    return erro500(res, err, 'atualizar');
  } finally { conn.release(); }
}

async function deletarPagina(req, res) {
  const slug = slugify(req.params.slug);
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT id, slug, titulo, conteudo, pasta, visibilidade FROM wiki_paginas WHERE slug = ?', [slug]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Página não encontrada.' });
    await conn.beginTransaction();
    await guardarRevisao(conn, rows[0], 'excluiu', req.user.id);
    await conn.execute('DELETE FROM wiki_paginas WHERE id = ?', [rows[0].id]);
    await conn.commit();
    return res.json({ success: true });
  } catch (err) {
    await conn.rollback().catch(() => {});
    return erro500(res, err, 'deletar');
  } finally { conn.release(); }
}

async function listarHistorico(req, res) {
  try {
    const slug = slugify(req.params.slug);
    const [versoes] = await pool.execute(
      `SELECT r.id, r.acao, r.titulo, r.visibilidade, CHAR_LENGTH(r.conteudo) AS tamanho, r.created_at, u.nome AS editor_nome
         FROM wiki_revisoes r LEFT JOIN users u ON u.id = r.editor_id
        WHERE r.pagina_slug = ? ORDER BY r.id DESC`, [slug]);
    return res.json({ success: true, versoes });
  } catch (err) { return erro500(res, err, 'historico'); }
}

/** Páginas apagadas (cuja última ação foi "excluiu" e que ainda não foram recriadas). */
async function listarExcluidas(_req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT r.id, r.pagina_slug AS slug, r.titulo, r.pasta, r.created_at
         FROM wiki_revisoes r
        WHERE r.acao = 'excluiu'
          AND r.id = (SELECT MAX(r2.id) FROM wiki_revisoes r2 WHERE r2.pagina_slug = r.pagina_slug)
          AND NOT EXISTS (SELECT 1 FROM wiki_paginas p WHERE p.slug = r.pagina_slug)
        ORDER BY r.id DESC`);
    return res.json({ success: true, excluidas: rows });
  } catch (err) { return erro500(res, err, 'excluidas'); }
}

/** Volta a página para uma versão antiga. Se a página foi apagada, ela é recriada. É reversível. */
async function restaurarVersao(req, res) {
  const slug = slugify(req.params.slug);
  const revId = Number.parseInt(req.params.revId, 10);
  if (!Number.isFinite(revId)) return res.status(400).json({ success: false, message: 'Versão inválida.' });

  const conn = await pool.getConnection();
  try {
    const [revs] = await conn.execute('SELECT * FROM wiki_revisoes WHERE id = ? AND pagina_slug = ?', [revId, slug]);
    if (!revs.length) return res.status(404).json({ success: false, message: 'Versão não encontrada.' });
    const rev = revs[0];
    const [rows] = await conn.execute(
      'SELECT id, slug, titulo, conteudo, pasta, visibilidade FROM wiki_paginas WHERE slug = ?', [slug]);

    await conn.beginTransaction();
    let paginaId;
    if (rows.length) {
      await guardarRevisao(conn, rows[0], 'editou', req.user.id); // desfazer o "restaurar" também é possível
      await conn.execute(
        'UPDATE wiki_paginas SET titulo = ?, conteudo = ?, pasta = ?, visibilidade = ? WHERE id = ?',
        [rev.titulo, rev.conteudo, rev.pasta, rev.visibilidade, rows[0].id]);
      paginaId = rows[0].id;
    } else {
      const [r] = await conn.execute(
        'INSERT INTO wiki_paginas (slug, titulo, conteudo, pasta, visibilidade, autor_id) VALUES (?, ?, ?, ?, ?, ?)',
        [slug, rev.titulo, rev.conteudo, rev.pasta, rev.visibilidade, req.user.id]);
      paginaId = r.insertId;
    }
    await sincronizarLinks(conn, paginaId, rev.conteudo);
    await conn.commit();
    return res.json({ success: true, slug });
  } catch (err) {
    await conn.rollback().catch(() => {});
    return erro500(res, err, 'restaurar');
  } finally { conn.release(); }
}

// ─── LINHA DO TEMPO ────────────────────────────────────────────────────────

function lerCorpoEvento(body) {
  const titulo = String(body.titulo || '').trim();
  if (!titulo) return { erro: 'Título é obrigatório.' };
  const ordem = Number.parseInt(body.ordem, 10);
  const slugPagina = body.pagina_slug ? slugify(body.pagina_slug) : null;
  return {
    titulo: titulo.slice(0, 200),
    descricao: String(body.descricao || '').slice(0, 5000),
    era: String(body.era || '').trim().slice(0, 120),
    data_texto: String(body.data_texto || '').trim().slice(0, 120),
    ordem: Number.isFinite(ordem) ? ordem : 0,
    pagina_slug: slugPagina || null,
    visibilidade: VISIBILIDADES.includes(body.visibilidade) ? body.visibilidade : 'jogador',
  };
}

async function listarEventos(req, res) {
  try {
    const nivel = nivelDe(req);
    const vis = visiveisPara(nivel);
    const [rows] = await pool.execute(
      `SELECT id, titulo, descricao, era, data_texto, ordem, pagina_slug, visibilidade
         FROM wiki_eventos WHERE visibilidade IN (${marcas(vis)}) ORDER BY ordem, id`, vis);

    // Só mantém o atalho para a página se o visitante puder vê-la
    const slugs = [...new Set(rows.map(r => r.pagina_slug).filter(Boolean))];
    let legiveis = new Set();
    if (slugs.length) {
      const [ps] = await pool.execute(
        `SELECT slug FROM wiki_paginas WHERE slug IN (${marcas(slugs)}) AND visibilidade IN (${marcas(vis)})`,
        [...slugs, ...vis]);
      legiveis = new Set(ps.map(p => p.slug));
    }
    const eventos = rows.map(r => ({ ...r, pagina_slug: legiveis.has(r.pagina_slug) ? r.pagina_slug : null }));
    return res.json({ success: true, eventos });
  } catch (err) { return erro500(res, err, 'eventos'); }
}

async function criarEvento(req, res) {
  const d = lerCorpoEvento(req.body || {});
  if (d.erro) return res.status(400).json({ success: false, message: d.erro });
  try {
    const [r] = await pool.execute(
      `INSERT INTO wiki_eventos (titulo, descricao, era, data_texto, ordem, pagina_slug, visibilidade)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [d.titulo, d.descricao, d.era, d.data_texto, d.ordem, d.pagina_slug, d.visibilidade]);
    return res.status(201).json({ success: true, id: r.insertId });
  } catch (err) { return erro500(res, err, 'criarEvento'); }
}

async function atualizarEvento(req, res) {
  const d = lerCorpoEvento(req.body || {});
  if (d.erro) return res.status(400).json({ success: false, message: d.erro });
  try {
    const [r] = await pool.execute(
      `UPDATE wiki_eventos SET titulo=?, descricao=?, era=?, data_texto=?, ordem=?, pagina_slug=?, visibilidade=? WHERE id=?`,
      [d.titulo, d.descricao, d.era, d.data_texto, d.ordem, d.pagina_slug, d.visibilidade, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Evento não encontrado.' });
    return res.json({ success: true });
  } catch (err) { return erro500(res, err, 'atualizarEvento'); }
}

async function deletarEvento(req, res) {
  try {
    const [r] = await pool.execute('DELETE FROM wiki_eventos WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Evento não encontrado.' });
    return res.json({ success: true });
  } catch (err) { return erro500(res, err, 'deletarEvento'); }
}

module.exports = {
  listarPaginas, obterPagina, grafo, buscar, criarPagina, atualizarPagina, deletarPagina,
  listarHistorico, listarExcluidas, restaurarVersao,
  listarEventos, criarEvento, atualizarEvento, deletarEvento,
};
