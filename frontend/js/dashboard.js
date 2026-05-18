// frontend/js/dashboard.js
(function () {
  'use strict';

  // ===== CAMPOS ESTRUTURADOS POR CATEGORIA =====

  // Quais categorias usam modo estruturado por padrão
  const CATS_ESTRUTURADAS = new Set([
    'Itens','Armas Brancas','Armas de Fogo','Armaduras',
    'Magias/Rituais','Classes','Montaria','Embarcações','Tripulação','Veículos'
  ]);

  // Definição dos campos por categoria
  const CAMPOS_POR_CATEGORIA = {
    'Itens': () => `
      <div class="campo-estruturado">
        <div class="campo-estruturado-titulo">Propriedades do Item</div>
        <div class="campos-grid-3">
          <div class="form-group"><label>Efeito / Buff</label>
            <input type="text" id="ce-efeito" placeholder="Ex: +2 Vigor por 1 turno"/></div>
          <div class="form-group"><label>Peso (slots)</label>
            <input type="number" id="ce-peso" min="0" value="1"/></div>
          <div class="form-group"><label>Preço</label>
            <input type="text" id="ce-preco" placeholder="Ex: 15 peças"/></div>
        </div>
        <div class="campos-grid-2">
          <div class="form-group"><label>Condição Especial</label>
            <input type="text" id="ce-condicao" placeholder="Ex: Quebra ao cair"/></div>
          <div class="form-group"><label>Usos / Quantidade</label>
            <input type="text" id="ce-usos" placeholder="Ex: 3 usos, Empilhável"/></div>
        </div>
      </div>`,

    'Armas Brancas': () => `
      <div class="campo-estruturado">
        <div class="campo-estruturado-titulo">⚔ Estatísticas de Combate</div>
        <div class="campos-grid-3">
          <div class="form-group"><label>Dano — Integridade</label>
            <input type="text" id="ce-dano-int" placeholder="Ex: 3"/></div>
          <div class="form-group"><label>Dano — Vitalidade</label>
            <input type="text" id="ce-dano-vit" placeholder="Ex: 1"/></div>
          <div class="form-group"><label>Alcance (metros)</label>
            <input type="text" id="ce-alcance" placeholder="Ex: 1m / 2m"/></div>
        </div>
        <div class="campos-grid-3">
          <div class="form-group"><label>Peso (slots)</label>
            <input type="number" id="ce-peso" min="1" value="2"/></div>
          <div class="form-group"><label>Atributo Base</label>
            <input type="text" id="ce-atributo" placeholder="Ex: Vigor Bruto"/></div>
          <div class="form-group"><label>Preço</label>
            <input type="text" id="ce-preco" placeholder="Ex: 40 peças"/></div>
        </div>
        <div class="campos-grid-2">
          <div class="form-group"><label>Classe com Vantagem</label>
            <input type="text" id="ce-classe-vantagem" placeholder="Ex: Duelista, Berserker"/></div>
          <div class="form-group"><label>Requisito</label>
            <input type="text" id="ce-requisito" placeholder="Ex: Vigor Bruto 3+"/></div>
        </div>
      </div>`,

    'Armas de Fogo': () => `
      <div class="campo-estruturado">
        <div class="campo-estruturado-titulo">🔫 Estatísticas de Combate</div>
        <div class="campos-grid-3">
          <div class="form-group"><label>Dano — Integridade</label>
            <input type="text" id="ce-dano-int" placeholder="Ex: 4"/></div>
          <div class="form-group"><label>Dano — Vitalidade</label>
            <input type="text" id="ce-dano-vit" placeholder="Ex: 2"/></div>
          <div class="form-group"><label>Alcance (metros)</label>
            <input type="text" id="ce-alcance" placeholder="Ex: 30m"/></div>
        </div>
        <div class="campos-grid-3">
          <div class="form-group"><label>Munição / Carregador</label>
            <input type="text" id="ce-municao" placeholder="Ex: 6 tiros"/></div>
          <div class="form-group"><label>Peso (slots)</label>
            <input type="number" id="ce-peso" min="1" value="2"/></div>
          <div class="form-group"><label>Preço</label>
            <input type="text" id="ce-preco" placeholder="Ex: 120 peças"/></div>
        </div>
        <div class="form-group">
          <label>Penalidade / Condição Especial</label>
          <input type="text" id="ce-condicao" placeholder="Ex: Inutilizável em chuva forte"/>
        </div>
      </div>`,

    'Armaduras': () => `
      <div class="campo-estruturado">
        <div class="campo-estruturado-titulo">🛡 Propriedades da Armadura</div>
        <div class="campos-grid-3">
          <div class="form-group"><label>Integridade Base</label>
            <input type="number" id="ce-integridade" min="1" value="10"/></div>
          <div class="form-group"><label>RD (Redução de Dano)</label>
            <input type="number" id="ce-rd" min="0" value="0"/></div>
          <div class="form-group"><label>Peso (slots)</label>
            <input type="number" id="ce-peso" min="1" value="3"/></div>
        </div>
        <div class="campos-grid-2">
          <div class="form-group"><label>Penalidade de Movimento</label>
            <input type="text" id="ce-penalidade-mov" placeholder="Ex: -2 movimento"/></div>
          <div class="form-group"><label>Restrição de Classe</label>
            <input type="text" id="ce-restricao" placeholder="Ex: Não usável por Batedor"/></div>
        </div>
        <div class="campos-grid-2">
          <div class="form-group"><label>Material</label>
            <input type="text" id="ce-material" placeholder="Ex: Aço temperado, Couro curtido"/></div>
          <div class="form-group"><label>Preço</label>
            <input type="text" id="ce-preco" placeholder="Ex: 80 peças"/></div>
        </div>
      </div>`,

    'Magias/Rituais': () => `
      <div class="campo-estruturado">
        <div class="campo-estruturado-titulo">✨ Propriedades da Magia</div>
        <div class="campos-grid-3">
          <div class="form-group"><label>Custo</label>
            <input type="text" id="ce-custo" placeholder="Ex: 2 Ímpeto, 1 Sanidade"/></div>
          <div class="form-group"><label>Alcance</label>
            <input type="text" id="ce-alcance" placeholder="Ex: 10 metros, Contato"/></div>
          <div class="form-group"><label>Duração</label>
            <input type="text" id="ce-duracao" placeholder="Ex: 3 turnos, Permanente"/></div>
        </div>
        <div class="form-group">
          <label>Efeito</label>
          <textarea id="ce-efeito" rows="2" placeholder="Descreva o que a magia faz mecanicamente..."></textarea>
        </div>
        <div class="form-group">
          <label>Falha Crítica (resultado 1)</label>
          <input type="text" id="ce-falha" placeholder="Ex: Causa 2 de dano em sanidade ao conjurador"/>
        </div>
        <div class="form-group">
          <label>Atributo de Teste</label>
          <input type="text" id="ce-atributo" placeholder="Ex: Lucidez, Intelecto"/>
        </div>
      </div>`,

    'Classes': () => `
      <div class="campo-estruturado">
        <div class="campo-estruturado-titulo">👤 Identidade da Classe</div>
        <div class="campos-grid-2">
          <div class="form-group"><label>Atributo Base</label>
            <input type="text" id="ce-atributo" placeholder="Ex: Vigor Bruto"/></div>
          <div class="form-group"><label>Vantagem de Arma</label>
            <input type="text" id="ce-arma-vantagem" placeholder="Ex: Lanças e Alabardas"/></div>
        </div>
      </div>
      <div class="campo-estruturado">
        <div class="campo-estruturado-titulo">Habilidades Inatas (Passivas)</div>
        <div id="lista-inatas"></div>
        <button class="btn-add-small" id="btnAddInata" type="button" style="margin-top:.5rem;">+ Adicionar Inata</button>
      </div>
      <div class="campo-estruturado">
        <div class="campo-estruturado-titulo">Habilidades Ativas (Custo em Ímpeto)</div>
        <div id="lista-ativas"></div>
        <button class="btn-add-small" id="btnAddAtiva" type="button" style="margin-top:.5rem;">+ Adicionar Ativa</button>
      </div>`,

    'Montaria': () => `
      <div class="campo-estruturado">
        <div class="campo-estruturado-titulo">🐴 Estatísticas da Montaria</div>
        <div class="campos-grid-3">
          <div class="form-group"><label>Vitalidade</label>
            <input type="number" id="ce-vitalidade" min="1" value="10"/></div>
          <div class="form-group"><label>Ímpeto</label>
            <input type="number" id="ce-impeto" min="0" value="9"/></div>
          <div class="form-group"><label>Integridade</label>
            <input type="number" id="ce-integridade" min="0" value="4"/></div>
        </div>
        <div class="campos-grid-2">
          <div class="form-group"><label>Bônus Especial</label>
            <input type="text" id="ce-bonus" placeholder="Ex: +2 em testes de fuga"/></div>
          <div class="form-group"><label>Consumo Diário</label>
            <input type="text" id="ce-consumo" placeholder="Ex: 3 fenos + 3 água"/></div>
        </div>
        <div class="campos-grid-2">
          <div class="form-group"><label>Característica Especial</label>
            <input type="text" id="ce-caracteristica" placeholder="Ex: Não recua de abominações"/></div>
          <div class="form-group"><label>Preço</label>
            <input type="text" id="ce-preco" placeholder="Ex: 200 peças"/></div>
        </div>
      </div>`,

    'Embarcações': () => `
      <div class="campo-estruturado">
        <div class="campo-estruturado-titulo">⛵ Estatísticas da Embarcação</div>
        <div class="campos-grid-3">
          <div class="form-group"><label>Casco (Vitalidade)</label>
            <input type="number" id="ce-casco" min="1" value="20"/></div>
          <div class="form-group"><label>Velocidade</label>
            <input type="text" id="ce-velocidade" placeholder="Ex: 8 nós"/></div>
          <div class="form-group"><label>Carga Máxima (slots)</label>
            <input type="number" id="ce-carga" min="0" value="50"/></div>
        </div>
        <div class="campos-grid-2">
          <div class="form-group"><label>Tripulação Mínima</label>
            <input type="number" id="ce-tripulacao" min="1" value="4"/></div>
          <div class="form-group"><label>Armas de Bordo</label>
            <input type="text" id="ce-armas-bordo" placeholder="Ex: 4 canhões laterais"/></div>
        </div>
        <div class="campos-grid-2">
          <div class="form-group"><label>Bônus Especial</label>
            <input type="text" id="ce-bonus" placeholder="Ex: +2 em navegação noturna"/></div>
          <div class="form-group"><label>Preço</label>
            <input type="text" id="ce-preco" placeholder="Ex: 2.000 peças"/></div>
        </div>
      </div>`,

    'Veículos': () => `
      <div class="campo-estruturado">
        <div class="campo-estruturado-titulo">🚗 Estatísticas do Veículo</div>
        <div class="campos-grid-3">
          <div class="form-group"><label>Estrutura (Vitalidade)</label>
            <input type="number" id="ce-estrutura" min="1" value="15"/></div>
          <div class="form-group"><label>Velocidade</label>
            <input type="text" id="ce-velocidade" placeholder="Ex: 30 km/h"/></div>
          <div class="form-group"><label>Capacidade de Carga</label>
            <input type="text" id="ce-carga" placeholder="Ex: 500 kg"/></div>
        </div>
        <div class="campos-grid-2">
          <div class="form-group"><label>Tripulação Mínima</label>
            <input type="number" id="ce-tripulacao" min="1" value="1"/></div>
          <div class="form-group"><label>Combustível</label>
            <input type="text" id="ce-combustivel" placeholder="Ex: 20L por dia"/></div>
        </div>
      </div>`,

    'Tripulação': () => `
      <div class="campo-estruturado">
        <div class="campo-estruturado-titulo">🧭 Dados do NPC de Tripulação</div>
        <div class="campos-grid-2">
          <div class="form-group"><label>Função na Embarcação</label>
            <input type="text" id="ce-funcao" placeholder="Ex: Navegador, Cozinheiro"/></div>
          <div class="form-group"><label>Moral (recurso)</label>
            <input type="number" id="ce-moral" min="0" value="10"/></div>
        </div>
        <div class="campos-grid-2">
          <div class="form-group"><label>Lealdade (1-10)</label>
            <input type="number" id="ce-lealdade" min="1" max="10" value="5"/></div>
          <div class="form-group"><label>Habilidade Especial</label>
            <input type="text" id="ce-habilidade" placeholder="Ex: +2 em navegação noturna"/></div>
        </div>
        <div class="form-group">
          <label>Segredo Pessoal</label>
          <input type="text" id="ce-segredo" placeholder="Algo que só o Mestre sabe..."/>
        </div>
      </div>`,
  };

  // Lê todos os campos estruturados do DOM e retorna um objeto
  function lerCamposEstruturados() {
    const campos = {};
    const descEl = document.getElementById('campoDescricao');
    if (descEl) campos.descricao = descEl.value.trim();

    // Campos genéricos por id
    const ids = [
      'ce-efeito','ce-peso','ce-preco','ce-condicao','ce-usos',
      'ce-dano-int','ce-dano-vit','ce-alcance','ce-atributo',
      'ce-classe-vantagem','ce-requisito','ce-municao','ce-penalidade-mov',
      'ce-restricao','ce-material','ce-integridade','ce-rd',
      'ce-custo','ce-duracao','ce-falha','ce-arma-vantagem',
      'ce-vitalidade','ce-impeto','ce-bonus','ce-consumo',
      'ce-caracteristica','ce-casco','ce-velocidade','ce-carga',
      'ce-tripulacao','ce-armas-bordo','ce-estrutura','ce-combustivel',
      'ce-funcao','ce-moral','ce-lealdade','ce-habilidade','ce-segredo',
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value !== '' && el.value !== null) {
        campos[id.replace('ce-','')] = el.type === 'number' ? (parseFloat(el.value) || 0) : el.value.trim();
      }
    });

    // Textarea efeito (magias)
    const efeitoTA = document.getElementById('ce-efeito');
    if (efeitoTA && efeitoTA.tagName === 'TEXTAREA') campos['efeito'] = efeitoTA.value.trim();

    // Habilidades de classe (inatas + ativas)
    const inatas = [];
    document.querySelectorAll('#lista-inatas .hab-classe-item').forEach(item => {
      const nome = item.querySelector('.hab-inata-nome')?.value.trim();
      const desc = item.querySelector('.hab-inata-desc')?.value.trim();
      if (nome) inatas.push({ nome, desc });
    });
    if (inatas.length) campos['habilidades_inatas'] = inatas;

    const ativas = [];
    document.querySelectorAll('#lista-ativas .hab-classe-item').forEach(item => {
      const nome  = item.querySelector('.hab-ativa-nome')?.value.trim();
      const custo = item.querySelector('.hab-ativa-custo')?.value.trim();
      const desc  = item.querySelector('.hab-ativa-desc')?.value.trim();
      if (nome) ativas.push({ nome, custo, desc });
    });
    if (ativas.length) campos['habilidades_ativas'] = ativas;

    return campos;
  }

  // Preenche campos ao editar um documento já salvo
  function preencherCamposEstruturados(camposObj) {
    if (!camposObj) return;
    const descEl = document.getElementById('campoDescricao');
    if (descEl && camposObj.descricao) descEl.value = camposObj.descricao;

    Object.entries(camposObj).forEach(([k, v]) => {
      const el = document.getElementById('ce-' + k);
      if (el && typeof v === 'string') el.value = v;
      else if (el && typeof v === 'number') el.value = v;
    });

    // Habilidades inatas
    if (camposObj.habilidades_inatas?.length) {
      const lista = document.getElementById('lista-inatas');
      if (lista) {
        lista.innerHTML = '';
        camposObj.habilidades_inatas.forEach(h => adicionarHabilidadeClasse('inata', h));
      }
    }
    // Habilidades ativas
    if (camposObj.habilidades_ativas?.length) {
      const lista = document.getElementById('lista-ativas');
      if (lista) {
        lista.innerHTML = '';
        camposObj.habilidades_ativas.forEach(h => adicionarHabilidadeClasse('ativa', h));
      }
    }
  }

  function adicionarHabilidadeClasse(tipo, dados = {}) {
    const lista = document.getElementById(tipo === 'inata' ? 'lista-inatas' : 'lista-ativas');
    if (!lista) return;
    const item = document.createElement('div');
    item.className = 'hab-classe-item';
    if (tipo === 'inata') {
      item.innerHTML = `
        <div class="hab-classe-inputs">
          <input type="text" class="hab-inata-nome" placeholder="Nome da habilidade inata"
            value="${escH(dados.nome||'')}"/>
          <input type="text" class="hab-inata-desc" placeholder="Descrição / efeito"
            value="${escH(dados.desc||'')}"/>
        </div>
        <button class="hab-classe-del" type="button">✕</button>`;
    } else {
      item.innerHTML = `
        <div class="hab-classe-inputs">
          <input type="text" class="hab-ativa-nome" placeholder="Nome da habilidade ativa"
            value="${escH(dados.nome||'')}"/>
          <input type="text" class="hab-ativa-custo" placeholder="Custo (ex: 2 Ímpeto)"
            value="${escH(dados.custo||'')}"/>
          <input type="text" class="hab-ativa-desc" placeholder="Descrição / efeito"
            value="${escH(dados.desc||'')}"/>
        </div>
        <button class="hab-classe-del" type="button">✕</button>`;
    }
    item.querySelector('.hab-classe-del').addEventListener('click', () => item.remove());
    lista.appendChild(item);
  }

  // ===== EDITOR QUILL =====
  let quillEditor = null;

  function initQuill() {
    if (quillEditor) return; // já inicializado
    quillEditor = new Quill('#editorQuill', {
      theme: 'snow',
      modules: { toolbar: '#editorToolbar' },
      placeholder: 'Escreva o conteúdo do documento...',
    });
  }

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
      const stabSessoes = document.getElementById('stabSessoes');
      if(stabSessoes) stabSessoes.style.display = t === 'sessoes' ? 'block' : 'none';
      
      if (t === 'fichas') carregarFichas();
      if (t === 'sessoes') carregarSessoes();
    });
  });

  // ===== FORM DOCUMENTO =====
  const selSistema  = document.getElementById('docSistema');
  const selCategoria = document.getElementById('docCategoria');

  function popularCategorias(sistema) {
    const cats = (SISTEMAS[sistema] || SISTEMAS['Decadência Cinza']).categorias;
    selCategoria.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  // ===== LÓGICA DO MODO DO DOCUMENTO =====
  let modoDocAtivo = 'lore';

  function atualizarModoDoc(categoria) {
    const deveEstruturar = CATS_ESTRUTURADAS.has(categoria);
    if (deveEstruturar && modoDocAtivo !== 'estruturado') {
      setModoDoc('estruturado');
    } else if (!deveEstruturar && modoDocAtivo !== 'lore') {
      setModoDoc('lore');
    }
    // Atualiza campos dinâmicos independente
    atualizarCamposDinamicos(categoria);
  }

  function setModoDoc(modo) {
    modoDocAtivo = modo;
    document.querySelectorAll('.modo-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.modo === modo);
    });
    document.getElementById('modoLore').style.display       = modo === 'lore'       ? 'block' : 'none';
    document.getElementById('modoEstruturado').style.display = modo === 'estruturado' ? 'block' : 'none';
  }

  function atualizarCamposDinamicos(categoria) {
    const container = document.getElementById('camposDinamicos');
    if (!container) return;
    const fn = CAMPOS_POR_CATEGORIA[categoria];
    container.innerHTML = fn ? fn() : '';
    // Bind botões de habilidades de classe
    document.getElementById('btnAddInata')?.addEventListener('click', () => adicionarHabilidadeClasse('inata'));
    document.getElementById('btnAddAtiva')?.addEventListener('click', () => adicionarHabilidadeClasse('ativa'));
  }

  // Listeners das tabs de modo
  document.querySelectorAll('.modo-tab').forEach(btn => {
    btn.addEventListener('click', () => setModoDoc(btn.dataset.modo));
  });

  // Quando a categoria muda, atualiza o modo e os campos
  selCategoria.addEventListener('change', () => {
    atualizarModoDoc(selCategoria.value);
  });
  selSistema.addEventListener('change', () => {
    popularCategorias(selSistema.value);
    atualizarModoDoc(selCategoria.value);
  });

  selSistema.addEventListener('change', () => popularCategorias(selSistema.value));
  popularCategorias('Decadência Cinza');

 document.getElementById('btnNovoDoc')?.addEventListener('click', () => {
    docEditandoId = null;
    document.getElementById('docTitulo').value   = '';
    document.getElementById('docConteudo').value = '';
    document.getElementById('docTags').value     = '';
    initQuill();
    quillEditor.setContents([]); // limpa o editor
    selSistema.value = sistemaAtual;
    popularCategorias(sistemaAtual);
    document.getElementById('formCriarDoc').classList.add('open');
    modoDocAtivo = 'lore';
    setModoDoc('lore');
    atualizarCamposDinamicos(selCategoria.value);
    atualizarModoDoc(selCategoria.value);
    if (document.getElementById('campoDescricao')) document.getElementById('campoDescricao').value = '';
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
    const conteudo    = modoDocAtivo === 'lore'
      ? (quillEditor ? quillEditor.root.innerHTML : '')
      : (document.getElementById('campoDescricao')?.value.trim() || '');
    const campos_extras = modoDocAtivo === 'estruturado'
      ? JSON.stringify(lerCamposEstruturados())
      : null;
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
     fd.append('tipo_documento', modoDocAtivo);
    if (campos_extras) fd.append('campos_extras', campos_extras);
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
    console.log('HTML do conteudo:', doc.conteudo);
    document.getElementById('modalDocMeta').innerHTML =
      `<span class="badge badge-gold">${escH(doc.sistema)}</span> &nbsp;
       <span class="badge badge-gray">${escH(doc.categoria)}</span>`;

    document.getElementById('modalDocTitulo').textContent = doc.titulo;

    const corpo = document.getElementById('modalDocCorpo');
    if (doc.tipo_documento === 'estruturado' && doc.campos_extras) {
      const campos = typeof doc.campos_extras === 'string'
        ? JSON.parse(doc.campos_extras) : doc.campos_extras;
      corpo.innerHTML = renderDocEstruturado(campos, doc.categoria) + renderTagsHtml(doc.tags);
    } else {
      corpo.innerHTML = `<div class="doc-conteudo-rich">${formatarConteudo(doc.conteudo)}</div>
        ${renderTagsHtml(doc.tags)}`;
    }
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
    document.getElementById('docTitulo').value = doc.titulo;
    document.getElementById('docTags').value   = doc.tags || '';
     const tipoDoc = doc.tipo_documento || 'lore';
    setModoDoc(tipoDoc);
    atualizarCamposDinamicos(doc.categoria || 'Livro de Regras');
    if (tipoDoc === 'estruturado' && doc.campos_extras) {
      const campos = typeof doc.campos_extras === 'string'
        ? JSON.parse(doc.campos_extras) : doc.campos_extras;
      setTimeout(() => preencherCamposEstruturados(campos), 50);
    }
    initQuill();
    quillEditor.root.innerHTML = doc.conteudo || '';
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


  // ===== SESSÕES / MESAS =====
  window.abrirModalNovaSessao = () => {
    document.getElementById('nomeSessao').value = '';
    document.getElementById('sistemaSessao').value = 'Decadência Cinza';
    document.getElementById('modalNovaSessao').classList.add('open');
  };

  window.fecharModalNovaSessao = () => {
    document.getElementById('modalNovaSessao').classList.remove('open');
  };

  document.getElementById('btnSalvarSessao')?.addEventListener('click', async () => {
    const nome = document.getElementById('nomeSessao').value.trim();
    const sistema = document.getElementById('sistemaSessao').value;
    const narrador = document.getElementById('checkNarradorSessaoDash')?.checked || false;
    
    if (!nome) { alert('Digite o nome da campanha.'); return; }
    
    const btn = document.getElementById('btnSalvarSessao');
    btn.disabled = true; btn.textContent = 'Criando...';
    
    try {
      const res = await Api.request('/sessoes', { method: 'POST', body: { nome, sistema, is_narrador: narrador } });
      if (res?.ok) {
        fecharModalNovaSessao();
        carregarSessoes();
      } else {
        alert(res?.data?.message || 'Erro ao criar mesa.');
      }
    } catch { alert('Erro de conexão.'); }
    finally { btn.disabled = false; btn.textContent = 'Forjar Mesa'; }
  });

  async function carregarSessoes() {
    const container = document.getElementById('listaSessoes');
    if (!container) return;
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="spinner" style="margin:0 auto;"></div></div>`;
    
    try {
      const res = await Api.request('/sessoes');
      if (!res?.ok) { 
        container.innerHTML = renderEmpty('🎲', 'Você ainda não possui mesas. Crie uma nova!');
        return; 
      }
      
      const sessoes = res.data.sessoes || res.data || [];
      if (document.getElementById('statSessoes')) document.getElementById('statSessoes').textContent = sessoes.length;
      
      if (!sessoes.length) { 
        container.innerHTML = renderEmpty('🎲', 'Você ainda não possui mesas ativas. Crie uma nova!'); 
        return; 
      }
      
      container.innerHTML = sessoes.map(s => {
        const sistemaStr = s.sistema ? `<div class="ficha-sistema">${escH(s.sistema)}</div>` : '';
        return `
        <div class="ficha-card fade-in" style="cursor: pointer;" onclick="window.location.href='/mesa?codigo=${s.codigo}'">
          <div class="ficha-header">
            <div class="ficha-avatar"><i class="fa-solid fa-dice-d20" style="color:var(--gold-dim); font-size:1.5rem;"></i></div>
            <div>
              <div class="ficha-nome">${escH(s.nome)}</div>
              ${sistemaStr}
              <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px;">Código: <strong>#${s.codigo}</strong></div>
            </div>
          </div>
          <div style="margin-top:.75rem; text-align:right;">
            <span class="btn btn-sm btn-primary">Entrar na Mesa</span>
          </div>
        </div>`;
      }).join('');
      
    } catch (e) { 
      container.innerHTML = renderEmpty('🎲', 'Você ainda não possui mesas. Crie uma nova!');
      if (document.getElementById('statSessoes')) document.getElementById('statSessoes').textContent = '0';
    }
  }

  // ===== UTILS =====
  function renderEmpty(icon, msg) {
    return `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">${icon}</div><p>${msg}</p></div>`;
  }
  function escH(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderDocEstruturado(campos, categoria) {
    if (!campos) return '';
    const linhas = [];

    if (campos.descricao) {
      linhas.push(`<p style="color:var(--text-secondary);font-size:1rem;line-height:1.7;margin-bottom:.75rem;">${escH(campos.descricao)}</p>`);
    }

    const LABELS = {
      'dano-int':       '⚔ Dano (Integridade)',
      'dano-vit':       '💀 Dano (Vitalidade)',
      'alcance':        '📏 Alcance',
      'peso':           '⚖ Peso',
      'preco':          '💰 Preço',
      'efeito':         '✨ Efeito',
      'atributo':       '📊 Atributo Base',
      'custo':          '🔵 Custo',
      'duracao':        '⏱ Duração',
      'falha':          '💥 Falha Crítica',
      'integridade':    '🛡 Integridade',
      'rd':             '🔰 RD',
      'material':       '🔩 Material',
      'restricao':      '⛔ Restrição',
      'penalidade-mov': '🐢 Penalidade',
      'vitalidade':     '❤ Vitalidade',
      'impeto':         '🔵 Ímpeto',
      'bonus':          '⭐ Bônus',
      'consumo':        '🌾 Consumo Diário',
      'arma-vantagem':  '⚔ Vantagem de Arma',
      'municao':        '🔫 Munição',
      'condicao':       '⚠ Condição',
      'usos':           '🔄 Usos',
      'requisito':      '📋 Requisito',
      'classe-vantagem':'🏅 Classe com Vantagem',
      'casco':          '⚓ Casco',
      'velocidade':     '💨 Velocidade',
      'carga':          '📦 Carga',
      'tripulacao':     '👥 Tripulação',
      'armas-bordo':    '💣 Armas de Bordo',
      'funcao':         '🧭 Função',
      'moral':          '❤ Moral',
      'lealdade':       '🤝 Lealdade',
      'habilidade':     '⭐ Habilidade',
      'segredo':        '🔒 Segredo',
    };

    // Campos simples
    const statsHtml = Object.entries(campos)
      .filter(([k]) => !['descricao','habilidades_inatas','habilidades_ativas'].includes(k))
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([k, v]) => {
        const label = LABELS[k] || k;
        // Dano tem destaque especial (clicável no futuro para o tabletop)
        const isDano = k === 'dano-int' || k === 'dano-vit';
        return `<div class="doc-campo-item${isDano ? ' doc-campo-dano' : ''}">
          <span class="doc-campo-label">${label}</span>
          <span class="doc-campo-val">${escH(String(v))}</span>
        </div>`;
      }).join('');

    if (statsHtml) {
      linhas.push(`<div class="doc-campos-grid">${statsHtml}</div>`);
    }

    // Habilidades de classe
    if (campos.habilidades_inatas?.length) {
      linhas.push(`<div class="doc-habs-section">
        <div class="doc-habs-titulo">Habilidades Inatas</div>
        ${campos.habilidades_inatas.map(h => `
          <div class="doc-hab-item doc-hab-inata">
            <span class="doc-hab-nome">${escH(h.nome)}</span>
            <span class="doc-hab-desc">${escH(h.desc)}</span>
          </div>`).join('')}
      </div>`);
    }

    if (campos.habilidades_ativas?.length) {
      linhas.push(`<div class="doc-habs-section">
        <div class="doc-habs-titulo">Habilidades Ativas</div>
        ${campos.habilidades_ativas.map(h => `
          <div class="doc-hab-item doc-hab-ativa">
            <span class="doc-hab-nome">${escH(h.nome)}</span>
            ${h.custo ? `<span class="doc-hab-custo">${escH(h.custo)}</span>` : ''}
            <span class="doc-hab-desc">${escH(h.desc)}</span>
          </div>`).join('')}
      </div>`);
    }

    return linhas.join('');
  }

  function formatarConteudo(html) {
    if (!html) return '<p style="color:var(--text-muted)">Sem conteúdo.</p>';

    // Divide parágrafos colados pelo \n dentro do mesmo <p>
    // e converte cada linha em um <p> próprio
    let resultado = html
      // Quebras de linha dentro de parágrafos viram </p><p>
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>')
      // Remove parágrafos vazios que ficaram só com <br>
      .replace(/<p[^>]*>\s*<br>\s*<\/p>/g, '<p>&nbsp;</p>');

    return resultado;
  }
  
  // ===== INÍCIO =====
  mostrarCategoriasGrid('Decadência Cinza');
})();