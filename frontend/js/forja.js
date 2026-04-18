// frontend/js/forja.js
(function () {
  'use strict';

  const user = VK.user;
  const isMestre = VK.isMestre;

  document.getElementById('navUserName').textContent = user.nome;
  if (user.avatar_url) document.getElementById('navAvatar').innerHTML = `<img src="${user.avatar_url}" alt="${user.nome}" />`;
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('hamburger').classList.toggle('open');
    document.getElementById('navMenu').classList.toggle('open');
  });

  // ===== SELETOR SISTEMA → CLASSE =====
  const selSistema = document.getElementById('fichaSistema');
  const selClasse = document.getElementById('fichaClasse');

  function popularClasses(sistema) {
    const info = SISTEMAS[sistema];
    const cats = info?.categorias || [];
    selClasse.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('previewSistema').textContent = sistema;
    // Muda atributos default ao trocar universo
  }

  selSistema.addEventListener('change', () => {
    popularClasses(selSistema.value);
    document.getElementById('previewSistema').textContent = selSistema.value;
    carregarAtributosDefault(selSistema.value);
  });

  selClasse.addEventListener('change', () => {
    document.getElementById('previewClasse').textContent = selClasse.value;
  });

  popularClasses('Decadência Cinza');

  // ===== ALERT =====
  function alertForja(msg, tipo = 'error') {
    const el = document.getElementById('alertForja');
    el.className = `alert alert-${tipo} show`;
    el.textContent = msg;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (tipo === 'success') setTimeout(() => { el.className = 'alert'; }, 3500);
  }

  // ===== CONSTRUTOR ATRIBUTOS =====
  const attrList = document.getElementById('attrList');
  const attrTA = document.getElementById('fichaAtributos');

  function addAttrRow(key = '', value = '') {
    const row = document.createElement('div');
    row.className = 'attr-row';
    row.innerHTML = `
      <input type="text" class="attr-key" placeholder="Atributo" value="${escH(key)}" />
      <input type="text" class="attr-val" placeholder="Valor" value="${escH(String(value))}" />
      <button type="button" class="btn-remove-attr">✕</button>
    `;
    row.querySelector('.btn-remove-attr').addEventListener('click', () => { row.remove(); syncToJson(); });
    row.querySelectorAll('input').forEach(i => i.addEventListener('input', syncToJson));
    attrList.appendChild(row);
  }

  function syncToJson() {
    const obj = {};
    attrList.querySelectorAll('.attr-row').forEach(r => {
      const k = r.querySelector('.attr-key').value.trim();
      const v = r.querySelector('.attr-val').value.trim();
      if (k) obj[k] = isNaN(v) || v === '' ? v : Number(v);
    });
    attrTA.value = JSON.stringify(obj, null, 2);
    atualizarPreview();
  }

  function syncFromJson() {
    try {
      const obj = JSON.parse(attrTA.value);
      attrList.innerHTML = '';
      Object.entries(obj).forEach(([k, v]) => addAttrRow(k, v));
      atualizarPreview();
    } catch {}
  }

  document.getElementById('btnAddAttr').addEventListener('click', () => addAttrRow());
  attrTA.addEventListener('input', syncFromJson);

  // ===== PREVIEW =====
  function atualizarPreview() {
    document.getElementById('previewNome').textContent = document.getElementById('fichaNome').value.trim() || 'Nome do Personagem';
    document.getElementById('previewSistema').textContent = selSistema.value;
    document.getElementById('previewClasse').textContent = selClasse.value || '';

    let attrs = {};
    try { attrs = JSON.parse(attrTA.value); } catch {}
    const entries = Object.entries(attrs);
    const previewAttrs = document.getElementById('previewAttrs');
    previewAttrs.innerHTML = entries.length
      ? entries.map(([k,v]) => `<div class="preview-attr-item"><span class="preview-attr-key">${escH(k)}</span><span class="preview-attr-val">${escH(String(v))}</span></div>`).join('')
      : '<p style="color:var(--text-muted);font-size:.85rem;grid-column:1/-1;">Adicione atributos...</p>';
  }

  ['fichaNome'].forEach(id => document.getElementById(id)?.addEventListener('input', atualizarPreview));

  document.getElementById('fichaImagem').addEventListener('change', function () {
    const f = this.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = e => { document.getElementById('previewAvatar').innerHTML = `<img src="${e.target.result}" alt="preview"/>`; };
    r.readAsDataURL(f);
  });

  // ===== DEFAULTS POR UNIVERSO =====
  const DEFAULTS = {
    'Decadência Cinza': { "Força":10,"Destreza":10,"Constituição":10,"Inteligência":10,"Percepção":10,"Magia":0,"Pontos de Vida":20,"Nível":1 },
    'Oceano Estrelado': { "Força":10,"Agilidade":10,"Resistência":10,"Astúcia":10,"Navegação":5,"Magia Naval":0,"Pontos de Vida":20,"Nível":1 },
    'Cavaleiros de Armadura': { "Força":12,"Resistência":12,"Vitalidade":10,"Combate":8,"Controle de Montaria":5,"Corrupção":0,"Pontos de Vida":25,"Nível":1 },
  };

  function carregarAtributosDefault(sistema) {
    const def = DEFAULTS[sistema] || DEFAULTS['Decadência Cinza'];
    attrTA.value = JSON.stringify(def, null, 2);
    syncFromJson();
  }

  // ===== EDITAR POR URL =====
  const editId = new URLSearchParams(window.location.search).get('id');
  if (editId) {
    carregarFichaParaEdicao(editId);
  } else {
    carregarAtributosDefault('Decadência Cinza');
  }

  async function carregarFichaParaEdicao(id) {
    try {
      const res = await Api.request(`/fichas/${id}`);
      if (!res?.ok) return;
      const f = res.data.ficha;
      document.getElementById('fichaId').value = f.id;
      document.getElementById('fichaNome').value = f.nome_personagem;
      selSistema.value = f.sistema || 'Decadência Cinza';
      popularClasses(f.sistema || 'Decadência Cinza');
      const atrsStr = typeof f.atributos === 'string' ? f.atributos : JSON.stringify(f.atributos, null, 2);
      attrTA.value = atrsStr;
      syncFromJson();
      if (f.imagem_url) document.getElementById('previewAvatar').innerHTML = `<img src="${f.imagem_url}" alt="${f.nome_personagem}" />`;
      document.getElementById('btnSalvarFicha').textContent = 'Atualizar Ficha';
      atualizarPreview();
    } catch { alertForja('Erro ao carregar ficha.'); }
  }

  // ===== SALVAR =====
  document.getElementById('btnSalvarFicha').addEventListener('click', async () => {
    const nome = document.getElementById('fichaNome').value.trim();
    const sistema = selSistema.value;
    const atributosStr = attrTA.value.trim();
    const imagemFile = document.getElementById('fichaImagem').files[0];
    const fichaIdVal = document.getElementById('fichaId').value.trim();

    if (!nome) { alertForja('Nome do personagem é obrigatório.'); return; }
    let atributosJson;
    try { atributosJson = JSON.parse(atributosStr || '{}'); }
    catch { alertForja('JSON dos atributos inválido.'); return; }

    const fd = new FormData();
    fd.append('nome_personagem', nome);
    fd.append('sistema', sistema);
    fd.append('atributos', JSON.stringify(atributosJson));
    if (imagemFile) fd.append('imagem', imagemFile);

    const btn = document.getElementById('btnSalvarFicha');
    btn.disabled = true; btn.textContent = 'Forjando...';
    try {
      const res = fichaIdVal
        ? await Api.atualizarFicha(fichaIdVal, fd)
        : await Api.criarFicha(fd);
      if (res?.ok) {
        alertForja(fichaIdVal ? 'Ficha atualizada!' : 'Personagem forjado!', 'success');
        if (!fichaIdVal && res.data.id) {
          document.getElementById('fichaId').value = res.data.id;
          history.replaceState(null,'',`/forja?id=${res.data.id}`);
        }
        carregarFichasLista();
      } else { alertForja(res?.data?.message || 'Erro ao salvar.'); }
    } catch { alertForja('Erro de conexão.'); }
    finally { btn.disabled = false; btn.textContent = document.getElementById('fichaId').value ? 'Atualizar Ficha' : 'Forjar Personagem'; }
  });

  // ===== LIMPAR =====
  document.getElementById('btnLimpar').addEventListener('click', () => {
    document.getElementById('fichaId').value = '';
    document.getElementById('fichaNome').value = '';
    selSistema.value = 'Decadência Cinza';
    popularClasses('Decadência Cinza');
    document.getElementById('fichaImagem').value = '';
    document.getElementById('previewAvatar').innerHTML = '⚔';
    history.replaceState(null,'','/forja');
    carregarAtributosDefault('Decadência Cinza');
    document.getElementById('btnSalvarFicha').textContent = 'Forjar Personagem';
  });

  // ===== LISTA DE FICHAS COM FILTRO =====
  let filtroSistema = 'todos';
  let fichasCache = [];

  document.querySelectorAll('.sistema-btn[data-fsistema]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sistema-btn[data-fsistema]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroSistema = btn.dataset.fsistema;
      renderFichasLista();
    });
  });

  function renderFichasLista() {
    const container = document.getElementById('listaFichasForja');
    const filtradas = filtroSistema === 'todos' ? fichasCache : fichasCache.filter(f => f.sistema === filtroSistema);
    if (!filtradas.length) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem;">Nenhuma ficha neste universo.</div>';
      return;
    }
    container.innerHTML = filtradas.map(f => `
      <div class="ficha-list-item">
        <div>
          <span class="ficha-list-nome">${escH(f.nome_personagem)}</span>
          <div style="font-size:.72rem;color:var(--text-muted);font-family:var(--font-heading);">${escH(f.sistema)}</div>
        </div>
        <div class="ficha-list-actions">
          <button class="btn btn-sm btn-edit-ficha" data-id="${f.id}" type="button">Editar</button>
          ${isMestre ? `<button class="btn btn-sm btn-danger btn-del-ficha" data-id="${f.id}" type="button">✕</button>` : ''}
        </div>
      </div>`).join('');

    container.querySelectorAll('.btn-edit-ficha').forEach(btn => {
      btn.addEventListener('click', () => {
        history.pushState(null,'',`/forja?id=${btn.dataset.id}`);
        carregarFichaParaEdicao(btn.dataset.id);
        window.scrollTo({ top:0, behavior:'smooth' });
      });
    });
    if (isMestre) {
      container.querySelectorAll('.btn-del-ficha').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Arquivar esta ficha?')) return;
          const res = await Api.deletarFicha(btn.dataset.id);
          if (res?.ok) carregarFichasLista();
        });
      });
    }
  }

  async function carregarFichasLista() {
    const container = document.getElementById('listaFichasForja');
    container.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem;">Carregando...</div>';
    try {
      const res = await Api.listarFichas();
      if (!res?.ok || !res.data.fichas.length) {
        fichasCache = [];
        container.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem;">Nenhuma ficha salva ainda.</div>';
        return;
      }
      fichasCache = res.data.fichas;
      renderFichasLista();
    } catch { container.innerHTML = '<div style="color:var(--text-muted);">Erro ao carregar.</div>'; }
  }

  document.getElementById('btnCarregarFichas').addEventListener('click', carregarFichasLista);

  function escH(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ===== INIT =====
  carregarFichasLista();
  atualizarPreview();
})();
