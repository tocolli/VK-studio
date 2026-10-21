// frontend/js/wiki.js — Compêndio (wiki estilo Obsidian)
// Rotas (tratadas aqui, o servidor entrega wiki.html para qualquer /wiki/*):
//   /wiki                      início
//   /wiki/p/<slug>             página        /wiki/p/<slug>/editar   editor (mestre)
//   /wiki/novo?titulo=&pasta=  nova página (mestre)
//   /wiki/grafo                mapa interligado
//   /wiki/linha-do-tempo       linha do tempo do universo
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const main = $('#wikiMain');
  const state = { user: Api.getUser(), paginas: [], listaOk: false };
  const ehMestre = () => state.user?.role === 'mestre';
  let renderId = 0; // descarta respostas atrasadas quando o usuário já navegou para outra tela
  let simAtiva = null; // simulação do mapa em andamento (parada ao sair da tela)

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Igual a backend/src/utils/wiki.js (slugify) — mantenha as duas iguais.
  function slugify(t) {
    return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/\.md$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 190);
  }

  const VIS = {
    publico: { rotulo: 'Público', dica: 'Qualquer pessoa com o link' },
    jogador: { rotulo: 'Jogadores', dica: 'Precisa estar logado' },
    mestre: { rotulo: 'Somente mestre', dica: 'Escondida dos jogadores' },
  };

  // ─── API ────────────────────────────────────────────────────────────────
  async function api(caminho, opcoes) {
    try {
      const r = await Api.request('/wiki' + caminho, opcoes);
      return r || { ok: false, status: 0, data: {} };
    } catch {
      return { ok: false, status: 0, data: { message: 'Sem conexão com o servidor.' } };
    }
  }

  function toast(msg, erro) {
    const t = $('#wikiToast');
    t.textContent = msg; t.classList.toggle('erro', !!erro); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, erro ? 5000 : 2600);
  }

  // ─── Markdown + [[links]] ───────────────────────────────────────────────
  marked.use({ gfm: true, breaks: true }); // breaks:true = quebra de linha simples vira <br>, como no Obsidian

  DOMPurify.addHook('afterSanitizeAttributes', (no) => {
    if (no.tagName === 'A') {
      const h = no.getAttribute('href') || '';
      if (/^https?:/i.test(h)) { no.setAttribute('target', '_blank'); no.setAttribute('rel', 'noopener noreferrer'); }
    }
  });

  /** Troca [[destino|apelido]] por <a>/<span>, sem mexer em blocos de código. */
  function resolverWikilinks(md, existentes) {
    const partes = String(md ?? '').split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g);
    return partes.map((trecho, i) => {
      if (i % 2) return trecho; // código
      return trecho.replace(/\[\[([^\]\n]+?)\]\]/g, (_, dentro) => {
        const [alvoBruto, ...resto] = dentro.replace(/\\\|/g, '|').split('|');
        const alvo = alvoBruto.split('#')[0].trim().split('/').pop().replace(/\.md$/i, '').trim();
        const slug = slugify(alvo);
        const texto = (resto.join('|') || alvoBruto.replace(/\.md$/i, '')).trim();
        if (!slug) return esc(texto);
        if (existentes[slug] !== undefined) return `<a class="wikilink" href="/wiki/p/${slug}">${esc(texto)}</a>`;
        if (ehMestre()) {
          return `<a class="wikilink faltando" href="/wiki/novo?titulo=${encodeURIComponent(alvo)}" title="Página ainda não escrita — clique para criar">${esc(texto)}</a>`;
        }
        return `<span class="wikilink faltando" title="Página ainda não escrita">${esc(texto)}</span>`;
      });
    }).join('');
  }

  /** markdown -> HTML seguro (sanitizado), com [[links]] resolvidos. Devolve um elemento. */
  function renderizarMarkdown(md, existentes) {
    const html = DOMPurify.sanitize(marked.parse(resolverWikilinks(md, existentes)), { USE_PROFILES: { html: true } });
    const raiz = document.createElement('div');
    raiz.className = 'wiki-md';
    raiz.innerHTML = html;
    raiz.querySelectorAll('table').forEach((t) => { // rolagem horizontal em tabelas largas
      const w = document.createElement('div'); w.className = 'tabela';
      t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
    const usados = new Set();
    raiz.querySelectorAll('h1,h2,h3,h4').forEach((h) => { // âncoras
      let id = slugify(h.textContent) || 'secao', n = 2; const base = id;
      while (usados.has(id)) id = `${base}-${n++}`;
      usados.add(id); h.id = id;
    });
    return raiz;
  }

  function criarSumario(raiz) {
    const hs = [...raiz.querySelectorAll('h2,h3')];
    if (hs.length < 4) return null;
    const det = document.createElement('details');
    det.className = 'wiki-toc';
    det.innerHTML = `<summary>Nesta página (${hs.length})</summary><ol>${hs.map((h) =>
      `<li class="n${h.tagName[1]}"><a href="#${h.id}" data-ancora="1">${esc(h.textContent)}</a></li>`).join('')}</ol>`;
    return det;
  }

  // ─── Navegação ──────────────────────────────────────────────────────────
  function ir(url, substituir) {
    if (substituir) history.replaceState(null, '', url); else history.pushState(null, '', url);
    renderizar();
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const href = a.getAttribute('href') || '';
    if (a.dataset.ancora) { // sumário: rolagem suave sem mudar a rota
      e.preventDefault(); document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' }); return;
    }
    if (href === '/wiki' || href.startsWith('/wiki/') || href.startsWith('/wiki?')) { e.preventDefault(); ir(href); }
  });
  window.addEventListener('popstate', renderizar);

  function lerRota() {
    const url = new URL(location.href);
    const p = decodeURI(url.pathname).replace(/\/+$/, '') || '/wiki';
    let m;
    if (p === '/wiki') return { nome: 'home' };
    if (p === '/wiki/grafo') return { nome: 'grafo', foco: url.searchParams.get('foco') || '' };
    if (p === '/wiki/linha-do-tempo') return { nome: 'tempo' };
    if (p === '/wiki/novo') return { nome: 'novo', titulo: url.searchParams.get('titulo') || '', pasta: url.searchParams.get('pasta') || '' };
    if ((m = p.match(/^\/wiki\/p\/([^/]+)\/editar$/))) return { nome: 'editar', slug: slugify(m[1]) };
    if ((m = p.match(/^\/wiki\/p\/([^/]+)$/))) return { nome: 'pagina', slug: slugify(m[1]) };
    return { nome: '404' };
  }

  async function renderizar() {
    const meu = ++renderId;
    if (simAtiva) { simAtiva.stop(); simAtiva = null; } // evita o mapa "enquadrar" depois de ter saído da tela
    const rota = lerRota();
    document.body.classList.remove('menu-aberto'); $('#wikiVeu').hidden = true;
    document.querySelectorAll('.wiki-nav a').forEach((a) => {
      const r = a.dataset.rota;
      a.classList.toggle('ativo', (r === 'home' && ['home', 'pagina', 'editar', 'novo'].includes(rota.nome)) || (r === 'grafo' && rota.nome === 'grafo') || (r === 'tempo' && rota.nome === 'tempo'));
    });
    if (!state.listaOk) await carregarLista();
    if (meu !== renderId) return;
    montarArvore(rota.slug);
    main.innerHTML = '<div class="wiki-carregando"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    window.scrollTo(0, 0);

    const telas = { home: telaHome, pagina: telaPagina, grafo: telaGrafo, tempo: telaTempo, novo: telaEditor, editar: telaEditor };
    try {
      await (telas[rota.nome] || tela404)(rota, () => meu === renderId);
    } catch (err) {
      console.error(err);
      if (meu === renderId) main.innerHTML = '<div class="wiki-vazio">Algo deu errado ao montar esta página. Tente recarregar.</div>';
    }
    if (meu === renderId) main.focus({ preventScroll: true });
  }

  // ─── Lista / árvore lateral ─────────────────────────────────────────────
  async function carregarLista() {
    const r = await api('/paginas');
    state.paginas = r.ok ? r.data.paginas : [];
    state.listaOk = r.ok;
  }

  function montarArvore(slugAtivo) {
    const raiz = { pastas: {}, paginas: [] };
    for (const p of state.paginas) {
      let no = raiz;
      for (const parte of (p.pasta || '').split('/').filter(Boolean)) no = no.pastas[parte] ??= { pastas: {}, paginas: [] };
      no.paginas.push(p);
    }
    // Só o mestre vê o ponto colorido de visibilidade (vermelho = só mestre)
    const link = (p) => `<a href="/wiki/p/${p.slug}" class="${p.slug === slugAtivo ? 'ativo' : ''}">${ehMestre() ? `<span class="sel vis-${p.visibilidade}" title="${VIS[p.visibilidade]?.rotulo}"></span>` : ''}${esc(p.titulo)}</a>`;
    const contem = (no) => no.paginas.some((p) => p.slug === slugAtivo) || Object.values(no.pastas).some(contem);
    const desenhar = (no) =>
      Object.keys(no.pastas).sort((a, b) => a.localeCompare(b, 'pt')).map((nome) =>
        `<details ${contem(no.pastas[nome]) ? 'open' : ''}><summary>${esc(nome)}</summary><div class="filhos">${desenhar(no.pastas[nome])}</div></details>`).join('') +
      no.paginas.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt')).map(link).join('');
    $('#arvore').innerHTML = state.paginas.length ? desenhar(raiz) : '<p class="wiki-search-res"><span class="vazio">Nenhuma página para você ainda.</span></p>';
    $('#acoesMestre').hidden = !ehMestre();
  }

  function montarTopo() {
    const u = state.user;
    $('#wikiUser').innerHTML = u
      ? `<span class="nome">${esc(u.nome)}${u.role === 'mestre' ? ' · Mestre' : ''}</span><a href="/dashboard">Painel</a>`
      : '<a href="/">Entrar</a>';
  }

  // ─── Busca ──────────────────────────────────────────────────────────────
  let buscaTimer;
  $('#busca').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(buscaTimer);
    const caixa = $('#buscaRes');
    if (q.length < 2) { caixa.hidden = true; $('#arvore').hidden = false; return; }
    buscaTimer = setTimeout(async () => {
      const r = await api('/busca?q=' + encodeURIComponent(q));
      if ($('#busca').value.trim() !== q) return;
      const marca = (t) => esc(t).replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`);
      const lista = r.ok ? r.data.resultados : [];
      caixa.innerHTML = lista.length
        ? lista.map((x) => `<a href="/wiki/p/${x.slug}">${marca(x.titulo)}${x.trecho ? `<small>${marca(x.trecho)}</small>` : ''}</a>`).join('')
        : '<span class="vazio">Nada encontrado.</span>';
      caixa.hidden = false; $('#arvore').hidden = true;
    }, 220);
  });
  $('#buscaRes').addEventListener('click', (e) => {
    if (e.target.closest('a')) { $('#busca').value = ''; $('#buscaRes').hidden = true; $('#arvore').hidden = false; }
  });

  // Menu lateral no celular
  $('#btnMenu').addEventListener('click', () => {
    const aberto = document.body.classList.toggle('menu-aberto');
    $('#wikiVeu').hidden = !aberto;
  });
  $('#wikiVeu').addEventListener('click', () => { document.body.classList.remove('menu-aberto'); $('#wikiVeu').hidden = true; });

  // ═══ TELAS ═══════════════════════════════════════════════════════════════

  function tela404() {
    document.title = 'Não encontrada — Compêndio';
    main.innerHTML = '<div class="wiki-vazio"><h2>Página não encontrada</h2><p>Esse endereço não existe no compêndio.</p><a class="wiki-btn" href="/wiki">Voltar ao início</a></div>';
  }

  // ─── Início ─────────────────────────────────────────────────────────────
  async function telaHome(_r, vivo) {
    document.title = 'Compêndio — VK.Studio';
    const recentes = [...state.paginas].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 8);
    let faltando = [], excluidas = [];
    if (ehMestre()) {
      const [g, ex] = await Promise.all([api('/grafo'), api('/excluidas')]);
      if (!vivo()) return;
      faltando = g.ok ? g.data.nos.filter((n) => n.faltando).sort((a, b) => b.grau - a.grau) : [];
      excluidas = ex.ok ? ex.data.excluidas : [];
    }
    const semPaginas = !state.paginas.length;
    main.innerHTML = `
      <section class="wiki-hero">
        <h1>Compêndio de Decadência Cinza</h1>
        <p>Regras, almas, magias e a história do mundo, tudo ligado por links. Comece por uma página, siga os links ou abra o mapa.</p>
      </section>
      <div class="wiki-cards">
        <a class="wiki-card" href="/wiki/grafo"><i class="fa-solid fa-diagram-project"></i><h3>Mapa interligado</h3><p>Veja como as páginas se conectam e navegue clicando.</p></a>
        <a class="wiki-card" href="/wiki/linha-do-tempo"><i class="fa-solid fa-timeline"></i><h3>Linha do tempo</h3><p>Os acontecimentos do universo, era por era.</p></a>
        <div class="wiki-card"><i class="fa-solid fa-scroll"></i><h3>${state.paginas.length} página${state.paginas.length === 1 ? '' : 's'}</h3><p>${state.user ? 'Disponíveis para você.' : 'Públicas. Entre para ver o conteúdo dos jogadores.'}</p></div>
      </div>
      ${semPaginas ? `<div class="wiki-section wiki-vazio">${state.user ? 'Ainda não há páginas para o seu perfil.' : 'Ainda não há páginas públicas. Entre com a sua conta para ler o conteúdo dos jogadores.'}${state.user ? '' : '<br><a class="wiki-btn primario" href="/">Entrar</a>'}</div>` : `
      <section class="wiki-section"><h2>Atualizadas recentemente</h2>
        <div class="wiki-chips">${recentes.map((p) => `<a href="/wiki/p/${p.slug}">${esc(p.titulo)}</a>`).join('')}</div></section>`}
      ${faltando.length ? `<section class="wiki-section"><h2>Citadas, mas ainda não escritas (${faltando.length})</h2>
        <p style="margin-bottom:10px">Só você vê esta lista. Clique para criar a página; as mais citadas vêm primeiro.</p>
        <div class="wiki-chips">${faltando.slice(0, 60).map((n) => `<a class="faltando" href="/wiki/novo?titulo=${encodeURIComponent(n.titulo)}">${esc(n.titulo)} <small>· ${n.grau}</small></a>`).join('')}</div></section>` : ''}
      ${excluidas.length ? `<section class="wiki-section"><h2>Páginas excluídas (${excluidas.length})</h2>
        <p style="margin-bottom:10px">Só você vê esta lista. Clique para restaurar a página como estava quando foi excluída.</p>
        <div class="wiki-chips">${excluidas.map((x) => `<button type="button" class="faltando" data-restaurar="${x.id}" data-slug="${esc(x.slug)}">${esc(x.titulo)}</button>`).join('')}</div></section>` : ''}`;
    main.querySelectorAll('[data-restaurar]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(`Restaurar a página "${b.textContent}"?`)) return;
      const d = await api(`/paginas/${encodeURIComponent(b.dataset.slug)}/restaurar/${b.dataset.restaurar}`, { method: 'POST' });
      if (d.ok) { state.listaOk = false; toast('Página restaurada.'); ir('/wiki/p/' + d.data.slug); } else toast(d.data.message || 'Falha ao restaurar.', true);
    }));
  }

  // ─── Página ─────────────────────────────────────────────────────────────
  async function telaPagina(rota, vivo) {
    const r = await api('/paginas/' + encodeURIComponent(rota.slug));
    if (!vivo()) return;
    if (!r.ok) {
      document.title = 'Não encontrada — Compêndio';
      const precisa = r.data.precisaLogin;
      main.innerHTML = `<div class="wiki-vazio"><h2>Página não encontrada</h2>
        <p>${precisa ? 'Ela não existe ou é restrita. Se você é jogador, entre com a sua conta.' : 'Ela não existe ou você não tem acesso.'}</p>
        ${precisa ? '<a class="wiki-btn primario" href="/">Entrar</a> ' : ''}<a class="wiki-btn" href="/wiki">Ir ao início</a></div>`;
      return;
    }
    const { pagina, links, backlinks } = r.data;
    document.title = `${pagina.titulo} — Compêndio`;
    const partes = (pagina.pasta || '').split('/').filter(Boolean);
    const vis = VIS[pagina.visibilidade] || VIS.jogador;
    const mostrarVis = ehMestre() || pagina.visibilidade === 'publico';
    const data = pagina.updated_at ? new Date(pagina.updated_at).toLocaleDateString('pt-BR') : '';

    main.innerHTML = `
      <article>
        <div class="wiki-crumbs"><a href="/wiki">Compêndio</a>${partes.map((p) => ` / ${esc(p)}`).join('')}</div>
        <h1 class="wiki-title">${esc(pagina.titulo)}</h1>
        <div class="wiki-meta">
          ${mostrarVis ? `<span class="wiki-badge ${pagina.visibilidade}" title="${esc(vis.dica)}">${pagina.visibilidade === 'mestre' ? '<i class="fa-solid fa-lock"></i> ' : ''}${vis.rotulo}</span>` : ''}
          ${data ? `<span>Atualizada em ${data}</span>` : ''}
          <span class="acoes">
            <button class="wiki-btn pequeno" id="btnCopiar" type="button"><i class="fa-solid fa-link"></i> Copiar link</button>
            <a class="wiki-btn pequeno" href="/wiki/grafo?foco=${pagina.slug}"><i class="fa-solid fa-diagram-project"></i> No mapa</a>
            ${ehMestre() ? `<button class="wiki-btn pequeno" id="btnHistorico" type="button"><i class="fa-solid fa-clock-rotate-left"></i> Histórico</button>
            <a class="wiki-btn pequeno" href="/wiki/p/${pagina.slug}/editar"><i class="fa-solid fa-pen"></i> Editar</a>` : ''}
          </span>
        </div>
        <section id="historico" class="wiki-historico" hidden></section>
        <div id="corpo"></div>
        <section class="wiki-backlinks"><h3>Mencionada em</h3>
          ${backlinks.length ? `<ul>${backlinks.map((b) => `<li><a href="/wiki/p/${b.slug}">${esc(b.titulo)}</a></li>`).join('')}</ul>` : '<p class="nenhum">Nenhuma outra página cita esta.</p>'}
        </section>
      </article>`;
    const corpo = renderizarMarkdown(pagina.conteudo, links);
    const toc = criarSumario(corpo);
    if (toc) $('#corpo').appendChild(toc);
    $('#corpo').appendChild(corpo);
    $('#btnCopiar').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.origin + '/wiki/p/' + pagina.slug); toast(pagina.visibilidade === 'publico' ? 'Link copiado.' : 'Link copiado (quem abrir precisa estar logado).'); }
      catch { toast('Não consegui copiar. Copie o endereço da barra do navegador.', true); }
    });
    $('#btnHistorico')?.addEventListener('click', () => alternarHistorico(pagina.slug));
  }

  // Histórico de versões (só mestre): cada salvamento/exclusão guarda a versão anterior.
  async function alternarHistorico(slug) {
    const caixa = $('#historico');
    if (!caixa.hidden) { caixa.hidden = true; return; }
    caixa.hidden = false;
    caixa.innerHTML = '<p class="nenhum">Carregando…</p>';
    const r = await api('/paginas/' + encodeURIComponent(slug) + '/historico');
    if (!r.ok) { caixa.innerHTML = '<p class="nenhum">Não consegui carregar o histórico.</p>'; return; }
    const v = r.data.versoes;
    caixa.innerHTML = `<h3>Versões anteriores</h3>` + (v.length
      ? `<ul>${v.map((x) => `<li><span>${new Date(x.created_at).toLocaleString('pt-BR')} · ${esc(x.editor_nome || 'alguém')} · ${(x.tamanho || 0).toLocaleString('pt-BR')} caracteres</span>
          <button class="wiki-btn pequeno" data-rev="${x.id}" type="button">Restaurar</button></li>`).join('')}</ul>
        <p class="nenhum">Restaurar guarda a versão atual no histórico, então dá para desfazer.</p>`
      : '<p class="nenhum">Ainda não há versões anteriores: a página nunca foi alterada pelo site.</p>');
    caixa.querySelectorAll('[data-rev]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Restaurar esta versão? A versão atual fica guardada no histórico.')) return;
      const d = await api(`/paginas/${encodeURIComponent(slug)}/restaurar/${b.dataset.rev}`, { method: 'POST' });
      if (d.ok) { state.listaOk = false; toast('Versão restaurada.'); renderizar(); } else toast(d.data.message || 'Falha ao restaurar.', true);
    }));
  }

  // ─── Mapa (grafo) ───────────────────────────────────────────────────────
  const PALETA = ['#c9a84c', '#6fa8dc', '#8fbf6a', '#c97a7a', '#a58bd6', '#d99a5b', '#5fb3b3'];

  async function telaGrafo(rota, vivo) {
    document.title = 'Mapa — Compêndio';
    const r = await api('/grafo');
    if (!vivo()) return;
    if (!r.ok || !r.data.nos.length) {
      main.innerHTML = '<div class="wiki-vazio">Ainda não há páginas para desenhar o mapa.</div>'; return;
    }
    const dados = r.data;
    const pastas = [...new Set(dados.nos.filter((n) => !n.faltando).map((n) => (n.pasta || '').split('/')[0] || 'Geral'))];
    const corDe = (n) => PALETA[Math.max(0, pastas.indexOf((n.pasta || '').split('/')[0] || 'Geral')) % PALETA.length];
    const temFantasmas = dados.nos.some((n) => n.faltando);

    main.innerHTML = `
      <div class="wiki-graph-wrap wiki-wide">
        <div class="wiki-graph-bar">
          <input type="search" id="gFiltro" placeholder="Destacar página…" aria-label="Destacar página" />
          ${temFantasmas ? `<label><input type="checkbox" id="gFantasmas" ${ehMestre() ? 'checked' : ''}/> Mostrar não escritas</label>` : ''}
          <span id="gInfo"></span>
          <span class="wiki-legend">${pastas.map((p, i) => `<span><i style="background:${PALETA[i % PALETA.length]}"></i>${esc(p)}</span>`).join('')}</span>
        </div>
        <svg id="grafo" role="img" aria-label="Mapa de páginas e links entre elas"></svg>
      </div>
      <p class="wiki-graph-dica wiki-wide">Arraste para mover, role para ampliar, clique em uma página para abri-la.${ehMestre() ? ' Borda vermelha = só mestre. Círculo tracejado = ainda não escrita (clique para criar).' : ''}</p>`;

    const svgEl = $('#grafo');
    let sim = null;

    function desenhar() {
      if (sim) sim.stop();
      const mostrarFantasmas = $('#gFantasmas') ? $('#gFantasmas').checked : false;
      const nos = dados.nos.filter((n) => mostrarFantasmas || !n.faltando).map((n) => ({ ...n }));
      const ids = new Set(nos.map((n) => n.id));
      const lig = dados.arestas.filter((a) => ids.has(a.origem) && ids.has(a.destino)).map((a) => ({ source: a.origem, target: a.destino }));
      const vizinhos = new Map(nos.map((n) => [n.id, new Set()]));
      lig.forEach((l) => { vizinhos.get(l.source).add(l.target); vizinhos.get(l.target).add(l.source); });
      $('#gInfo').textContent = `${nos.filter((n) => !n.faltando).length} páginas · ${lig.length} links`;

      const svg = d3.select(svgEl); svg.selectAll('*').remove();
      const W = svgEl.clientWidth || 800, H = svgEl.clientHeight || 600;
      const raio = (n) => 6 + Math.sqrt(n.grau) * 2.8;
      const g = svg.append('g');
      let kAtual = 1;
      // Rótulos: páginas principais sempre; as demais só com zoom; "não escritas" só com bastante zoom.
      const rotuloVisivel = (n, k) => n.id === rota.foco || (n.faltando ? k >= 1.2 : (k >= 0.7 || n.grau >= 6));
      const atualizarRotulos = () => noEls.select('text').style('display', (n) => (rotuloVisivel(n, kAtual) ? null : 'none'));
      const zoom = d3.zoom().scaleExtent([0.12, 4]).extent([[0, 0], [W, H]]).on('zoom', (e) => {
        g.attr('transform', e.transform); kAtual = e.transform.k; atualizarRotulos();
      });
      svg.call(zoom).on('dblclick.zoom', null);

      const linhas = g.append('g').selectAll('line').data(lig).join('line').attr('class', 'g-link');
      const noEls = g.append('g').selectAll('g').data(nos).join('g')
        .attr('class', (n) => 'g-node' + (n.faltando ? ' faltando' : '') + (n.visibilidade === 'mestre' && ehMestre() ? ' mestre' : '') + (n.id === rota.foco ? ' foco' : ''));
      noEls.append('circle').attr('r', raio).attr('fill', corDe);
      noEls.append('text').attr('dy', (n) => raio(n) + 13).text((n) => n.titulo);
      noEls.append('title').text((n) => n.faltando ? `${n.titulo} (ainda não escrita)` : n.titulo);

      noEls.on('click', (_e, n) => {
        if (!n.faltando) ir('/wiki/p/' + n.id);
        else if (ehMestre()) ir('/wiki/novo?titulo=' + encodeURIComponent(n.titulo));
      });
      noEls.on('mouseenter', (_e, n) => {
        noEls.classed('apagado', (m) => m.id !== n.id && !vizinhos.get(n.id).has(m.id));
        noEls.select('text').style('display', (m) => (m.id === n.id || vizinhos.get(n.id).has(m.id) ? null : 'none'));
        linhas.classed('apagado', (l) => l.source.id !== n.id && l.target.id !== n.id).classed('dest', (l) => l.source.id === n.id || l.target.id === n.id);
      }).on('mouseleave', () => {
        noEls.classed('apagado', false); linhas.classed('apagado', false).classed('dest', false);
        atualizarRotulos(); aplicarFiltro();
      });

      noEls.call(d3.drag()
        .on('start', (e, n) => { if (!e.active) sim.alphaTarget(0.25).restart(); n.fx = n.x; n.fy = n.y; })
        .on('drag', (e, n) => { n.fx = e.x; n.fy = e.y; })
        .on('end', (e, n) => { if (!e.active) sim.alphaTarget(0); n.fx = null; n.fy = null; }));

      sim = d3.forceSimulation(nos)
        .force('link', d3.forceLink(lig).id((n) => n.id).distance(75).strength(0.45))
        // Páginas soltas (sem links) e folhas repelem menos e são puxadas ao centro: não fogem para longe
        // e o grupo principal continua grande o bastante para ler.
        .force('charge', d3.forceManyBody().strength((n) => (n.grau === 0 ? -30 : n.grau === 1 ? -130 : -280)))
        .force('center', d3.forceCenter(W / 2, H / 2))
        .force('x', d3.forceX(W / 2).strength((n) => (n.grau === 0 ? 0.16 : 0.05)))
        .force('y', d3.forceY(H / 2).strength((n) => (n.grau === 0 ? 0.16 : 0.05)))
        .force('colisao', d3.forceCollide().radius((n) => raio(n) + 14))
        .on('tick', () => {
          linhas.attr('x1', (l) => l.source.x).attr('y1', (l) => l.source.y).attr('x2', (l) => l.target.x).attr('y2', (l) => l.target.y);
          noEls.attr('transform', (n) => `translate(${n.x},${n.y})`);
        });

      simAtiva = sim;
      function enquadrar(animar) {
        if (!svgEl.isConnected) return;
        const xs = nos.map((n) => n.x), ys = nos.map((n) => n.y);
        if (!xs.length || xs.some((v) => v == null)) return;
        const x0 = Math.min(...xs) - 60, x1 = Math.max(...xs) + 60, y0 = Math.min(...ys) - 50, y1 = Math.max(...ys) + 60;
        const k = Math.min(1.4, 0.95 * Math.min(W / (x1 - x0), H / (y1 - y0)));
        const t = d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2).scale(k);
        (animar ? svg.transition().duration(500) : svg).call(zoom.transform, t);
      }
      sim.on('end', () => enquadrar(true));
      for (let i = 0; i < 120; i++) sim.tick(); // pré-aquece para não "explodir" na tela
      atualizarRotulos();
      enquadrar(false);

      function aplicarFiltro() {
        const q = slugify($('#gFiltro').value);
        noEls.classed('apagado', (n) => !!q && !slugify(n.titulo).includes(q));
        linhas.classed('apagado', (l) => !!q && !(slugify(l.source.titulo).includes(q) || slugify(l.target.titulo).includes(q)));
      }
      $('#gFiltro').oninput = aplicarFiltro;
      $('#gFiltro').onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        const q = slugify($('#gFiltro').value);
        const achado = nos.find((n) => !n.faltando && slugify(n.titulo).includes(q));
        if (q && achado) ir('/wiki/p/' + achado.id);
      };
    }

    desenhar();
    if ($('#gFantasmas')) $('#gFantasmas').addEventListener('change', desenhar);
  }

  // ─── Linha do tempo ─────────────────────────────────────────────────────
  async function telaTempo(_r, vivo) {
    document.title = 'Linha do tempo — Compêndio';
    const r = await api('/eventos');
    if (!vivo()) return;
    const eventos = r.ok ? r.data.eventos : [];
    const eras = [];
    for (const ev of eventos) {
      const nome = ev.era || 'Sem era definida';
      let era = eras.find((e) => e.nome === nome);
      if (!era) eras.push((era = { nome, itens: [] }));
      era.itens.push(ev);
    }
    main.innerHTML = `
      <div class="tl-topo">
        <div class="wiki-hero"><h1>Linha do tempo</h1><p>Os acontecimentos do universo, em ordem.</p></div>
        ${ehMestre() ? '<button class="wiki-btn primario" id="tlNovo" type="button"><i class="fa-solid fa-plus"></i> Novo evento</button>' : ''}
      </div>
      ${eras.length ? eras.map((era) => `
        <section class="tl-era"><h2>${esc(era.nome)}</h2>
          <ol class="tl-list">${era.itens.map((ev) => `
            <li class="tl-item"><div class="tl-card" data-id="${ev.id}">
              ${ev.data_texto ? `<div class="tl-data">${esc(ev.data_texto)}</div>` : ''}
              <h3>${esc(ev.titulo)}</h3>
              ${ev.descricao ? `<p>${esc(ev.descricao)}</p>` : ''}
              <div class="tl-rodape">
                ${ev.pagina_slug ? `<a class="mais" href="/wiki/p/${ev.pagina_slug}">Ler mais →</a>` : ''}
                ${ehMestre() ? `<span class="wiki-badge ${ev.visibilidade}">${VIS[ev.visibilidade].rotulo}</span>
                  <span class="acoes"><button class="wiki-btn pequeno" data-acao="editar" type="button"><i class="fa-solid fa-pen"></i></button>
                  <button class="wiki-btn pequeno perigo" data-acao="excluir" type="button"><i class="fa-solid fa-trash"></i></button></span>` : ''}
              </div></div></li>`).join('')}
          </ol></section>`).join('')
        : `<div class="wiki-vazio">${ehMestre() ? 'Nenhum evento ainda. Crie o primeiro com o botão acima.' : 'Ainda não há eventos liberados para você.'}</div>`}`;

    if (!ehMestre()) return;
    $('#tlNovo').addEventListener('click', () => modalEvento(null, eventos));
    main.querySelectorAll('.tl-card').forEach((card) => {
      const ev = eventos.find((x) => String(x.id) === card.dataset.id);
      card.querySelector('[data-acao=editar]').addEventListener('click', () => modalEvento(ev, eventos));
      card.querySelector('[data-acao=excluir]').addEventListener('click', async () => {
        if (!confirm(`Excluir o evento "${ev.titulo}"?`)) return;
        const d = await api('/eventos/' + ev.id, { method: 'DELETE' });
        if (d.ok) { toast('Evento excluído.'); renderizar(); } else toast(d.data.message || 'Falha ao excluir.', true);
      });
    });
  }

  function modalEvento(ev, todos) {
    const eras = [...new Set(todos.map((e) => e.era).filter(Boolean))];
    const proxOrdem = todos.length ? Math.max(...todos.map((e) => e.ordem)) + 10 : 10;
    const fundo = document.createElement('div');
    fundo.className = 'wiki-modal-fundo';
    fundo.innerHTML = `
      <form class="wiki-modal" role="dialog" aria-modal="true" aria-label="${ev ? 'Editar evento' : 'Novo evento'}">
        <h2>${ev ? 'Editar evento' : 'Novo evento'}</h2>
        <div class="campo"><label>Título<input name="titulo" required maxlength="200" value="${esc(ev?.titulo)}"></label></div>
        <div class="dupla">
          <div class="campo"><label>Era<input name="era" list="listaEras" maxlength="120" value="${esc(ev?.era)}" placeholder="Ex.: Segunda geração"></label>
            <datalist id="listaEras">${eras.map((e) => `<option value="${esc(e)}">`).join('')}</datalist></div>
          <div class="campo"><label>Data (texto livre)<input name="data_texto" maxlength="120" value="${esc(ev?.data_texto)}" placeholder="Ex.: Ano 312 da Queda"></label></div>
        </div>
        <div class="campo"><label>Descrição<textarea name="descricao" rows="4" maxlength="5000">${esc(ev?.descricao)}</textarea></label></div>
        <div class="dupla">
          <div class="campo"><label>Ordem<input name="ordem" type="number" value="${ev ? ev.ordem : proxOrdem}"><small>Menor = mais antigo. Use saltos de 10 para poder encaixar eventos depois.</small></label></div>
          <div class="campo"><label>Visível para<select name="visibilidade">${Object.entries(VIS).map(([k, v]) => `<option value="${k}" ${(ev?.visibilidade || 'mestre') === k ? 'selected' : ''}>${v.rotulo}</option>`).join('')}</select></label></div>
        </div>
        <div class="campo"><label>Página relacionada
          <select name="pagina_slug"><option value="">(nenhuma)</option>${state.paginas.map((p) => `<option value="${p.slug}" ${ev?.pagina_slug === p.slug ? 'selected' : ''}>${esc(p.titulo)}</option>`).join('')}</select></label></div>
        <div class="acoes"><button type="button" class="wiki-btn" data-fechar>Cancelar</button><button class="wiki-btn primario" type="submit">Salvar</button></div>
      </form>`;
    document.body.appendChild(fundo);
    const form = $('form', fundo);
    const fechar = () => { fundo.remove(); document.removeEventListener('keydown', esc_); };
    const esc_ = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc_);
    fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
    $('[data-fechar]', fundo).addEventListener('click', fechar);
    form.titulo.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const corpo = Object.fromEntries(new FormData(form));
      const d = ev ? await api('/eventos/' + ev.id, { method: 'PUT', body: corpo }) : await api('/eventos', { method: 'POST', body: corpo });
      if (d.ok) { fechar(); toast('Evento salvo.'); renderizar(); } else toast(d.data.message || 'Falha ao salvar.', true);
    });
  }

  // ─── Editor (mestre) ────────────────────────────────────────────────────
  async function telaEditor(rota, vivo) {
    if (!ehMestre()) {
      main.innerHTML = '<div class="wiki-vazio"><h2>Só o mestre edita</h2><a class="wiki-btn" href="/wiki">Voltar</a></div>'; return;
    }
    let pagina = { titulo: rota.titulo || '', pasta: rota.pasta || '', visibilidade: 'jogador', conteudo: '' };
    const editando = rota.nome === 'editar';
    if (editando) {
      const r = await api('/paginas/' + encodeURIComponent(rota.slug));
      if (!vivo()) return;
      if (!r.ok) return tela404();
      pagina = r.data.pagina;
    }
    document.title = (editando ? 'Editar ' + pagina.titulo : 'Nova página') + ' — Compêndio';
    const pastas = [...new Set(state.paginas.map((p) => p.pasta).filter(Boolean))];

    main.innerHTML = `
      <form class="wiki-editor wiki-wide" autocomplete="off">
        <h1 class="wiki-title">${editando ? 'Editar página' : 'Nova página'}</h1>
        <div class="linha">
          <label>Título<input id="eTitulo" required maxlength="200" value="${esc(pagina.titulo)}"></label>
          <label>Pasta<input id="ePasta" list="listaPastas" maxlength="190" value="${esc(pagina.pasta)}" placeholder="(raiz)"></label>
          <datalist id="listaPastas">${pastas.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
          <label>Quem pode ver<select id="eVis">${Object.entries(VIS).map(([k, v]) => `<option value="${k}" ${pagina.visibilidade === k ? 'selected' : ''}>${v.rotulo} — ${v.dica}</option>`).join('')}</select></label>
        </div>
        <div class="dividido">
          <div><div class="rotulo-previa">MARKDOWN</div><textarea id="eTexto" spellcheck="true">${esc(pagina.conteudo)}</textarea><div id="eSug" class="wiki-sug" hidden></div></div>
          <div><div class="rotulo-previa">PRÉVIA</div><div id="ePrevia" class="previa"></div></div>
        </div>
        <p class="dica">Digite <code>[[</code> para linkar outra página. Links para páginas que não existem aparecem tracejados e viram um atalho de criação.${editando ? ' O endereço da página não muda ao renomear, então nenhum link quebra.' : ''}</p>
        <div class="acoes">
          <button class="wiki-btn primario" type="submit"><i class="fa-solid fa-floppy-disk"></i> Salvar</button>
          <a class="wiki-btn" id="eCancelar" href="${editando ? '/wiki/p/' + pagina.slug : '/wiki'}">Cancelar</a>
          ${editando ? '<span class="dir"><button class="wiki-btn perigo" id="eExcluir" type="button"><i class="fa-solid fa-trash"></i> Excluir</button></span>' : ''}
        </div>
      </form>`;

    const ta = $('#eTexto'), sug = $('#eSug');
    let sujo = false;

    // prévia ao vivo
    const existentes = () => Object.fromEntries(state.paginas.map((p) => [p.slug, p.titulo]));
    let prevTimer;
    const atualizarPrevia = () => { const el = $('#ePrevia'); el.replaceChildren(renderizarMarkdown(ta.value, existentes())); };
    atualizarPrevia();
    ta.addEventListener('input', () => { sujo = true; clearTimeout(prevTimer); prevTimer = setTimeout(atualizarPrevia, 250); sugerir(); });
    $('#eTitulo').addEventListener('input', () => { sujo = true; });

    // autocompletar de [[links]]
    let itens = [], sel = 0;
    function fecharSug() { sug.hidden = true; itens = []; }
    function sugerir() {
      const antes = ta.value.slice(0, ta.selectionStart);
      const m = antes.match(/\[\[([^\]\n|#]*)$/);
      if (!m) return fecharSug();
      const q = slugify(m[1]);
      itens = state.paginas.filter((p) => !q || slugify(p.titulo).includes(q)).slice(0, 8);
      if (!itens.length) return fecharSug();
      sel = 0; desenharSug();
      // posiciona logo abaixo do campo de texto, perto do topo
      sug.style.top = '28px'; sug.hidden = false;
    }
    function desenharSug() {
      sug.innerHTML = itens.map((p, i) => `<button type="button" data-i="${i}" class="${i === sel ? 'sel' : ''}">${esc(p.titulo)}${p.pasta ? `<small>${esc(p.pasta)}</small>` : ''}</button>`).join('');
    }
    function escolher(i) {
      const p = itens[i]; if (!p) return;
      const pos = ta.selectionStart, antes = ta.value.slice(0, pos), depois = ta.value.slice(pos);
      const ini = antes.lastIndexOf('[[') + 2;
      const fecha = depois.startsWith(']]') ? '' : ']]';
      ta.value = antes.slice(0, ini) + p.titulo + fecha + depois;
      const novo = ini + p.titulo.length + 2; // cursor logo depois do ]]
      ta.setSelectionRange(novo, novo); ta.focus(); fecharSug(); sujo = true; atualizarPrevia();
    }
    sug.addEventListener('mousedown', (e) => { const b = e.target.closest('button'); if (b) { e.preventDefault(); escolher(+b.dataset.i); } });
    ta.addEventListener('keydown', (e) => {
      if (sug.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % itens.length; desenharSug(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + itens.length) % itens.length; desenharSug(); }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); escolher(sel); }
      else if (e.key === 'Escape') { e.preventDefault(); fecharSug(); }
    });
    ta.addEventListener('blur', () => setTimeout(fecharSug, 120));

    $('#eCancelar').addEventListener('click', (e) => {
      if (sujo && !confirm('Descartar as alterações não salvas?')) { e.preventDefault(); e.stopPropagation(); }
    });

    $('form.wiki-editor').addEventListener('submit', async (e) => {
      e.preventDefault();
      const corpo = { titulo: $('#eTitulo').value, pasta: $('#ePasta').value, visibilidade: $('#eVis').value, conteudo: ta.value };
      const d = editando
        ? await api('/paginas/' + encodeURIComponent(pagina.slug), { method: 'PUT', body: corpo })
        : await api('/paginas', { method: 'POST', body: corpo });
      if (!d.ok) { toast(d.data.message || 'Falha ao salvar.', true); return; }
      sujo = false; state.listaOk = false;
      toast('Página salva.');
      ir('/wiki/p/' + d.data.slug);
    });

    if (editando) {
      $('#eExcluir').addEventListener('click', async () => {
        if (!confirm(`Excluir "${pagina.titulo}" para sempre? Links para ela passarão a aparecer como "não escritos".`)) return;
        const d = await api('/paginas/' + encodeURIComponent(pagina.slug), { method: 'DELETE' });
        if (d.ok) { state.listaOk = false; toast('Página excluída.'); ir('/wiki'); } else toast(d.data.message || 'Falha ao excluir.', true);
      });
    }
    if (!editando) $('#eTitulo').focus();
  }

  // ─── Início ─────────────────────────────────────────────────────────────
  montarTopo();
  renderizar();
})();
