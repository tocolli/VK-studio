// backend/src/controllers/passwordResetController.js
// Recuperação de senha por e-mail.
//
// Segurança (resumo):
//  - o token é aleatório (256 bits) e só o HASH dele fica no banco: quem ler o banco não consegue usá-lo;
//  - vale por 60 minutos e uma única vez; pedir um novo link invalida o anterior;
//  - "esqueci a senha" responde SEMPRE a mesma coisa, exista o e-mail ou não (não revela quem tem conta),
//    e responde antes de consultar o banco/enviar, para o tempo de resposta também não revelar;
//  - limite de pedidos por e-mail (3/hora, em silêncio) e global (60/hora), contra spam de e-mails;
//  - o link usa APP_URL (nunca o cabeçalho Host da requisição, que poderia ser forjado);
//  - avisa por e-mail quando a senha é trocada.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { enviarEmail } = require('../utils/mailer');
const { criarLimitador } = require('../utils/rateLimit');

const VALIDADE_MIN = 60;
const HORA = 60 * 60 * 1000;
const MSG_PEDIDO = 'Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha. Ele vale por 1 hora. Confira também a caixa de spam.';

const limitePorEmail = criarLimitador({ max: 3, janelaMs: HORA });
const limiteGlobal = criarLimitador({ max: 60, janelaMs: HORA });

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function urlBase() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') return null;
  return `http://localhost:${process.env.PORT || 10000}`;
}

function emailDeRedefinicao(nome, link) {
  const assunto = 'VK.Studio — redefinir sua senha';
  const texto = `Olá, ${nome}!\n\nRecebemos um pedido para redefinir a senha da sua conta no VK.Studio.\nAbra o link abaixo (vale por ${VALIDADE_MIN} minutos e só funciona uma vez):\n\n${link}\n\nSe não foi você, ignore este e-mail: a sua senha continua a mesma.`;
  const html = `<div style="font-family:Georgia,serif;max-width:480px;margin:auto;padding:24px;background:#141416;color:#d4cfc4;border:1px solid #4a3f2a">
  <h2 style="color:#c9a84c;margin-top:0">VK.Studio</h2>
  <p>Olá, ${esc(nome)}!</p>
  <p>Recebemos um pedido para redefinir a senha da sua conta. O link vale por ${VALIDADE_MIN} minutos e só funciona uma vez.</p>
  <p style="text-align:center;margin:28px 0"><a href="${esc(link)}" style="background:#c9a84c;color:#141416;padding:12px 22px;text-decoration:none;font-weight:bold;border-radius:4px">Redefinir minha senha</a></p>
  <p style="font-size:13px;color:#8a8478">Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all">${esc(link)}</span></p>
  <p style="font-size:13px;color:#8a8478">Se não foi você, ignore este e-mail: a sua senha continua a mesma.</p>
</div>`;
  return { assunto, html, texto };
}

function emailSenhaAlterada(nome) {
  const assunto = 'VK.Studio — sua senha foi alterada';
  const texto = `Olá, ${nome}!\n\nA senha da sua conta no VK.Studio acabou de ser alterada.\nSe foi você, está tudo certo. Se não foi, peça um novo link de recuperação na tela de login e avise o mestre.`;
  const html = `<div style="font-family:Georgia,serif;max-width:480px;margin:auto;padding:24px;background:#141416;color:#d4cfc4;border:1px solid #4a3f2a">
  <h2 style="color:#c9a84c;margin-top:0">VK.Studio</h2>
  <p>Olá, ${esc(nome)}!</p>
  <p>A senha da sua conta acabou de ser alterada. Se foi você, está tudo certo.</p>
  <p>Se <strong>não</strong> foi você, peça um novo link de recuperação na tela de login e avise o mestre.</p>
</div>`;
  return { assunto, html, texto };
}

/** POST /api/auth/esqueci-senha  { email } */
async function esqueciSenha(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Informe um e-mail válido.' });
  }
  if (!limiteGlobal.permitir('global')) {
    return res.status(429).json({ success: false, message: 'Muitos pedidos agora. Tente de novo em alguns minutos.' });
  }

  // Responde já, igual para qualquer e-mail; o trabalho real continua em segundo plano.
  res.json({ success: true, message: MSG_PEDIDO });

  try {
    if (!limitePorEmail.permitir(email)) return; // passou do limite: ignora em silêncio (mesma resposta)
    const [rows] = await pool.execute('SELECT id, nome FROM users WHERE email = ?', [email]);
    if (!rows.length) return;
    const usuario = rows[0];

    const base = urlBase();
    if (!base) { console.error('[reset] Defina APP_URL (ex.: https://seusite.onrender.com) para enviar links de recuperação.'); return; }

    const token = crypto.randomBytes(32).toString('base64url');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM password_resets WHERE user_id = ?', [usuario.id]); // o link anterior deixa de valer
      await conn.execute(
        `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${VALIDADE_MIN} MINUTE))`,
        [usuario.id, sha256(token)]);
      await conn.commit();
    } catch (err) { await conn.rollback().catch(() => {}); throw err; } finally { conn.release(); }

    const msg = emailDeRedefinicao(usuario.nome, `${base}/redefinir-senha?token=${token}`);
    await enviarEmail({ para: email, ...msg });
  } catch (err) {
    console.error('Erro ao processar esqueci-senha:', err.message);
  }
}

/** GET /api/auth/redefinir-senha/validar?token=...  -> { valido } (para a página avisar antes de digitar) */
async function validarToken(req, res) {
  try {
    const token = String(req.query.token || '');
    if (!token || token.length > 200) return res.json({ success: true, valido: false });
    const [rows] = await pool.execute(
      'SELECT id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()', [sha256(token)]);
    return res.json({ success: true, valido: rows.length > 0 });
  } catch (err) {
    console.error('Erro ao validar token:', err.message);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

/** POST /api/auth/redefinir-senha  { token, senha } */
async function redefinirSenha(req, res) {
  const token = String(req.body?.token || '');
  const senha = String(req.body?.senha || '');
  if (!token || token.length > 200) return res.status(400).json({ success: false, message: 'Link inválido ou expirado. Peça um novo.' });
  if (senha.length < 6) return res.status(400).json({ success: false, message: 'Senha deve ter no mínimo 6 caracteres.' });
  if (senha.length > 200) return res.status(400).json({ success: false, message: 'Senha muito longa.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT id, user_id FROM password_resets
        WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE`, [sha256(token)]);
    if (!rows.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Link inválido ou expirado. Peça um novo.' });
    }
    const { id, user_id } = rows[0];
    const hash = await bcrypt.hash(senha, 12); // só chega aqui com token válido: tokens falsos não gastam CPU
    await conn.execute('UPDATE users SET senha = ? WHERE id = ?', [hash, user_id]);
    await conn.execute('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [id]);
    await conn.execute('DELETE FROM password_resets WHERE user_id = ? AND id <> ?', [user_id, id]);
    await conn.commit();

    // Aviso por e-mail (em segundo plano; se falhar, a troca já foi feita)
    pool.execute('SELECT nome, email FROM users WHERE id = ?', [user_id])
      .then(([u]) => u.length && enviarEmail({ para: u[0].email, ...emailSenhaAlterada(u[0].nome) }))
      .catch((err) => console.error('Erro ao avisar troca de senha:', err.message));

    return res.json({ success: true, message: 'Senha alterada! Entre com a nova senha.' });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Erro ao redefinir senha:', err.message);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  } finally { conn.release(); }
}

module.exports = { esqueciSenha, validarToken, redefinirSenha };
