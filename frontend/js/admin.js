// frontend/js/admin.js
(function(){
  'use strict';

  const user = VK.user;
  if (!VK.isMestre) { window.location.replace('/dashboard'); throw new Error('NO_ADM'); }

  document.getElementById('navUserName').textContent = user.nome;
  if (user.avatar_url) document.getElementById('navAvatar').innerHTML = `<img src="${user.avatar_url}" alt="${user.nome}"/>`;
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('hamburger').classList.toggle('open');
    document.getElementById('navMenu').classList.toggle('open');
  });

  let paginaAtual = 1;
  const LIMITE = 30;
  let filtroUsuario = '';
  let filtroCampo   = '';
  let usuariosMap   = {};

  // ===== STATS =====
  async function carregarStats() {
    const res = await Api.estatisticas();
    if (!res?.ok) return;
    const s = res.data.stats;
    document.getElementById('stUsers').textContent   = s.totalUsers;
    document.getElementById('stFichas').textContent  = s.totalFichas;
    document.getElementById('stAtivHoje').textContent= s.atividadesHoje;
    document.getElementById('stAtivos7d').textContent= s.jogadoresAtivos7d;
  }

  // ===== USUÁRIOS =====
  async function carregarUsuarios() {
    const res = await Api.listarUsuarios();
    if (!res?.ok) return;
    const usuarios = res.data.usuarios;

    // Preenche mapa id→usuario
    usuarios.forEach(u => { usuariosMap[u.id] = u; });

    // Preenche filtro
    const sel = document.getElementById('filtroUsuario');
    usuarios.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id; opt.textContent = u.nome + (u.role === 'mestre' ? ' (Mestre)' : '');
      sel.appendChild(opt);
    });

    // Tabela
    const tbody = usuarios.map(u => {
      const av = u.avatar_url
        ? `<span class="user-mini-avatar"><img src="${u.avatar_url}" alt="${escH(u.nome)}"/></span>`
        : `<span class="user-mini-avatar">👤</span>`;
      const data = new Date(u.created_at).toLocaleDateString('pt-BR');
      return `<tr>
        <td>${av}${escH(u.nome)}</td>
        <td style="color:var(--text-secondary);font-size:.85rem;">${escH(u.email)}</td>
        <td><span class="role-badge ${u.role}">${u.role}</span></td>
        <td style="color:var(--text-muted);font-size:.82rem;">${data}</td>
      </tr>`;
    }).join('');

    document.getElementById('tabelaUsuarios').innerHTML = `
      <table class="usuarios-table">
        <thead>
          <tr>
            <th>Nome</th><th>E-mail</th><th>Função</th><th>Membro desde</th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>`;
  }

  // ===== ATIVIDADES =====
  async function carregarAtividades(pagina = 1) {
    paginaAtual = pagina;
    const container = document.getElementById('feedAtividades');
    container.innerHTML = '<div class="empty-feed">Carregando atividades...</div>';

    const params = { limite: LIMITE, pagina };
    if (filtroUsuario) params.usuario_id = filtroUsuario;

    const res = await Api.listarAtividades(params);
    if (!res?.ok) { container.innerHTML = '<div class="empty-feed">Erro ao carregar.</div>'; return; }

    let { atividades, total } = res.data;

    // Filtro de campo no cliente (simples)
    if (filtroCampo) atividades = atividades.filter(a => a.campo === filtroCampo);

    document.getElementById('totalAtividades').textContent = `${total} registro${total !== 1 ? 's' : ''}`;

    if (!atividades.length) {
      container.innerHTML = '<div class="empty-feed">Nenhuma atividade encontrada.</div>';
      document.getElementById('paginacao').style.display = 'none';
      return;
    }

    container.innerHTML = atividades.map(a => renderAtividade(a)).join('');

    // Paginação
    const totalPaginas = Math.ceil(total / LIMITE);
    if (totalPaginas > 1) {
      document.getElementById('paginacao').style.display = 'flex';
      document.getElementById('paginaInfo').textContent = `Página ${pagina} de ${totalPaginas}`;
      document.getElementById('btnAnterior').disabled = pagina <= 1;
      document.getElementById('btnProxima').disabled  = pagina >= totalPaginas;
    } else {
      document.getElementById('paginacao').style.display = 'none';
    }
  }

  function renderAtividade(a) {
    const hora = new Date(a.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    const u = usuariosMap[a.usuario_id];
    const av = (u?.avatar_url || a.usuario_avatar)
      ? `<img src="${u?.avatar_url || a.usuario_avatar}" alt="${escH(a.usuario_nome)}"/>`
      : '👤';

    // Tipo de campo para coloração
    const tipoClass = ['vida','sanidade','estamina'].includes(a.campo) ? `tipo-${a.campo}`
                    : a.campo === 'ficha' ? 'tipo-ficha' : 'tipo-status';

    // Diff visual: só mostra se houver mudança real
    let diffHtml = '';
    if (a.valor_anterior !== '—' && a.valor_novo !== 'Ficha criada' && a.valor_novo !== 'Ficha salva' && a.valor_novo !== 'Arquivada') {
      diffHtml = `
        <div class="ativ-diff">
          <span class="val-ant">${escH(a.valor_anterior)}</span>
          <span class="seta">→</span>
          <span class="val-nov">${escH(a.valor_novo)}</span>
        </div>`;
    }

    // Frase natural
    let frase = '';
    if (a.valor_novo === 'Ficha criada')   frase = `criou a ficha`;
    else if (a.valor_novo === 'Arquivada') frase = `arquivou a ficha`;
    else if (a.valor_novo === 'Ficha salva') frase = `salvou alterações na ficha`;
    else frase = `alterou <span class="campo">${escH(a.campo)}</span> da ficha`;

    return `
      <div class="atividade-item ${tipoClass}">
        <div class="ativ-avatar">${av}</div>
        <div class="ativ-corpo">
          <div class="ativ-titulo">
            <strong>${escH(a.usuario_nome)}</strong> ${frase}
            <span class="ativ-personagem" style="font-family:var(--font-body);font-style:italic;color:var(--gold-dim);margin-left:.3rem;">"${escH(a.personagem_nome)}"</span>
          </div>
          ${diffHtml}
          <div class="ativ-meta">${hora}</div>
        </div>
      </div>`;
  }

  // ===== FILTROS =====
  document.getElementById('btnFiltrar').addEventListener('click', () => {
    filtroUsuario = document.getElementById('filtroUsuario').value;
    filtroCampo   = document.getElementById('filtroCampo').value;
    carregarAtividades(1);
  });

  document.getElementById('btnAnterior').addEventListener('click', () => carregarAtividades(paginaAtual - 1));
  document.getElementById('btnProxima').addEventListener('click',  () => carregarAtividades(paginaAtual + 1));
  document.getElementById('btnRefresh').addEventListener('click',  () => { carregarStats(); carregarAtividades(paginaAtual); });

  function escH(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // INIT
  carregarStats();
  carregarUsuarios().then(() => carregarAtividades(1));
})();
