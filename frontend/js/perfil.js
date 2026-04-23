// frontend/js/perfil.js
(function(){
  'use strict';

  const user = VK.user;
  document.getElementById('navUserName').textContent = user.nome;
  if (user.avatar_url) document.getElementById('navAvatar').innerHTML = `<img src="${user.avatar_url}" alt="${user.nome}"/>`;
  if (VK.isMestre) document.getElementById('navAdmin').style.display = 'block';
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('hamburger').classList.toggle('open');
    document.getElementById('navMenu').classList.toggle('open');
  });

  function alertPerfil(msg, tipo = 'error') {
    const el = document.getElementById('alertPerfil');
    el.className = `alert alert-${tipo} show`;
    el.textContent = msg;
    if (tipo === 'success') setTimeout(() => { el.className = 'alert'; }, 3500);
  }

  function escH(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ===== CARREGAR PERFIL =====
  async function carregarPerfil() {
    const res = await Api.perfil();
    if (!res?.ok) return;
    const u = res.data.usuario;

    // Avatar grande
    const ag = document.getElementById('avatarGrande');
    if (u.avatar_url) ag.innerHTML = `<img src="${u.avatar_url}" alt="${escH(u.nome)}"/>`;
    else ag.textContent = '👤';

    document.getElementById('avatarNome').textContent   = u.nome;
    document.getElementById('avatarRole').textContent   = u.role === 'mestre' ? '⚔ Mestre' : '🎲 Jogador';
    const dataEntrada = new Date(u.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
    document.getElementById('avatarMembro').textContent = `Membro desde ${dataEntrada}`;

    // Info
    document.getElementById('infoNome').textContent   = u.nome;
    document.getElementById('infoEmail').textContent  = u.email;
    document.getElementById('infoRole').textContent   = u.role === 'mestre' ? 'Mestre' : 'Jogador';
    document.getElementById('infoMembro').textContent = dataEntrada;

    // Atualiza sessão local com avatar mais recente
    const sessao = Api.getUser();
    if (sessao) { sessao.avatar_url = u.avatar_url; Api.setSession(Api.getToken(), sessao); }
  }

  // ===== UPLOAD DE AVATAR =====
  const dropArea  = document.getElementById('avatarDropArea');
  const fileInput = document.getElementById('avatarFile');
  let arquivoSelecionado = null;

  dropArea.addEventListener('click', () => fileInput.click());

  dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.style.borderColor = 'var(--gold)'; });
  dropArea.addEventListener('dragleave', () => { dropArea.style.borderColor = ''; });
  dropArea.addEventListener('drop', e => {
    e.preventDefault(); dropArea.style.borderColor = '';
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) mostrarPreview(f);
  });

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (f) mostrarPreview(f);
  });

  function mostrarPreview(file) {
    if (file.size > 5 * 1024 * 1024) { alertPerfil('Imagem muito grande. Máximo 5MB.'); return; }
    arquivoSelecionado = file;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('avatarPreview').src = e.target.result;
      document.getElementById('avatarPreviewWrap').style.display = 'block';
      dropArea.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  document.getElementById('btnCancelarAvatar').addEventListener('click', () => {
    arquivoSelecionado = null;
    document.getElementById('avatarPreviewWrap').style.display = 'none';
    dropArea.style.display = 'block';
    fileInput.value = '';
  });

  document.getElementById('btnSalvarAvatar').addEventListener('click', async () => {
    if (!arquivoSelecionado) return;
    const btn = document.getElementById('btnSalvarAvatar');
    btn.disabled = true; btn.textContent = 'Salvando...';
    const fd = new FormData();
    fd.append('avatar', arquivoSelecionado);
    try {
      const res = await Api.atualizarAvatar(fd);
      if (res?.ok) {
        alertPerfil('Foto de perfil atualizada!', 'success');
        // Atualiza avatar na sessão e recarrega
        const sessao = Api.getUser();
        if (sessao) { sessao.avatar_url = res.data.avatar_url; Api.setSession(Api.getToken(), sessao); }
        carregarPerfil();
        document.getElementById('avatarPreviewWrap').style.display = 'none';
        dropArea.style.display = 'block';
        arquivoSelecionado = null;
        // Atualiza avatar da navbar
        const navAv = document.getElementById('navAvatar');
        if (navAv) navAv.innerHTML = `<img src="${res.data.avatar_url}" alt="${user.nome}"/>`;
      } else {
        alertPerfil(res?.data?.message || 'Erro ao salvar.');
      }
    } catch { alertPerfil('Erro de conexão.'); }
    finally { btn.disabled = false; btn.textContent = 'Salvar Foto'; }
  });

  // ===== FICHAS =====
  async function carregarFichas() {
    const res = await Api.listarFichas();
    const container = document.getElementById('perfilFichas');
    if (!res?.ok || !res.data.fichas.length) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;">Nenhuma ficha criada.</div>';
      return;
    }
    container.innerHTML = res.data.fichas.map(f => {
      const av = f.imagem_url ? `<img src="${f.imagem_url}" alt="${escH(f.nome_personagem)}"/>` : '⚔';
      return `<a href="/forja?id=${f.id}" class="perfil-ficha-item">
        <div class="perfil-ficha-avatar">${av}</div>
        <div>
          <div class="perfil-ficha-nome">${escH(f.nome_personagem)}</div>
          <div class="perfil-ficha-sistema">${escH(f.sistema)}</div>
        </div>
      </a>`;
    }).join('');
  }

  // ===== ATIVIDADES RECENTES =====
  async function carregarAtividades() {
    const res = await Api.listarAtividades({ usuario_id: user.id, limite: 10 });
    const container = document.getElementById('perfilAtividades');
    if (!res?.ok || !res.data.atividades.length) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;">Nenhuma atividade registrada.</div>';
      return;
    }
    container.innerHTML = res.data.atividades.map(a => {
      const hora = new Date(a.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      let desc = '';
      if (a.valor_novo === 'Ficha criada')   desc = `Criou "${escH(a.personagem_nome)}"`;
      else if (a.valor_novo === 'Ficha salva') desc = `Salvou "${escH(a.personagem_nome)}"`;
      else desc = `${escH(a.campo)}: ${escH(a.valor_anterior)} → ${escH(a.valor_novo)} em "${escH(a.personagem_nome)}"`;
      return `<div class="perfil-atv-item">
        <span class="perfil-atv-hora">${hora}</span>
        <div class="perfil-atv-diff">${desc}</div>
      </div>`;
    }).join('');
  }

  // INIT
  carregarPerfil();
  carregarFichas();
  carregarAtividades();
})();
