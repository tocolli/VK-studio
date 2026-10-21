// backend/src/utils/mailer.js
// Envio de e-mail por API HTTPS (Brevo ou Resend).
//
// Por que não SMTP? O plano gratuito do Render bloqueia as portas SMTP (25, 465 e 587) desde
// setembro de 2025; uma API HTTPS funciona em qualquer plano e não exige nenhuma biblioteca extra.
//
// Variáveis de ambiente:
//   EMAIL_PROVIDER  brevo | resend            (sem isso, em desenvolvimento o e-mail só é escrito no console)
//   EMAIL_API_KEY   chave de API do provedor
//   EMAIL_FROM      remetente, ex.: VK.Studio <contato@seudominio.com>  (precisa estar verificado no provedor)
//   EMAIL_API_URL   (opcional) troca o endereço da API; usado nos testes automáticos

const PROVEDORES = {
  brevo: {
    url: 'https://api.brevo.com/v3/smtp/email',
    cabecalhos: (chave) => ({ 'api-key': chave, accept: 'application/json' }),
    // A Brevo aceita só UM tipo de corpo por envio: mandamos o HTML.
    corpo: ({ de, para, assunto, html }) => ({
      sender: { name: de.nome || undefined, email: de.email },
      to: [{ email: para }],
      subject: assunto,
      htmlContent: html,
    }),
  },
  resend: {
    url: 'https://api.resend.com/emails',
    cabecalhos: (chave) => ({ Authorization: `Bearer ${chave}` }),
    corpo: ({ de, para, assunto, html, texto }) => ({
      from: de.nome ? `${de.nome} <${de.email}>` : de.email,
      to: [para],
      subject: assunto,
      html,
      text: texto,
    }),
  },
};

/** "VK.Studio <a@b.com>" -> { nome: 'VK.Studio', email: 'a@b.com' } */
function lerRemetente(bruto) {
  const m = String(bruto || '').match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { nome: (m[1] || '').trim(), email: m[2].trim() };
  return { nome: '', email: String(bruto || '').trim() };
}

function configurado() {
  return !!(PROVEDORES[process.env.EMAIL_PROVIDER] && process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Envia um e-mail. NUNCA lança erro: devolve true/false, para que a falha de e-mail não derrube a rota.
 * Não escreve a chave de API nem o corpo do e-mail nos logs de produção.
 */
async function enviarEmail({ para, assunto, html, texto }) {
  if (!configurado()) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[mailer] E-mail NÃO enviado: configure EMAIL_PROVIDER, EMAIL_API_KEY e EMAIL_FROM.');
      return false;
    }
    // Desenvolvimento: mostra o e-mail no console para você copiar o link
    console.log(`\n[mailer:dev] Para: ${para}\nAssunto: ${assunto}\n${texto}\n`);
    return true;
  }

  const prov = PROVEDORES[process.env.EMAIL_PROVIDER];
  const de = lerRemetente(process.env.EMAIL_FROM);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const resp = await fetch(process.env.EMAIL_API_URL || prov.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...prov.cabecalhos(process.env.EMAIL_API_KEY) },
      body: JSON.stringify(prov.corpo({ de, para, assunto, html, texto })),
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      // O corpo da resposta explica o motivo (ex.: remetente não verificado). Não contém segredos.
      const detalhe = (await resp.text().catch(() => '')).slice(0, 300);
      console.error(`[mailer] ${process.env.EMAIL_PROVIDER} recusou o envio (HTTP ${resp.status}): ${detalhe}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[mailer] falha ao chamar ${process.env.EMAIL_PROVIDER}: ${err.name === 'AbortError' ? 'tempo esgotado' : err.message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { enviarEmail, lerRemetente, configurado };
