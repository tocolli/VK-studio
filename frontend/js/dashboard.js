// frontend/js/dashboard.js
(function () {
  'use strict';

  const user = VK.user;
  const isMestre = VK.isMestre;

  // UI básica
  document.getElementById('navUserName').textContent = user.nome;
  if (isMestre && document.getElementById('navAdmin')) document.getElementById('navAdmin').style.display = 'block';
  if (user.avatar_url) document.getElementById('navAvatar').innerHTML = `<img src="${user.avatar_url}" alt="${user.nome}" />`;
  if (isMestre) {
    document.getElementById('mestreBtns').style.display = 'flex';
    document.getElementById('statsRow').style.display = 'grid';
    document.getElementById('pageTitle').textContent = 'A Câmara do Mestre';
  } else {
    document.getElementById('pageTitle').textContent = `Bem-vindo, ${user.nome}`;
  }

  // Hamburger
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('hamburger').classList.toggle('open');
    document.getElementById('navMenu').classList.toggle('open');
  });

  // ===== ESTADO =====
  let sistemaAtual   = 'Decadência Cinza';
  let categoriaAtual = null;
  let docsCache      = [];
  let docEditandoId  = null;

  // ===== TABS PRINCIPAIS =====
  document.querySelectorAll('.section-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.section-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.dataset.stab;
      document.getElementById('stabDocumentos').style.display = t === 'documentos' ? 'block' : 'none';
      document.getElementById('stabFichas').style.display     = t === 'fichas'     ? 'block' : 'none';
      if (t === 'fichas') carregarFichas();
    });
  });

  // ===== FORM DOCUMENTO =====
  const selSistema  = document.getElementById('docSistema');
  const selCategoria = document.getElementById('docCategoria');

  function popularCategorias(sistema) {
    const cats = (SISTEMAS[sistema] || SISTEMAS['Decadência Cinza']).categorias;
    selCategoria.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  selSistema.addEventListener('change', () => popularCategorias(selSistema.value));
  popularCategorias('Decadência Cinza');

  document.getElementById('btnNovoDoc')?.addEventListener('click', () => {
    docEditandoId = null;
    document.getElementById('docTitulo').value   = '';
    document.getElementById('docConteudo').value = '';
    document.getElementById('docTags').value     = '';
    selSistema.value = sistemaAtual;
    popularCategorias(sistemaAtual);
    document.getElementById('formCriarDoc').classList.add('open');
    document.getElementById('formCriarDoc').scrollIntoView({ behavior: 'smooth' });
  });

  window.fecharFormDoc = () => {
    document.getElementById('formCriarDoc').classList.remove('open');
    docEditandoId = null;
  };

  function alertDoc(msg, tipo = 'error') {
    const el = document.getElementById('alertDoc');
    el.className = `alert alert-${tipo} show`;
    el.textContent = msg;
  }

  document.getElementById('btnSalvarDoc')?.addEventListener('click', async () => {
    const titulo      = document.getElementById('docTitulo').value.trim();
    const conteudo    = document.getElementById('docConteudo').value.trim();
    const sistema     = selSistema.value;
    const categoria   = selCategoria.value;
    const visibilidade = document.getElementById('docVisibilidade').value;
    const tags        = document.getElementById('docTags')?.value.trim() || '';
    const imagemFile  = document.getElementById('docImagem').files[0];
    if (!titulo) { alertDoc('Título obrigatório.'); return; }

    const fd = new FormData();
    fd.append('titulo',      titulo);
    fd.append('conteudo',    conteudo);
    fd.append('sistema',     sistema);
    fd.append('categoria',   categoria);
    fd.append('visibilidade',visibilidade);
    fd.append('tags',        tags);
    if (imagemFile) fd.append('imagem', imagemFile);

    const btn = document.getElementById('btnSalvarDoc');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      const res = docEditandoId
        ? await Api.atualizarDocumento(docEditandoId, fd)
        : await Api.criarDocumento(fd);
      if (res?.ok) {
        alertDoc('Documento salvo!', 'success');
        fecharFormDoc();
        if (categoriaAtual === categoria && sistemaAtual === sistema) carregarDocumentos(sistema, categoria);
        if (isMestre) atualizarStatDocs();
      } else {
        alertDoc(res?.data?.message || 'Erro ao salvar.');
      }
    } catch { alertDoc('Erro de conexão.'); }
    finally { btn.disabled = false; btn.textContent = 'Salvar Documento'; }
  });

  // ===== UTILS DE TAGS =====
  function getTagClass(tag) {
    const t = tag.replace('#','').toUpperCase();
    if (t.startsWith('X')) return 'tag-x';
    if (t.startsWith('S')) return 'tag-s';
    if (t.startsWith('A')) return 'tag-a';
    if (t.startsWith('B')) return 'tag-b';
    if (t.startsWith('C')) return 'tag-c';
    if (t.startsWith('D')) return 'tag-d';
    return 'tag-default';
  }

  function renderTagsHtml(tagsStr) {
    if (!tagsStr) return '';
    const tags = tagsStr.split(/\s+/).filter(t => t.startsWith('#') && t.length > 1);
    if (!tags.length) return '';
    return `<div class="doc-tags-wrap">${
      tags.map(t => `<span class="doc-tag ${getTagClass(t)}" data-tag="${escH(t)}">${escH(t)}</span>`).join('')
    }</div>`;
  }

  function bindTagClicks(container, callback) {
    container.querySelectorAll('.doc-tag').forEach(el => {
      el.addEventListener('click', e => { e.stopPropagation(); callback(el.dataset.tag); });
    });
  }

  // ===== BUSCA =====
  let buscaAtiva = '';

  function mostrarBusca() {
    document.getElementById('buscaRow').style.display = 'flex';
  }

  function esconderBusca() {
    document.getElementById('buscaRow').style.display = 'none';
    document.getElementById('buscaInput').value = '';
    document.getElementById('btnLimparBusca').style.display = 'none';
    document.getElementById('tagsSugeridas').innerHTML = '';
    buscaAtiva = '';
  }

  function popularTagsSugeridas(docs) {
    const todasTags = new Set();
    docs.forEach(d => {
      if (d.tags) d.tags.split(/\s+/).filter(t => t.startsWith('#')).forEach(t => todasTags.add(t));
    });
    const container = document.getElementById('tagsSugeridas');
    container.innerHTML = [...todasTags].map(t =>
      `<button class="tag-pill" data-tag="${escH(t)}" type="button">${escH(t)}</button>`
    ).join('');
    container.querySelectorAll('.tag-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tag-pill').forEach(b => b.classList.remove('ativa'));
        btn.classList.add('ativa');
        executarBusca(btn.dataset.tag);
      });
    });
  }

  async function executarBusca(termo) {
    buscaAtiva = termo || document.getElementById('buscaInput').value.trim();
    if (!buscaAtiva) return;

    document.getElementById('buscaInput').value = buscaAtiva;
    document.getElementById('btnLimparBusca').style.display = 'block';

    const grid      = document.getElementById('categoriaGrid');
    const listHeader = document.getElementById('docListHeader');
    const listDocs  = document.getElementById('listaDocumentos');

    grid.style.display      = 'none';
    listHeader.style.display = 'flex';
    listDocs.style.display   = 'grid';

    document.getElementById('docListTitle').innerHTML =
      `🔍 "<em style="color:var(--gold)">${escH(buscaAtiva)}</em>" · ${sistemaAtual}`;

    listDocs.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="spinner" style="margin:0 auto;"></div></div>`;

   const isTag = buscaAtiva.startsWith('#');
    const params = {};
    if (isTag) params.tag   = buscaAtiva;
    else       params.busca = buscaAtiva;

    try {
      const res = await Api.request(`/documentos?${new URLSearchParams(params)}`);
      if (!res?.ok) { listDocs.innerHTML = renderEmpty('⚠','Erro na busca.'); return; }
      docsCache = res.data.documentos;
      if (!docsCache.length) {
        listDocs.innerHTML = renderEmpty('📜', `Nenhum resultado para "${buscaAtiva}".`);
        return;
      }
      listDocs.innerHTML = docsCache.map(renderDocCard).join('');
      bindListeners(listDocs);
    } catch { listDocs.innerHTML = renderEmpty('⚠','Erro de conexão.'); }
  }

  document.getElementById('buscaInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') executarBusca();
  });
  document.getElementById('buscaInput').addEventListener('input', () => {
    document.getElementById('btnLimparBusca').style.display =
      document.getElementById('buscaInput').value ? 'block' : 'none';
  });
  document.getElementById('btnLimparBusca').addEventListener('click', () => {
    esconderBusca();
    if (categoriaAtual) carregarDocumentos(sistemaAtual, categoriaAtual);
    else mostrarCategoriasGrid(sistemaAtual);
  });

  // ===== NAVEGAÇÃO SISTEMA → CATEGORIA → DOCUMENTOS =====
  document.querySelectorAll('.sistema-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sistema-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sistemaAtual   = btn.dataset.sistema;
      categoriaAtual = null;
      esconderBusca();
      mostrarCategoriasGrid(sistemaAtual);
    });
  });

  function mostrarCategoriasGrid(sistema) {
    const info = SISTEMAS[sistema];
    const grid       = document.getElementById('categoriaGrid');
    const listHeader = document.getElementById('docListHeader');
    const listDocs   = document.getElementById('listaDocumentos');

    grid.style.display       = 'grid';
    listHeader.style.display = 'none';
    listDocs.style.display   = 'none';
    mostrarBusca();
    grid.style.setProperty('--sistema-cor', info.cor);

    grid.innerHTML = info.categorias.map(cat => {
      const ic = info.iconesCat[cat] || '📄';
      return `<button class="cat-card" data-cat="${cat}" type="button">
        <div class="cat-icon">${ic}</div>
        <div class="cat-name">${cat}</div>
      </button>`;
    }).join('');

    grid.querySelectorAll('.cat-card').forEach(btn => {
      btn.addEventListener('click', () => {
        categoriaAtual = btn.dataset.cat;
        carregarDocumentos(sistemaAtual, categoriaAtual);
      });
    });
  }

  async function carregarDocumentos(sistema, categoria) {
    const grid       = document.getElementById('categoriaGrid');
    const listHeader = document.getElementById('docListHeader');
    const listDocs   = document.getElementById('listaDocumentos');

    grid.style.display       = 'none';
    listHeader.style.display = 'flex';
    listDocs.style.display   = 'grid';

    const info = SISTEMAS[sistema];
    const ic   = info?.iconesCat?.[categoria] || '📄';
    document.getElementById('docListTitle').innerHTML =
      `${ic} ${categoria} <span style="color:var(--text-muted);font-size:.75rem;margin-left:.5rem;">· ${sistema}</span>`;

    listDocs.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="spinner" style="margin:0 auto;"></div></div>`;

    try {
      const params = new URLSearchParams({ sistema, categoria });
      const res = await Api.request(`/documentos?${params}`);
      if (!res?.ok) { listDocs.innerHTML = renderEmpty('⚠', 'Erro ao carregar.'); return; }

      docsCache = res.data.documentos;
      if (isMestre) document.getElementById('statDocs').textContent = docsCache.length;

      if (!docsCache.length) {
        listDocs.innerHTML = renderEmpty('📜', `Nenhum documento em "${categoria}" — ${sistema}.`);
        mostrarBusca();
        return;
      }

      listDocs.innerHTML = docsCache.map(renderDocCard).join('');
      bindListeners(listDocs);

      // Barra de busca + tags sugeridas
      mostrarBusca();
      popularTagsSugeridas(docsCache);

    } catch { listDocs.innerHTML = renderEmpty('⚠', 'Erro de conexão.'); }
  }

  // Registra todos os listeners dos cards de documento
  function bindListeners(container) {
    container.querySelectorAll('.doc-card-body').forEach(el => {
      el.addEventListener('click', () => abrirDoc(el.closest('.doc-card').dataset.id));
    });
    if (isMestre) {
      container.querySelectorAll('.btn-edit-doc').forEach(el =>
        el.addEventListener('click', e => { e.stopPropagation(); editarDoc(el.dataset.id); }));
      container.querySelectorAll('.btn-del-doc').forEach(el =>
        el.addEventListener('click', e => { e.stopPropagation(); deletarDoc(el.dataset.id); }));
    }
    // Tags clicáveis nos cards → filtra por tag
    bindTagClicks(container, executarBusca);
  }

  document.getElementById('btnVoltarCats')?.addEventListener('click', () => {
    categoriaAtual = null;
    esconderBusca();
    mostrarCategoriasGrid(sistemaAtual);
  });

  // ===== RENDER CARD =====
  function renderDocCard(doc) {
    const imgHtml = doc.imagem_url
      ? `<img src="${doc.imagem_url}" alt="${escH(doc.titulo)}" />`
      : '📜';
    const mestreBtns = isMestre ? `
      <div class="doc-card-actions">
        <button class="btn btn-sm btn-edit-doc" data-id="${doc.id}" type="button">✏</button>
        <button class="btn btn-sm btn-danger btn-del-doc" data-id="${doc.id}" type="button">✕</button>
      </div>` : '';
    const visiBadge = doc.visibilidade === 'privado'
      ? '<span class="badge badge-red">Privado</span>'
      : '<span class="badge badge-gold">Público</span>';

    return `
      <div class="doc-card fade-in" data-id="${doc.id}">
        <div class="doc-card-img">${imgHtml}</div>
        ${mestreBtns}
        <div class="doc-card-body">
          <div class="doc-card-title">${escH(doc.titulo)}</div>
          <div class="doc-card-meta"><span>${escH(doc.categoria)}</span>${visiBadge}</div>
          ${renderTagsHtml(doc.tags)}
        </div>
      </div>`;
  }

  // ===== MODAL =====
  function abrirDoc(id) {
    const doc = docsCache.find(d => String(d.id) === String(id));
    if (!doc) return;

    document.getElementById('modalDocMeta').innerHTML =
      `<span class="badge badge-gold">${escH(doc.sistema)}</span> &nbsp;
       <span class="badge badge-gray">${escH(doc.categoria)}</span>`;

    document.getElementById('modalDocTitulo').textContent = doc.titulo;

    // Conteúdo + tags clicáveis no modal
    const corpo = document.getElementById('modalDocCorpo');
    corpo.innerHTML = `<p>${escH(doc.conteudo || 'Sem conteúdo.').replace(/\n/g,'<br>')}</p>
      ${renderTagsHtml(doc.tags)}`;

    // Clicar numa tag no modal fecha e filtra
    bindTagClicks(corpo, tag => { fecharModalDoc(); executarBusca(tag); });

    if (isMestre) {
      const panel = document.getElementById('modalDocMestre');
      panel.style.display = 'flex';
      panel.querySelector('.btn-edit-doc-modal').onclick = () => { fecharModalDoc(); editarDoc(id); };
      document.getElementById('btnDeletarDoc').onclick = () => deletarDoc(id);
    }
    document.getElementById('modalDoc').classList.add('open');
  }

  window.fecharModalDoc = () => document.getElementById('modalDoc').classList.remove('open');
  document.getElementById('modalDoc').addEventListener('click', e => {
    if (e.target === document.getElementById('modalDoc')) fecharModalDoc();
  });

  function editarDoc(id) {
    const doc = docsCache.find(d => String(d.id) === String(id));
    if (!doc) return;
    docEditandoId = id;
    document.getElementById('docTitulo').value   = doc.titulo;
    document.getElementById('docConteudo').value = doc.conteudo || '';
    document.getElementById('docTags').value     = doc.tags || '';
    selSistema.value = doc.sistema || 'Decadência Cinza';
    popularCategorias(doc.sistema || 'Decadência Cinza');
    selCategoria.value = doc.categoria || '';
    document.getElementById('docVisibilidade').value = doc.visibilidade;
    document.getElementById('formCriarDoc').classList.add('open');
    document.getElementById('formCriarDoc').scrollIntoView({ behavior: 'smooth' });
  }

  async function deletarDoc(id) {
    if (!confirm('Remover este documento?')) return;
    const res = await Api.deletarDocumento(id);
    if (res?.ok) { fecharModalDoc(); carregarDocumentos(sistemaAtual, categoriaAtual); }
  }

  async function atualizarStatDocs() {
    const res = await Api.request('/documentos');
    if (res?.ok) document.getElementById('statDocs').textContent = res.data.documentos.length;
  }

  // ===== FICHAS =====
  async function carregarFichas() {
    const container = document.getElementById('listaFichas');
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="spinner" style="margin:0 auto;"></div></div>`;
    try {
      const res = await Api.listarFichas();
      if (!res?.ok) { container.innerHTML = renderEmpty('⚔','Erro ao carregar fichas.'); return; }
      const fichas = res.data.fichas;
      if (isMestre) document.getElementById('statFichas').textContent = fichas.length;
      if (!fichas.length) { container.innerHTML = renderEmpty('⚔','Nenhuma ficha. Crie uma na Forja!'); return; }
      container.innerHTML = fichas.map(f => {
        let attrs = {};
        try { attrs = typeof f.atributos === 'string' ? JSON.parse(f.atributos) : f.atributos; } catch {}
        const pills = Object.entries(attrs).slice(0,4).map(([k,v]) =>
          `<div class="attr-pill">${escH(k)}<span>${escH(String(v))}</span></div>`).join('');
        const av = f.imagem_url ? `<img src="${f.imagem_url}" alt="${escH(f.nome_personagem)}" />` : '⚔';
        return `<div class="ficha-card fade-in">
          <div class="ficha-header"><div class="ficha-avatar">${av}</div>
          <div>
            <div class="ficha-nome">${escH(f.nome_personagem)}</div>
            <div class="ficha-sistema">${escH(f.sistema)}</div>
            ${isMestre ? `<div style="font-size:.75rem;color:var(--text-muted);">👤 ${escH(f.jogador_nome||'')}</div>` : ''}
          </div></div>
          <div class="ficha-attrs">${pills}</div>
          <div style="margin-top:.75rem;"><a href="/forja?id=${f.id}" class="btn btn-sm">Editar Ficha</a></div>
        </div>`;
      }).join('');
    } catch { container.innerHTML = renderEmpty('⚠','Erro de conexão.'); }
  }

  // ===== UTILS =====
  function renderEmpty(icon, msg) {
    return `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">${icon}</div><p>${msg}</p></div>`;
  }
  function escH(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ===== INÍCIO =====
  mostrarCategoriasGrid('Decadência Cinza');
})();