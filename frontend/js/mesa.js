// frontend/js/mesa.js — VK.Studio Tabletop Client
// Arquitetado para expansão: novas ferramentas, sistemas e integrações de ficha

(function () {
  'use strict';

  // ─── ESTADO GLOBAL ────────────────────────────────────────────────────
  const Estado = {
    sessao:      null,   // dados da sessão atual
    mapa:        null,   // mapa ativo
    tokens:      [],     // tokens na mesa
    fogCelulas:  null,   // matriz 2D de fog (0=revelado, 1=coberto)
    ferramenta:  'mover',
    zoom:        1,
    panX:        0,
    panY:        0,
    isMestre:    false,
    userId:      null,
    userName:    '',
    tokenSel:    null,   // token selecionado
    arrastandoToken: null,
    arrastOffset: { x:0, y:0 },
    mouseCanvas:  { x:0, y:0 },
    chatAberto:   false,
    msgNaoLidas:  0,
    sessaoId:     null,
    mapaId:       null,
    editandoTokenId: null, // para o modal de edição
  };

  // ─── CANVAS ───────────────────────────────────────────────────────────
  const canvas  = document.getElementById('mesaCanvas');
  const ctx     = canvas.getContext('2d');
  let   rafId   = null;
  let   painting = false; // fog painting em progresso

  // ─── SOCKET ───────────────────────────────────────────────────────────
  let socket = null;

  // ─── INICIALIZAÇÃO ────────────────────────────────────────────────────
  async function init() {
    const user = VK.user;
    Estado.isMestre = VK.isMestre;
    Estado.userId   = user.id;
    Estado.userName = user.nome;

    // Mostra elementos de mestre
    if (Estado.isMestre) {
      document.getElementById('grupoFerramentasMestre').style.display = 'flex';
      document.getElementById('grupoFerramentasJogador').style.display = 'none';
      document.getElementById('modalOuMestre').style.display = 'flex';
      document.getElementById('modalCriarSessao').style.display = 'block';
      document.getElementById('chatOpcoesMestre').style.display = 'block';
    }

    // Verifica se veio com código na URL
    const params = new URLSearchParams(window.location.search);
    const codigoUrl = params.get('codigo');
    if (codigoUrl) {
      document.getElementById('inputCodigo').value = codigoUrl.toUpperCase();
      document.getElementById('modalEntrar').classList.add('open');
    } else {
      document.getElementById('modalEntrar').classList.add('open');
    }

    // Resize do canvas
    redimensionarCanvas();
    window.addEventListener('resize', redimensionarCanvas);

    // Bind de eventos globais
    bindEventos();

    // Inicia loop de render
    loop();
  }

  // ─── SOCKET.IO ────────────────────────────────────────────────────────
  function conectarSocket(codigo) {
    socket = io({ auth: { token: Api.getToken() } });

    socket.on('connect', () => {
      socket.emit('mesa:entrar', { codigo });
    });

    socket.on('connect_error', (err) => {
      mostrarAlertaMesa(err.message || 'Erro de conexão.', 'erro');
    });

    // Estado inicial
    socket.on('mesa:estado_inicial', ({ sessao, usuarios }) => {
      Estado.sessao   = sessao;
      Estado.sessaoId = sessao.id;
      fecharModal('modalEntrar');

      document.getElementById('topbarNomeSessao').textContent = sessao.nome;
      document.getElementById('topbarCodigo').textContent     = `#${sessao.codigo}`;

      atualizarUsuariosPip(usuarios);

      if (sessao.mapa_id) {
        Estado.mapa   = { id: sessao.mapa_id, nome: sessao.mapa_nome, imagem_url: sessao.mapa_url, largura_grid: sessao.largura_grid, altura_grid: sessao.altura_grid, tamanho_cel: sessao.tamanho_cel };
        Estado.mapaId = sessao.mapa_id;
        carregarImagemMapa(sessao.mapa_url);
      }

      history.replaceState(null, '', `/mesa?codigo=${sessao.codigo}`);
    });

    socket.on('mesa:erro',         ({ msg }) => mostrarAlertaMesa(msg, 'erro'));
    socket.on('mesa:usuario_entrou', ({ usuario }) => { adicionarPip(usuario); adicionarMsgSistema(`${usuario.nome} entrou.`); });
    socket.on('mesa:usuario_saiu',   ({ usuario }) => { removerPip(usuario.id); adicionarMsgSistema(`${usuario.nome} saiu.`); });

    // Mapa
    socket.on('mapa:trocado', ({ mapa, tokens, celulas }) => {
      Estado.mapa    = mapa;
      Estado.mapaId  = mapa.id;
      Estado.tokens  = tokens || [];
      Estado.fogCelulas = celulas;
      carregarImagemMapa(mapa.imagem_url);
    });

    // Tokens
    socket.on('tokens:lista', ({ tokens }) => { Estado.tokens = tokens || []; });
    socket.on('token:criado', ({ token }) => { Estado.tokens.push(token); });
    socket.on('token:movido', ({ tokenId, pos_x, pos_y }) => {
      const t = Estado.tokens.find(t => t.id === tokenId);
      if (t) { t.pos_x = pos_x; t.pos_y = pos_y; }
    });
    socket.on('token:atualizado', ({ tokenId, dados }) => {
      const t = Estado.tokens.find(t => t.id === tokenId);
      if (t) Object.assign(t, dados);
    });
    socket.on('token:deletado', ({ tokenId }) => {
      Estado.tokens = Estado.tokens.filter(t => t.id !== tokenId);
      if (Estado.tokenSel?.id === tokenId) {
        Estado.tokenSel = null;
        ocultarTooltip();
      }
    });

    // Fog
    socket.on('fog:atualizado',        ({ celulas }) => { Estado.fogCelulas = celulas; });
    socket.on('fog:atualizado_mestre', ({ celulas }) => { Estado.fogCelulas = celulas; });
    socket.on('fog:celula_atualizada', ({ row, col, valor }) => {
      if (Estado.fogCelulas?.[row]) Estado.fogCelulas[row][col] = valor;
    });

    // Ping visual
    socket.on('mesa:ping_visual', ({ x, y }) => mostrarPing(x, y));

    // Chat
    socket.on('chat:historico', ({ mensagens }) => {
      document.getElementById('chatMsgs').innerHTML = '';
      mensagens.forEach(renderMensagem);
    });
    socket.on('chat:nova_mensagem', (msg) => {
      renderMensagem(msg);
      if (!Estado.chatAberto) {
        Estado.msgNaoLidas++;
        const badge = document.getElementById('chatBadge');
        badge.textContent = Estado.msgNaoLidas;
        badge.style.display = 'flex';
      }
    });
  }

  // ─── IMAGEM DO MAPA ───────────────────────────────────────────────────
  let mapaImg = null;
  function carregarImagemMapa(url) {
    if (!url) { mapaImg = null; return; }
    mapaImg = new Image();
    mapaImg.crossOrigin = 'anonymous';
    mapaImg.src = url;
    mapaImg.onload = () => {
      // Centraliza o mapa
      const cel = Estado.mapa?.tamanho_cel || 60;
      const cols = Estado.mapa?.largura_grid || 20;
      const rows = Estado.mapa?.altura_grid  || 20;
      const mW = cols * cel;
      const mH = rows * cel;
      Estado.panX = (canvas.width  - mW * Estado.zoom) / 2;
      Estado.panY = (canvas.height - mH * Estado.zoom) / 2;
    };
  }

  // ─── RENDER LOOP ──────────────────────────────────────────────────────
  function loop() {
    renderFrame();
    rafId = requestAnimationFrame(loop);
  }

  function renderFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(Estado.panX, Estado.panY);
    ctx.scale(Estado.zoom, Estado.zoom);

    if (Estado.mapa) {
      const cel  = Estado.mapa.tamanho_cel  || 60;
      const cols = Estado.mapa.largura_grid || 20;
      const rows = Estado.mapa.altura_grid  || 20;

      // Mapa de fundo
      if (mapaImg?.complete && mapaImg.naturalWidth > 0) {
        ctx.drawImage(mapaImg, 0, 0, cols * cel, rows * cel);
      } else {
        ctx.fillStyle = '#1a1c22';
        ctx.fillRect(0, 0, cols * cel, rows * cel);
      }

      // Grid
      desenharGrid(cols, rows, cel);

      // Tokens (abaixo do fog)
      Estado.tokens.forEach(t => desenharToken(t, cel));

      // Fog of war
      if (Estado.fogCelulas) desenharFog(cols, rows, cel);

      // Contorno do token selecionado
      if (Estado.tokenSel) {
        const t = Estado.tokens.find(t => t.id === Estado.tokenSel.id);
        if (t) desenharSelecao(t, cel);
      }
    } else {
      // Sem mapa — tela vazia com instrução
      ctx.restore();
      ctx.fillStyle = '#2a2d36';
      ctx.font = '14px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        Estado.isMestre ? 'Clique em 🗺 para adicionar um mapa' : 'Aguardando o Mestre carregar o mapa...',
        canvas.width / 2, canvas.height / 2
      );
      return;
    }

    ctx.restore();
  }

  function desenharGrid(cols, rows, cel) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) {
      ctx.moveTo(x * cel, 0);
      ctx.lineTo(x * cel, rows * cel);
    }
    for (let y = 0; y <= rows; y++) {
      ctx.moveTo(0, y * cel);
      ctx.lineTo(cols * cel, y * cel);
    }
    ctx.stroke();
  }

  function desenharToken(t, cel) {
    if (!t.visivel && !Estado.isMestre) return;

    const tam = (t.tamanho || 1) * cel;
    const cx  = t.pos_x * cel + tam / 2;
    const cy  = t.pos_y * cel + tam / 2;
    const r   = tam / 2 - 3;

    ctx.save();

    // Sombra
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur  = 8;

    // Círculo de fundo
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = t.cor || '#c9a84c';
    ctx.fill();

    // Imagem do token
    if (t.imagem_url && tokenImgs[t.id]?.complete) {
      ctx.clip();
      ctx.drawImage(tokenImgs[t.id], t.pos_x * cel + 3, t.pos_y * cel + 3, tam - 6, tam - 6);
    }

    ctx.restore();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;

    // Borda
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = t.visivel === 0 ? 'rgba(255,255,255,0.2)' : (t.cor || '#c9a84c');
    ctx.lineWidth = 2;
    ctx.stroke();

    // HP bar
    const hpPct = Math.max(0, Math.min(1, (t.hp_atual || 0) / (t.hp_max || 1)));
    const barW = tam - 8;
    const barY = t.pos_y * cel + tam - 8;
    const barX = t.pos_x * cel + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, 4);
    ctx.fillStyle = hpPct > 0.5 ? '#27ae60' : hpPct > 0.2 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(barX, barY, barW * hpPct, 4);

    // Nome
    ctx.font = `bold ${Math.max(9, cel * 0.15)}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(t.nome, cx, t.pos_y * cel + tam + 11);
    ctx.fillText  (t.nome, cx, t.pos_y * cel + tam + 11);

    // Invisível (mestre vê semi-transparente)
    if (!t.visivel && Estado.isMestre) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
      ctx.font = `${cel * 0.3}px serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('👁', cx, cy + cel * 0.1);
    }
  }

  function desenharSelecao(t, cel) {
    const tam = (t.tamanho || 1) * cel;
    const cx  = t.pos_x * cel + tam / 2;
    const cy  = t.pos_y * cel + tam / 2;
    const r   = tam / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function desenharFog(cols, rows, cel) {
    const fog = Estado.fogCelulas;
    if (!fog) return;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!fog[row] || fog[row][col] !== 1) continue;
        if (Estado.isMestre) {
          // Mestre vê fog como overlay semi-transparente
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
        } else {
          ctx.fillStyle = '#000';
        }
        ctx.fillRect(col * cel, row * cel, cel, cel);
      }
    }
  }

  // ─── CACHE DE IMAGENS DE TOKEN ─────────────────────────────────────
  const tokenImgs = {};
  function preCarregarTokenImg(token) {
    if (!token.imagem_url || tokenImgs[token.id]) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = token.imagem_url;
    tokenImgs[token.id] = img;
  }

  // ─── COORDENADAS ──────────────────────────────────────────────────────
  function canvasParaMapa(cx, cy) {
    return {
      x: (cx - Estado.panX) / Estado.zoom,
      y: (cy - Estado.panY) / Estado.zoom,
    };
  }

  function mapaParaGrid(mx, my) {
    const cel = Estado.mapa?.tamanho_cel || 60;
    return {
      col: Math.floor(mx / cel),
      row: Math.floor(my / cel),
    };
  }

  function tokenEmPosicao(mx, my) {
    const cel = Estado.mapa?.tamanho_cel || 60;
    // Busca de trás pra frente (token do topo primeiro)
    for (let i = Estado.tokens.length - 1; i >= 0; i--) {
      const t = Estado.tokens[i];
      const tam = (t.tamanho || 1) * cel;
      if (mx >= t.pos_x * cel && mx <= t.pos_x * cel + tam &&
          my >= t.pos_y * cel && my <= t.pos_y * cel + tam) {
        return t;
      }
    }
    return null;
  }

  // ─── EVENTOS DO CANVAS ────────────────────────────────────────────────
  function bindEventos() {
    // Canvas — mouse
    canvas.addEventListener('mousedown',  onMouseDown);
    canvas.addEventListener('mousemove',  onMouseMove);
    canvas.addEventListener('mouseup',    onMouseUp);
    canvas.addEventListener('wheel',      onWheel, { passive: false });
    canvas.addEventListener('dblclick',   onDblClick);
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); onRightClick(e); });

    // Touch
    canvas.addEventListener('touchstart',  onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',   onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',    onTouchEnd);

    // Ferramentas
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => setFerramenta(btn.dataset.tool));
    });

    // Zoom
    document.getElementById('btnZoomIn').addEventListener('click',    () => ajustarZoom(0.1));
    document.getElementById('btnZoomOut').addEventListener('click',   () => ajustarZoom(-0.1));
    document.getElementById('btnZoomReset').addEventListener('click', () => resetZoom());

    // Chat
    document.getElementById('btnToggleChat').addEventListener('click', toggleChat);
    document.getElementById('btnFecharChat').addEventListener('click', () => setChat(false));
    document.getElementById('btnChatSend').addEventListener('click',   enviarChat);
    document.getElementById('chatInputExpr').addEventListener('keydown', e => {
      if (e.key === 'Enter') enviarChat();
    });
    document.querySelectorAll('.dado-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('chatInputExpr').value = btn.dataset.expr;
        enviarChat();
      });
    });

    // Entrar na mesa
    document.getElementById('btnEntrarMesa').addEventListener('click', entrarMesa);
    document.getElementById('inputCodigo').addEventListener('keydown', e => {
      if (e.key === 'Enter') entrarMesa();
      e.target.value = e.target.value.toUpperCase();
    });

    // Criar sessão (mestre)
    document.getElementById('btnCriarSessao')?.addEventListener('click', criarSessao);

    // Sair da mesa
    document.getElementById('btnSairMesa').addEventListener('click', () => {
      if (confirm('Sair da mesa?')) window.location.href = '/dashboard';
    });

    // Mapas (mestre)
    document.getElementById('btnGerenciarMapas')?.addEventListener('click', abrirModalMapas);
    document.getElementById('btnFecharMapas')?.addEventListener('click', () => fecharModal('modalMapas'));
    document.getElementById('btnEnviarMapa')?.addEventListener('click', enviarMapa);

    // Token modal
    document.getElementById('btnAdicionarToken')?.addEventListener('click', () => abrirModalToken(null));
    document.getElementById('btnFecharToken').addEventListener('click', () => fecharModal('modalToken'));
    document.getElementById('btnCancelarToken').addEventListener('click', () => fecharModal('modalToken'));
    document.getElementById('btnSalvarToken').addEventListener('click', salvarToken);
    document.getElementById('btnDeletarToken').addEventListener('click', deletarToken);

    // Tooltip
    document.addEventListener('click', e => {
      if (!e.target.closest('.token-tooltip') && !e.target.closest('#mesaCanvas')) {
        ocultarTooltip();
        Estado.tokenSel = null;
      }
    });

    // Teclado
    document.addEventListener('keydown', onKeyDown);
  }

  // ─── MOUSE ────────────────────────────────────────────────────────────
  let panInicio = null;
  let panInicioPan = null;

  function onMouseDown(e) {
    if (!Estado.mapa) return;
    const rect  = canvas.getBoundingClientRect();
    const cx    = e.clientX - rect.left;
    const cy    = e.clientY - rect.top;
    const { x: mx, y: my } = canvasParaMapa(cx, cy);

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Pan com botão do meio ou alt+click
      panInicio    = { cx, cy };
      panInicioPan = { x: Estado.panX, y: Estado.panY };
      canvas.classList.add('grabbing');
      return;
    }

    if (e.button !== 0) return;

    if (Estado.ferramenta === 'mover') {
      const token = tokenEmPosicao(mx, my);
      if (token) {
        Estado.arrastandoToken = token;
        Estado.arrastOffset    = {
          x: mx - token.pos_x * (Estado.mapa?.tamanho_cel || 60),
          y: my - token.pos_y * (Estado.mapa?.tamanho_cel || 60),
        };
        Estado.tokenSel = token;
        ocultarTooltip();
      } else {
        // Pan
        panInicio    = { cx, cy };
        panInicioPan = { x: Estado.panX, y: Estado.panY };
        canvas.classList.add('grabbing');
        Estado.tokenSel = null;
        ocultarTooltip();
      }

    } else if (Estado.ferramenta === 'fog-apagar' || Estado.ferramenta === 'fog-cobrir') {
      if (!Estado.isMestre) return;
      painting = true;
      aplicarFogCelula(mx, my, Estado.ferramenta === 'fog-apagar' ? 0 : 1);

    } else if (Estado.ferramenta === 'ping') {
      socket?.emit('mesa:ping_visual', { x: mx, y: my });
      mostrarPing(mx, my, true);
    }
  }

  function onMouseMove(e) {
    if (!Estado.mapa) return;
    const rect = canvas.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;
    const { x: mx, y: my } = canvasParaMapa(cx, cy);
    Estado.mouseCanvas = { x: mx, y: my };

    if (panInicio) {
      Estado.panX = panInicioPan.x + (cx - panInicio.cx);
      Estado.panY = panInicioPan.y + (cy - panInicio.cy);
      return;
    }

    if (Estado.arrastandoToken) {
      const cel = Estado.mapa?.tamanho_cel || 60;
      const newCol = Math.max(0, Math.floor((mx - Estado.arrastOffset.x) / cel));
      const newRow = Math.max(0, Math.floor((my - Estado.arrastOffset.y) / cel));
      Estado.arrastandoToken.pos_x = newCol;
      Estado.arrastandoToken.pos_y = newRow;
      return;
    }

    if (painting && Estado.isMestre) {
      aplicarFogCelula(mx, my, Estado.ferramenta === 'fog-apagar' ? 0 : 1);
    }
  }

  function onMouseUp(e) {
    const rect = canvas.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;
    const { x: mx, y: my } = canvasParaMapa(cx, cy);

    if (panInicio) {
      panInicio = null;
      canvas.classList.remove('grabbing');
      return;
    }

    if (Estado.arrastandoToken) {
      const t   = Estado.arrastandoToken;
      const cel = Estado.mapa?.tamanho_cel || 60;
      // Snap para o grid
      const col = Math.max(0, Math.min((Estado.mapa.largura_grid || 20) - t.tamanho, t.pos_x));
      const row = Math.max(0, Math.min((Estado.mapa.altura_grid  || 20) - t.tamanho, t.pos_y));
      t.pos_x = col; t.pos_y = row;
      socket?.emit('token:mover', { tokenId: t.id, pos_x: col, pos_y: row, sessaoId: Estado.sessaoId });
      Estado.arrastandoToken = null;
      return;
    }

    if (painting && Estado.isMestre) {
      painting = false;
      // Salva fog no servidor
      socket?.emit('fog:atualizar', { sessaoId: Estado.sessaoId, mapaId: Estado.mapaId, celulas: Estado.fogCelulas });
    }
  }

  function onDblClick(e) {
    if (!Estado.mapa) return;
    const rect = canvas.getBoundingClientRect();
    const { x: mx, y: my } = canvasParaMapa(e.clientX - rect.left, e.clientY - rect.top);
    const token = tokenEmPosicao(mx, my);
    if (token && Estado.isMestre) abrirModalToken(token);
  }

  function onRightClick(e) {
    if (!Estado.mapa) return;
    const rect = canvas.getBoundingClientRect();
    const { x: mx, y: my } = canvasParaMapa(e.clientX - rect.left, e.clientY - rect.top);
    const token = tokenEmPosicao(mx, my);
    if (token) mostrarTooltip(token, e.clientX, e.clientY);
  }

  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    const rect  = canvas.getBoundingClientRect();
    const cx    = e.clientX - rect.left;
    const cy    = e.clientY - rect.top;
    ajustarZoomPonto(delta, cx, cy);
  }

  // ─── TOUCH ────────────────────────────────────────────────────────────
  let touchInicio = null;
  let touchDist   = null;

  function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      touchDist = distTouches(e.touches);
      return;
    }
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const cx = t.clientX - rect.left;
    const cy = t.clientY - rect.top;
    touchInicio    = { cx, cy };
    panInicioPan   = { x: Estado.panX, y: Estado.panY };

    const { x: mx, y: my } = canvasParaMapa(cx, cy);
    const token = tokenEmPosicao(mx, my);
    if (token && Estado.ferramenta === 'mover') {
      Estado.arrastandoToken = token;
      Estado.arrastOffset = {
        x: mx - token.pos_x * (Estado.mapa?.tamanho_cel || 60),
        y: my - token.pos_y * (Estado.mapa?.tamanho_cel || 60),
      };
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const d = distTouches(e.touches);
      if (touchDist) {
        const delta = (d - touchDist) * 0.005;
        const rect  = canvas.getBoundingClientRect();
        const mx    = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const my    = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        ajustarZoomPonto(delta, mx, my);
      }
      touchDist = d;
      return;
    }

    const t  = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const cx   = t.clientX - rect.left;
    const cy   = t.clientY - rect.top;
    const { x: mx, y: my } = canvasParaMapa(cx, cy);

    if (Estado.arrastandoToken) {
      const cel = Estado.mapa?.tamanho_cel || 60;
      Estado.arrastandoToken.pos_x = Math.max(0, Math.floor((mx - Estado.arrastOffset.x) / cel));
      Estado.arrastandoToken.pos_y = Math.max(0, Math.floor((my - Estado.arrastOffset.y) / cel));
    } else if (touchInicio) {
      Estado.panX = panInicioPan.x + (cx - touchInicio.cx);
      Estado.panY = panInicioPan.y + (cy - touchInicio.cy);
    }
  }

  function onTouchEnd(e) {
    if (Estado.arrastandoToken) {
      const t   = Estado.arrastandoToken;
      socket?.emit('token:mover', { tokenId: t.id, pos_x: t.pos_x, pos_y: t.pos_y, sessaoId: Estado.sessaoId });
      Estado.arrastandoToken = null;
    }
    touchInicio = null; touchDist = null;
  }

  function distTouches(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }

  // ─── TECLADO ──────────────────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key.toLowerCase()) {
      case 'm': setFerramenta('mover');      break;
      case 'r': if (Estado.isMestre) setFerramenta('fog-apagar'); break;
      case 'c': if (Estado.isMestre) setFerramenta('fog-cobrir'); break;
      case 'p': if (Estado.isMestre) setFerramenta('ping');       break;
      case 'tab':
        e.preventDefault();
        toggleChat();
        break;
      case '+': case '=': ajustarZoom(0.1);  break;
      case '-':           ajustarZoom(-0.1); break;
      case '0':           resetZoom();        break;
    }
  }

  // ─── FERRAMENTAS ──────────────────────────────────────────────────────
  function setFerramenta(tool) {
    Estado.ferramenta = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    canvas.className = '';
    if (tool === 'fog-apagar') canvas.classList.add('fog-apagar');
    if (tool === 'fog-cobrir')  canvas.classList.add('fog-cobrir');
    if (tool === 'ping')        canvas.classList.add('ping');
  }

  // ─── ZOOM ─────────────────────────────────────────────────────────────
  function ajustarZoom(delta) {
    const novo = Math.max(0.2, Math.min(4, Estado.zoom + delta));
    const cx   = canvas.width / 2;
    const cy   = canvas.height / 2;
    Estado.panX = cx - (cx - Estado.panX) * (novo / Estado.zoom);
    Estado.panY = cy - (cy - Estado.panY) * (novo / Estado.zoom);
    Estado.zoom = novo;
    document.getElementById('zoomVal').textContent = Math.round(novo * 100) + '%';
  }

  function ajustarZoomPonto(delta, cx, cy) {
    const novo = Math.max(0.2, Math.min(4, Estado.zoom + delta));
    Estado.panX = cx - (cx - Estado.panX) * (novo / Estado.zoom);
    Estado.panY = cy - (cy - Estado.panY) * (novo / Estado.zoom);
    Estado.zoom = novo;
    document.getElementById('zoomVal').textContent = Math.round(novo * 100) + '%';
  }

  function resetZoom() {
    Estado.zoom = 1;
    Estado.panX = 0;
    Estado.panY = 0;
    document.getElementById('zoomVal').textContent = '100%';
  }

  // ─── FOG OF WAR ───────────────────────────────────────────────────────
  function aplicarFogCelula(mx, my, valor) {
    if (!Estado.fogCelulas || !Estado.mapa) return;
    const cel = Estado.mapa.tamanho_cel || 60;
    const col = Math.floor(mx / cel);
    const row = Math.floor(my / cel);
    if (Estado.fogCelulas[row] && Estado.fogCelulas[row][col] !== undefined) {
      Estado.fogCelulas[row][col] = valor;
      socket?.emit('fog:celula', { sessaoId: Estado.sessaoId, mapaId: Estado.mapaId, row, col, valor });
    }
  }

  // ─── PING VISUAL ──────────────────────────────────────────────────────
  function mostrarPing(mx, my, emitir = false) {
    const ping = document.getElementById('pingAnim');
    const cx   = mx * Estado.zoom + Estado.panX;
    const cy   = my * Estado.zoom + Estado.panY;
    ping.style.left    = cx + 'px';
    ping.style.top     = cy + 'px';
    ping.style.display = 'block';
    ping.style.animation = 'none';
    requestAnimationFrame(() => { ping.style.animation = 'pingExpand .8s ease-out forwards'; });
    setTimeout(() => { ping.style.display = 'none'; }, 900);
  }

  // ─── TOOLTIP DO TOKEN ─────────────────────────────────────────────────
  function mostrarTooltip(token, px, py) {
    Estado.tokenSel = token;
    const tt = document.getElementById('tokenTooltip');
    document.getElementById('ttNome').textContent = token.nome;
    document.getElementById('ttHp').textContent   = `HP: ${token.hp_atual} / ${token.hp_max}`;

    const acoes = document.getElementById('ttAcoes');
    acoes.innerHTML = '';

    if (Estado.isMestre) {
      const btnEditar = document.createElement('button');
      btnEditar.className = 'tt-btn'; btnEditar.textContent = 'Editar';
      btnEditar.onclick = () => { ocultarTooltip(); abrirModalToken(token); };
      acoes.appendChild(btnEditar);

      const btnVis = document.createElement('button');
      btnVis.className = 'tt-btn';
      btnVis.textContent = token.visivel ? 'Ocultar' : 'Revelar';
      btnVis.onclick = () => {
        const novoVis = token.visivel ? 0 : 1;
        socket?.emit('token:atualizar', { sessaoId: Estado.sessaoId, tokenId: token.id, dados: { visivel: novoVis } });
        ocultarTooltip();
      };
      acoes.appendChild(btnVis);

      const btnDel = document.createElement('button');
      btnDel.className = 'tt-btn danger'; btnDel.textContent = 'Remover';
      btnDel.onclick = () => {
        socket?.emit('token:deletar', { sessaoId: Estado.sessaoId, tokenId: token.id });
        ocultarTooltip();
      };
      acoes.appendChild(btnDel);
    }

    // HP rápido
    const btnMenosHp = document.createElement('button');
    btnMenosHp.className = 'tt-btn'; btnMenosHp.textContent = '−HP';
    btnMenosHp.onclick = () => {
      const novo = Math.max(0, token.hp_atual - 1);
      socket?.emit('token:atualizar', { sessaoId: Estado.sessaoId, tokenId: token.id, dados: { hp_atual: novo } });
    };
    const btnMaisHp = document.createElement('button');
    btnMaisHp.className = 'tt-btn'; btnMaisHp.textContent = '+HP';
    btnMaisHp.onclick = () => {
      const novo = Math.min(token.hp_max, token.hp_atual + 1);
      socket?.emit('token:atualizar', { sessaoId: Estado.sessaoId, tokenId: token.id, dados: { hp_atual: novo } });
    };
    acoes.appendChild(btnMenosHp);
    acoes.appendChild(btnMaisHp);

    tt.style.left    = Math.min(px, window.innerWidth  - 160) + 'px';
    tt.style.top     = Math.min(py, window.innerHeight - 120) + 'px';
    tt.style.display = 'block';
  }

  function ocultarTooltip() {
    document.getElementById('tokenTooltip').style.display = 'none';
  }

  // ─── MODAL TOKEN ──────────────────────────────────────────────────────
  function abrirModalToken(token) {
    Estado.editandoTokenId = token?.id || null;
    document.getElementById('tokenModalTitulo').textContent = token ? '✏ Editar Token' : '➕ Novo Token';
    document.getElementById('tokenNome').value      = token?.nome        || '';
    document.getElementById('tokenHpAtual').value   = token?.hp_atual    || 10;
    document.getElementById('tokenHpMax').value     = token?.hp_max      || 10;
    document.getElementById('tokenTamanho').value   = token?.tamanho     || 1;
    document.getElementById('tokenCor').value       = token?.cor         || '#c9a84c';
    document.getElementById('tokenImagemUrl').value = token?.imagem_url  || '';
    document.getElementById('btnDeletarToken').style.display = token ? 'inline-flex' : 'none';
    abrirModal('modalToken');
  }

  function salvarToken() {
    const dados = {
      nome:       document.getElementById('tokenNome').value.trim(),
      hp_atual:   parseInt(document.getElementById('tokenHpAtual').value) || 10,
      hp_max:     parseInt(document.getElementById('tokenHpMax').value)   || 10,
      tamanho:    parseInt(document.getElementById('tokenTamanho').value) || 1,
      cor:        document.getElementById('tokenCor').value,
      imagem_url: document.getElementById('tokenImagemUrl').value.trim(),
    };
    if (!dados.nome) return;

    if (Estado.editandoTokenId) {
      socket?.emit('token:atualizar', { sessaoId: Estado.sessaoId, tokenId: Estado.editandoTokenId, dados });
      // Atualiza imagem em cache se mudou
      if (dados.imagem_url) {
        delete tokenImgs[Estado.editandoTokenId];
        preCarregarTokenImg({ id: Estado.editandoTokenId, imagem_url: dados.imagem_url });
      }
    } else {
      // Coloca no centro do viewport
      const cel  = Estado.mapa?.tamanho_cel || 60;
      const { x: mx, y: my } = canvasParaMapa(canvas.width / 2, canvas.height / 2);
      dados.pos_x = Math.max(0, Math.floor(mx / cel));
      dados.pos_y = Math.max(0, Math.floor(my / cel));
      socket?.emit('token:criar', { sessaoId: Estado.sessaoId, mapaId: Estado.mapaId, dados });
    }
    fecharModal('modalToken');
  }

  function deletarToken() {
    if (!Estado.editandoTokenId) return;
    if (!confirm('Remover este token?')) return;
    socket?.emit('token:deletar', { sessaoId: Estado.sessaoId, tokenId: Estado.editandoTokenId });
    fecharModal('modalToken');
  }

  // ─── MODAL MAPAS ──────────────────────────────────────────────────────
  async function abrirModalMapas() {
    abrirModal('modalMapas');
    const res = await Api.request(`/sessoes/${Estado.sessaoId}/mapas`);
    if (!res?.ok) return;
    const lista = document.getElementById('mapasList');
    lista.innerHTML = '';
    res.data.mapas.forEach(m => {
      const item = document.createElement('div');
      item.className = 'mapa-item' + (m.id === Estado.mapaId ? ' ativo' : '');
      item.innerHTML = `
        <img class="mapa-thumb" src="${m.imagem_url}" alt="${m.nome}"/>
        <span class="mapa-nome">${m.nome}</span>
        <div class="mapa-acoes">
          <button class="mapa-btn mapa-btn-ativar" data-id="${m.id}">Ativar</button>
          <button class="mapa-btn mapa-btn-del"    data-id="${m.id}">✕</button>
        </div>`;
      item.querySelector('.mapa-btn-ativar').addEventListener('click', () => {
        socket?.emit('mapa:selecionar', { sessaoId: Estado.sessaoId, mapaId: m.id });
        fecharModal('modalMapas');
      });
      item.querySelector('.mapa-btn-del').addEventListener('click', async () => {
        if (!confirm(`Remover mapa "${m.nome}"?`)) return;
        await Api.request(`/sessoes/${Estado.sessaoId}/mapas/${m.id}`, { method:'DELETE' });
        item.remove();
      });
      lista.appendChild(item);
    });
  }

  async function enviarMapa() {
    const nome     = document.getElementById('mapaNovoNome').value.trim();
    const arquivo  = document.getElementById('mapaNovoArquivo').files[0];
    const largura  = document.getElementById('mapaNovoLargura').value;
    const altura   = document.getElementById('mapaNovoAltura').value;
    if (!arquivo) { mostrarAlertaMesa('Selecione uma imagem.', 'erro'); return; }

    const btn = document.getElementById('btnEnviarMapa');
    btn.disabled = true; btn.textContent = 'Enviando...';

    const fd = new FormData();
    fd.append('imagem',        arquivo);
    fd.append('nome',          nome || arquivo.name);
    fd.append('largura_grid',  largura);
    fd.append('altura_grid',   altura);

    const res = await Api.request(`/sessoes/${Estado.sessaoId}/mapas`, { method:'POST', body: fd });

    btn.disabled = false; btn.textContent = 'Enviar Mapa';

    if (res?.ok) {
      document.getElementById('mapaNovoNome').value  = '';
      document.getElementById('mapaNovoArquivo').value = '';
      abrirModalMapas();
    } else {
      mostrarAlertaMesa(res?.data?.message || 'Erro ao enviar.', 'erro');
    }
  }

  // ─── CHAT ─────────────────────────────────────────────────────────────
  function toggleChat() { setChat(!Estado.chatAberto); }

  function setChat(aberto) {
    Estado.chatAberto = aberto;
    document.getElementById('chatPanel').classList.toggle('aberto', aberto);
    if (aberto) {
      Estado.msgNaoLidas = 0;
      document.getElementById('chatBadge').style.display = 'none';
      document.getElementById('chatMsgs').scrollTop = 9999;
      document.getElementById('chatInputExpr').focus();
    }
  }

  function enviarChat() {
    const inp  = document.getElementById('chatInputExpr');
    const txt  = inp.value.trim();
    const priv = document.getElementById('checkPrivado')?.checked || false;
    if (!txt) return;
    inp.value = '';

    // Detecta se é rolagem de dados
    const isDado = /^\d*d\d+([+\-*/]\d+)?$/.test(txt.replace(/\s/g,'').toLowerCase());
    if (isDado) {
      socket?.emit('chat:rolar', { sessaoId: Estado.sessaoId, expressao: txt, privado: priv });
    } else {
      socket?.emit('chat:mensagem', { sessaoId: Estado.sessaoId, texto: txt });
    }
  }

  function renderMensagem(msg) {
    const container = document.getElementById('chatMsgs');

    const div = document.createElement('div');

    if (msg.tipo === 'sistema') {
      div.className = 'chat-msg msg-sistema';
      div.textContent = msg.conteudo;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
      return;
    }

    const dados = msg.dados_rol;
    const ehCritico  = dados?.critico;
    const ehDesastre = dados?.desastre;

    div.className = 'chat-msg msg-' + msg.tipo +
      (ehCritico  ? ' msg-critico'  : '') +
      (ehDesastre ? ' msg-desastre' : '');

    const autor = document.createElement('span');
    autor.className = 'msg-autor';
    autor.textContent = msg.nome + (msg.privado ? ' 🔒' : '');
    div.appendChild(autor);

    if (msg.tipo === 'rolagem' || msg.tipo === 'privado' && dados) {
      const expr = document.createElement('div');
      expr.className = 'msg-rolagem-expr';
      expr.textContent = `Rolou: ${dados.expressao}`;
      div.appendChild(expr);

      if (dados.dados?.length > 0) {
        const indiv = document.createElement('div');
        indiv.className = 'msg-dados-individuais';
        dados.dados.forEach(d => {
          const chip = document.createElement('div');
          chip.className = 'dado-individual' +
            (d === dados.faces ? ' max' : '') +
            (d === 1 ? ' min' : '');
          chip.textContent = d;
          indiv.appendChild(chip);
        });
        div.appendChild(indiv);
      }

      const total = document.createElement('span');
      total.className = 'msg-total' + (ehCritico ? ' critico' : ehDesastre ? ' desastre' : '');
      total.textContent = dados.total;
      div.appendChild(total);

      if (ehCritico)  { const l = document.createElement('span'); l.className='msg-critico-label';  l.textContent='✦ Crítico!';  div.appendChild(l); }
      if (ehDesastre) { const l = document.createElement('span'); l.className='msg-desastre-label'; l.textContent='✦ Desastre!'; div.appendChild(l); }

    } else {
      const txt = document.createElement('span');
      txt.className = 'msg-texto-conteudo';
      txt.textContent = msg.conteudo;
      div.appendChild(txt);
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function adicionarMsgSistema(texto) {
    renderMensagem({ tipo: 'sistema', conteudo: texto });
  }

  // ─── USUÁRIOS ─────────────────────────────────────────────────────────
  function atualizarUsuariosPip(usuarios) {
    const cont = document.getElementById('topbarUsuarios');
    cont.innerHTML = '';
    usuarios.forEach(u => adicionarPip(u, cont));
  }

  function adicionarPip(u, cont) {
    cont = cont || document.getElementById('topbarUsuarios');
    if (document.getElementById('pip-' + u.id)) return;
    const pip = document.createElement('div');
    pip.className   = 'usuario-pip online' + (u.role === 'mestre' ? ' mestre' : '');
    pip.id          = 'pip-' + u.id;
    pip.title       = u.nome + (u.role === 'mestre' ? ' (Mestre)' : '');
    pip.textContent = u.nome.charAt(0).toUpperCase();
    cont.appendChild(pip);
  }

  function removerPip(userId) {
    document.getElementById('pip-' + userId)?.remove();
  }

  // ─── ENTRAR / CRIAR SESSÃO ────────────────────────────────────────────
  async function entrarMesa() {
    const codigo = document.getElementById('inputCodigo').value.trim().toUpperCase();
    if (codigo.length < 4) { mostrarAlertaMesa('Código inválido.', 'erro'); return; }
    conectarSocket(codigo);
    document.getElementById('btnEntrarMesa').disabled = true;
    document.getElementById('btnEntrarMesa').textContent = 'Conectando...';
  }

  async function criarSessao() {
    const nome = document.getElementById('inputNomeSessao').value.trim();
    if (!nome) { mostrarAlertaMesa('Digite um nome para a sessão.', 'erro'); return; }

    const res = await Api.request('/sessoes', { method:'POST', body: { nome } });
    if (!res?.ok) { mostrarAlertaMesa(res?.data?.message || 'Erro ao criar.', 'erro'); return; }

    document.getElementById('inputCodigo').value = res.data.sessao.codigo;
    entrarMesa();
  }

  // ─── UTILITÁRIOS ──────────────────────────────────────────────────────
  function redimensionarCanvas() {
    canvas.width  = document.getElementById('mesaViewport').clientWidth;
    canvas.height = document.getElementById('mesaViewport').clientHeight;
  }

  function abrirModal(id) {
    document.getElementById(id).classList.add('open');
  }
  function fecharModal(id) {
    document.getElementById(id).classList.remove('open');
  }

  function mostrarAlertaMesa(msg, tipo = 'erro') {
    const el = document.getElementById('alertMesa');
    el.className  = 'mesa-alert ' + tipo;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  // ─── START ────────────────────────────────────────────────────────────
  init();

})();
