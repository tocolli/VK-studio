// backend/test/wiki.api.test.js — testes de integração da wiki (permissões + histórico).
//
// Só roda quando você pede, contra um banco LOCAL DE TESTE (nunca o de produção):
//   DB_HOST=127.0.0.1 DB_PORT=3307 DB_USER=... DB_PASSWORD=... DB_NAME=... DB_SSL=false \
//   WIKI_TESTE_DB=1 npm test
// (se o e-mail do mestre já existir nesse banco com outra senha: WIKI_TESTE_SENHA_MESTRE=...)
// Sem WIKI_TESTE_DB=1 (ou com DB_HOST que não seja local) estes testes são ignorados.
// Eles criam usuários e páginas de teste nesse banco; use um banco descartável.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const local = ['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || '');
const pular = process.env.WIKI_TESTE_DB !== '1' || !local
  ? 'defina WIKI_TESTE_DB=1 e aponte DB_HOST para um banco LOCAL de teste' : false;

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}/api`;
const MESTRE_EMAIL = 'vitorbarbosatocolli@gmail.com'; // o servidor promove este e-mail a mestre
const SENHA = 'teste-wiki-123';
const U = Date.now().toString(36); // sufixo único: o teste pode rodar várias vezes no mesmo banco

let servidor; let mestre; let jogador; let anon = {};
const ctx = { slugs: [] };

async function http(metodo, caminho, { token, corpo } = {}) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dados = {};
  try { dados = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, dados };
}

async function entrar(nome, email, senha = SENHA) {
  let r = await http('POST', '/auth/registrar', { corpo: { nome, email, senha } });
  if (r.status !== 201) r = await http('POST', '/auth/login', { corpo: { email, senha } });
  assert.ok(r.dados.token, `não consegui entrar como ${email}: ${JSON.stringify(r.dados)}`);
  return { token: r.dados.token };
}

test.before(async () => {
  if (pular) return;
  servidor = spawn(process.execPath, ['backend/src/server.js'], {
    cwd: require('node:path').resolve(__dirname, '../..'),
    env: { ...process.env, PORT: String(PORT), JWT_SECRET: process.env.JWT_SECRET || 'segredo-de-teste' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) break; } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  // Se o mestre já existir no banco de teste com outra senha, informe-a em WIKI_TESTE_SENHA_MESTRE
  mestre = await entrar('Mestre Teste', MESTRE_EMAIL, process.env.WIKI_TESTE_SENHA_MESTRE || SENHA);
  jogador = await entrar('Jogador Teste', `jogador-${U}@teste.local`);
});

test.after(async () => {
  if (!servidor) return;
  for (const s of ctx.slugs) await http('DELETE', `/wiki/paginas/${s}`, mestre).catch(() => {});
  servidor.kill();
});

test('visibilidade: página de mestre some para jogador e anônimo (404, busca, grafo, links, backlinks)', { skip: pular }, async () => {
  const segredo = `segredo-${U}`, aberta = `aberta-${U}`, token = `zzraro${U}`;
  ctx.slugs.push(segredo, aberta);
  assert.equal((await http('POST', '/wiki/paginas', { ...mestre, corpo: { titulo: segredo, conteudo: `texto ${token}`, visibilidade: 'mestre' } })).status, 201);
  assert.equal((await http('POST', '/wiki/paginas', { ...mestre, corpo: { titulo: aberta, conteudo: `cita [[${segredo}]]`, visibilidade: 'jogador' } })).status, 201);

  assert.equal((await http('GET', `/wiki/paginas/${segredo}`, mestre)).status, 200);
  assert.equal((await http('GET', `/wiki/paginas/${segredo}`, jogador)).status, 404);
  assert.equal((await http('GET', `/wiki/paginas/${segredo}`, anon)).status, 404);

  // busca pelo texto da página de mestre: só o mestre acha
  assert.equal((await http('GET', `/wiki/busca?q=${token}`, mestre)).dados.resultados.length, 1);
  assert.equal((await http('GET', `/wiki/busca?q=${token}`, jogador)).dados.resultados.length, 0);

  // listagem e grafo do jogador não trazem a página de mestre como página real
  const lista = (await http('GET', '/wiki/paginas', jogador)).dados.paginas.map((p) => p.slug);
  assert.ok(lista.includes(aberta) && !lista.includes(segredo));
  const grafo = (await http('GET', '/wiki/grafo', jogador)).dados;
  const no = grafo.nos.find((n) => n.id === segredo);
  assert.ok(!no || (no.faltando && no.pasta === '' && no.visibilidade === null), 'o nó da página de mestre deve parecer "não escrita"');

  // o [[link]] da página aberta para a de mestre aparece como "não escrita" para o jogador
  const pag = (await http('GET', `/wiki/paginas/${aberta}`, jogador)).dados;
  assert.equal(pag.links[segredo], undefined);
  assert.equal((await http('GET', `/wiki/paginas/${aberta}`, mestre)).dados.links[segredo], segredo);
  // backlink: a página de mestre cita? (não) — e a aberta aparece nos backlinks do mestre
  assert.ok((await http('GET', `/wiki/paginas/${segredo}`, mestre)).dados.backlinks.some((b) => b.slug === aberta));
});

test('só o mestre escreve', { skip: pular }, async () => {
  const corpo = { titulo: `intruso-${U}`, conteudo: 'x' };
  assert.equal((await http('POST', '/wiki/paginas', { ...jogador, corpo })).status, 403);
  assert.equal((await http('POST', '/wiki/paginas', { ...anon, corpo })).status, 401);
  assert.equal((await http('DELETE', `/wiki/paginas/aberta-${U}`, jogador)).status, 403);
  assert.equal((await http('GET', `/wiki/paginas/aberta-${U}/historico`, jogador)).status, 403);
  assert.equal((await http('GET', '/wiki/excluidas', jogador)).status, 403);
});

test('histórico: guarda versões, ignora salvar sem mudança, restaura e recupera página excluída', { skip: pular }, async () => {
  const slug = `hist-${U}`;
  ctx.slugs.push(slug);
  const salvar = (conteudo, vis = 'jogador') => http('PUT', `/wiki/paginas/${slug}`, { ...mestre, corpo: { titulo: slug, conteudo, visibilidade: vis } });
  const versoes = async () => (await http('GET', `/wiki/paginas/${slug}/historico`, mestre)).dados.versoes;

  await http('POST', '/wiki/paginas', { ...mestre, corpo: { titulo: slug, conteudo: 'v1', visibilidade: 'jogador' } });
  await salvar('v1');                        // sem mudança
  assert.equal((await versoes()).length, 0, 'salvar sem mudar não deve criar versão');
  await salvar('v2'); await salvar('v3', 'mestre');
  const v = await versoes();
  assert.equal(v.length, 2);

  // restaura a mais antiga (v1), inclusive a visibilidade original
  await http('POST', `/wiki/paginas/${slug}/restaurar/${v[v.length - 1].id}`, mestre);
  const atual = (await http('GET', `/wiki/paginas/${slug}`, mestre)).dados.pagina;
  assert.equal(atual.conteudo, 'v1');
  assert.equal(atual.visibilidade, 'jogador');
  assert.equal((await versoes()).length, 3, 'restaurar também guarda a versão atual (dá para desfazer)');

  // exclui e recupera
  assert.equal((await http('DELETE', `/wiki/paginas/${slug}`, mestre)).status, 200);
  assert.equal((await http('GET', `/wiki/paginas/${slug}`, mestre)).status, 404);
  const excl = (await http('GET', '/wiki/excluidas', mestre)).dados.excluidas.find((x) => x.slug === slug);
  assert.ok(excl, 'a página excluída deve aparecer na lista de excluídas');
  assert.equal((await http('POST', `/wiki/paginas/${slug}/restaurar/${excl.id}`, mestre)).status, 200);
  assert.equal((await http('GET', `/wiki/paginas/${slug}`, mestre)).dados.pagina.conteudo, 'v1');
});
