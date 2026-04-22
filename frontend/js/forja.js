// frontend/js/forja.js — Sistema de Fichas Dinâmico v2
(function () {
  'use strict';

  const user   = VK.user;
  const isMestre = VK.isMestre;

  // ===== NAV =====
  document.getElementById('navUserName').textContent = user.nome;
  if (user.avatar_url) document.getElementById('navAvatar').innerHTML = `<img src="${user.avatar_url}" alt="${user.nome}"/>`;
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('hamburger').classList.toggle('open');
    document.getElementById('navMenu').classList.toggle('open');
  });

  // ===== DADOS DOS TIPOS DE ALMA (Decadência Cinza) =====
  const TIPOS_ALMA = ['Alma Comum','Príncipe Mestiço','Âncora das Almas','Despertado','Exilado','Alma Velada'];
  const PODERES_DESPERTADO = ['Magnetismo','Maldição da Dor','Sangue de Ferro'];
  const ENTIDADES_EXILADO  = ['Adão','Seph','Véu da Noite'];

  const ALMA_TEMA = {
    'Alma Comum':       'tema-comum',
    'Príncipe Mestiço': 'tema-principe',
    'Âncora das Almas': 'tema-ancora',
    'Despertado':       'tema-despertado',
    'Exilado':          'tema-exilado',
    'Alma Velada':      'tema-velada',
  };

  const ALMA_DESC = {
    'Alma Comum':       'Uma alma de natureza ordinária. Sem marcas do além.',
    'Príncipe Mestiço': 'Sangue de duas naturezas fundido em um núcleo instável.',
    'Âncora das Almas': 'Uma alma que prende outras a si. Gravidade espiritual.',
    'Despertado':       'O véu foi rasgado. Um poder dormia e agora respira.',
    'Exilado':          'Marcado por uma entidade. Não mais completamente seu.',
    'Alma Velada':      'Escondida atrás de névoa. Nem os deuses a enxergam.',
  };

  // ===== TEMPLATES DE FICHA POR SISTEMA =====
  const TEMPLATES = {
    'Decadência Cinza': {
      atributos: { 'Físico':0,'Social':0,'Intelecto':0,'Agilidade':0 },
      pericias: {
        'Pontaria':0,'Armas Brancas':0,'Desarmado':0,'Furtividade':0,
        'Percepção':0,'Persuasão':0,'Condução':0,'Reflexos':0,
        'Religião':0,'Atletismo':0,'Culinária':0,'Vigor':0,'Ciência':0
      },
      secoes: ['necessidades','capacitacoes','economia','periciasProfissao'],
      calcEsquiva:   d => 10 + (d.atrs['Agilidade']||0) + (d.peri['Reflexos']||0),
      calcPercepcao: d => 10 + (d.atrs['Intelecto']||0) + (d.peri['Percepção']||0),
      calcDefesa:    d => (d.rdRoupa||0) + (d.atrs['Físico']||0) + Math.floor((d.peri['Vigor']||0)/2),
    },
    'Oceano Estrelado': {
      atributos: { 'Físico':0,'Astúcia':0,'Presença':0,'Agilidade':0 },
      pericias: {
        'Navegação':0,'Armas Brancas':0,'Pontaria':0,'Atletismo':0,
        'Percepção':0,'Persuasão':0,'Reflexos':0,'Magia Naval':0,'Liderança':0
      },
      secoes: ['capacitacoes'],
      calcEsquiva:   d => 10 + (d.atrs['Agilidade']||0) + (d.peri['Reflexos']||0),
      calcPercepcao: d => 10 + (d.atrs['Astúcia']||0)   + (d.peri['Percepção']||0),
      calcDefesa:    d => (d.rdRoupa||0) + (d.atrs['Físico']||0),
    },
    'Cavaleiros de Armadura': {
      atributos: { 'Força':0,'Resistência':0,'Vitalidade':0,'Intelecto':0 },
      pericias: {
        'Combate':0,'Montaria':0,'Armas Brancas':0,'Atletismo':0,
        'Percepção':0,'Reflexos':0,'Intimidação':0,'Sobrevivência':0
      },
      secoes: ['capacitacoes'],
      calcEsquiva:   d => 10 + (d.atrs['Resistência']||0) + (d.peri['Reflexos']||0),
      calcPercepcao: d => 10 + (d.atrs['Intelecto']||0)   + (d.peri['Percepção']||0),
      calcDefesa:    d => (d.rdRoupa||0) + (d.atrs['Força']||0),
    },
  };

  // ===== ESTADO GLOBAL =====
  let sistemaAtivo   = null;
  let almaRolada     = null; // { tipo, extra, nucleos }
  let fichaState     = {};
  let fichasCache    = [];
  let filtroSistema  = 'todos';
  let modalItemTipo  = null;
  let modalItemIdx   = null;

  // ===== ETAPAS =====
  function mostrarEtapa(etapa) {
    document.getElementById('etapa1').style.display     = etapa === 1 ? 'block' : 'none';
    document.getElementById('etapaRoll').style.display  = etapa === 1.5 ? 'block' : 'none';
    document.getElementById('etapa2').style.display     = etapa === 2 ? 'block' : 'none';
    document.getElementById('btnNovaFicha').style.display = etapa !== 1 ? 'none' : 'none';
  }

  // ===== ETAPA 1: SELEÇÃO DE SISTEMA =====
  document.querySelectorAll('.sistema-select-card').forEach(card => {
    card.addEventListener('click', () => {
      sistemaAtivo = card.dataset.sistema;
      if (sistemaAtivo === 'Decadência Cinza') {
        mostrarEtapa(1.5);
        resetRoll();
      } else {
        almaRolada = null;
        iniciarFichaVazia();
      }
    });
  });

  // ===== ROLL DE ALMA (Decadência Cinza) =====
  function resetRoll() {
    document.getElementById('rollResultado').style.display = 'none';
    document.getElementById('rollActions').style.display   = 'none';
    almaRolada = null;
  }

  document.getElementById('btnRollAlma').addEventListener('click', () => {
    const tipo = TIPOS_ALMA[Math.floor(Math.random() * TIPOS_ALMA.length)];
    const tema = ALMA_TEMA[tipo];
    let extra = null, nucleos = 0;

    if (tipo === 'Príncipe Mestiço') {
      nucleos = Math.floor(Math.random() * 5) + 2; // 2 a 6
    } else if (tipo === 'Despertado') {
      extra = PODERES_DESPERTADO[Math.floor(Math.random() * PODERES_DESPERTADO.length)];
    } else if (tipo === 'Exilado') {
      extra = ENTIDADES_EXILADO[Math.floor(Math.random() * ENTIDADES_EXILADO.length)];
    }

    almaRolada = { tipo, tema, extra, nucleos };
    renderRollResultado(almaRolada);

    document.getElementById('rollResultado').style.display = 'block';
    document.getElementById('rollActions').style.display   = 'flex';

    // Anima o dado
    const dice = document.querySelector('.roll-dice');
    dice.style.animation = 'none';
    requestAnimationFrame(() => { dice.style.animation = 'diceSpin .4s ease-out'; });
  });

  function renderRollResultado(alma) {
    const el = document.getElementById('rollResultado');
    el.className = `roll-resultado ${alma.tema}`;

    let extraHtml = '';
    if (alma.tipo === 'Príncipe Mestiço') {
      extraHtml = `
        <div style="margin-top:.75rem;">
          <div style="font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:.5rem;font-family:var(--font-heading);">
            ${alma.nucleos} Campo${alma.nucleos > 1 ? 's' : ''} de Núcleo
          </div>
          <div class="roll-nucleos">
            ${Array.from({length:alma.nucleos}, (_,i) => `<div class="roll-nucleo-item">${i+1}</div>`).join('')}
          </div>
        </div>`;
    } else if (alma.extra) {
      const label = alma.tipo === 'Despertado' ? 'Poder Manifestado' : 'Entidade Vinculada';
      extraHtml = `<div class="roll-tipo-extra">${label}: ${alma.extra}</div>`;
    }

    el.innerHTML = `
      <div class="roll-tipo-nome">${alma.tipo}</div>
      <div class="roll-tipo-detalhe">${ALMA_DESC[alma.tipo]}</div>
      ${extraHtml}
    `;
  }

  document.getElementById('btnRolarNovamente').addEventListener('click', () => {
    document.getElementById('btnRollAlma').click();
  });

  document.getElementById('btnAceitarAlma').addEventListener('click', () => {
    iniciarFichaVazia();
  });

  document.getElementById('btnVoltarSistema').addEventListener('click', () => {
    mostrarEtapa(1);
    sistemaAtivo = null;
    almaRolada = null;
  });

  // ===== INICIAR FICHA VAZIA =====
  function iniciarFichaVazia() {
    const tpl = TEMPLATES[sistemaAtivo];
    fichaState = {
      id: null,
      sistema: sistemaAtivo,
      alma: almaRolada ? { ...almaRolada } : null,
      nome: '', idade: '', profissao: '', expectativa: '',
      vidaAtual:0, vidaMax:10, sanAtual:0, sanMax:10, estAtual:0, estMax:10,
      sacAtual:10, sacMax:10, sedeAtual:10, sedeMax:10, energiaAtual:10, energiaMax:10,
      rdRoupa: 0,
      ecoDinheiro: '', ecoGasto: '', ecoRenda: '',
      atrs: { ...tpl.atributos },
      peri: { ...tpl.pericias },
      periProf: {},
      periOutra: {},
      habilidades: [], qualidades: [], defeitos: [], itens: [], caracteristicas: [],
    };
    montarFormulario();
    mostrarEtapa(2);
    document.getElementById('forjaSubtitle').textContent = sistemaAtivo;
  }

  // ===== MONTAR FORMULÁRIO =====
  function montarFormulario() {
    const tpl = TEMPLATES[sistemaAtivo];

    // Seções condicionais
    const secoes = ['necessidades','capacitacoes','economia','periciasProfissao'];
    secoes.forEach(s => {
      const el = document.getElementById('secao' + capitalize(s));
      if (el) el.style.display = tpl.secoes.includes(s) ? 'block' : 'none';
    });

    // Bloco de alma
    renderBlocoAlma();

    // Atributos
    renderDots('attrDotsContainer', fichaState.atrs, 'atrs', 10);

    // Perícias
    renderDots('periciasDotsContainer', fichaState.peri, 'peri', 10);

    // Perícias de profissão (DC)
    if (tpl.secoes.includes('periciasProfissao')) {
      renderDots('periciaProfContainer', fichaState.periProf, 'periProf', 10);
    }

    // Listas clicáveis
    ['habilidades','qualidades','defeitos','itens','caracteristicas'].forEach(renderClickable);

    // Bind inputs de recursos
    bindRecursos();

    // Preview inicial
    atualizarPreview();
    recalcularCapacitacoes();

    // Inputs de texto
    ['fichaNome','fichaIdade','fichaProfissao','fichaExpectativa',
     'ecoDinheiro','ecoGasto','ecoRenda','rdRoupa'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { syncTextos(); atualizarPreview(); recalcularCapacitacoes(); });
    });

    // Imagem
    document.getElementById('fichaImagem').addEventListener('change', function() {
      const f = this.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = e => { document.getElementById('previewAvatar').innerHTML = `<img src="${e.target.result}" alt="preview"/>`; };
      r.readAsDataURL(f);
    });
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ===== BLOCO DE ALMA =====
  function renderBlocoAlma() {
    const bloco = document.getElementById('blocoAlma');
    if (!fichaState.alma) { bloco.style.display = 'none'; return; }

    const alma = fichaState.alma;
    const tema = alma.tema || 'tema-comum';
    bloco.style.display = 'block';
    bloco.className = `bloco-alma ${tema}`;

    // Badge do sistema no ícone
    document.getElementById('almaIcone').textContent = '☀';

    let extraHtml = '';
    if (alma.tipo === 'Príncipe Mestiço' && alma.nucleos > 0) {
      // Garante que o array de energias existe e tem o tamanho certo
      if (!fichaState.alma.nucleosValores) fichaState.alma.nucleosValores = [];
      while (fichaState.alma.nucleosValores.length < alma.nucleos) fichaState.alma.nucleosValores.push('');

      extraHtml = `
        <div class="alma-row" style="flex-direction:column;align-items:flex-start;gap:.5rem;">
          <span class="alma-key">Campos de Núcleo (${alma.nucleos}) — escreva a energia de cada núcleo</span>
          <div class="nucleos-grid" id="nucleosGrid">
            ${Array.from({length:alma.nucleos}, (_,i) => `
              <div class="nucleo-campo-wrap">
                <label class="nucleo-label">Núcleo ${i+1}</label>
                <input
                  type="text"
                  class="nucleo-input"
                  data-nucleo="${i}"
                  placeholder="Ex: Fogo, Sombra..."
                  value="${fichaState.alma.nucleosValores[i] || ''}"
                  style="width:100%;padding:.35rem .6rem;font-size:.82rem;background:rgba(0,0,0,.4);border:1px solid var(--gold-dim);border-radius:3px;color:var(--gold-light);font-family:var(--font-heading);"
                />
              </div>`).join('')}
          </div>
        </div>`;
    } else if (alma.extra) {
      const label = alma.tipo === 'Despertado' ? 'Poder' : 'Entidade';
      extraHtml = `
        <div class="alma-row">
          <span class="alma-key">${label}</span>
          <span class="alma-val">${alma.extra}</span>
        </div>`;
    }

    bloco.innerHTML = `
      <div class="alma-row">
        <span class="alma-key">Tipo de Alma</span>
        <span class="alma-val">${alma.tipo}</span>
      </div>
      ${extraHtml}
    `;

    // Bind listeners nos inputs de núcleo para salvar em fichaState
    if (alma.tipo === 'Príncipe Mestiço') {
      bloco.querySelectorAll('.nucleo-input').forEach(inp => {
        inp.addEventListener('input', () => {
          const idx = parseInt(inp.dataset.nucleo);
          fichaState.alma.nucleosValores[idx] = inp.value;
        });
      });
    }

    // Atualiza badge no preview
    const badge = document.getElementById('previewAlmaBadge');
    badge.style.display = 'inline-block';
    badge.textContent   = alma.tipo;
    badge.className     = `preview-alma-badge ${tema}`;
    badge.style.borderColor = getBadgeColor(tema);
    badge.style.color       = getBadgeColor(tema);
    badge.style.background  = getBadgeBg(tema);
  }

  function getBadgeColor(tema) {
    const map = { 'tema-comum':'#8a8478','tema-principe':'#c9a84c','tema-ancora':'#7ab8f0','tema-despertado':'#f07a7a','tema-exilado':'#b87af0','tema-velada':'#7af0d8' };
    return map[tema] || '#8a8478';
  }
  function getBadgeBg(tema) {
    const map = { 'tema-comum':'rgba(74,72,64,.12)','tema-principe':'rgba(201,168,76,.1)','tema-ancora':'rgba(74,138,201,.1)','tema-despertado':'rgba(201,74,74,.1)','tema-exilado':'rgba(138,74,201,.1)','tema-velada':'rgba(74,201,168,.1)' };
    return map[tema] || 'transparent';
  }

  // ===== DOTS (atributos / perícias) =====
  function renderDots(containerId, obj, field, max) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!Object.keys(obj).length) {
      c.innerHTML = '<div style="color:var(--text-muted);font-size:.8rem;padding:.5rem 0;">Nenhuma perícia. Use + Adicionar.</div>';
      return;
    }
    c.innerHTML = '';
    Object.entries(obj).forEach(([key, val]) => {
      const row = document.createElement('div');
      row.className = 'dots-row';
      const dots = Array.from({length:max}, (_,i) => `
        <div class="dot${i < val ? ' filled' : ''}" data-field="${field}" data-key="${key}" data-idx="${i}"></div>
      `).join('');
      row.innerHTML = `<span class="dots-label">${key}</span><div class="dots-track">${dots}</div>`;
      c.appendChild(row);
    });

    // Listeners nos dots
    c.querySelectorAll('.dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const f   = dot.dataset.field;
        const k   = dot.dataset.key;
        const idx = parseInt(dot.dataset.idx);
        const cur = fichaState[f][k];
        fichaState[f][k] = cur === idx + 1 ? idx : idx + 1;
        renderDots(containerId, fichaState[f], f, max);
        recalcularCapacitacoes();
        atualizarPreview();
      });
    });
  }

  // ===== ADICIONAR PERÍCIA =====
  document.getElementById('btnAddPericia')?.addEventListener('click', () => {
    document.getElementById('modalPericiaNome').value = '';
    document.getElementById('modalPericiaTipo').value = 'basica';
    document.getElementById('modalPericiaOverlay').classList.add('open');
  });
  document.getElementById('btnAddPericiaProf')?.addEventListener('click', () => {
    document.getElementById('modalPericiaNome').value = '';
    document.getElementById('modalPericiaTipo').value = 'profissao';
    document.getElementById('modalPericiaOverlay').classList.add('open');
  });
  document.getElementById('btnFecharModalPericia').addEventListener('click', () => {
    document.getElementById('modalPericiaOverlay').classList.remove('open');
  });
  document.getElementById('btnConfirmarPericia').addEventListener('click', () => {
    const nome = document.getElementById('modalPericiaNome').value.trim();
    const tipo = document.getElementById('modalPericiaTipo').value;
    if (!nome) return;
    if (tipo === 'basica') {
      if (!(nome in fichaState.peri)) fichaState.peri[nome] = 0;
      renderDots('periciasDotsContainer', fichaState.peri, 'peri', 10);
      setTimeout(() => {
        const c = document.getElementById('periciasDotsContainer');
        if (c && c.lastElementChild) c.lastElementChild.scrollIntoView({ behavior:'smooth', block:'nearest' });
      }, 50);
    } else if (tipo === 'profissao') {
      if (!(nome in fichaState.periProf)) fichaState.periProf[nome] = 0;
      const secao = document.getElementById('secaoPericiasProfissao');
      if (secao) secao.style.display = 'block';
      renderDots('periciaProfContainer', fichaState.periProf, 'periProf', 10);
      setTimeout(() => {
        const c = document.getElementById('periciaProfContainer');
        if (c && c.lastElementChild) c.lastElementChild.scrollIntoView({ behavior:'smooth', block:'nearest' });
      }, 50);
    } else {
      if (!(nome in fichaState.periOutra)) fichaState.periOutra[nome] = 0;
    }
    document.getElementById('modalPericiaOverlay').classList.remove('open');
  });

  // ===== LISTAS CLICÁVEIS =====
  function renderClickable(tipo) {
    const grid = document.getElementById('grid' + capitalize(tipo));
    if (!grid) return;
    const lista = fichaState[tipo] || [];
    if (!lista.length) {
      grid.innerHTML = `<div class="clickable-item-empty">Nenhum item</div>`;
      return;
    }
    grid.innerHTML = lista.map((item, i) => `
      <button class="clickable-item" data-tipo="${tipo}" data-idx="${i}" type="button">
        ${escH(item.title)}
      </button>
    `).join('');
    grid.querySelectorAll('.clickable-item').forEach(btn => {
      btn.addEventListener('click', () => abrirModalItemEditar(btn.dataset.tipo, parseInt(btn.dataset.idx)));
    });
  }

  window.abrirModalItem = function(tipo) {
    modalItemTipo = tipo; modalItemIdx = null;
    document.getElementById('modalItemTitulo').textContent = 'Adicionar ' + capitalize(tipo.slice(0,-1));
    document.getElementById('modalItemNome').value = '';
    document.getElementById('modalItemDesc').value = '';
    document.getElementById('btnDeletarItem').style.display = 'none';
    document.getElementById('modalItemOverlay').classList.add('open');
    document.getElementById('modalItemNome').focus();
  };

  function abrirModalItemEditar(tipo, idx) {
    modalItemTipo = tipo; modalItemIdx = idx;
    const item = fichaState[tipo][idx];
    document.getElementById('modalItemTitulo').textContent = item.title;
    document.getElementById('modalItemNome').value  = item.title;
    document.getElementById('modalItemDesc').value  = item.desc || '';
    document.getElementById('btnDeletarItem').style.display = 'inline-flex';
    document.getElementById('modalItemOverlay').classList.add('open');
  }

  document.getElementById('btnFecharModalItem').addEventListener('click', () => {
    document.getElementById('modalItemOverlay').classList.remove('open');
  });

  document.getElementById('btnConfirmarItem').addEventListener('click', () => {
    const nome = document.getElementById('modalItemNome').value.trim();
    const desc = document.getElementById('modalItemDesc').value.trim();
    if (!nome) return;
    if (modalItemIdx !== null) {
      fichaState[modalItemTipo][modalItemIdx] = { title: nome, desc };
    } else {
      fichaState[modalItemTipo].push({ title: nome, desc });
    }
    renderClickable(modalItemTipo);
    document.getElementById('modalItemOverlay').classList.remove('open');
  });

  document.getElementById('btnDeletarItem').addEventListener('click', () => {
    if (!confirm('Excluir este item?')) return;
    fichaState[modalItemTipo].splice(modalItemIdx, 1);
    renderClickable(modalItemTipo);
    document.getElementById('modalItemOverlay').classList.remove('open');
  });

  // Fecha modal ao clicar no overlay
  ['modalItemOverlay','modalPericiaOverlay'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target.id === id) document.getElementById(id).classList.remove('open');
    });
  });

  // ===== SYNC TEXTOS =====
  function syncTextos() {
    fichaState.nome         = document.getElementById('fichaNome').value.trim();
    fichaState.idade        = document.getElementById('fichaIdade').value.trim();
    fichaState.profissao    = document.getElementById('fichaProfissao').value.trim();
    fichaState.expectativa  = document.getElementById('fichaExpectativa').value.trim();
    fichaState.ecoDinheiro  = document.getElementById('ecoDinheiro')?.value || '';
    fichaState.ecoGasto     = document.getElementById('ecoGasto')?.value || '';
    fichaState.ecoRenda     = document.getElementById('ecoRenda')?.value || '';
    fichaState.rdRoupa      = parseInt(document.getElementById('rdRoupa')?.value) || 0;
  }

  function bindRecursos() {
    const ids = ['vidaAtual','vidaMax','sanAtual','sanMax','estAtual','estMax',
                 'sacAtual','sacMax','sedeAtual','sedeMax','energiaAtual','energiaMax'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { syncRecursos(); atualizarPreview(); });
    });
  }

  function syncRecursos() {
    ['vida','san','est','sac','sede','energia'].forEach(r => {
      const a = document.getElementById(r+'Atual');
      const m = document.getElementById(r+'Max');
      if (a) fichaState[r+'Atual'] = parseInt(a.value)||0;
      if (m) fichaState[r+'Max']   = parseInt(m.value)||0;
    });
  }

  // ===== RECALCULAR CAPACITAÇÕES =====
  function recalcularCapacitacoes() {
    const tpl = TEMPLATES[sistemaAtivo];
    if (!tpl || !fichaState) return;
    const d = { atrs: fichaState.atrs, peri: fichaState.peri, rdRoupa: fichaState.rdRoupa };
    const esq  = tpl.calcEsquiva(d);
    const perc = tpl.calcPercepcao(d);
    const def  = tpl.calcDefesa(d);
    const peso = (fichaState.atrs['Físico'] || fichaState.atrs['Força'] || 0) * 10;
    const elE = document.getElementById('capEsquiva');
    const elP = document.getElementById('capPercepcao');
    const elD = document.getElementById('capDefesa');
    const elW = document.getElementById('capPeso');
    if (elE) elE.textContent = esq;
    if (elP) elP.textContent = perc;
    if (elD) elD.textContent = def;
    if (elW) elW.textContent = peso + ' kg';
  }

  // ===== PREVIEW =====
  function atualizarPreview() {
    document.getElementById('previewNome').textContent = fichaState.nome || 'Nome do Personagem';
    const meta = [fichaState.profissao, fichaState.idade ? fichaState.idade + ' anos' : ''].filter(Boolean).join(' · ');
    document.getElementById('previewMeta').textContent = meta || '—';

    // Stats vitais
    const previewStats = document.getElementById('previewStats');
    const stats = [
      { k:'VIDA',    v:`${fichaState.vidaAtual||0}/${fichaState.vidaMax||0}` },
      { k:'SANIDADE',v:`${fichaState.sanAtual||0}/${fichaState.sanMax||0}` },
      { k:'ESTAMINA',v:`${fichaState.estAtual||0}/${fichaState.estMax||0}` },
    ];
    previewStats.innerHTML = stats.map(s =>
      `<div class="preview-stat"><div class="preview-stat-key">${s.k}</div><div class="preview-stat-val">${s.v}</div></div>`
    ).join('');
  }

  // ===== CANCELAR =====
  document.getElementById('btnCancelarFicha').addEventListener('click', () => {
    mostrarEtapa(1);
    sistemaAtivo = null;
    almaRolada = null;
    fichaState = {};
    document.getElementById('forjaSubtitle').textContent = 'Selecione um universo para começar';
  });

  // ===== SALVAR FICHA NO BANCO =====
  document.getElementById('btnSalvarFicha').addEventListener('click', async () => {
    syncTextos();
    syncRecursos();

    if (!fichaState.nome) { alertForja('Nome do personagem é obrigatório.'); return; }

    // Monta o JSON completo dos atributos
    const atributosCompletos = {
      // Atributos base
      ...fichaState.atrs,
      // Perícias
      _pericias: fichaState.peri,
      _periciasProf: fichaState.periProf,
      // Status vitais
      vida:    [fichaState.vidaAtual,  fichaState.vidaMax],
      sanidade:[fichaState.sanAtual,   fichaState.sanMax],
      estamina:[fichaState.estAtual,   fichaState.estMax],
      // Extras DC
      saciedade:[fichaState.sacAtual,  fichaState.sacMax],
      sede:    [fichaState.sedeAtual,  fichaState.sedeMax],
      energia: [fichaState.energiaAtual, fichaState.energiaMax],
      rd_roupa: fichaState.rdRoupa,
      // Economia
      dinheiro: fichaState.ecoDinheiro,
      gasto_fixo: fichaState.ecoGasto,
      renda: fichaState.ecoRenda,
      // Dados pessoais
      idade: fichaState.idade,
      profissao: fichaState.profissao,
      expectativa_vida: fichaState.expectativa,
      // Listas
      habilidades:    fichaState.habilidades,
      qualidades:     fichaState.qualidades,
      defeitos:       fichaState.defeitos,
      itens:          fichaState.itens,
      caracteristicas:fichaState.caracteristicas,
      // Alma (Decadência Cinza) — salvo fixo para não mudar ao recarregar
      alma: fichaState.alma || null,
    };

    const fd = new FormData();
    fd.append('nome_personagem', fichaState.nome);
    fd.append('sistema', fichaState.sistema); // 'Decadência Cinza', etc.
    fd.append('atributos', JSON.stringify(atributosCompletos));
    const imgFile = document.getElementById('fichaImagem').files[0];
    if (imgFile) fd.append('imagem', imgFile);

    const btn = document.getElementById('btnSalvarFicha');
    btn.disabled = true; btn.textContent = 'Forjando...';

    try {
      const res = fichaState.id
        ? await Api.atualizarFicha(fichaState.id, fd)
        : await Api.criarFicha(fd);

      if (res?.ok) {
        if (!fichaState.id && res.data.id) {
          fichaState.id = res.data.id;
          history.replaceState(null, '', `/forja?id=${res.data.id}`);
        }
        alertForja(fichaState.id ? 'Ficha atualizada!' : 'Personagem forjado!', 'success');
        carregarFichasLista();
      } else {
        alertForja(res?.data?.message || 'Erro ao salvar.');
      }
    } catch { alertForja('Erro de conexão.'); }
    finally { btn.disabled = false; btn.textContent = fichaState.id ? 'Atualizar Ficha' : 'Forjar Personagem'; }
  });

  // ===== CARREGAR FICHA PARA EDIÇÃO =====
  async function carregarFichaParaEdicao(id) {
    try {
      const res = await Api.request(`/fichas/${id}`);
      if (!res?.ok) return;
      const f = res.data.ficha;
      const atrs = typeof f.atributos === 'string' ? JSON.parse(f.atributos) : f.atributos;

      sistemaAtivo = f.sistema || 'Decadência Cinza';
      const tpl = TEMPLATES[sistemaAtivo];

      // Reconstrói o estado a partir do JSON salvo
      fichaState = {
        id: f.id,
        sistema: sistemaAtivo,
        alma: atrs.alma ? { ...atrs.alma, nucleosValores: atrs.alma.nucleosValores || [] } : null,
        nome: f.nome_personagem,
        idade: atrs.idade || '',
        profissao: atrs.profissao || '',
        expectativa: atrs.expectativa_vida || '',
        vidaAtual: atrs.vida?.[0] || 0,    vidaMax: atrs.vida?.[1] || 10,
        sanAtual:  atrs.sanidade?.[0] || 0, sanMax:  atrs.sanidade?.[1] || 10,
        estAtual:  atrs.estamina?.[0] || 0, estMax:  atrs.estamina?.[1] || 10,
        sacAtual:  atrs.saciedade?.[0] || 10, sacMax: atrs.saciedade?.[1] || 10,
        sedeAtual: atrs.sede?.[0] || 10,    sedeMax: atrs.sede?.[1] || 10,
        energiaAtual: atrs.energia?.[0] || 10, energiaMax: atrs.energia?.[1] || 10,
        rdRoupa: atrs.rd_roupa || 0,
        ecoDinheiro: atrs.dinheiro || '',
        ecoGasto:    atrs.gasto_fixo || '',
        ecoRenda:    atrs.renda || '',
        atrs: {},
        peri: { ...tpl.pericias },
        periProf: atrs._periciasProf || {},
        periOutra: {},
        habilidades:     atrs.habilidades || [],
        qualidades:      atrs.qualidades || [],
        defeitos:        atrs.defeitos || [],
        itens:           atrs.itens || [],
        caracteristicas: atrs.caracteristicas || [],
      };

      // Atributos base (excluindo campos especiais)
      const ignorar = new Set(['_pericias','_periciasProf','vida','sanidade','estamina','saciedade','sede','energia','rd_roupa','dinheiro','gasto_fixo','renda','idade','profissao','expectativa_vida','habilidades','qualidades','defeitos','itens','caracteristicas','alma']);
      Object.keys(tpl.atributos).forEach(k => {
        fichaState.atrs[k] = atrs[k] ?? 0;
      });

      // Perícias base
      if (atrs._pericias) fichaState.peri = atrs._pericias;

      // Preenche campos do formulário
      almaRolada = fichaState.alma;
      montarFormulario();

      document.getElementById('fichaNome').value       = fichaState.nome;
      document.getElementById('fichaIdade').value      = fichaState.idade;
      document.getElementById('fichaProfissao').value  = fichaState.profissao;
      document.getElementById('fichaExpectativa').value= fichaState.expectativa;
      document.getElementById('vidaAtual').value       = fichaState.vidaAtual;
      document.getElementById('vidaMax').value         = fichaState.vidaMax;
      document.getElementById('sanAtual').value        = fichaState.sanAtual;
      document.getElementById('sanMax').value          = fichaState.sanMax;
      document.getElementById('estAtual').value        = fichaState.estAtual;
      document.getElementById('estMax').value          = fichaState.estMax;
      if (document.getElementById('sacAtual')) document.getElementById('sacAtual').value = fichaState.sacAtual;
      if (document.getElementById('sacMax'))   document.getElementById('sacMax').value   = fichaState.sacMax;
      if (document.getElementById('rdRoupa'))  document.getElementById('rdRoupa').value  = fichaState.rdRoupa;
      if (f.imagem_url) document.getElementById('previewAvatar').innerHTML = `<img src="${f.imagem_url}" alt="${f.nome_personagem}"/>`;

      document.getElementById('btnSalvarFicha').textContent = 'Atualizar Ficha';
      document.getElementById('forjaSubtitle').textContent  = sistemaAtivo;
      mostrarEtapa(2);
      atualizarPreview();
      recalcularCapacitacoes();
    } catch (e) { alertForja('Erro ao carregar ficha.'); console.error(e); }
  }

  // ===== LISTA DE FICHAS =====
  document.querySelectorAll('.fsys-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fsys-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroSistema = btn.dataset.fsistema;
      renderFichasLista();
    });
  });

  function renderFichasLista() {
    const container = document.getElementById('listaFichasForja');
    const filtradas = filtroSistema === 'todos'
      ? fichasCache
      : fichasCache.filter(f => f.sistema === filtroSistema);

    if (!filtradas.length) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:.82rem;padding:.75rem 0;font-family:var(--font-heading);letter-spacing:.1em;text-transform:uppercase;">Nenhuma ficha encontrada.</div>';
      return;
    }

    container.innerHTML = filtradas.map(f => `
      <div class="ficha-list-item">
        <div>
          <span class="ficha-list-nome">${escH(f.nome_personagem)}</span>
          <div style="font-size:.72rem;color:var(--text-muted);font-family:var(--font-heading);">${escH(f.sistema)}</div>
        </div>
        <div class="ficha-list-actions">
          <button class="btn btn-sm btn-editar-ficha" data-id="${f.id}" type="button">Editar</button>
          ${isMestre ? `<button class="btn btn-sm btn-danger btn-del-ficha" data-id="${f.id}" type="button">✕</button>` : ''}
        </div>
      </div>`).join('');

    container.querySelectorAll('.btn-editar-ficha').forEach(btn => {
      btn.addEventListener('click', () => {
        history.pushState(null, '', `/forja?id=${btn.dataset.id}`);
        carregarFichaParaEdicao(btn.dataset.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
    container.innerHTML = '<div style="color:var(--text-muted);font-size:.82rem;padding:.5rem;">Carregando...</div>';
    try {
      const res = await Api.listarFichas();
      if (!res?.ok || !res.data.fichas.length) {
        fichasCache = [];
        container.innerHTML = '<div style="color:var(--text-muted);font-size:.82rem;padding:.5rem;font-family:var(--font-heading);letter-spacing:.08em;text-transform:uppercase;">Nenhuma ficha criada ainda.</div>';
        return;
      }
      fichasCache = res.data.fichas;
      renderFichasLista();
    } catch { container.innerHTML = '<div style="color:var(--text-muted);">Erro ao carregar.</div>'; }
  }

  document.getElementById('btnRefreshLista').addEventListener('click', carregarFichasLista);

  // ===== ALERT =====
  function alertForja(msg, tipo = 'error') {
    const el = document.getElementById('alertForja');
    el.className = `alert alert-${tipo} show`;
    el.textContent = msg;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (tipo === 'success') setTimeout(() => { el.className = 'alert'; }, 3500);
  }

  function escH(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ===== INIT =====
  const editId = new URLSearchParams(window.location.search).get('id');
  if (editId) {
    carregarFichaParaEdicao(editId);
  } else {
    mostrarEtapa(1);
  }
  carregarFichasLista();

})();
