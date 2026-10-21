# Recuperação de senha por e-mail

Na tela de login há o link **Esqueci minha senha**. A pessoa informa o e-mail da conta, recebe um link válido por **1 hora** (uso único) e cria uma nova senha em `/redefinir-senha`. Depois da troca, chega outro e-mail avisando que a senha foi alterada.

## Configurar o envio de e-mail (uma vez)

O site envia e-mail por **API HTTPS**, não por SMTP: o plano gratuito do Render bloqueia as portas de SMTP (25, 465 e 587), então Gmail/SMTP não funcionaria lá. Há dois provedores prontos: **Brevo** e **Resend**.

### Opção recomendada: Brevo (não exige domínio próprio)

1. Crie uma conta em https://www.brevo.com (o plano gratuito inclui e-mails transacionais; o limite diário informado no site deles é de 300 e-mails, e os e-mails do plano gratuito podem levar a marca da Brevo).
2. Cadastre e **valide um remetente** (um e-mail seu, que você consiga abrir para confirmar). A Brevo só envia a partir de remetente validado.
3. Crie uma **chave de API** na área de SMTP e API da sua conta.
4. No painel do Render, em **Environment** do serviço do site, adicione:

| Variável | Valor |
| --- | --- |
| `EMAIL_PROVIDER` | `brevo` |
| `EMAIL_API_KEY` | a chave de API criada no passo 3 |
| `EMAIL_FROM` | `VK.Studio <o-email-validado-no-passo-2>` |
| `APP_URL` | o endereço do site, ex.: `https://seusite.onrender.com` (sem barra no final) |

5. Salve (o Render reinicia o serviço) e teste pedindo a recuperação com uma conta real.

### Alternativa: Resend

Use `EMAIL_PROVIDER=resend` e as mesmas variáveis. Em geral o Resend só entrega a qualquer destinatário depois de você **verificar um domínio seu**; confira as regras atuais na documentação deles antes de escolher.

> `APP_URL` é obrigatória em produção: é com ela que o link do e-mail é montado. Ela existe de propósito para o endereço nunca vir de um cabeçalho da requisição, que poderia ser forjado.

## Como testar no seu computador

Sem `EMAIL_PROVIDER`, fora de produção o e-mail **não é enviado**: o texto dele (com o link) aparece no console onde o servidor está rodando. Basta copiar o link.

## Segurança (o que foi feito)

- O link tem um token aleatório de 256 bits. No banco fica só o **hash** dele, então quem ler o banco não consegue usá-lo.
- Vale 60 minutos e **uma vez só**. Pedir um novo link invalida o anterior.
- "Esqueci a senha" dá **sempre a mesma resposta**, exista ou não o e-mail, para ninguém descobrir quem tem conta.
- Limites: 3 pedidos por hora para o mesmo e-mail (acima disso o pedido é ignorado em silêncio) e 60 por hora no site todo, para não gastar o limite do provedor nem encher a caixa de alguém. Os limites ficam na memória do servidor e zeram quando ele reinicia.
- A página de redefinição não deixa o navegador repassar o endereço a terceiros e remove o token da barra de endereço assim que abre.
- A senha continua com o mesmo requisito do cadastro (mínimo de 6 caracteres) e é guardada com bcrypt, como antes.

## Limitações conhecidas

- **Sessões já abertas não são derrubadas.** O login usa um token de 7 dias; quem já estava logado continua logado em outros aparelhos até ele vencer, mesmo depois de trocar a senha.
- Se a pessoa cadastrou um e-mail errado, não há como recuperar por aqui: o mestre precisaria corrigir direto no banco.
- O e-mail pode cair no **spam** na primeira vez, principalmente com remetente de e-mail pessoal. O aviso na tela já pede para conferir a caixa de spam.

## Testes

Os testes de integração (`backend/test/auth.reset.test.js`) rodam o fluxo completo contra um banco **local** de teste, com um servidor falso no lugar da Brevo (nenhum e-mail real sai). Veja `docs/WIKI.md` para o comando.
