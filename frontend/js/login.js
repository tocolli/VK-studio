// frontend/js/login.js
(function () {
  'use strict';

  if (Api.getToken() && Api.getUser()) {
    window.location.replace('/dashboard');
    return;
  }

  const WORLDS = {
    decadencia: {
      title:    'Decadência Cinza',
      lore:     '"O mundo é meu."',
      divider:  '✦ ✦ ✦',
      subtitle: 'versão 0.1',
      footer:   'Decadência Cinza',
      sigil:    '☀',
    },
    oceano: {
      title:    'Oceano Estrelado',
      lore:     '"Pexe."',
      divider:  '✧ ✧ ✧',
      subtitle: 'Todos os direitos reservados',
      footer:   'Oceano Estrelado',
      sigil:    '☽',
    },
    cavaleiros: {
      title:    'Cavaleiros de Armadura',
      lore:     '"Por Valtharia."',
      divider:  '✠ ✠ ✠',
      subtitle: 'Um criação de Vitor Tocolli',
      footer:   'Cavaleiros de Armadura',
      sigil:    '☠',
    },
  };

  let currentWorld = 'decadencia';

  function setWorld(world) {
    if (world === currentWorld) return;
    currentWorld = world;
    const d = WORLDS[world];

    document.body.dataset.theme = world;

    // Anima saída e entrada do texto de lore
    const block = document.querySelector('.art-lore-block');
    block.style.opacity = '0';
    block.style.transform = 'translateY(8px)';
    setTimeout(() => {
      document.getElementById('artTitle').textContent   = d.title;
      document.getElementById('artLore').textContent    = d.lore;
      document.getElementById('artDivider').textContent = d.divider;
      block.style.transition = 'opacity .35s ease, transform .35s ease';
      block.style.opacity = '1';
      block.style.transform = 'translateY(0)';
    }, 180);

    document.getElementById('loginSubtitle').textContent  = d.subtitle;
    document.getElementById('footerWorld').textContent    = d.footer;

    // Atualiza sigil no círculo
    const sigilEl = document.getElementById('sigilSvg');
    sigilEl.querySelector('text').textContent = d.sigil;

    document.querySelectorAll('.world-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.world === world);
    });
  }

  // Init transição do bloco de lore
  const block = document.querySelector('.art-lore-block');
  block.style.transition = 'opacity .35s ease, transform .35s ease';

  document.querySelectorAll('.world-btn').forEach(btn => {
    btn.addEventListener('click', () => setWorld(btn.dataset.world));
  });

  // TABS
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tabLogin').style.display    = btn.dataset.tab === 'login'    ? 'block' : 'none';
      document.getElementById('tabRegister').style.display = btn.dataset.tab === 'register' ? 'block' : 'none';
      hideAlert();
    });
  });

  // TOGGLE SENHA
  document.querySelectorAll('.toggle-pass').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = btn.previousElementSibling;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      btn.textContent = inp.type === 'password' ? '👁' : '🙈';
    });
  });

  // UTILS
  function showAlert(msg, tipo = 'error') {
    const el = document.getElementById('alertBox');
    el.className = `alert alert-${tipo} show`;
    el.textContent = msg;
  }
  function hideAlert() {
    const el = document.getElementById('alertBox');
    el.className = 'alert'; el.textContent = '';
  }
  function setLoading(btn, on) {
    const t = btn.querySelector('.btn-text');
    const s = btn.querySelector('.btn-spinner');
    btn.disabled = on;
    if (t) t.style.opacity = on ? '0' : '1';
    if (s) s.style.display = on ? 'inline-block' : 'none';
  }

  // ENTER
  document.getElementById('loginSenha').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('btnLogin').click(); });
  document.getElementById('regSenha').addEventListener('keydown',   e => { if (e.key==='Enter') document.getElementById('btnRegistrar').click(); });

  // LOGIN
  document.getElementById('btnLogin').addEventListener('click', async () => {
    hideAlert();
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    if (!email || !senha) { showAlert('Preencha todos os campos.'); return; }
    const btn = document.getElementById('btnLogin');
    setLoading(btn, true);
    try {
      const res = await Api.login(email, senha);
      if (!res) return;
      if (res.ok && res.data.success) {
        Api.setSession(res.data.token, res.data.usuario);
        showAlert('Bem-vindo, ' + res.data.usuario.nome + '!', 'success');
        setTimeout(() => window.location.replace('/dashboard'), 700);
      } else {
        showAlert(res.data.message || 'Credenciais inválidas.');
        setLoading(btn, false);
      }
    } catch { showAlert('Erro de conexão.'); setLoading(btn, false); }
  });

  // REGISTRO
  document.getElementById('btnRegistrar').addEventListener('click', async () => {
    hideAlert();
    const nome  = document.getElementById('regNome').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const senha = document.getElementById('regSenha').value;
    if (!nome || !email || !senha) { showAlert('Preencha todos os campos.'); return; }
    if (senha.length < 6) { showAlert('Senha deve ter ao menos 6 caracteres.'); return; }
    const btn = document.getElementById('btnRegistrar');
    setLoading(btn, true);
    try {
      const res = await Api.registrar(nome, email, senha);
      if (!res) return;
      if (res.ok && res.data.success) {
        Api.setSession(res.data.token, res.data.usuario);
        showAlert('Conta criada! Entrando...', 'success');
        setTimeout(() => window.location.replace('/dashboard'), 700);
      } else {
        showAlert(res.data.message || 'Erro ao registrar.');
        setLoading(btn, false);
      }
    } catch { showAlert('Erro de conexão.'); setLoading(btn, false); }
  });
})();
