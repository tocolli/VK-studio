// backend/test/auth.reset.test.js — testes de integração da recuperação de senha.
//
// Mesmas regras dos outros testes de integração: só rodam contra um banco LOCAL de teste.
//   DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=... DB_PASSWORD=... DB_NAME=vk_teste DB_SSL=false \
//   WIKI_TESTE_DB=1 npm test
//
// O envio de e-mail é testado de verdade (mesmo código usado em produção), mas apontado para um
// servidor HTTP falso que só guarda o que receberia a Brevo. Nenhum e-mail real é enviado.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const local = ['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || '');
const pular = process.env.WIKI_TESTE_DB !== '1' || !local
  ? 'defina WIKI_TESTE_DB=1 e aponte DB_HOST para um banco LOCAL de teste' : false;

const PORT = 3800 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}/api`;
const U = Date.now().toString(36);
const SENHA_ANTIGA = 'senha-antiga-1';

let servidor; let correio; let pool;
const emails = []; // tudo que o "provedor" recebeu: { chave, corpo }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperar(cond, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { const v = await cond(); if (v) return v; await sleep(50); }
  return null;
}

async function http_(metodo, caminho, corpo) {
  const r = await fetch(BASE + caminho, {
    method: metodo, headers: { 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dados = {};
  try { dados = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, dados };
}

const criarConta = async (email) => (await http_('POST', '/auth/registrar', { nome: 'Jogador Reset', email, senha: SENHA_ANTIGA })).status;
const pedir = (email) => http_('POST', '/auth/esqueci-senha', { email });
const paraEste = (email) => emails.filter((e) => e.corpo.to?.[0]?.email === email);
const linkDe = (mail) => mail.corpo.htmlContent.match(/href="([^"]*redefinir-senha\?token=[^"]+)"/)?.[1];
const tokenDe = (mail) => new URL(linkDe(mail)).searchParams.get('token');

test.before(async () => {
  if (pular) return;
  // "Brevo" de mentira
  correio = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => { b += c; });
    req.on('end', () => { emails.push({ chave: req.headers['api-key'], corpo: JSON.parse(b) }); res.writeHead(201, { 'Content-Type': 'application/json' }); res.end('{"messageId":"x"}'); });
  });
  await new Promise((r) => correio.listen(0, '127.0.0.1', r));

  servidor = spawn(process.execPath, ['backend/src/server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env, PORT: String(PORT), JWT_SECRET: process.env.JWT_SECRET || 'segredo-de-teste',
      EMAIL_PROVIDER: 'brevo', EMAIL_API_KEY: 'chave-de-teste', EMAIL_FROM: 'VK.Studio Teste <nao-responda@teste.local>',
      EMAIL_API_URL: `http://127.0.0.1:${correio.address().port}/v3/smtp/email`, APP_URL: 'https://app.teste',
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) break; } catch { /* subindo */ }
    await sleep(250);
  }
  pool = require('../src/config/database').pool;
});

test.after(async () => {
  if (servidor) servidor.kill();
  if (correio) correio.close();
  if (pool) await pool.end().catch(() => {});
});

test('e-mail desconhecido: mesma resposta de um e-mail cadastrado, e nada é enviado', { skip: pular }, async () => {
  const conhecido = `reset-a-${U}@teste.local`;
  await criarConta(conhecido);
  const a = await pedir(conhecido);
  const b = await pedir(`ninguem-${U}@teste.local`);
  assert.equal(a.status, 200);
  assert.deepEqual(b, a, 'a resposta não pode revelar se o e-mail existe');
  assert.ok(await esperar(() => paraEste(conhecido).length === 1), 'o cadastrado deve receber o e-mail');
  await sleep(300);
  assert.equal(paraEste(`ninguem-${U}@teste.local`).length, 0);
});

test('e-mail inválido é recusado', { skip: pular }, async () => {
  assert.equal((await pedir('isso-nao-e-email')).status, 400);
  assert.equal((await pedir('')).status, 400);
});

test('fluxo completo: pedir, receber o link, trocar a senha, entrar com a nova, link não vale de novo', { skip: pular }, async () => {
  const email = `reset-b-${U}@teste.local`;
  await criarConta(email);
  await pedir(email);
  const mail = await esperar(() => paraEste(email)[0]);
  assert.ok(mail, 'e-mail de recuperação não chegou');

  // O que o provedor recebeu está no formato da Brevo, com a chave no cabeçalho
  assert.equal(mail.chave, 'chave-de-teste');
  assert.deepEqual(mail.corpo.sender, { name: 'VK.Studio Teste', email: 'nao-responda@teste.local' });
  assert.ok(mail.corpo.subject && mail.corpo.htmlContent);
  assert.match(linkDe(mail), /^https:\/\/app\.teste\/redefinir-senha\?token=/, 'o link deve usar APP_URL');
  const token = tokenDe(mail);

  assert.equal((await http_('GET', `/auth/redefinir-senha/validar?token=${token}`)).dados.valido, true);
  assert.equal((await http_('POST', '/auth/redefinir-senha', { token, senha: 'senha-nova-123' })).status, 200);

  assert.equal((await http_('POST', '/auth/login', { email, senha: 'senha-nova-123' })).status, 200);
  assert.equal((await http_('POST', '/auth/login', { email, senha: SENHA_ANTIGA })).status, 401);

  // o mesmo link não funciona uma segunda vez
  assert.equal((await http_('POST', '/auth/redefinir-senha', { token, senha: 'outra-senha-9' })).status, 400);
  assert.equal((await http_('GET', `/auth/redefinir-senha/validar?token=${token}`)).dados.valido, false);

  // aviso de "sua senha foi alterada"
  assert.ok(await esperar(() => paraEste(email).length === 2), 'deveria chegar o aviso de senha alterada');
});

test('só o hash do token fica no banco', { skip: pular }, async () => {
  const email = `reset-c-${U}@teste.local`;
  await criarConta(email);
  await pedir(email);
  const token = tokenDe(await esperar(() => paraEste(email)[0]));
  const [linhas] = await pool.execute(
    'SELECT pr.token_hash FROM password_resets pr JOIN users u ON u.id = pr.user_id WHERE u.email = ?', [email]);
  assert.equal(linhas.length, 1);
  assert.notEqual(linhas[0].token_hash, token);
  assert.match(linhas[0].token_hash, /^[0-9a-f]{64}$/);
});

test('um novo pedido invalida o link anterior', { skip: pular }, async () => {
  const email = `reset-d-${U}@teste.local`;
  await criarConta(email);
  await pedir(email);
  const primeiro = tokenDe(await esperar(() => paraEste(email)[0]));
  await pedir(email);
  const segundo = tokenDe(await esperar(() => paraEste(email)[1]));
  assert.notEqual(primeiro, segundo);
  assert.equal((await http_('GET', `/auth/redefinir-senha/validar?token=${primeiro}`)).dados.valido, false);
  assert.equal((await http_('GET', `/auth/redefinir-senha/validar?token=${segundo}`)).dados.valido, true);
});

test('link expirado não funciona', { skip: pular }, async () => {
  const email = `reset-e-${U}@teste.local`;
  await criarConta(email);
  await pedir(email);
  const token = tokenDe(await esperar(() => paraEste(email)[0]));
  await pool.execute(
    'UPDATE password_resets pr JOIN users u ON u.id = pr.user_id SET pr.expires_at = NOW() - INTERVAL 1 MINUTE WHERE u.email = ?', [email]);
  assert.equal((await http_('GET', `/auth/redefinir-senha/validar?token=${token}`)).dados.valido, false);
  assert.equal((await http_('POST', '/auth/redefinir-senha', { token, senha: 'senha-nova-123' })).status, 400);
  assert.equal((await http_('POST', '/auth/login', { email, senha: SENHA_ANTIGA })).status, 200, 'a senha não pode ter mudado');
});

test('senha curta é recusada e o link continua valendo', { skip: pular }, async () => {
  const email = `reset-f-${U}@teste.local`;
  await criarConta(email);
  await pedir(email);
  const token = tokenDe(await esperar(() => paraEste(email)[0]));
  assert.equal((await http_('POST', '/auth/redefinir-senha', { token, senha: '123' })).status, 400);
  assert.equal((await http_('GET', `/auth/redefinir-senha/validar?token=${token}`)).dados.valido, true);
  assert.equal((await http_('POST', '/auth/redefinir-senha', { token: 'token-inventado', senha: 'senha-nova-123' })).status, 400);
});

test('limite por e-mail: do 4º pedido em diante nada é enviado, mas a resposta é a mesma', { skip: pular }, async () => {
  const email = `reset-g-${U}@teste.local`;
  await criarConta(email);
  const respostas = [];
  for (let i = 0; i < 5; i++) respostas.push(await pedir(email));
  assert.ok(respostas.every((r) => r.status === 200 && r.dados.message === respostas[0].dados.message));
  assert.ok(await esperar(() => paraEste(email).length >= 3));
  await sleep(600);
  assert.equal(paraEste(email).length, 3, 'só 3 e-mails por hora para o mesmo endereço');
});
