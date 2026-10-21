// frontend/js/redefinir-senha.js
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // Lê o token do endereço e já o tira da barra: não fica no histórico nem pode ser copiado sem querer.
  const token = new URLSearchParams(location.search).get('token') || '';
  history.replaceState(null, '', location.pathname);

  function mostrar(qual) {
    ['estadoCarregando', 'estadoInvalido', 'estadoForm', 'estadoSucesso'].forEach((id) => {
      $(id).style.display = id === qual ? 'block' : 'none';
    });
  }
  function aviso(msg, tipo = 'error') { const el = $('alertBox'); el.className = `alert alert-${tipo} show`; el.textContent = msg; }
  function semAviso() { const el = $('alertBox'); el.className = 'alert'; el.textContent = ''; }
  function carregando(btn, on) {
    btn.disabled = on;
    btn.querySelector('.btn-text').style.opacity = on ? '0' : '1';
    btn.querySelector('.btn-spinner').style.display = on ? 'inline-block' : 'none';
  }

  document.querySelectorAll('.toggle-pass').forEach((btn) => {
    btn.addEventListener('click', () => {
      const inp = btn.previousElementSibling;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      btn.textContent = inp.type === 'password' ? '👁' : '🙈';
    });
  });

  async function iniciar() {
    if (!token) { mostrar('estadoInvalido'); return; }
    try {
      const r = await Api.validarResetToken(token);
      if (r?.ok && r.data.valido) { mostrar('estadoForm'); $('novaSenha').focus(); }
      else mostrar('estadoInvalido');
    } catch { mostrar('estadoInvalido'); aviso('Erro de conexão. Recarregue a página.'); }
  }

  $('btnRedefinir').addEventListener('click', async () => {
    semAviso();
    const senha = $('novaSenha').value;
    if (senha.length < 6) { aviso('A senha deve ter ao menos 6 caracteres.'); return; }
    if (senha !== $('confirmaSenha').value) { aviso('As duas senhas não são iguais.'); return; }
    const btn = $('btnRedefinir');
    carregando(btn, true);
    try {
      const r = await Api.redefinirSenha(token, senha);
      if (r?.ok && r.data.success) { mostrar('estadoSucesso'); return; }
      if (r && r.status === 400 && /link/i.test(r.data.message || '')) { mostrar('estadoInvalido'); return; }
      aviso(r?.data?.message || 'Não foi possível salvar agora.');
    } catch { aviso('Erro de conexão.'); }
    carregando(btn, false);
  });

  ['novaSenha', 'confirmaSenha'].forEach((id) =>
    $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnRedefinir').click(); }));

  iniciar();
})();
