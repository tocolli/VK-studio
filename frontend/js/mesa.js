// frontend/js/mesa.js — VK.Studio Tabletop v3
(function () {
  'use strict';

  // ─── ESTADO ───────────────────────────────────────────────────────────
  const E = {
    sessao: null, mapa: null, tokens: [], fogCelulas: null,
    ferramenta: 'select', zoom: 1, panX: 0, panY: 0,
    isMestre: false, userId: null, userName: '',
    tokenSel: null, arrastandoToken: null, arrastOffset: {x:0,y:0},
    sidebarAberta: false, sidebarAba: 'fichas',
    sessaoId: null, mapaId: null,
    editandoTokenId: null, imagemTokenSel: '',
    fichas: [], // fichas do jogador atual
    janelas: new Map(), // fichaId → elemento DOM da janela
    // Medição
    medindoInicio: null,
    // Pan
    panInicio: null, panInicioPan: null,
    painting: false,
    msgNaoLidas: 0,
    fogOriginal: null, // cópia do fog antes de aplicar iluminação
  };

  const canvas  = document.getElementById('mesaCanvas');
  const ctx     = canvas.getContext('2d');
  const tokenImgs = {};
  let   mapaImg   = null;
  let   socket    = null;
  let   diceBox   = null;

  // ─── INIT ─────────────────────────────────────────────────────────────
  async function init() {
    const user   = VK.user;
    E.isMestre   = VK.isMestre; // Master global do site
    E.userId     = user.id;
    E.userName   = user.nome;

    if (E.isMestre) {
      document.getElementById('grupoMestre').style.display = 'flex';
      document.getElementById('grupoJogador').style.display = 'none';
      document.getElementById('ouMestre').style.display = 'flex';
      document.getElementById('criarSessaoWrap').style.display = 'block';
      document.getElementById('chatPrivateRow').style.display = 'block';
      document.getElementById('tabConfigs').style.display = 'flex';
    }

    const params = new URLSearchParams(window.location.search);
    const codigo = params.get('codigo');
    if (codigo) document.getElementById('inputCodigo').value = codigo.toUpperCase();
    abrirOverlay('overlayEntrar');

    redimensionar();
    window.addEventListener('resize', redimensionar);
    bindEventos();
    loop();

    // Carrega fichas do jogador para a sidebar
    carregarFichasSidebar();
    // Carrega galeria de fichas no modal de token
    carregarGaleriaFichas();

   setTimeout(async () => {
      if (window.DiceBox) {
        try {
          const container = document.getElementById("dice-box-container");
          
          const vp = document.getElementById('mesaViewport');
          container.style.width = vp.clientWidth + "px";
          container.style.height = vp.clientHeight + "px";

          diceBox = new window.DiceBox("#dice-box-container", {
            assetPath: "https://unpkg.com/@3d-dice/dice-box@1.1.3/dist/assets/",
            theme: "default",
            themeColor: "#c9a84c",
            scale: 6,
            offscreen: false 
          });
          await diceBox.init();
          diceBox.pronto = true;

          window.addEventListener('resize', () => {
             container.style.width = vp.clientWidth + "px";
             container.style.height = vp.clientHeight + "px";
          });
        } catch(e) {
          console.error("Erro ao carregar dados 3D:", e);
        }
      }
    }, 1000);
  }

  // ─── FICHAS SIDEBAR E PASTAS ──────────────────────────────────────────
  async function carregarFichasSidebar() {
    const lista = document.getElementById('listaFichasSidebar');
    try {
      const res = await Api.listarFichas();
      if (!res?.ok || !res.data.fichas.length) return;

      const fichas = E.isMestre
        ? res.data.fichas
        : res.data.fichas.filter(f => f.jogador_id === E.userId);

      E.fichas = fichas;
      lista.innerHTML = '';

      fichas.forEach(f => {
        const item = criarFichaSidebarItem(f);
        lista.appendChild(item);
      });

      if (E.isMestre) {
        document.getElementById('secaoFichasJogadores').style.display = 'block';
        document.getElementById('listaFichasJogadores').innerHTML = '';
        const outros = res.data.fichas.filter(f => f.jogador_id !== E.userId);
        outros.forEach(f => {
          const item = criarFichaSidebarItem(f);
          document.getElementById('listaFichasJogadores').appendChild(item);
        });
      }
    } catch(e) {
      console.error('Erro ao carregar fichas:', e);
    }
  }

  function criarFichaSidebarItem(f) {
    const item = document.createElement('div');
    item.className = 'ficha-sidebar-item';
    item.dataset.fichaId = f.id;
    item.draggable = true;
    item.id = 'drag-ficha-' + f.id;
    item.addEventListener('dragstart', (e) => {
       e.dataTransfer.setData('text/plain', item.id);
    });

    const av = document.createElement('div');
    av.className = 'ficha-sidebar-avatar';
    if (f.imagem_url) av.innerHTML = `<img src="${f.imagem_url}" alt="${escH(f.nome_personagem)}"/>`;
    else av.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

    const info = document.createElement('div');
    info.className = 'ficha-sidebar-info';
    info.innerHTML = `
      <span class="ficha-sidebar-nome">${escH(f.nome_personagem)}</span>
      <span class="ficha-sidebar-sistema">${escH(f.sistema)}</span>`;

    const openBtn = document.createElement('button');
    openBtn.className = 'ficha-sidebar-open-btn';
    openBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    openBtn.title = 'Abrir ficha';

    item.appendChild(av);
    item.appendChild(info);
    item.appendChild(openBtn);

    item.addEventListener('click', () => abrirJanelaFicha(f));
    return item;
  }

  window.criarPastaVisual = function(nome, id = Date.now()) {
    const cont = document.getElementById('listaPastasSidebar');
    if(!cont) return;
    const w = document.createElement('div'); w.className = 'folder-wrap';
    w.innerHTML = `
      <div class="folder-header" onclick="this.nextElementSibling.classList.toggle('open')">
        <span style="display:flex; align-items:center;"><i data-lucide="folder" style="width:12px;height:12px;margin-right:4px;"></i>${escH(nome)}</span>
        <div style="display:flex; align-items:center;">
          <button class="btn-add-ficha-pasta" onclick="event.stopPropagation(); abrirModalAddFichaPasta('${id}')" title="Adicionar Ficha à Pasta">
              <i data-lucide="plus" style="width:14px;height:14px;"></i>
          </button>
          <i data-lucide="chevron-down" style="width:14px;height:14px;"></i>
        </div>
      </div>
      <div class="folder-content" id="pasta-${id}" ondragover="event.preventDefault()" ondrop="soltarNaPasta(event, '${id}')">
        <div style="font-size:0.65rem; color:#666; text-align:center; padding: 4px;">Vazio</div>
      </div>
    `;
    cont.appendChild(w);
    if(window.lucide) lucide.createIcons();
  }

  window.soltarNaPasta = function(e, pastaId) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if(!id) return;
    const el = document.getElementById(id);
    if(el && el.classList.contains('ficha-sidebar-item')) {
       const pasta = document.getElementById('pasta-'+pastaId);
       pasta.appendChild(el);
       const emptyMsg = pasta.querySelector('div');
       if(emptyMsg && emptyMsg.textContent.includes('Vazio')) emptyMsg.remove();
    }
  };

  window.abrirModalAddFichaPasta = function(pastaId) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay open';
    overlay.style.zIndex = '9999';

    const options = E.fichas.map(f => `<option value="${f.id}">${escH(f.nome_personagem)}</option>`).join('');

    if(!options) {
        alertEntrar('Nenhuma ficha disponível.', 'info');
        overlay.remove();
        return;
    }

    overlay.innerHTML = `
      <div class="modal-box" style="max-width:300px;">
        <div class="modal-header">
          <span class="modal-title">Adicionar à Pasta</span>
          <button class="modal-close" onclick="this.closest('.overlay').remove()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
        <div class="modal-field">
          <label>Selecione a Ficha</label>
          <select id="selFichaPasta" class="modal-inp" style="appearance: auto; cursor:pointer;">${options}</select>
        </div>
        <div class="modal-actions">
          <button class="modal-btn ghost" onclick="this.closest('.overlay').remove()">Cancelar</button>
          <button class="modal-btn primary" id="btnConfirmAddFicha">Adicionar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#btnConfirmAddFicha').addEventListener('click', () => {
       const fId = overlay.querySelector('#selFichaPasta').value;
       if(fId) {
          const el = document.getElementById('drag-ficha-' + fId);
          if(el) {
             const pasta = document.getElementById('pasta-' + pastaId);
             pasta.appendChild(el);
             const emptyMsg = pasta.querySelector('div');
             if(emptyMsg && emptyMsg.textContent.includes('Vazio')) emptyMsg.remove();
          } else {
             alertEntrar('Ficha não encontrada na barra lateral.', 'erro');
          }
       }
       overlay.remove();
    });
  };

  // ─── JANELAS ARRASTÁVEIS ──────────────────────────────────────────────
  async function abrirJanelaFicha(fichaResumida) {
    if (E.janelas.has(fichaResumida.id)) {
      const janela = E.janelas.get(fichaResumida.id);
      janela.style.zIndex = proxZ();
      return;
    }

    const res = await Api.request(`/fichas/${fichaResumida.id}`);
    if (!res?.ok) return;
    const f    = res.data.ficha;
    const atrs = typeof f.atributos === 'string' ? JSON.parse(f.atributos) : f.atributos;

    const janela = criarJanela({
      titulo: f.nome_personagem,
      icone: 'scroll-text',
      largura: 440,
      onClose: () => E.janelas.delete(f.id),
    });

    const estado = FichaCavaleiros.ESTADO_DEFAULT();
    estado.id          = f.id;
    estado.nome        = f.nome_personagem;
    estado.avatar_url  = f.imagem_url || '';
    estado.classe      = atrs.classe       || '';
    estado.patente     = atrs.patente      || 'Soldado';
    estado.vit         = atrs.vitalidade   || [7,7];
    estado.imp         = atrs.impeto       || [9,9];
    estado.luc         = atrs.lucidez      || [10,10];
    estado.arm         = atrs.armadura     || [10,10];
    estado.arm_estagio = atrs.arm_estagio  || 'Impecável';
    estado.atrs        = atrs.atributos_cav || estado.atrs;
    estado.proficiencias = atrs.proficiencias || estado.proficiencias;
    estado.habilidades   = atrs.habilidades   || [];
    estado.inventario    = atrs.inventario     || estado.inventario;
    estado.status        = atrs.status         || [];
    estado.notas         = atrs.notas          || '';

    if (f.sistema === 'Cavaleiros de Armadura' && window.FichaCavaleiros) {
      FichaCavaleiros.render(janela.body, estado, async (e) => {
        const fd = new FormData();
        fd.append('nome_personagem', e.nome);
        fd.append('sistema', 'Cavaleiros de Armadura');
        fd.append('atributos', JSON.stringify({
          classe: e.classe, patente: e.patente,
          vitalidade: e.vit, impeto: e.imp, lucidez: e.luc,
          armadura: e.arm, arm_estagio: e.arm_estagio,
          atributos_cav: e.atrs, proficiencias: e.proficiencias,
          habilidades: e.habilidades, inventario: e.inventario,
          status: e.status, notas: e.notas,
        }));
        await Api.atualizarFicha(e.id, fd);
        socket?.emit('ficha:alterada', {
          sessaoId: E.sessaoId,
          jogadorId: E.userId,
          jogadorNome: E.userName,
          fichaId: e.id,
          personagem: e.nome,
          resumo: { vit: e.vit, imp: e.imp, luc: e.luc },
        });
      });
    } else {
      janela.body.innerHTML = `
        <div style="padding:1.5rem;text-align:center;font-family:var(--font-h);
             font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);">
          ${escH(f.sistema)}<br>
          <span style="color:var(--gold-dim);margin-top:.5rem;display:block;">
            Suporte a este sistema em breve.
          </span>
        </div>`;
    }

    E.janelas.set(f.id, janela.el);

    const offset = E.janelas.size * 24;
    const el = janela.el;
    el.style.left = (window.innerWidth  / 2 - 220 + offset) + 'px';
    el.style.top  = (window.innerHeight / 2 - 300 + offset) + 'px';
    el.style.zIndex = proxZ();
    
    inicializarFichaAtiva();
  }

  let _z = 300;
  function proxZ() { return ++_z; }

  function criarJanela({ titulo, icone, largura = 420, onClose }) {
    const el = document.createElement('div');
    el.className = 'vk-window';
    el.style.width = largura + 'px';

    let maximizada = false;
    let posSalva   = null;

    el.innerHTML = `
      <div class="vk-window-titlebar" id="tb_${Date.now()}">
        <span class="vk-window-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
        </span>
        <span class="vk-window-title">${escH(titulo)}</span>
        <div class="vk-window-controls">
          <button class="vk-window-btn maximize" title="Maximizar/Restaurar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          </button>
          <button class="vk-window-btn close" title="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="vk-window-body" style="overflow-y: auto; overflow-x: hidden; max-height: 80vh; height: 100%;"></div>
      <div class="vk-window-resize">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22,12 22,22 12,22"/>
          <polyline points="22,17 17,22"/>
        </svg>
      </div>`;

    const body     = el.querySelector('.vk-window-body');
    const titlebar = el.querySelector('.vk-window-titlebar');
    const btnMax   = el.querySelector('.vk-window-btn.maximize');
    const btnClose = el.querySelector('.vk-window-btn.close');
    const resize   = el.querySelector('.vk-window-resize');

    btnClose.addEventListener('click', () => { el.remove(); onClose?.(); });

    btnMax.addEventListener('click', () => {
      maximizada = !maximizada;
      if (maximizada) {
        posSalva = { top: el.style.top, left: el.style.left, w: el.style.width, h: el.style.height };
        el.classList.add('maximized');
      } else {
        el.classList.remove('maximized');
        if (posSalva) {
          el.style.top    = posSalva.top;
          el.style.left   = posSalva.left;
          el.style.width  = posSalva.w;
          el.style.height = posSalva.h;
        }
      }
    });

    titlebar.addEventListener('dblclick', () => btnMax.click());
    makeDraggable(el, titlebar);
    makeResizable(el, resize);

    el.addEventListener('mousedown', () => { el.style.zIndex = proxZ(); });

    document.getElementById('windowsContainer').appendChild(el);
    return { el, body };
  }

  function makeDraggable(el, handle) {
    let ox, oy, ex, ey;
    handle.addEventListener('mousedown', e => {
      if (e.target.closest('.vk-window-controls')) return;
      if (el.classList.contains('maximized')) return;
      ox = e.clientX; oy = e.clientY;
      ex = el.offsetLeft; ey = el.offsetTop;
      const onMove = mv => {
        el.style.left = Math.max(0, ex + mv.clientX - ox) + 'px';
        el.style.top  = Math.max(46, ey + mv.clientY - oy) + 'px';
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function makeResizable(el, handle) {
    handle.addEventListener('mousedown', e => {
      e.stopPropagation();
      const ox = e.clientX, oy = e.clientY;
      const ow = el.offsetWidth, oh = el.offsetHeight;
      const onMove = mv => {
        el.style.width  = Math.max(320, ow + mv.clientX - ox) + 'px';
        el.style.height = Math.max(200, oh + mv.clientY - oy) + 'px';
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ─── GALERIA DE TOKENS ────────────────────────────────────────────────
  async function carregarGaleriaFichas() {
    const grid = document.getElementById('galeriaFichas');
    try {
      const res = await Api.listarFichas();
      if (!res?.ok || !res.data.fichas.length) { grid.innerHTML = '<div style="color:var(--text-muted);font-size:.72rem;padding:.5rem;">Nenhuma ficha.</div>'; return; }
      grid.innerHTML = '';
      res.data.fichas.forEach(f => adicionarItemGaleria(grid, f.imagem_url, f.nome_personagem));
    } catch { grid.innerHTML = '<div style="color:var(--text-muted);font-size:.72rem;padding:.5rem;">Erro ao carregar.</div>'; }
  }

  async function carregarGaleriaJogadores() {
    const grid = document.getElementById('galeriaJogadores');
    if (grid.dataset.loaded) return;
    grid.dataset.loaded = '1';
    try {
      const res = await Api.listarUsuarios();
      if (!res?.ok) return;
      grid.innerHTML = '';
      res.data.usuarios.forEach(u => adicionarItemGaleria(grid, u.avatar_url, u.nome));
    } catch {}
  }

  function adicionarItemGaleria(grid, url, nome) {
    const item = document.createElement('div');
    item.className = 'galeria-item';
    item.dataset.url = url || '';
    if (url) item.innerHTML = `<img src="${url}" alt="${escH(nome)}"/><span class="galeria-item-lbl">${escH(nome.split(' ')[0])}</span>`;
    else      item.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span class="galeria-item-lbl">${escH(nome.split(' ')[0])}</span>`;
    item.addEventListener('click', () => selecionarGaleria(item, url, nome));
    grid.appendChild(item);
  }

  function selecionarGaleria(itemEl, url, nome) {
    document.querySelectorAll('.galeria-item').forEach(i => i.classList.remove('sel'));
    itemEl.classList.add('sel');
    E.imagemTokenSel = url || '';
    const prev = document.getElementById('galeriaPreview');
    const img  = document.getElementById('galeriaPreviewImg');
    if (url) { img.src = url; prev.style.display = 'flex'; }
    else prev.style.display = 'none';
    if (!document.getElementById('tokenNome').value.trim()) document.getElementById('tokenNome').value = nome;
  }

  // ─── SOCKET ───────────────────────────────────────────────────────────
  function conectar(codigo) {
    socket = io({ auth: { token: Api.getToken() } });
    socket.on('connect', () => socket.emit('mesa:entrar', { codigo }));
    socket.on('connect_error', err => alertEntrar(err.message || 'Erro de conexão.', 'erro'));

    socket.on('mesa:estado_inicial', ({ sessao, usuarios }) => {
      E.sessao = sessao; E.sessaoId = sessao.id;
      if (sessao.mestre_id === E.userId || VK.isMestre) {
        E.isMestre = true;
        document.getElementById('grupoMestre').style.display = 'flex';
        document.getElementById('grupoJogador').style.display = 'none';
        document.getElementById('ouMestre').style.display = 'flex';
        document.getElementById('criarSessaoWrap').style.display = 'block';
        document.getElementById('chatPrivateRow').style.display = 'block';
        document.getElementById('tabConfigs').style.display = 'flex';
      }
      
      setTimeout(carregarVitrineLoja, 1000);
      fecharOverlay('overlayEntrar');
      document.getElementById('topbarNomeSessao').textContent = sessao.nome;
      document.getElementById('topbarCodigo').textContent     = '#' + sessao.codigo;
      atualizarPips(usuarios);
      if (sessao.mapa_id) {
        E.mapa   = { id:sessao.mapa_id, nome:sessao.mapa_nome, imagem_url:sessao.mapa_url,
                     largura_grid:sessao.largura_grid, altura_grid:sessao.altura_grid, tamanho_cel:sessao.tamanho_cel };
        E.mapaId = sessao.mapa_id;
        carregarImgMapa(sessao.mapa_url);
      }
      history.replaceState(null, '', `/mesa?codigo=${sessao.codigo}`);
      document.getElementById('configSessaoInfo').textContent =
        `Código: ${sessao.codigo} · Mestre: ${sessao.mestre_nome || '—'}`;
    });

    socket.on('mesa:erro',           ({ msg }) => alertEntrar(msg, 'erro'));
    socket.on('mesa:usuario_entrou', ({ usuario }) => { addPip(usuario); msgSistema(usuario.nome + ' entrou na mesa.'); });
    socket.on('mesa:usuario_saiu',   ({ usuario }) => { remPip(usuario.id); msgSistema(usuario.nome + ' saiu.'); });

    socket.on('mapa:trocado', ({ mapa, tokens, celulas }) => {
      E.mapa=mapa; E.mapaId=mapa.id; E.tokens=tokens||[]; E.fogCelulas=celulas;
      carregarImgMapa(mapa.imagem_url); E.tokens.forEach(preloadTokenImg);
    });

    socket.on('tokens:lista',     ({ tokens })            => { E.tokens=tokens||[]; E.tokens.forEach(preloadTokenImg); });
    socket.on('token:criado',     ({ token })             => { E.tokens.push(token); preloadTokenImg(token); });
    socket.on('token:movido',     ({ tokenId,pos_x,pos_y}) => { const t=E.tokens.find(t=>t.id===tokenId); if(t){t.pos_x=pos_x;t.pos_y=pos_y;} });
    socket.on('token:atualizado', ({ tokenId,dados})      => { const t=E.tokens.find(t=>t.id===tokenId); if(t) Object.assign(t,dados); });
    socket.on('token:deletado',   ({ tokenId })           => {
      E.tokens=E.tokens.filter(t=>t.id!==tokenId);
      if(E.tokenSel?.id===tokenId){E.tokenSel=null;fecharCtxMenu();}
    });

    socket.on('fog:atualizado',        ({celulas}) => { E.fogCelulas=celulas; });
    socket.on('fog:atualizado_mestre', ({celulas}) => { E.fogCelulas=celulas; });
    socket.on('fog:celula_atualizada', ({row,col,valor}) => { if(E.fogCelulas?.[row]) E.fogCelulas[row][col]=valor; });

    socket.on('mesa:ping_visual', ({x,y}) => mostrarPing(x,y));

    socket.on('ficha:alterada', ({ jogadorNome, personagem, resumo, fichaId }) => {
      if (E.isMestre) {
        msgSistema(`${jogadorNome} atualizou "${personagem}" — Vida: ${resumo.vit[0]}/${resumo.vit[1]}`);
      }
      
      const tokensVinculados = E.tokens.filter(t => String(t.ficha_id) === String(fichaId));
      tokensVinculados.forEach(t => {
         if (E.isMestre) {
             socket.emit('token:atualizar', {
                 sessaoId: E.sessaoId, 
                 tokenId: t.id, 
                 dados: { hp_atual: resumo.vit[0], hp_max: resumo.vit[1] }
             });
         }
      });
    });

    socket.on('chat:historico', ({ mensagens }) => {
      document.getElementById('chatMsgs').innerHTML = '';
      mensagens.forEach(renderMsg);
    });
    socket.on('chat:nova_mensagem', msg => {
      renderMsg(msg);
      if (E.sidebarAba !== 'chat') {
        E.msgNaoLidas++;
        document.getElementById('chatBadge').textContent    = E.msgNaoLidas;
        document.getElementById('chatBadge').style.display  = 'flex';
        document.getElementById('chatBadgeTab').textContent  = E.msgNaoLidas;
        document.getElementById('chatBadgeTab').style.display= 'flex';
      }
    });
  }

  // ─── CANVAS RENDER E NEBLINA OTIMIZADA ────────────────────────────────
  function loop() { renderFrame(); requestAnimationFrame(loop); }

  function renderFrame() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();
    ctx.translate(E.panX,E.panY);
    ctx.scale(E.zoom,E.zoom);

    if (!E.mapa) {
      ctx.restore();
      ctx.fillStyle='#2e3145';
      ctx.font='13px Cinzel,serif';
      ctx.textAlign='center';
      ctx.fillText(E.isMestre?'Clique em Mapas para adicionar um mapa':'Aguardando o Mestre...', canvas.width/2, canvas.height/2);
      return;
    }

    const cel=E.mapa.tamanho_cel||60, cols=E.mapa.largura_grid||20, rows=E.mapa.altura_grid||20;

    if (mapaImg?.complete && mapaImg.naturalWidth>0) ctx.drawImage(mapaImg,0,0,cols*cel,rows*cel);
    else { ctx.fillStyle='#161820'; ctx.fillRect(0,0,cols*cel,rows*cel); }

    desenharGrid(cols,rows,cel);
    E.tokens.forEach(t=>desenharToken(t,cel));
    
    if(E.fogCelulas) {
      desenharFog(cols,rows,cel);
    }
    
    if (E.tokenSel) {
      const t=E.tokens.find(t=>t.id===E.tokenSel.id);
      if(t) desenharSelecao(t,cel);
    }
    if (E.ferramenta==='measure'&&E.medindoInicio&&E.mouseMapaAtual) {
      const {x:x1,y:y1}=E.medindoInicio, {x:x2,y:y2}=E.mouseMapaAtual;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
      ctx.strokeStyle='rgba(201,168,76,.7)'; ctx.lineWidth=2; ctx.setLineDash([6,3]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function desenharGrid(cols,rows,cel) {
    ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.lineWidth=.5; ctx.beginPath();
    for(let x=0;x<=cols;x++){ctx.moveTo(x*cel,0);ctx.lineTo(x*cel,rows*cel);}
    for(let y=0;y<=rows;y++){ctx.moveTo(0,y*cel);ctx.lineTo(cols*cel,y*cel);}
    ctx.stroke();
  }

  function desenharToken(t,cel) {
    if(!t.visivel&&!E.isMestre) return;
    const tam=(t.tamanho||1)*cel, cx=t.pos_x*cel+tam/2, cy=t.pos_y*cel+tam/2, r=tam/2-3;

    const ex2 = t.dados_extras
      ? (typeof t.dados_extras==='string' ? JSON.parse(t.dados_extras) : t.dados_extras)
      : {};
    if(ex2.luz_ativa && ex2.luz_raio > 0) {
      ctx.save();
      const raioCanvas = ex2.luz_raio * cel;
      const grad = ctx.createRadialGradient(cx, cy, r, cx, cy, raioCanvas);
      grad.addColorStop(0,   'rgba(255,240,180,0.10)');
      grad.addColorStop(0.6, 'rgba(255,220,100,0.04)');
      grad.addColorStop(1,   'rgba(255,200, 50,0.00)');
      ctx.beginPath();
      ctx.arc(cx, cy, raioCanvas, 0, Math.PI*2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor='rgba(0,0,0,.65)'; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle=t.cor||'#c9a84c'; ctx.fill();
    if(t.imagem_url&&tokenImgs[t.id]?.complete){
      ctx.save(); ctx.clip(); ctx.drawImage(tokenImgs[t.id],t.pos_x*cel+3,t.pos_y*cel+3,tam-6,tam-6); ctx.restore();
    }
    ctx.restore();
    ctx.shadowColor='transparent'; ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle=!t.visivel?'rgba(255,255,255,.2)':(t.cor||'#c9a84c');
    ctx.lineWidth=2; ctx.stroke();

    const hp=Math.max(0,Math.min(1,(t.hp_atual||0)/(t.hp_max||1)));
    const bW=tam-8,bY=t.pos_y*cel+tam-8,bX=t.pos_x*cel+4;
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(bX,bY,bW,4);
    ctx.fillStyle=hp>.5?'#27ae60':hp>.2?'#f39c12':'#e74c3c'; ctx.fillRect(bX,bY,bW*hp,4);

    const fs=Math.max(9,cel*.14);
    ctx.font=`600 ${fs}px Cinzel,serif`; ctx.textAlign='center';
    ctx.strokeStyle='rgba(0,0,0,.85)'; ctx.lineWidth=3;
    ctx.strokeText(t.nome,cx,t.pos_y*cel+tam+12);
    ctx.fillStyle='#fff'; ctx.fillText(t.nome,cx,t.pos_y*cel+tam+12);

    if(!t.visivel&&E.isMestre){
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fill();
    }
  }

  function desenharSelecao(t,cel) {
    const tam=(t.tamanho||1)*cel;
    ctx.beginPath(); ctx.arc(t.pos_x*cel+tam/2,t.pos_y*cel+tam/2,tam/2+4,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.lineWidth=2; ctx.setLineDash([6,3]); ctx.stroke(); ctx.setLineDash([]);
  }

  function desenharFog(cols,rows,cel) {
    if(!E.fogCelulas) return;
    
    const mapW = cols * cel;
    const mapH = rows * cel;
    
    if (!window.fogCanvasCache) {
        window.fogCanvasCache = document.createElement('canvas');
    }
    const fogCanvas = window.fogCanvasCache;
    if (fogCanvas.width !== mapW || fogCanvas.height !== mapH) {
        fogCanvas.width = mapW;
        fogCanvas.height = mapH;
    }
    const fctx = fogCanvas.getContext('2d');
    fctx.clearRect(0, 0, mapW, mapH);
    
    fctx.globalCompositeOperation = 'source-over';
    fctx.fillStyle = E.isMestre ? 'rgba(0,0,0,0.5)' : '#000000';
    fctx.fillRect(0, 0, mapW, mapH);
    
    fctx.globalCompositeOperation = 'destination-out';
    for(let r=0;r<rows;r++) {
      for(let c=0;c<cols;c++){
        if(E.fogCelulas[r] && E.fogCelulas[r][c] === 0) {
          fctx.fillStyle = 'rgba(0,0,0,1)';
          fctx.fillRect(c*cel, r*cel, cel, cel);
        }
      }
    }
    
    const luzes = E.tokens.filter(t => {
      const ex = t.dados_extras ? (typeof t.dados_extras==='string' ? JSON.parse(t.dados_extras) : t.dados_extras) : {};
      const temLuz = ex.luz_ativa && ex.luz_raio > 0 && t.visivel !== 0;
      
      if (!temLuz) return false;
      if (E.isMestre) return true; 
      if (!t.ficha_id) return true; 
      
      return E.fichas.some(f => String(f.id) === String(t.ficha_id));
    });

    luzes.forEach(t => {
      const ex = typeof t.dados_extras==='string' ? JSON.parse(t.dados_extras) : t.dados_extras;
      const tam = t.tamanho || 1;
      const raio = parseInt(ex.luz_raio) * cel;
      const cx = t.pos_x * cel + (tam * cel) / 2;
      const cy = t.pos_y * cel + (tam * cel) / 2;

      const grad = fctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
      grad.addColorStop(0, 'rgba(0,0,0,1)'); 
      grad.addColorStop(0.7, 'rgba(0,0,0,0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0)'); 

      fctx.fillStyle = grad;
      fctx.beginPath();
      fctx.arc(cx, cy, raio, 0, Math.PI * 2);
      fctx.fill();
    });

    fctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(fogCanvas, 0, 0);
  }

  function preloadTokenImg(t){
    if(!t.imagem_url||tokenImgs[t.id]) return;
    const img=new Image(); img.crossOrigin='anonymous'; img.src=t.imagem_url; tokenImgs[t.id]=img;
  }

  // ─── COORDS ───────────────────────────────────────────────────────────
  function c2m(cx,cy){return{x:(cx-E.panX)/E.zoom,y:(cy-E.panY)/E.zoom};}
  function tokenEm(mx,my){
    const cel=E.mapa?.tamanho_cel||60;
    for(let i=E.tokens.length-1;i>=0;i--){
      const t=E.tokens[i],tam=(t.tamanho||1)*cel;
      if(mx>=t.pos_x*cel&&mx<=t.pos_x*cel+tam&&my>=t.pos_y*cel&&my<=t.pos_y*cel+tam) return t;
    }
    return null;
  }

  E.mouseMapaAtual = null;

  // ─── EVENTOS ──────────────────────────────────────────────────────────
  function bindEventos() {
    canvas.addEventListener('mousedown',  onMD);
    canvas.addEventListener('mousemove',  onMM);
    canvas.addEventListener('mouseup',    onMU);
    canvas.addEventListener('wheel',      onWheel,{passive:false});
    canvas.addEventListener('dblclick',   onDbl);
    canvas.addEventListener('contextmenu',e=>{e.preventDefault();onRClick(e);});
    canvas.addEventListener('touchstart', onTS,{passive:false});
    canvas.addEventListener('touchmove',  onTM,{passive:false});
    canvas.addEventListener('touchend',   onTE);

    document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
    document.getElementById('btnZoomIn').addEventListener('click',()=>zoom(.1));
    document.getElementById('btnZoomOut').addEventListener('click',()=>zoom(-.1));
    document.getElementById('btnZoomFit').addEventListener('click',fitMapa);

    // Sidebar
    document.querySelectorAll('.sidebar-tab').forEach(t=>t.addEventListener('click',()=>trocarAba(t.dataset.stab)));
    document.getElementById('btnFichas').addEventListener('click',()=>toggleSidebar('fichas'));
    document.getElementById('btnPastas')?.addEventListener('click',()=>toggleSidebar('pastas'));
    document.getElementById('btnChat').addEventListener('click',()=>toggleSidebar('chat'));
    
    // Botão nova pasta
    document.getElementById('btnCriarPasta')?.addEventListener('click', () => {
      const nome = prompt("Nome da pasta:");
      if(nome) criarPastaVisual(nome);
    });

    // Chat
    document.getElementById('btnChatSend').addEventListener('click',enviarChat);
    document.getElementById('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter')enviarChat();});
    document.querySelectorAll('.dado-chip').forEach(b=>b.addEventListener('click',()=>{document.getElementById('chatInput').value=b.dataset.expr;enviarChat();}));

    // Token modal
    document.getElementById('btnAddToken')?.addEventListener('click',()=>abrirModalToken(null));
    document.getElementById('btnTokenSave').addEventListener('click',salvarToken);
    document.getElementById('btnTokenDelete').addEventListener('click',deletarToken);
    document.getElementById('btnTokenCancel').addEventListener('click',()=>fecharOverlay('overlayToken'));

    // Galeria tabs
    document.querySelectorAll('.galeria-tab').forEach(t=>t.addEventListener('click',()=>{
      document.querySelectorAll('.galeria-tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      const tab=t.dataset.gtab;
      document.getElementById('galeriaFichas').style.display    = tab==='fichas'    ?'grid':'none';
      document.getElementById('galeriaJogadores').style.display  = tab==='jogadores' ?'grid':'none';
      document.getElementById('galeriaUrl').style.display        = tab==='url'       ?'block':'none';
      if(tab==='jogadores') carregarGaleriaJogadores();
    }));

    document.getElementById('tokenUrlInput').addEventListener('input',function(){
      E.imagemTokenSel=this.value.trim();
      const p=document.getElementById('galeriaPreview');
      if(E.imagemTokenSel){document.getElementById('galeriaPreviewImg').src=E.imagemTokenSel;p.style.display='flex';}
      else p.style.display='none';
    });
    document.getElementById('btnGaleriaClear').addEventListener('click',()=>{
      E.imagemTokenSel='';
      document.getElementById('galeriaPreview').style.display='none';
      document.querySelectorAll('.galeria-item').forEach(i=>i.classList.remove('sel'));
    });

    // Mapas
    document.getElementById('btnMapas')?.addEventListener('click',abrirModalMapas);
    document.getElementById('btnEnviarMapa')?.addEventListener('click',enviarMapa);

    // Fechar overlays
    document.querySelectorAll('.modal-close[data-close]').forEach(b=>b.addEventListener('click',()=>fecharOverlay(b.dataset.close)));

    // Entrar / criar
    document.getElementById('btnEntrar').addEventListener('click',entrarMesa);
    document.getElementById('inputCodigo').addEventListener('keydown',e=>{if(e.key==='Enter')entrarMesa();e.target.value=e.target.value.toUpperCase();});
    document.getElementById('btnCriarSessao')?.addEventListener('click',criarSessao);
    document.getElementById('btnSair').addEventListener('click',()=>{if(confirm('Sair da mesa?'))window.location.href='/dashboard';});
    document.getElementById('btnEncerrarSessao')?.addEventListener('click',async()=>{
      if(!confirm('Encerrar sessão para todos?')) return;
      await Api.request(`/sessoes/${E.sessaoId}/encerrar`,{method:'PUT'});
      window.location.href='/dashboard';
    });

    document.addEventListener('keydown',onKey);
    document.addEventListener('click',e=>{
      if(!e.target.closest('.token-ctx-menu')) fecharCtxMenu();
    });
  }

  // ─── MOUSE ────────────────────────────────────────────────────────────
  function onMD(e) {
    if(!E.mapa) return;
    const r=canvas.getBoundingClientRect(),cx=e.clientX-r.left,cy=e.clientY-r.top;
    const {x:mx,y:my}=c2m(cx,cy);
    if(e.button===1||(e.button===0&&e.altKey)){
      E.panInicio={cx,cy};E.panInicioPan={x:E.panX,y:E.panY};
      document.getElementById('mesaViewport').classList.add('cur-grabbing'); return;
    }
    if(e.button!==0) return;
    fecharCtxMenu();
    if(E.ferramenta==='select'){
      const t=tokenEm(mx,my);
      if(t){E.arrastandoToken=t;E.tokenSel=t;
        const cel=E.mapa?.tamanho_cel||60;
        E.arrastOffset={x:mx-t.pos_x*cel,y:my-t.pos_y*cel};
      } else {
        E.panInicio={cx,cy};E.panInicioPan={x:E.panX,y:E.panY};
        document.getElementById('mesaViewport').classList.add('cur-grabbing');
        E.tokenSel=null;
      }
    } else if(E.ferramenta==='fog-erase'||E.ferramenta==='fog-paint'){
      if(!E.isMestre) return;
      E.painting=true; aplicarFog(mx,my,E.ferramenta==='fog-erase'?0:1);
    } else if(E.ferramenta==='measure'){
      E.medindoInicio={x:mx,y:my};
    } else if(E.ferramenta==='ping'){
      socket?.emit('mesa:ping_visual',{x:mx,y:my}); mostrarPing(mx,my);
    }
  }

  function onMM(e) {
    if(!E.mapa) return;
    const r=canvas.getBoundingClientRect(),cx=e.clientX-r.left,cy=e.clientY-r.top;
    const {x:mx,y:my}=c2m(cx,cy);
    E.mouseMapaAtual={x:mx,y:my};
    if(E.panInicio){E.panX=E.panInicioPan.x+(cx-E.panInicio.cx);E.panY=E.panInicioPan.y+(cy-E.panInicio.cy);return;}
    if(E.arrastandoToken){
      const cel=E.mapa?.tamanho_cel||60;
      E.arrastandoToken.pos_x=Math.max(0,Math.floor((mx-E.arrastOffset.x)/cel));
      E.arrastandoToken.pos_y=Math.max(0,Math.floor((my-E.arrastOffset.y)/cel));
      return;
    }
    if(E.painting&&E.isMestre) aplicarFog(mx,my,E.ferramenta==='fog-erase'?0:1);
    if(E.ferramenta==='measure'&&E.medindoInicio){
      const cel=E.mapa?.tamanho_cel||60;
      const dx=mx-E.medindoInicio.x,dy=my-E.medindoInicio.y;
      const dist=Math.sqrt(dx*dx+dy*dy)/cel;
      const lbl=document.getElementById('measureLabel');
      lbl.style.display='block';
      lbl.style.left=e.clientX+'px'; lbl.style.top=e.clientY+'px';
      lbl.textContent=dist.toFixed(1)+' cel · '+(dist*1.5).toFixed(1)+'m';
    }
  }

  function onMU(e) {
    const vp=document.getElementById('mesaViewport');
    if(E.panInicio){E.panInicio=null;vp.classList.remove('cur-grabbing');return;}
    if(E.arrastandoToken){
      const t=E.arrastandoToken,cols=E.mapa?.largura_grid||20,rows=E.mapa?.altura_grid||20;
      t.pos_x=Math.max(0,Math.min(cols-t.tamanho,t.pos_x));
      t.pos_y=Math.max(0,Math.min(rows-t.tamanho,t.pos_y));
      socket?.emit('token:mover',{tokenId:t.id,pos_x:t.pos_x,pos_y:t.pos_y,sessaoId:E.sessaoId});
      E.arrastandoToken=null; return;
    }
    if(E.painting&&E.isMestre){
      E.painting=false;
      _fogPintura.clear();
      socket?.emit('fog:atualizar',{sessaoId:E.sessaoId,mapaId:E.mapaId,celulas:E.fogCelulas});
    }
    if(E.ferramenta==='measure'){E.medindoInicio=null;document.getElementById('measureLabel').style.display='none';}
  }

  function onDbl(e){
    if(!E.mapa||!E.isMestre) return;
    const r=canvas.getBoundingClientRect();
    const {x:mx,y:my}=c2m(e.clientX-r.left,e.clientY-r.top);
    const t=tokenEm(mx,my);
    if(t) abrirModalToken(t);
  }

  function onRClick(e){
    if(!E.mapa) return;
    const r=canvas.getBoundingClientRect();
    const {x:mx,y:my}=c2m(e.clientX-r.left,e.clientY-r.top);
    const t=tokenEm(mx,my);
    if(t) mostrarCtxMenu(t,e.clientX,e.clientY);
  }

  function onWheel(e){
    e.preventDefault();
    const r=canvas.getBoundingClientRect();
    zoomPonto(e.deltaY>0?-.08:.08,e.clientX-r.left,e.clientY-r.top);
  }

  // ─── TOUCH ────────────────────────────────────────────────────────────
  let _ti=null,_td=null;
  function onTS(e){
    e.preventDefault();
    if(e.touches.length===2){_td=dT(e.touches);return;}
    const t=e.touches[0],r=canvas.getBoundingClientRect();
    const cx=t.clientX-r.left,cy=t.clientY-r.top;
    _ti={cx,cy};E.panInicioPan={x:E.panX,y:E.panY};
    const {x:mx,y:my}=c2m(cx,cy);
    const tok=tokenEm(mx,my);
    if(tok&&E.ferramenta==='select'){
      E.arrastandoToken=tok;const cel=E.mapa?.tamanho_cel||60;
      E.arrastOffset={x:mx-tok.pos_x*cel,y:my-tok.pos_y*cel};
    }
  }
  function onTM(e){
    e.preventDefault();
    if(e.touches.length===2){
      const d=dT(e.touches);
      if(_td){const r=canvas.getBoundingClientRect();
        const mx=(e.touches[0].clientX+e.touches[1].clientX)/2-r.left;
        const my=(e.touches[0].clientY+e.touches[1].clientY)/2-r.top;
        zoomPonto((d-_td)*.005,mx,my);}
      _td=d;return;
    }
    const t=e.touches[0],r=canvas.getBoundingClientRect();
    const cx=t.clientX-r.left,cy=t.clientY-r.top;
    const {x:mx,y:my}=c2m(cx,cy);
    if(E.arrastandoToken){
      const cel=E.mapa?.tamanho_cel||60;
      E.arrastandoToken.pos_x=Math.max(0,Math.floor((mx-E.arrastOffset.x)/cel));
      E.arrastandoToken.pos_y=Math.max(0,Math.floor((my-E.arrastOffset.y)/cel));
    } else if(_ti){E.panX=E.panInicioPan.x+(cx-_ti.cx);E.panY=E.panInicioPan.y+(cy-_ti.cy);}
  }
  function onTE(){
    if(E.arrastandoToken){const t=E.arrastandoToken;
      socket?.emit('token:mover',{tokenId:t.id,pos_x:t.pos_x,pos_y:t.pos_y,sessaoId:E.sessaoId});
      E.arrastandoToken=null;}
    _ti=null;_td=null;
  }
  function dT(ts){const dx=ts[0].clientX-ts[1].clientX,dy=ts[0].clientY-ts[1].clientY;return Math.sqrt(dx*dx+dy*dy);}

  // ─── TECLADO ──────────────────────────────────────────────────────────
  function onKey(e){
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    switch(e.key.toLowerCase()){
      case 's': setTool('select');    break;
      case 'r': if(E.isMestre)setTool('fog-erase'); break;
      case 'c': if(E.isMestre)setTool('fog-paint'); break;
      case 'd': setTool('measure');  break;
      case 'p': if(E.isMestre)setTool('ping'); break;
      case 'f': toggleSidebar('fichas'); break;
      case 't': toggleSidebar('chat'); break;
      case '+': case '=': zoom(.1); break;
      case '-': zoom(-.1); break;
      case '0': fitMapa(); break;
      case 'escape': fecharCtxMenu(); break;
    }
  }

  // ─── FERRAMENTAS ──────────────────────────────────────────────────────
  function setTool(tool){
    E.ferramenta=tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
    const vp=document.getElementById('mesaViewport');
    vp.className='mesa-viewport';
    if(tool==='fog-erase') vp.classList.add('cur-cell');
    if(tool==='fog-paint')  vp.classList.add('cur-crosshair');
    if(tool==='measure')    vp.classList.add('cur-crosshair');
    if(tool==='ping')       vp.classList.add('cur-crosshair');
  }

  // ─── ZOOM ─────────────────────────────────────────────────────────────
  function zoom(d){const n=Math.max(.1,Math.min(5,E.zoom+d));const cx=canvas.width/2,cy=canvas.height/2;E.panX=cx-(cx-E.panX)*(n/E.zoom);E.panY=cy-(cy-E.panY)*(n/E.zoom);E.zoom=n;document.getElementById('zoomPct').textContent=Math.round(n*100)+'%';}
  function zoomPonto(d,cx,cy){const n=Math.max(.1,Math.min(5,E.zoom+d));E.panX=cx-(cx-E.panX)*(n/E.zoom);E.panY=cy-(cy-E.panY)*(n/E.zoom);E.zoom=n;document.getElementById('zoomPct').textContent=Math.round(n*100)+'%';}
  function fitMapa(){
    if(!E.mapa) return;
    const cel=E.mapa.tamanho_cel||60,cols=E.mapa.largura_grid||20,rows=E.mapa.altura_grid||20;
    const zx=canvas.width/(cols*cel),zy=canvas.height/(rows*cel);
    E.zoom=Math.min(zx,zy)*.9;
    E.panX=(canvas.width-cols*cel*E.zoom)/2;
    E.panY=(canvas.height-rows*cel*E.zoom)/2;
    document.getElementById('zoomPct').textContent=Math.round(E.zoom*100)+'%';
  }

  // ─── FOG ──────────────────────────────────────────────────────────────
  let _fogPintura = new Set();

  function aplicarFog(mx,my,val){
    if(!E.fogCelulas||!E.mapa) return;
    const cel=E.mapa.tamanho_cel||60;
    const col=Math.floor(mx/cel), row=Math.floor(my/cel);
    if(row<0||col<0||row>=E.fogCelulas.length||col>=E.fogCelulas[0].length) return;
    if(E.fogCelulas[row][col]===val) return; 
    E.fogCelulas[row][col]=val;
    _fogPintura.add(`${row},${col}`);
    socket?.emit('fog:celula',{sessaoId:E.sessaoId,mapaId:E.mapaId,row,col,valor:val});
  }

  // ─── PING ─────────────────────────────────────────────────────────────
  function mostrarPing(mx,my){
    const ping=document.getElementById('pingRing');
    ping.style.left=(mx*E.zoom+E.panX)+'px';
    ping.style.top=(my*E.zoom+E.panY)+'px';
    ping.style.display='block';
    ping.style.animation='none';
    requestAnimationFrame(()=>{ping.style.animation='pingExpand .7s ease-out forwards';});
    setTimeout(()=>{ping.style.display='none';},800);
  }

  // ─── CTX MENU TOKEN ───────────────────────────────────────────────────
  function mostrarCtxMenu(token,px,py){
    E.tokenSel=token;
    const menu=document.getElementById('tokenCtxMenu');
    menu.innerHTML='';
    const hdr=document.createElement('div'); hdr.className='ctx-header';
    hdr.innerHTML=`<span class="ctx-nome">${escH(token.nome)}</span>`;
    menu.appendChild(hdr);
    const hpRow=document.createElement('div'); hpRow.className='ctx-hp-row';
    hpRow.innerHTML=`
      <button class="ctx-hp-btn" id="ctxHpMinus">-</button>
      <span class="ctx-hp-val" id="ctxHpVal">${token.hp_atual}/${token.hp_max}</span>
      <button class="ctx-hp-btn" id="ctxHpPlus">+</button>`;
    menu.appendChild(hpRow);
    const sep=()=>{const s=document.createElement('div');s.className='ctx-sep';menu.appendChild(s);};
    sep();

    const mkBtn=(ico,label,cls,fn)=>{
      const b=document.createElement('button');
      b.className='ctx-btn'+(cls?' '+cls:'');
      b.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><use href="#ico-${ico}"/></svg>${escH(label)}`;
      b.onclick=fn; menu.appendChild(b);
    };

    if(E.isMestre){
      mkBtn('edit','Editar','',()=>{fecharCtxMenu();abrirModalToken(token);});
      mkBtn('eye',token.visivel?'Ocultar':'Revelar','',()=>{
        socket?.emit('token:atualizar',{sessaoId:E.sessaoId,tokenId:token.id,dados:{visivel:token.visivel?0:1}});
        fecharCtxMenu();
      });
      sep();
      mkBtn('trash','Remover','danger',()=>{
        socket?.emit('token:deletar',{sessaoId:E.sessaoId,tokenId:token.id});fecharCtxMenu();
      });
    }

    menu.querySelector('#ctxHpMinus').addEventListener('click',()=>{
      const n=Math.max(0,token.hp_atual-1);
      socket?.emit('token:atualizar',{sessaoId:E.sessaoId,tokenId:token.id,dados:{hp_atual:n}});
      menu.querySelector('#ctxHpVal').textContent=n+'/'+token.hp_max;
    });
    menu.querySelector('#ctxHpPlus').addEventListener('click',()=>{
      const n=Math.min(token.hp_max,token.hp_atual+1);
      socket?.emit('token:atualizar',{sessaoId:E.sessaoId,tokenId:token.id,dados:{hp_atual:n}});
      menu.querySelector('#ctxHpVal').textContent=n+'/'+token.hp_max;
    });

    menu.style.display='block';
    menu.style.left=Math.min(px,window.innerWidth-170)+'px';
    menu.style.top=Math.min(py,window.innerHeight-200)+'px';
  }
  function fecharCtxMenu(){document.getElementById('tokenCtxMenu').style.display='none';}

  // ─── MODAL TOKEN ──────────────────────────────────────────────────────
  function abrirModalToken(token){
    E.editandoTokenId=token?.id||null;
    E.imagemTokenSel=token?.imagem_url||'';
    document.getElementById('tokenModalTitulo').textContent=token?'Editar Token':'Novo Token';
    document.getElementById('tokenNome').value    =token?.nome||'';
    document.getElementById('tokenHpAtual').value =token?.hp_atual||10;
    document.getElementById('tokenHpMax').value   =token?.hp_max||10;
    document.getElementById('tokenTam').value     =token?.tamanho||1;
    document.getElementById('tokenCor').value     =token?.cor||'#c9a84c';
    document.getElementById('tokenUrlInput').value='';
    
    const ex = token?.dados_extras
      ? (typeof token.dados_extras==='string' ? JSON.parse(token.dados_extras) : token.dados_extras)
      : {};
    document.getElementById('tokenLuzAtiva').checked = ex.luz_ativa||false;
    document.getElementById('tokenLuzRaio').value    = ex.luz_raio||3;
    document.getElementById('btnTokenDelete').style.display=token?'inline-flex':'none';
    const prev=document.getElementById('galeriaPreview');
    if(E.imagemTokenSel){document.getElementById('galeriaPreviewImg').src=E.imagemTokenSel;prev.style.display='flex';}
    else prev.style.display='none';
    document.querySelectorAll('.galeria-item').forEach(i=>i.classList.remove('sel'));
    carregarGaleriaFichas();
    abrirOverlay('overlayToken');
  }

  function salvarToken(){
    const img=E.imagemTokenSel||document.getElementById('tokenUrlInput').value.trim();
    const luzAtiva = document.getElementById('tokenLuzAtiva').checked;
    const luzRaio  = parseInt(document.getElementById('tokenLuzRaio').value)||3;
    const dados={
      nome:        document.getElementById('tokenNome').value.trim(),
      hp_atual:    parseInt(document.getElementById('tokenHpAtual').value)||10,
      hp_max:      parseInt(document.getElementById('tokenHpMax').value)||10,
      tamanho:     parseInt(document.getElementById('tokenTam').value)||1,
      cor:         document.getElementById('tokenCor').value,
      imagem_url:  img,
      dados_extras: { luz_ativa: luzAtiva, luz_raio: luzRaio },
    };
    if(!dados.nome) return;
    if(E.editandoTokenId){
      socket?.emit('token:atualizar',{sessaoId:E.sessaoId,tokenId:E.editandoTokenId,dados});
      if(img){delete tokenImgs[E.editandoTokenId];preloadTokenImg({id:E.editandoTokenId,imagem_url:img});}
    } else {
      const cel=E.mapa?.tamanho_cel||60,{x:mx,y:my}=c2m(canvas.width/2,canvas.height/2);
      dados.pos_x=Math.max(0,Math.floor(mx/cel));
      dados.pos_y=Math.max(0,Math.floor(my/cel));
      socket?.emit('token:criar',{sessaoId:E.sessaoId,mapaId:E.mapaId,dados});
    }
    fecharOverlay('overlayToken');
  }

  function deletarToken(){
    if(!E.editandoTokenId||!confirm('Remover token?')) return;
    socket?.emit('token:deletar',{sessaoId:E.sessaoId,tokenId:E.editandoTokenId});
    fecharOverlay('overlayToken');
  }

  // ─── MAPAS ────────────────────────────────────────────────────────────
  async function abrirModalMapas(){
    abrirOverlay('overlayMapas');
    const res=await Api.request(`/sessoes/${E.sessaoId}/mapas`);
    if(!res?.ok) return;
    const lista=document.getElementById('mapaLista');lista.innerHTML='';
    res.data.mapas.forEach(m=>{
      const item=document.createElement('div');
      item.className='mapa-item'+(m.id===E.mapaId?' ativo':'');
      item.innerHTML=`
        <img class="mapa-thumb" src="${m.imagem_url}" alt="${escH(m.nome)}"/>
        <span class="mapa-nome">${escH(m.nome)}</span>
        <div class="mapa-btns">
          <button class="mapa-btn ativar" data-id="${m.id}">Ativar</button>
          <button class="mapa-btn del"    data-id="${m.id}">Remover</button>
        </div>`;
      item.querySelector('.ativar').addEventListener('click',()=>{
        socket?.emit('mapa:selecionar',{sessaoId:E.sessaoId,mapaId:m.id});fecharOverlay('overlayMapas');
      });
      item.querySelector('.del').addEventListener('click',async()=>{
        if(!confirm(`Remover "${m.nome}"?`)) return;
        await Api.request(`/sessoes/${E.sessaoId}/mapas/${m.id}`,{method:'DELETE'});
        item.remove();
      });
      lista.appendChild(item);
    });
  }

  async function enviarMapa(){
    const nome=document.getElementById('mapaNovoNome').value.trim();
    const arq=document.getElementById('mapaNovoArq').files[0];
    const col=document.getElementById('mapaNovoCol').value;
    const row=document.getElementById('mapaNovoRow').value;
    if(!arq){return;}
    const btn=document.getElementById('btnEnviarMapa');
    btn.disabled=true;btn.textContent='Enviando...';
    const fd=new FormData();
    fd.append('imagem',arq);fd.append('nome',nome||arq.name);
    fd.append('largura_grid',col);fd.append('altura_grid',row);
    const res=await Api.request(`/sessoes/${E.sessaoId}/mapas`,{method:'POST',body:fd});
    btn.disabled=false;btn.textContent='Enviar Mapa';
    if(res?.ok){document.getElementById('mapaNovoNome').value='';document.getElementById('mapaNovoArq').value='';abrirModalMapas();}
  }

  // ─── CHAT COM DADOS 3D ────────────────────────────────────────────────
  function enviarChat(){
    const inp = document.getElementById('chatInput');
    let txt = inp.value.trim();
    const priv = document.getElementById('checkPrivado')?.checked || false;
    if(!txt) return; 
    inp.value = '';
    
    // Agora aceita tanto "1d20" direto quanto "/r 1d20" ou "/roll 1d20"
    const matchDado = txt.match(/^(?:\/r\s+|\/roll\s+)?(\d*d\d+(?:[+\-*/]\d+)?)$/i);
    
    if(matchDado) {
      const expressao = matchDado[1]; // Isola a fórmula matemática
      
      if (diceBox && diceBox.pronto) {
        diceBox.roll(expressao).then(results => {
          socket?.emit('chat:rolar',{sessaoId:E.sessaoId,expressao:expressao,privado:priv});
          
          // Limpa os dados da tela após 4 segundos com segurança
          setTimeout(() => {
              if (diceBox) diceBox.clear();
          }, 4000); 

        }).catch(err => {
          socket?.emit('chat:rolar',{sessaoId:E.sessaoId,expressao:expressao,privado:priv});
        });
      }
    } else {
      socket?.emit('chat:mensagem',{sessaoId:E.sessaoId,texto:txt});
    }
  }

  function renderMsg(msg){
    const c=document.getElementById('chatMsgs');
    const div=document.createElement('div');
    if(msg.tipo==='sistema'){div.className='chat-msg cm-sistema';div.textContent=msg.conteudo;c.appendChild(div);c.scrollTop=c.scrollHeight;return;}
    const d=msg.dados_rol;
    div.className='chat-msg cm-'+msg.tipo+(d?.critico?' cm-critico':d?.desastre?' cm-desastre':'');
    const autor=document.createElement('span');autor.className='cm-autor';autor.textContent=msg.nome+(msg.privado?' 🔒':'');div.appendChild(autor);
    if((msg.tipo==='rolagem'||msg.tipo==='privado')&&d){
      const ex=document.createElement('div');ex.className='cm-expr';ex.textContent='Rolou: '+d.expressao;div.appendChild(ex);
      if(d.dados?.length){const row=document.createElement('div');row.className='cm-dados-row';
        d.dados.forEach(v=>{const chip=document.createElement('div');chip.className='cm-dado'+(v===d.faces?' max':v===1?' min':'');chip.textContent=v;row.appendChild(chip);});div.appendChild(row);}
      const tot=document.createElement('span');tot.className='cm-total'+(d.critico?' critico':d.desastre?' desastre':'');tot.textContent=d.total;div.appendChild(tot);
      if(d.critico){const b=document.createElement('span');b.className='cm-badge critico';b.textContent='Crítico!';div.appendChild(b);}
      if(d.desastre){const b=document.createElement('span');b.className='cm-badge desastre';b.textContent='Desastre!';div.appendChild(b);}
    } else {const t=document.createElement('span');t.className='cm-conteudo';t.textContent=msg.conteudo;div.appendChild(t);}
    c.appendChild(div);c.scrollTop=c.scrollHeight;
  }

  function msgSistema(t){renderMsg({tipo:'sistema',conteudo:t});}

  // ─── SIDEBAR ──────────────────────────────────────────────────────────
  function toggleSidebar(aba){
    if(E.sidebarAberta&&E.sidebarAba===aba){setSidebar(false,aba);return;}
    setSidebar(true,aba);
  }
  function setSidebar(aberta,aba){
    E.sidebarAberta=aberta;
    E.sidebarAba=aba||E.sidebarAba;
    const sb=document.getElementById('mesaSidebar');
    const vp=document.getElementById('mesaViewport');
    sb.classList.toggle('aberta',aberta);
    vp.classList.toggle('sidebar-open',aberta);
    if(aberta) trocarAba(E.sidebarAba);
    redimensionar();
  }
  function trocarAba(aba){
    E.sidebarAba=aba;
    document.querySelectorAll('.sidebar-tab').forEach(t=>t.classList.toggle('active',t.dataset.stab===aba));
    document.querySelectorAll('.sidebar-content').forEach(c=>c.style.display='none');
    const el=document.getElementById('stab'+aba.charAt(0).toUpperCase()+aba.slice(1));
    if(el) el.style.display='flex';
    if(aba==='chat'){E.msgNaoLidas=0;document.getElementById('chatBadge').style.display='none';document.getElementById('chatBadgeTab').style.display='none';document.getElementById('chatMsgs').scrollTop=9999;}
    document.getElementById('btnFichas').classList.toggle('active',E.sidebarAberta&&aba==='fichas');
    document.getElementById('btnPastas')?.classList.toggle('active',E.sidebarAberta&&aba==='pastas');
    document.getElementById('btnChat').classList.toggle('active',E.sidebarAberta&&aba==='chat');
  }

  // ─── USUÁRIOS ─────────────────────────────────────────────────────────
  function atualizarPips(usuarios){const c=document.getElementById('usuariosPips');c.innerHTML='';usuarios.forEach(u=>addPip(u,c));}
  function addPip(u,cont){
    cont=cont||document.getElementById('usuariosPips');
    if(document.getElementById('pip-'+u.id)) return;
    const pip=document.createElement('div');
    pip.className='pip online'+(u.role==='mestre'?' mestre':'');
    pip.id='pip-'+u.id;pip.title=u.nome+(u.role==='mestre'?' (Mestre)':'');
    pip.textContent=u.nome.charAt(0).toUpperCase();
    cont.appendChild(pip);
  }
  function remPip(id){document.getElementById('pip-'+id)?.remove();}

  // ─── ENTRAR / CRIAR ───────────────────────────────────────────────────
  function carregarImgMapa(url){
    if(!url){mapaImg=null;return;}
    mapaImg=new Image();mapaImg.crossOrigin='anonymous';mapaImg.src=url;
    mapaImg.onload=fitMapa;
  }
  async function entrarMesa(){
    const codigo=document.getElementById('inputCodigo').value.trim().toUpperCase();
    if(codigo.length<4){alertEntrar('Código inválido.','erro');return;}
    document.getElementById('btnEntrar').disabled=true;
    document.getElementById('btnEntrar').textContent='Conectando...';
    conectar(codigo);
  }
  async function criarSessao(){
    const nome=document.getElementById('inputNomeSessao').value.trim();
    const sistemaSelect = document.getElementById('selectSistemaSessao');
    const sistema = sistemaSelect ? sistemaSelect.value : 'Decadência Cinza';
    
    if(!nome){alertEntrar('Digite um nome.','erro');return;}
    
    const res=await Api.request('/sessoes',{method:'POST',body:{nome, sistema}});
    if(!res?.ok){alertEntrar(res?.data?.message||'Erro.','erro');return;}
    document.getElementById('inputCodigo').value=res.data.sessao.codigo;
    entrarMesa();
  }

  // ─── VITRINE DA LOJA (TABLETOP) ───────────────────────────────────────
  window.lojaAtualMesa = null;
  window.catalogoDocumentos = [];

  async function carregarVitrineLoja() {
    if (!E.sessaoId) return;
    const vitrine = document.getElementById('vitrineLoja');
    if (!vitrine) return;
    vitrine.innerHTML = '<div style="text-align:center;color:#888;padding:1rem;">Carregando mercado...</div>';
    
    try {
      const res = await Api.request(`/sessoes/${E.sessaoId}/lojas`);
      if (!res?.ok || !res.data.lojas || res.data.lojas.length === 0) {
        if (E.isMestre) {
           const resCriar = await Api.request(`/sessoes/${E.sessaoId}/lojas`, { method: 'POST', body: { nome: 'Mercado Geral' } });
           if (resCriar?.ok) {
             carregarVitrineLoja(); 
           } else {
             vitrine.innerHTML = '<div style="text-align:center;color:#888;padding:1rem;">O Mestre ainda não abriu o mercado.</div>';
           }
        } else {
           vitrine.innerHTML = '<div style="text-align:center;color:#888;padding:1rem;">O Mestre ainda não abriu o mercado.</div>';
        }
        return;
      }
      
      window.lojaAtualMesa = res.data.lojas[0];
      const itens = window.lojaAtualMesa.itens || [];
      
      if (!itens.length) {
        vitrine.innerHTML = '<div style="text-align:center;color:#888;padding:1rem;">O mercado está sem estoque no momento.</div>';
        return;
      }
      
      vitrine.innerHTML = itens.map(item => {
        return `
          <div style="background:#111214; border:1px solid #333; border-radius:6px; padding:10px; display:flex; gap:10px; align-items:center;">
            <div style="width:40px; height:40px; background:#222; border-radius:4px; display:flex; align-items:center; justify-content:center; border:1px solid var(--bronze-dim);">
              <i data-lucide="package" style="color:var(--gold-dim); width:20px;"></i>
            </div>
            <div style="flex:1;">
              <div style="font-weight:600; color:#fff; font-size:0.9rem;">${escH(item.nome)}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${escH(item.categoria || 'Item')}</div>
            </div>
            <div style="text-align:right;">
              <div style="color:var(--gold); font-family:'Cinzel', serif; font-weight:bold; font-size:0.95rem;">${item.preco} 💰</div>
              ${E.isMestre ? `<div style="font-size:0.65rem; color:#e74c3c; cursor:pointer; text-decoration:underline; margin-top:4px;" onclick="removerItemVitrine(${item.id})">Remover</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
      
      lucide.createIcons();
      
    } catch (e) {
      vitrine.innerHTML = '<div style="text-align:center;color:#e74c3c;padding:1rem;">Erro ao carregar o mercado.</div>';
    }
  }

  window.abrirModalCatalogoLoja = async () => {
    abrirOverlay('overlayCatalogoLoja');
    const container = document.getElementById('listaCatalogoSistema');
    container.innerHTML = '<div style="text-align:center;color:#888;">Buscando itens do sistema...</div>';
    
    try {
      const res = await Api.request('/documentos'); 
      if (!res?.ok) throw new Error();
      
      window.catalogoDocumentos = res.data.documentos.filter(d => 
        (d.sistema === E.sessao.sistema) &&
        ['Itens','Armas Brancas','Armas de Fogo','Armaduras','Consumíveis'].includes(d.categoria)
      );
      
      renderCatalogoBusca('');
    } catch (e) {
      container.innerHTML = '<div style="text-align:center;color:#e74c3c;">Erro ao carregar banco de dados.</div>';
    }
  };

  window.filtrarCatalogoLoja = () => {
    const term = document.getElementById('inputBuscaCatalogo').value.toLowerCase();
    renderCatalogoBusca(term);
  };

  // Substitua as funções de Catálogo no final do seu mesa.js por estas:

  function renderCatalogoBusca(term) {
    const container = document.getElementById('listaCatalogoSistema');
    let filtrados = window.catalogoDocumentos;
    if (term) {
      filtrados = filtrados.filter(d => d.titulo.toLowerCase().includes(term));
    }
    
    if (!filtrados.length) {
      container.innerHTML = '<div style="text-align:center;color:#888;">Nenhum item encontrado.</div>';
      return;
    }
    
    container.innerHTML = filtrados.map(d => {
      let descNarrativa = d.conteudo || d.categoria || '';

      return `
        <div style="background:#0a0a0a; border:1px solid #333; padding:10px; border-radius:4px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <div style="font-weight:bold; color:#fff;">${escH(d.titulo)} <span style="font-size:0.7rem; color:var(--gold-dim); background:rgba(201,168,76,0.1); padding:2px 4px; border-radius:2px; margin-left:5px;">${escH(d.categoria)}</span></div>
          </div>
          
          <div style="font-size:0.8rem; color:#888; margin-bottom:10px; max-height:40px; overflow:hidden;">${escH(descNarrativa)}</div>
          
          <div style="background:#111214; padding:8px; border-radius:4px; border:1px solid #222; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
              <div style="flex:1; min-width:120px;">
                  <label style="font-size:0.65rem; color:var(--text-muted); display:block; margin-bottom:3px;">Automação: Ação/Ataque</label>
                  <input type="text" id="macro_acao_${d.id}" placeholder="Ex: 1d20+2" class="modal-inp" style="padding:4px; font-size:0.8rem;">
              </div>
              <div style="flex:1; min-width:120px;">
                  <label style="font-size:0.65rem; color:var(--text-muted); display:block; margin-bottom:3px;">Automação: Dano/Cura</label>
                  <input type="text" id="macro_dano_${d.id}" placeholder="Ex: 1d8" class="modal-inp" style="padding:4px; font-size:0.8rem;">
              </div>
              <div style="width:70px;">
                  <label style="font-size:0.65rem; color:var(--gold); display:block; margin-bottom:3px;">Preço 💰</label>
                  <input type="number" id="preco_add_${d.id}" value="0" class="modal-inp" style="padding:4px; font-size:0.8rem; color:var(--gold); font-weight:bold;">
              </div>
              <button class="btn-sm btn-primary" style="height:28px;" onclick="adicionarItemAutomatizadoAoMercado(${d.id}, '${escH(d.titulo.replace(/'/g,"\\'"))}', '${escH(d.categoria)}', '${escH(descNarrativa.replace(/'/g,"\\'").replace(/\n/g, '\\n'))}')">Por à Venda</button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.adicionarItemAutomatizadoAoMercado = async (docId, titulo, categoria, descNarrativa) => {
    if (!window.lojaAtualMesa) {
       alertEntrar('A loja geral ainda não foi inicializada.', 'erro');
       return;
    }
    
    const preco = parseInt(document.getElementById(`preco_add_${docId}`).value) || 0;
    const acao = document.getElementById(`macro_acao_${docId}`).value.trim();
    const dano = document.getElementById(`macro_dano_${docId}`).value.trim();
    const lojaId = window.lojaAtualMesa.id;

    // Constrói o JSON Puro e isolado que irá APENAS para a loja, não alterando o sistema principal
    const objDescricao = {
        narrativa: descNarrativa,
        macro: { rolagem: acao, dano: dano }
    };
    
    try {
      const res = await Api.request(`/sessoes/${E.sessaoId}/lojas/${lojaId}/itens`, {
        method: 'POST',
        body: { nome: titulo, preco: preco, categoria: categoria, descricao: JSON.stringify(objDescricao) }
      });
      
      if (res?.ok) {
        fecharOverlay('overlayCatalogoLoja');
        carregarVitrineLoja(); 
      } else {
        alertEntrar('Erro ao adicionar.', 'erro');
      }
    } catch(e) {
      alertEntrar('Erro de conexão.', 'erro');
    }
  };

  window.adicionarItemAoMercado = async (docId, titulo, categoria, desc) => {
    if (!window.lojaAtualMesa) {
       alertEntrar('A loja geral ainda não foi inicializada.', 'erro');
       return;
    }
    
    const preco = parseInt(document.getElementById(`preco_add_${docId}`).value) || 0;
    const lojaId = window.lojaAtualMesa.id;
    
    try {
      const res = await Api.request(`/sessoes/${E.sessaoId}/lojas/${lojaId}/itens`, {
        method: 'POST',
        body: { nome: titulo, preco: preco, categoria: categoria, descricao: desc }
      });
      
      if (res?.ok) {
        fecharOverlay('overlayCatalogoLoja');
        carregarVitrineLoja(); 
      } else {
        alertEntrar('Erro ao adicionar.', 'erro');
      }
    } catch(e) {
      alertEntrar('Erro de conexão.', 'erro');
    }
  };

  window.removerItemVitrine = (itemId) => {
     alertEntrar('Remoção direta na loja virá na próxima atualização.', 'info');
  };

  // ─── UTILS ────────────────────────────────────────────────────────────
  function redimensionar(){
    canvas.width=document.getElementById('mesaViewport').clientWidth;
    canvas.height=document.getElementById('mesaViewport').clientHeight;
  }
  function abrirOverlay(id){document.getElementById(id).classList.add('open');}
  function fecharOverlay(id){document.getElementById(id).classList.remove('open');}
  function alertEntrar(msg,tipo){
    const el=document.getElementById('alertEntrar');
    el.className='modal-alert '+tipo;el.textContent=msg;el.style.display='block';
    setTimeout(()=>{el.style.display='none';},4000);
  }
  function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  // ─── START ────────────────────────────────────────────────────────────
  function inicializarFichaAtiva() {
    setTimeout(() => {
        if (typeof FichaDecadencia !== 'undefined' && FichaDecadencia.init) {
            FichaDecadencia.init();
        }
        if (typeof FichaOceano !== 'undefined' && FichaOceano.init) {
            FichaOceano.init();
        }
        if (typeof FichaCavaleiros !== 'undefined' && FichaCavaleiros.init) {
            FichaCavaleiros.init();
        }
        if (typeof FichaOutbreak !== 'undefined' && FichaOutbreak.init) {
            FichaOutbreak.init();
        }
    }, 150);
  }

  init();
})();