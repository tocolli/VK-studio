// frontend/js/ficha-cavaleiros.js
// Lógica completa da ficha de Cavaleiros de Armadura

(function (w) {
  'use strict';

  const ATRIBUTOS = ['Temperança','Vigor Bruto','Zelo','Humanidade','Inteligência'];
  const MAX_DOTS  = 10;
  const PROF_SLOTS = 7;

  const PATENTES = ['Soldado','Veterano','Sargento','1° Sargento','2° Sargento','Tenente','Comandante'];
  const ALFORGES = [
    { label:'Sem alforge',         slots:0  },
    { label:'Bolsa de Lona +4',    slots:4  },
    { label:'Alforge do Viajante +8', slots:8 },
    { label:'Alforge de Flandres +15', slots:15 },
    { label:'Alforge de Curandeiro +8', slots:8 },
  ];
  const STATUS_LIST = ['Sangramento','Fraturado','Aterrorizado','Exausto','Atordoado'];

  const ESTADO_DEFAULT = () => ({
    nome: '', classe: '', patente: 'Soldado',
    vit: [7,7], imp: [9,9], luc: [10,10],
    arm: [10,10], arm_estagio: 'Impecável',
    arm_equipada: null,
    atrs: { 'Temperança':0,'Vigor Bruto':0,'Zelo':0,'Humanidade':0,'Inteligência':0 },
    proficiencias: Array(PROF_SLOTS).fill(null).map(() => ({ nome:'', desc:'' })),
    habilidades: [],
    inventario: { alforge_idx:0, pecas:0, slots:{} },
    status: [],
    notas: '',
  });

  function render(container, estado, onSave) {
    container.innerHTML = '';
    container.className = 'ficha-cav';

    const el = criarFicha(estado, onSave);
    container.appendChild(el);
  }

  function criarFicha(estado, onSave) {
    const root = document.createElement('div');

    root.appendChild(criarHeader(estado, onSave));
    root.appendChild(criarRecursos(estado, onSave));
    root.appendChild(criarCapacitacoes(estado));
    root.appendChild(criarAtributos(estado, onSave, root));
    root.appendChild(criarArmadura(estado, onSave));
    root.appendChild(criarStatus(estado, onSave));
    root.appendChild(criarProficiencias(estado, onSave));
    root.appendChild(criarHabilidades(estado, onSave));
    root.appendChild(criarInventario(estado, onSave));
    root.appendChild(criarNotas(estado, onSave));

    const saved = document.createElement('div');
    saved.className = 'cav-saved';
    saved.id = 'cavSaved_' + Date.now();
    saved.textContent = 'Salvo ✓';
    root.appendChild(saved);

    return root;
  }

  function criarHeader(e, save) {
    const div = document.createElement('div');
    div.className = 'cav-header';

    const av = document.createElement('div');
    av.className = 'cav-avatar';
    av.style.cursor = 'pointer';
    av.title = 'Clique para alterar a foto';

    function renderAvatar() {
      av.innerHTML = e.avatar_url
        ? `<img src="${e.avatar_url}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
        : '⚔';
    }
    renderAvatar();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    input.addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = f => {
        av.innerHTML = `<img src="${f.target.result}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
      };
      reader.readAsDataURL(file);

      try {
        if (!e.id) {
          e._avatarPendente = file;
          return;
        }
        const fd = new FormData();
        fd.append('nome_personagem', e.nome || 'Cavaleiro');
        fd.append('sistema', 'Cavaleiros de Armadura');
        fd.append('imagem', file); 
        fd.append('atributos', JSON.stringify({
          classe: e.classe, patente: e.patente,
          vitalidade: e.vit, impeto: e.imp, lucidez: e.luc,
          armadura: e.arm, arm_estagio: e.arm_estagio,
          arm_equipada: e.arm_equipada,
          atributos_cav: e.atrs, proficiencias: e.proficiencias,
          habilidades: e.habilidades, inventario: e.inventario,
          status: e.status, notas: e.notas,
        }));

        const res = await window.Api.atualizarFicha(e.id, fd);
        if (res?.ok) {
          const res2 = await window.Api.request(`/fichas/${e.id}`);
          if (res2?.ok) {
            e.avatar_url = res2.data.ficha.imagem_url || e.avatar_url;
            renderAvatar();
            const ind = document.querySelector('.cav-saved');
            if (ind) { ind.classList.add('show'); setTimeout(() => ind.classList.remove('show'), 1800); }
          }
        } else {
          console.error('Erro ao salvar avatar:', res?.data?.message);
        }
      } catch(err) {
        console.error('Erro no upload do avatar:', err);
      }
    });

    av.addEventListener('click', () => input.click());
    div.appendChild(av);
    div.appendChild(input);

    const info = document.createElement('div');
    info.className = 'cav-header-info';

    const nome = document.createElement('input');
    nome.className = 'cav-nome-input';
    nome.type = 'text';
    nome.placeholder = 'NOME DO CAVALEIRO';
    nome.value = e.nome || '';
    nome.addEventListener('input', () => { e.nome = nome.value; autoSave(e, save); });
    info.appendChild(nome);

    const meta = document.createElement('div');
    meta.className = 'cav-meta-row';

    const campos = [
      { label:'Classe', key:'classe', width:'110px' },
    ];
    campos.forEach(c => {
      const wrap = document.createElement('div'); wrap.className = 'cav-meta-field';
      const lbl = document.createElement('span'); lbl.className = 'cav-meta-label'; lbl.textContent = c.label;
      const inp = document.createElement('input'); inp.className = 'cav-meta-input';
      inp.style.width = c.width; inp.value = e[c.key] || '';
      inp.addEventListener('input', () => { e[c.key] = inp.value; autoSave(e, save); });
      wrap.appendChild(lbl); wrap.appendChild(inp);
      meta.appendChild(wrap);
    });

    const pWrap = document.createElement('div'); pWrap.className = 'cav-meta-field';
    const pLbl = document.createElement('span'); pLbl.className = 'cav-meta-label'; pLbl.textContent = 'Patente';
    const pSel = document.createElement('select'); pSel.className = 'cav-patente cav-meta-input';
    PATENTES.forEach(p => {
      const opt = document.createElement('option'); opt.value = p; opt.textContent = p;
      if (e.patente === p) opt.selected = true;
      pSel.appendChild(opt);
    });
    pSel.addEventListener('change', () => { e.patente = pSel.value; autoSave(e, save); });
    pWrap.appendChild(pLbl); pWrap.appendChild(pSel);
    meta.appendChild(pWrap);

    info.appendChild(meta);
    div.appendChild(info);
    return div;
  }

  function criarRecursos(e, save) {
    const panel = criarPanel('❤ Recursos Vitais');
    const grid = document.createElement('div'); grid.className = 'recursos-grid';

    const recursos = [
      { key:'vit', label:'VITALIDADE', cls:'rl-vida',    barCls:'b-vida'    },
      { key:'imp', label:'ÍMPETO',     cls:'rl-impeto',  barCls:'b-impeto'  },
      { key:'luc', label:'LUCIDEZ',    cls:'rl-lucidez', barCls:'b-lucidez' },
    ];

    recursos.forEach(r => {
      const card = document.createElement('div'); card.className = 'recurso-card';

      const lbl = document.createElement('span');
      lbl.className = `recurso-label ${r.cls}`; lbl.textContent = r.label;
      card.appendChild(lbl);

      const inputs = document.createElement('div'); inputs.className = 'recurso-inputs';
      const cur = criarNumInput(e[r.key][0], v => { e[r.key][0] = v; atualizarBarra(card, r.barCls, e[r.key]); autoSave(e, save); });
      cur.className = 'rec-num';
      const sep = document.createElement('span'); sep.className = 'rec-sep'; sep.textContent = '/';
      const max = criarNumInput(e[r.key][1], v => { e[r.key][1] = v; atualizarBarra(card, r.barCls, e[r.key]); autoSave(e, save); });
      max.className = 'rec-num';

      inputs.appendChild(cur); inputs.appendChild(sep); inputs.appendChild(max);
      card.appendChild(inputs);

      const bCont = document.createElement('div'); bCont.className = 'barra';
      const bFill = document.createElement('div');
      bFill.className = `barra-f ${r.barCls}`;
      bFill.style.width = pct(e[r.key][0], e[r.key][1]) + '%';
      bFill.dataset.barKey = r.barCls;
      bCont.appendChild(bFill); card.appendChild(bCont);

      grid.appendChild(card);
    });

    panel.querySelector('.cav-panel').appendChild(grid);
    return panel.querySelector('.cav-panel').parentElement || panel;
  }

  function atualizarBarra(card, barCls, vals) {
    const fill = card.querySelector(`[data-bar-key="${barCls}"]`);
    if (fill) fill.style.width = pct(vals[0], vals[1]) + '%';
  }

  function criarCapacitacoes(e) {
    const panel = criarPanelSimples();
    const row = document.createElement('div'); row.className = 'cap-row';

    const caps = [
      { id:'cap-mov', label:'Movimentação' },
      { id:'cap-carga', label:'Carga Máx' },
      { id:'cap-defesa', label:'Defesa' },
      { id:'cap-impeto-max', label:'Ímpeto/Teste' },
    ];

    caps.forEach(c => {
      const item = document.createElement('div'); item.className = 'cap-item';
      const val = document.createElement('div'); val.className = 'cap-val'; val.id = c.id; val.textContent = '—';
      const lbl = document.createElement('div'); lbl.className = 'cap-lbl'; lbl.textContent = c.label;
      item.appendChild(val); item.appendChild(lbl);
      row.appendChild(item);
    });

    panel.appendChild(row);
    setTimeout(() => atualizarCalcs(e, panel.closest('.ficha-cav') || panel), 50);
    return panel;
  }

  function atualizarCalcs(e, root) {
    const vigor = e.atrs['Vigor Bruto'] || 0;
    const mov   = vigor + 5;
    const carga = vigor + 5 + slotsAlforge(e);
    const def   = 10 + Math.floor(vigor / 2);

    setVal(root, 'cap-mov',       mov);
    setVal(root, 'cap-carga',     carga);
    setVal(root, 'cap-defesa',    def);
    setVal(root, 'cap-impeto-max', vigor);
  }

  function slotsAlforge(e) {
    const idx = e.inventario?.alforge_idx || 0;
    return ALFORGES[idx]?.slots || 0;
  }

  function criarAtributos(e, save, root) {
    const panel = criarPanel('⚔ Atributos');
    const list = document.createElement('div'); list.className = 'attr-list';

    ATRIBUTOS.forEach(nome => {
      const row = document.createElement('div'); row.className = 'attr-row';

      const lbl = document.createElement('span'); lbl.className = 'attr-name'; lbl.textContent = nome;
      row.appendChild(lbl);

      const dots = document.createElement('div'); dots.className = 'attr-dots';
      const num  = document.createElement('span'); num.className = 'attr-num';
      num.textContent = e.atrs[nome] || 0;

      for (let i = 1; i <= MAX_DOTS; i++) {
        const dot = document.createElement('div');
        dot.className = 'attr-dot' + (i <= (e.atrs[nome] || 0) ? ' filled' : '');
        dot.addEventListener('click', () => {
          const cur = e.atrs[nome] || 0;
          e.atrs[nome] = cur === i ? i - 1 : i;
          dots.querySelectorAll('.attr-dot').forEach((d, idx) => {
            d.classList.toggle('filled', idx < e.atrs[nome]);
          });
          num.textContent = e.atrs[nome];
          atualizarCalcs(e, root);
          autoSave(e, save);
        });
        dots.appendChild(dot);
      }

      row.appendChild(dots);
      row.appendChild(num);
      list.appendChild(row);
    });

    panel.querySelector('.cav-panel').appendChild(list);
    return panel.querySelector('.cav-panel').parentElement || panel;
  }

  // ── NOVA ARMADURA (CATÁLOGO DIRETO COM IMAGEM) ───────────────────────
  function criarArmadura(e, save) {
    const cont = criarPanelSimples();
    
    const titleRow = document.createElement('div'); titleRow.className = 'cav-ptitle';
    titleRow.style.display = 'flex'; titleRow.style.justifyContent = 'space-between'; titleRow.style.alignItems = 'center';
    const leftTitle = document.createElement('div');
    leftTitle.style.display = 'flex'; leftTitle.style.alignItems = 'center';
    leftTitle.innerHTML = '<span style="width:12px;height:1px;background:var(--bronze-dim);display:block;margin-right:5px;"></span>🛡 Integridade da Armadura';
    
    const btnCat = document.createElement('button');
    btnCat.className = 'btn-add-small';
    btnCat.innerHTML = '📖 Buscar Armadura';
    btnCat.addEventListener('click', () => abrirModalCatalogoEspecifico(e, 'Armaduras', (itemEscolhido) => {
        let descLimpa = itemEscolhido.conteudo || '';
        let imgUrl = itemEscolhido.imagem_url || '';
        let macroObj = null;

        try {
            const parsed = JSON.parse(itemEscolhido.conteudo);
            if (parsed.narrativa !== undefined) descLimpa = parsed.narrativa;
            else if (parsed.Descrição !== undefined) descLimpa = parsed.Descrição;
            else if (parsed.Descricao !== undefined) descLimpa = parsed.Descricao;
            
            if (parsed.imagem) imgUrl = parsed.imagem;
            if (parsed.macro) macroObj = parsed.macro;
        } catch(err){}
        
        descLimpa = limparFormatacao(descLimpa);

        e.arm_equipada = {
            nome: itemEscolhido.titulo,
            desc: descLimpa,
            imagem: imgUrl,
            macro: macroObj
        };
        renderBoxArmadura();
        autoSave(e, save);
    }));

    titleRow.appendChild(leftTitle);
    titleRow.appendChild(btnCat);
    cont.appendChild(titleRow);

    const boxArmadura = document.createElement('div');
    boxArmadura.style.background = '#1a1d26';
    boxArmadura.style.border = '1px solid #2a2e3d';
    boxArmadura.style.borderRadius = '4px';
    boxArmadura.style.padding = '10px';
    boxArmadura.style.marginBottom = '10px';
    cont.appendChild(boxArmadura);

    function renderBoxArmadura() {
        if (!e.arm_equipada) {
            boxArmadura.innerHTML = '<div style="color:#888; font-size:0.8rem; text-align:center; padding:10px;">Nenhuma armadura vestida.</div>';
            return;
        }
        
        let imgHtml = e.arm_equipada.imagem 
            ? `<img src="${escH(e.arm_equipada.imagem)}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #3a3f55; flex-shrink:0;">` 
            : `<div style="width:40px; height:40px; background:#1a1d26; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#555; flex-shrink:0; border:1px solid #3a3f55;"><i class="fa-solid fa-shield"></i></div>`;

        boxArmadura.innerHTML = `
            <div style="display:flex; align-items:flex-start; gap:10px;">
                ${imgHtml}
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <strong style="color:#c9a84c; font-size:0.9rem;">${escH(e.arm_equipada.nome)}</strong>
                        <button id="btnRemoverArmadura" title="Remover Armadura" style="background:#22263a; border:1px solid #3a3f55; color:#e74c3c; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:0.75rem; display:flex; align-items:center; gap:4px; transition:0.2s;">
                            <i class="fa-solid fa-trash"></i> Desequipar
                        </button>
                    </div>
                    <div style="font-size:0.75rem; color:#ccc; margin-top:5px; line-height:1.4;">${escH(e.arm_equipada.desc).replace(/\n/g, '<br>')}</div>
                </div>
            </div>
        `;

        boxArmadura.querySelector('#btnRemoverArmadura').addEventListener('click', () => {
            if(confirm('Desequipar armadura?')) {
                e.arm_equipada = null;
                renderBoxArmadura();
                autoSave(e, save);
            }
        });
    }
    renderBoxArmadura();

    const row = document.createElement('div'); row.className = 'arm-row';
    const inputs = document.createElement('div'); inputs.className = 'arm-inputs';
    const cur = criarNumInput(e.arm[0], v => { e.arm[0] = v; atualizarBarraArm(cont); atualizarEstagio(e, cont); autoSave(e, save); });
    cur.className = 'rec-num';
    const sep = document.createElement('span'); sep.className = 'rec-sep'; sep.textContent = '/';
    const max = criarNumInput(e.arm[1], v => { e.arm[1] = v; atualizarBarraArm(cont); autoSave(e, save); });
    max.className = 'rec-num';
    inputs.appendChild(cur); inputs.appendChild(sep); inputs.appendChild(max);
    row.appendChild(inputs);

    const sel = document.createElement('select'); sel.className = 'arm-stage';
    ['Impecável','Riscada','Amassada','Rompida'].forEach(s => {
      const opt = document.createElement('option'); opt.value = s; opt.textContent = s;
      if (e.arm_estagio === s) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => { e.arm_estagio = sel.value; atualizarEstagio(e, cont); autoSave(e, save); });
    row.appendChild(sel);

    const aviso = document.createElement('span');
    aviso.className = 'arm-aviso rompida';
    aviso.textContent = '−25% Defesa · +1 Dano Vital';
    aviso.id = 'arm-aviso';
    aviso.style.display = e.arm_estagio === 'Rompida' ? 'inline-block' : 'none';
    row.appendChild(aviso);

    const bCont = document.createElement('div'); bCont.className = 'barra'; bCont.style.marginTop = '.4rem';
    const bFill = document.createElement('div');
    bFill.className = 'barra-f b-arm';
    bFill.id = 'barra-arm';
    bFill.style.width = pct(e.arm[0], e.arm[1]) + '%';
    bCont.appendChild(bFill);

    cont.appendChild(row);
    cont.appendChild(bCont);
    return cont;
  }

  function atualizarBarraArm(root) {
    const fill = root.querySelector('#barra-arm');
    if (fill) {
      const cur = parseFloat(root.querySelectorAll('.arm-inputs .rec-num')[0]?.value) || 0;
      const max = parseFloat(root.querySelectorAll('.arm-inputs .rec-num')[1]?.value) || 1;
      fill.style.width = pct(cur, max) + '%';
    }
  }

  function atualizarEstagio(e, root) {
    const aviso = root.querySelector('#arm-aviso');
    if (aviso) aviso.style.display = e.arm_estagio === 'Rompida' ? 'inline-block' : 'none';
  }

  function criarStatus(e, save) {
    const cont = criarPanelSimples();
    const lbl = document.createElement('div'); lbl.className = 'cav-ptitle'; lbl.innerHTML = '<span style="width:12px;height:1px;background:var(--bronze-dim);display:block;"></span>Condições de Status';
    cont.appendChild(lbl);
    const list = document.createElement('div'); list.className = 'status-list';
    STATUS_LIST.forEach(s => {
      const chip = document.createElement('button'); chip.className = 'status-chip' + (e.status.includes(s) ? ' ativo' : '');
      chip.textContent = s;
      chip.addEventListener('click', () => {
        const idx = e.status.indexOf(s);
        if (idx >= 0) e.status.splice(idx, 1); else e.status.push(s);
        chip.classList.toggle('ativo', e.status.includes(s));
        autoSave(e, save);
      });
      list.appendChild(chip);
    });
    cont.appendChild(list);
    return cont;
  }

  function criarProficiencias(e, save) {
    const ocupados = e.proficiencias.filter(p => p.nome).length;
    const panel = criarPanel(`📖 Proficiências · <span style="color:#888;font-size:.58rem;">${ocupados}/${PROF_SLOTS} usados</span>`);
    const grid = document.createElement('div'); grid.className = 'prof-grid';
    grid.id = 'prof-grid';

    e.proficiencias.forEach((prof, i) => {
      const slot = document.createElement('div');
      slot.className = 'prof-slot' + (prof.nome ? ' ocupado' : '');
      slot.innerHTML = `<span class="prof-slot-num">Slot ${i+1}</span><span class="prof-slot-nome">${esc(prof.nome) || '—'}</span>`;
      slot.addEventListener('click', () => abrirModalProf(e, i, save, grid));
      grid.appendChild(slot);
    });

    panel.querySelector('.cav-panel').appendChild(grid);
    return panel.querySelector('.cav-panel').parentElement || panel;
  }

  function abrirModalProf(e, idx, save, grid) {
    const prof = e.proficiencias[idx];
    abrirModal('Proficiência — Slot ' + (idx+1), [
      { label:'Nome (ex: Carpintaria, Equitação...)', key:'nome', tipo:'input', val: prof.nome },
      { label:'Descrição / Habilidades concedidas',  key:'desc', tipo:'textarea', val: prof.desc },
    ], (dados) => {
      e.proficiencias[idx] = { nome: dados.nome, desc: dados.desc };
      grid.querySelectorAll('.prof-slot').forEach((slot, i) => {
        const p = e.proficiencias[i];
        slot.className = 'prof-slot' + (p.nome ? ' ocupado' : '');
        slot.innerHTML = `<span class="prof-slot-num">Slot ${i+1}</span><span class="prof-slot-nome">${esc(p.nome) || '—'}</span>`;
      });
      autoSave(e, save);
    }, () => {
      e.proficiencias[idx] = { nome:'', desc:'' };
      grid.querySelectorAll('.prof-slot')[idx].className = 'prof-slot';
      grid.querySelectorAll('.prof-slot')[idx].innerHTML = `<span class="prof-slot-num">Slot ${idx+1}</span><span class="prof-slot-nome">—</span>`;
      autoSave(e, save);
    });
  }

  function criarHabilidades(e, save) {
    const p = criarPanelSimples();
    
    const titleRow = document.createElement('div'); titleRow.className = 'cav-ptitle';
    titleRow.style.display = 'flex'; titleRow.style.justifyContent = 'space-between'; titleRow.style.alignItems = 'center';
    
    const leftTitle = document.createElement('div');
    leftTitle.style.display = 'flex'; leftTitle.style.alignItems = 'center';
    leftTitle.innerHTML = '<span style="width:12px;height:1px;background:var(--bronze-dim);display:block;margin-right:5px;"></span>⚡ Habilidades & Armas';
    
    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex'; btnGroup.style.gap = '5px';

    const btnCat = document.createElement('button');
    btnCat.className = 'btn-add-small';
    btnCat.innerHTML = '📖 Catálogo';
    btnCat.addEventListener('click', () => abrirModalCatalogoEspecifico(e, 'todos', (itemEscolhido) => {
        let descLimpa = itemEscolhido.conteudo || '';
        let macroObj = null;
        try {
            const parsed = JSON.parse(itemEscolhido.conteudo);
            if (parsed.narrativa !== undefined) descLimpa = parsed.narrativa;
            else if (parsed.Descrição !== undefined) descLimpa = parsed.Descrição;
            else if (parsed.Descricao !== undefined) descLimpa = parsed.Descricao;
            
            if (parsed.macro) macroObj = parsed.macro;
        } catch(err){}
        
        descLimpa = limparFormatacao(descLimpa);

        e.habilidades.push({ 
            nome: itemEscolhido.titulo, 
            desc: descLimpa, 
            atributo: '', 
            custo: macroObj?.custo_valor || 0, 
            dano: macroObj?.dano || '' 
        });
        renderHabs();
        autoSave(e, save);
    }));

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-small'; 
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Manual';

    btnGroup.appendChild(btnCat);
    btnGroup.appendChild(addBtn);
    titleRow.appendChild(leftTitle);
    titleRow.appendChild(btnGroup);
    p.appendChild(titleRow);

    const list = document.createElement('div'); list.className = 'hab-list'; list.id = 'hab-list';

    function renderHabs() {
      list.innerHTML = '';
      if (!e.habilidades.length) {
        const empty = document.createElement('div'); empty.className = 'hab-empty';
        empty.textContent = 'Nenhuma habilidade/arma adicionada.';
        list.appendChild(empty); return;
      }
      e.habilidades.forEach((h, i) => {
        const item = document.createElement('div'); item.className = 'hab-item';

        const body = document.createElement('div'); body.className = 'hab-body';
        const nome = document.createElement('div'); nome.className = 'hab-nome'; 
        nome.style.color = '#c9a84c'; // Garante que a fonte seja dourada
        nome.textContent = h.nome || 'Sem nome';
        const desc = document.createElement('div'); desc.className = 'hab-desc'; 
        desc.innerHTML = escH(h.desc || '').replace(/\n/g, '<br>');
        
        body.appendChild(nome); body.appendChild(desc);

        const tags = document.createElement('div'); tags.className = 'hab-tags';
        if (h.atributo) {
          const t = document.createElement('span'); t.className = 'hab-tag ht-attr'; t.textContent = h.atributo;
          tags.appendChild(t);
        }
        if (h.custo > 0) {
          const t = document.createElement('span'); t.className = 'hab-tag ht-custo'; t.textContent = `${h.custo} Ímpeto`;
          tags.appendChild(t);
        }
        if (h.dano) {
          const t = document.createElement('span'); t.className = 'hab-tag ht-dano'; t.textContent = h.dano;
          tags.appendChild(t);
        }
        body.appendChild(tags);

        const del = document.createElement('button'); del.className = 'hab-del'; del.innerHTML = '<i class="fa-solid fa-trash"></i>';
        del.addEventListener('click', e2 => {
          e2.stopPropagation();
          if (confirm('Remover esta habilidade?')) {
            e.habilidades.splice(i, 1);
            renderHabs();
            autoSave(e, save);
          }
        });

        item.appendChild(body); item.appendChild(del);
        item.addEventListener('click', () => abrirModalHab(e, i, save, renderHabs));
        list.appendChild(item);
      });
    }

    addBtn.addEventListener('click', () => {
      e.habilidades.push({ nome:'', desc:'', atributo:'', custo:0, dano:'' });
      abrirModalHab(e, e.habilidades.length - 1, save, renderHabs);
    });

    renderHabs();
    p.appendChild(list);
    return p;
  }

  function abrirModalHab(e, idx, save, renderFn) {
    const h = e.habilidades[idx];
    const overlay = document.createElement('div'); overlay.className = 'cav-modal-overlay open';
    const modal   = document.createElement('div'); modal.className = 'cav-modal';

    modal.innerHTML = `
      <button class="cav-modal-close" type="button">✕</button>
      <div class="cav-modal-title">Habilidade / Arma</div>
      <div class="cav-field"><label class="cav-lbl">Nome</label>
        <input class="cav-inp" id="mh-nome" type="text" value="${escH(h.nome)}" placeholder="Ex: Estocar, Espada Longa..."/></div>
      <div class="cav-field"><label class="cav-lbl">Descrição</label>
        <textarea class="cav-ta" id="mh-desc" rows="4">${escH(h.desc)}</textarea></div>
      <div class="cav-g3">
        <div class="cav-field"><label class="cav-lbl">Atributo</label>
          <select class="cav-sel" id="mh-attr">
            <option value="">—</option>
            ${ATRIBUTOS.map(a => `<option value="${a}" ${h.atributo===a?'selected':''}>${a}</option>`).join('')}
          </select></div>
        <div class="cav-field"><label class="cav-lbl">Custo Ímpeto</label>
          <input class="cav-inp" id="mh-custo" type="number" min="0" max="10" value="${h.custo||0}"/></div>
        <div class="cav-field"><label class="cav-lbl">Dado de Dano</label>
          <input class="cav-inp" id="mh-dano" type="text" value="${escH(h.dano)}" placeholder="Ex: 1d6"/></div>
      </div>
      <div class="cav-modal-actions">
        <button class="cbtn cbtn-d" id="mh-del" type="button">Remover</button>
        <button class="cbtn cbtn-g" id="mh-cancel" type="button">Cancelar</button>
        <button class="cbtn cbtn-p" id="mh-save" type="button">Salvar</button>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const fechar = () => document.body.removeChild(overlay);
    overlay.querySelector('.cav-modal-close').addEventListener('click', fechar);
    overlay.querySelector('#mh-cancel').addEventListener('click', fechar);
    overlay.addEventListener('click', ev => { if (ev.target === overlay) fechar(); });

    overlay.querySelector('#mh-del').addEventListener('click', () => {
      if (confirm('Remover?')) {
        e.habilidades.splice(idx, 1);
        renderFn(); autoSave(e, save); fechar();
      }
    });

    overlay.querySelector('#mh-save').addEventListener('click', () => {
      e.habilidades[idx] = {
        nome:     overlay.querySelector('#mh-nome').value.trim(),
        desc:     overlay.querySelector('#mh-desc').value.trim(),
        atributo: overlay.querySelector('#mh-attr').value,
        custo:    parseInt(overlay.querySelector('#mh-custo').value) || 0,
        dano:     overlay.querySelector('#mh-dano').value.trim(),
      };
      renderFn(); autoSave(e, save); fechar();
    });
  }

  // ── INVENTÁRIO COM CATÁLOGO DIRETO E IMAGENS ────────────────────────
  function criarInventario(e, save) {
    const p = criarPanelSimples();

    const title = document.createElement('div'); title.className = 'cav-ptitle';
    title.style.display = 'flex'; title.style.alignItems = 'center'; title.style.justifyContent = 'space-between';
    
    const titleLeft = document.createElement('div');
    titleLeft.style.display = 'flex'; titleLeft.style.alignItems = 'center';
    titleLeft.innerHTML = '<span style="width:12px;height:1px;background:var(--bronze-dim);display:block;margin-right:5px;"></span>🎒 Inventário';
    
    const btnCat = document.createElement('button');
    btnCat.className = 'btn-add-small';
    btnCat.innerHTML = '📖 Catálogo do Sistema';
    btnCat.addEventListener('click', () => abrirModalCatalogoEspecifico(e, 'todos', (itemSelecionado) => {
        let slotLivre = 0;
        while(e.inventario.slots[slotLivre]) slotLivre++;

        const vigor = e.atrs['Vigor Bruto'] || 0;
        const totalSlots = vigor + 5 + (ALFORGES[e.inventario.alforge_idx || 0]?.slots || 0);
        
        let usados = 0;
        Object.values(e.inventario.slots).forEach(it => { if (it) usados += (it.peso || 1); });

        if (usados >= totalSlots) {
            alert('Inventário cheio! Você não tem slots suficientes.');
            return;
        }

        let descLimpa = itemSelecionado.conteudo || '';
        let imgUrl = itemSelecionado.imagem_url || '';
        let macroObj = null;

        try {
            const parsed = JSON.parse(itemSelecionado.conteudo);
            if (parsed.narrativa !== undefined) descLimpa = parsed.narrativa;
            else if (parsed.Descrição !== undefined) descLimpa = parsed.Descrição;
            else if (parsed.Descricao !== undefined) descLimpa = parsed.Descricao;
            
            if (parsed.imagem) imgUrl = parsed.imagem;
            if (parsed.macro) macroObj = parsed.macro;
        } catch (err) {}

        descLimpa = limparFormatacao(descLimpa);

        e.inventario.slots[slotLivre] = {
            nome: itemSelecionado.titulo,
            desc: descLimpa,
            imagem: imgUrl,
            peso: 1,
            estagio: 'Afiada',
            macro: macroObj 
        };
        renderGrid();
        autoSave(e, save);
    }));
    
    title.appendChild(titleLeft);
    title.appendChild(btnCat);
    p.appendChild(title);

    const controls = document.createElement('div'); controls.className = 'inv-controls';
    controls.style.display = 'flex'; controls.style.gap = '15px'; controls.style.alignItems = 'center'; controls.style.flexWrap = 'wrap';

    const sel = document.createElement('select'); sel.className = 'inv-select';
    ALFORGES.forEach((a, i) => {
      const opt = document.createElement('option'); opt.value = i; opt.textContent = a.label;
      if ((e.inventario.alforge_idx || 0) === i) opt.selected = true;
      sel.appendChild(opt);
    });

    const divMoedas = document.createElement('div');
    divMoedas.style.display = 'flex'; divMoedas.style.alignItems = 'center'; divMoedas.style.gap = '5px';
    divMoedas.innerHTML = `<span style="font-size:0.8rem; color:#c9a84c; font-family: 'Cinzel', serif; font-weight: bold;">💰 Peças:</span>`;
    const inpMoedas = document.createElement('input');
    inpMoedas.type = 'number'; inpMoedas.min = 0; inpMoedas.className = 'cav-inp';
    inpMoedas.style.width = '70px'; inpMoedas.style.padding = '4px 8px'; inpMoedas.style.height = 'auto';
    inpMoedas.id = 'inv-moedas-inp';
    inpMoedas.value = e.inventario.pecas || 0;
    inpMoedas.addEventListener('input', () => { e.inventario.pecas = parseInt(inpMoedas.value) || 0; autoSave(e, save); });
    divMoedas.appendChild(inpMoedas);

    const carga = document.createElement('span'); carga.className = 'inv-carga'; carga.id = 'inv-carga';
    const grid = document.createElement('div'); grid.id = 'inv-grid';

    function renderGrid() {
      grid.innerHTML = '';
      const vigor = e.atrs['Vigor Bruto'] || 0;
      const baseSlots = vigor + 5;
      const extraSlots = ALFORGES[e.inventario.alforge_idx || 0]?.slots || 0;
      const totalSlots = baseSlots + extraSlots;
      
      let usados = 0;
      Object.values(e.inventario.slots).forEach(item => { if (item) usados += (item.peso || 1); });

      carga.textContent = `Carga: ${usados} / ${baseSlots} (${usados}/${totalSlots} c/ alforge)`;
      carga.className = 'inv-carga' + (usados > totalSlots ? ' sobre' : '');

      grid.style.display = 'flex';
      grid.style.flexDirection = 'column';
      grid.style.gap = '8px';
      grid.style.marginTop = '10px';

      const slotsKeys = Object.keys(e.inventario.slots);
      
      if (slotsKeys.length === 0) {
          grid.innerHTML = '<div style="color:#888; font-size:0.8rem; text-align:center; padding:10px; border:1px dashed #333; border-radius:4px;">Inventário Vazio</div>';
      } else {
          slotsKeys.forEach(k => {
              const item = e.inventario.slots[k];
              if (!item) return;

              const card = document.createElement('div');
              card.style.background = '#1a1d26';
              card.style.border = '1px solid #2a2e3d';
              card.style.borderRadius = '4px';
              card.style.padding = '10px';
              card.style.position = 'relative';

              let macroHtml = '';
              if (item.macro && (item.macro.rolagem || item.macro.dano)) {
                  macroHtml = `
                    <div style="display:flex; gap:8px; margin-top:8px; padding-top:8px; border-top:1px solid #333;">
                        ${item.macro.rolagem ? `<button class="cbtn" style="background:#27ae60; color:#fff; flex:1; font-size:0.75rem; padding:6px;" id="btnRolar_${k}"><i class="fa-solid fa-dice"></i> ${item.macro.rolagem}</button>` : ''}
                        ${item.macro.dano ? `<button class="cbtn" style="background:#c0392b; color:#fff; flex:1; font-size:0.75rem; padding:6px;" id="btnDano_${k}"><i class="fa-solid fa-burst"></i> ${item.macro.dano}</button>` : ''}
                    </div>
                  `;
              }

              let imgHtml = item.imagem ? `<img src="${escH(item.imagem)}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #333; flex-shrink:0;">` : '';

              card.innerHTML = `
                <div style="display:flex; align-items:flex-start; gap:10px;">
                    ${imgHtml}
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <div style="font-weight:bold; color:#c9a84c; font-size:0.85rem;">${escH(item.nome)}</div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:0.7rem; color:#888; background:rgba(0,0,0,0.3); padding:2px 4px; border-radius:2px;">${item.peso || 1} slots</span>
                                <button title="Remover" id="btnRem_${k}" style="background:transparent; border:none; color:#e74c3c; cursor:pointer; font-size:0.85rem; opacity:0.8; transition:0.2s;"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                        <div style="font-size:0.75rem; color:#ccc; line-height:1.4;">${escH(item.desc).replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
                ${macroHtml}
              `;

              if (item.macro?.rolagem) {
                  card.querySelector(`#btnRolar_${k}`).addEventListener('click', (ev) => { ev.stopPropagation(); executarMacro(e, item, ev.currentTarget, 'rolagem', () => autoSave(e, save)); });
              }
              if (item.macro?.dano) {
                  card.querySelector(`#btnDano_${k}`).addEventListener('click', (ev) => { ev.stopPropagation(); executarMacro(e, item, ev.currentTarget, 'dano', () => autoSave(e, save)); });
              }

              card.querySelector(`#btnRem_${k}`).addEventListener('click', (ev) => { 
                  ev.stopPropagation(); 
                  if(confirm(`Remover ${item.nome}?`)) {
                      delete e.inventario.slots[k];
                      renderGrid(); autoSave(e, save);
                  }
              });
              
              card.addEventListener('click', () => abrirModalInv(e, k, save, renderGrid));
              grid.appendChild(card);
          });
      }
      
      const btnAdd = document.createElement('button');
      btnAdd.className = 'btn-add-small';
      btnAdd.style.width = '100%';
      btnAdd.style.marginTop = '10px';
      btnAdd.innerHTML = '<i class="fa-solid fa-plus"></i> Item Manual';
      btnAdd.onclick = () => {
          let newK = 0;
          while(e.inventario.slots[newK]) newK++;
          e.inventario.slots[newK] = { nome: 'Novo Item', desc: '', peso: 1 };
          abrirModalInv(e, newK, save, renderGrid);
      };
      grid.appendChild(btnAdd);
    }

    sel.addEventListener('change', () => { e.inventario.alforge_idx = parseInt(sel.value); renderGrid(); autoSave(e, save); });
    controls.appendChild(sel); controls.appendChild(divMoedas); controls.appendChild(carga);
    p.appendChild(controls); p.appendChild(grid);
    renderGrid();
    return p;
  }

  // --- Função Universal para buscar itens do sistema ---
  async function abrirModalCatalogoEspecifico(e, filtroCategoria, onSelect) {
    const overlay = document.createElement('div'); overlay.className = 'cav-modal-overlay open';
    const modal   = document.createElement('div'); modal.className = 'cav-modal';
    modal.style.maxWidth = '500px';

    modal.innerHTML = `
      <button class="cav-modal-close" type="button">✕</button>
      <div class="cav-modal-title">📖 Catálogo do Sistema</div>
      <div style="margin-bottom:10px;">
         <input type="text" id="catBusca" placeholder="Pesquisar..." class="cav-inp" style="width:100%;">
      </div>
      <div id="catLoading" style="text-align:center; padding:1rem; color:#888;">Buscando documentos...</div>
      <div id="catConteudo" style="display:none; max-height: 50vh; overflow-y: auto; padding-right: 5px;"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const fechar = () => document.body.removeChild(overlay);
    overlay.querySelector('.cav-modal-close').addEventListener('click', fechar);
    overlay.addEventListener('click', ev => { if (ev.target === overlay) fechar(); });

    try {
        const res = await window.Api.request('/documentos');
        if (!res?.ok) throw new Error();
        
        let docs = res.data.documentos.filter(d => d.sistema === 'Cavaleiros de Armadura');
        
        if (filtroCategoria !== 'todos') {
            docs = docs.filter(d => d.categoria === filtroCategoria);
        } else {
            docs = docs.filter(d => ['Itens','Armaduras','Armas Brancas','Armas de Fogo','Consumíveis'].includes(d.categoria));
        }

        const cont = modal.querySelector('#catConteudo');
        const load = modal.querySelector('#catLoading');
        load.style.display = 'none';
        cont.style.display = 'block';

        function renderizarLista(termo) {
            let lista = docs;
            if (termo) lista = lista.filter(d => d.titulo.toLowerCase().includes(termo.toLowerCase()));

            if (!lista.length) {
                cont.innerHTML = '<div style="color:#888; text-align:center; padding:10px;">Nenhum item encontrado.</div>';
                return;
            }

            cont.innerHTML = lista.map(item => {
                let descLimpa = item.conteudo || '';
                let imgUrl = item.imagem_url || '';

                try {
                    const parsed = JSON.parse(item.conteudo);
                    if (parsed.narrativa !== undefined) descLimpa = parsed.narrativa;
                    else if (parsed.Descrição !== undefined) descLimpa = parsed.Descrição;
                    else if (parsed.Descricao !== undefined) descLimpa = parsed.Descricao;
                    
                    if (parsed.imagem) imgUrl = parsed.imagem;
                } catch(err) {}

                descLimpa = limparFormatacao(descLimpa);

                let imgHtml = imgUrl 
                    ? `<img src="${escH(imgUrl)}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #333; flex-shrink:0;">` 
                    : `<div style="width:40px; height:40px; background:#1a1d26; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#555; flex-shrink:0; border:1px solid #333;"><i class="fa-solid fa-box"></i></div>`;

                return `
                <div style="background:#0a0a0a; border:1px solid #333; padding:10px; border-radius:4px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                    ${imgHtml}
                    <div style="flex:1;">
                        <strong style="color:#c9a84c;">${escH(item.titulo)}</strong> <span style="font-size:0.6rem; color:#888; background:#222; padding:2px 4px; border-radius:3px;">${escH(item.categoria)}</span>
                        <div style="font-size:0.75rem; color:#ccc; margin-top:3px; max-height:40px; overflow:hidden;">${escH(descLimpa).replace(/\n/g, '<br>')}</div>
                    </div>
                    <button class="cbtn cbtn-p btn-add-cat" data-id="${item.id}" style="padding:4px 8px; font-size:0.75rem; white-space:nowrap;">+ Equipar / Add</button>
                </div>
                `;
            }).join('');

            cont.querySelectorAll('.btn-add-cat').forEach(btn => {
                btn.addEventListener('click', () => {
                    const itemDoc = docs.find(d => String(d.id) === btn.dataset.id);
                    onSelect(itemDoc);
                    fechar();
                });
            });
        }

        renderizarLista('');
        modal.querySelector('#catBusca').addEventListener('input', (e) => renderizarLista(e.target.value));

    } catch (e) {
        modal.querySelector('#catLoading').textContent = 'Erro ao carregar o catálogo.';
    }
  }


  function traduzirRolagem(fichaObj, formStr) {
      if (!formStr) return "";
      let txt = formStr;
      
      const atrMap = {
         '@Temperança': fichaObj.atrs['Temperança'] || 0,
         '@Vigor Bruto': fichaObj.atrs['Vigor Bruto'] || 0,
         '@Zelo': fichaObj.atrs['Zelo'] || 0,
         '@Humanidade': fichaObj.atrs['Humanidade'] || 0,
         '@Inteligência': fichaObj.atrs['Inteligência'] || 0
      };

      for (let tag in atrMap) {
          let val = atrMap[tag];
          txt = txt.replace(new RegExp(tag, 'gi'), val);
      }
      return txt;
  }

  function executarMacro(e, item, btnElement, tipo, saveFn) {
     if (!item.macro) return;
     
     if (tipo === 'rolagem' && item.macro.custo_tipo && item.macro.custo_valor) {
         const ct = item.macro.custo_tipo;
         const cv = parseInt(item.macro.custo_valor);
         
         if (ct === 'impeto') {
             if (e.imp[0] < cv) { alert('Ímpeto insuficiente!'); return; }
             e.imp[0] -= cv;
         } else if (ct === 'vitalidade') {
             if (e.vit[0] < cv) { alert('Vitalidade insuficiente!'); return; }
             e.vit[0] -= cv;
         } else if (ct === 'lucidez') {
             if (e.luc[0] < cv) { alert('Lucidez insuficiente!'); return; }
             e.luc[0] -= cv;
         }
         saveFn();
     }

     let formulaRaw = tipo === 'rolagem' ? item.macro.rolagem : item.macro.dano;
     if (!formulaRaw) return;
     
     let formulaFinal = traduzirRolagem(e, formulaRaw);

     if (w.Socket && w.E && w.E.sessaoId) {
         let prefix = tipo === 'rolagem' ? 'Ataque/Uso' : 'Dano';
         let msg = `<div style="font-weight:bold; color:#c9a84c;">${escH(item.nome)} (${prefix})</div>`;
         msg += `<div style="font-size:0.85rem; color:#ccc;">Rolando: [${formulaFinal}]</div>`;
         if (item.macro.alvo && tipo === 'rolagem') {
             msg += `<div style="font-size:0.75rem; color:#888;">Alvo: ${escH(item.macro.alvo)}</div>`;
         }
         
         w.Socket.emit('chat:mensagem', {
             sessao_id: w.E.sessaoId,
             usuario_id: w.E.userId,
             texto: `ROLL:${formulaFinal}#${item.nome} (${prefix})`, 
             nome_autor: e.nome || 'Jogador'
         });
         
         const oldHtml = btnElement.innerHTML;
         btnElement.innerHTML = `<i class="fa-solid fa-check"></i> Enviado!`;
         setTimeout(() => { btnElement.innerHTML = oldHtml; }, 2000);
     } else {
         alert(`A Rolagem de ${tipo} é: ${formulaFinal}\n(Entre numa mesa para rolar os dados em 3D)`);
     }
  }

  function abrirModalInv(e, idx, save, renderFn) {
    const item = e.inventario.slots[idx] || {};
    
    // Tratativa JSON para exibição isolada da narrativa
    let descExibicao = item.desc || '';
    try {
        const parsed = JSON.parse(item.desc);
        if (parsed.narrativa !== undefined) descExibicao = parsed.narrativa;
    } catch(err) {}

    const overlay = document.createElement('div'); overlay.className = 'cav-modal-overlay open';
    const modal   = document.createElement('div'); modal.className = 'cav-modal';

    modal.innerHTML = `
      <button class="cav-modal-close" type="button">✕</button>
      <div class="cav-modal-title">Slot ${idx + 1} — ${idx >= (e.atrs['Vigor Bruto']||0)+5 ? 'Alforge' : 'Inventário'}</div>
      <div class="cav-field"><label class="cav-lbl">Nome do Item</label>
        <input class="cav-inp" id="mi-nome" type="text" value="${escH(item.nome||'')}" placeholder="Ex: Espada Longa, Ração..."/></div>
      <div class="cav-field"><label class="cav-lbl">Descrição / Efeito</label>
        <textarea class="cav-ta" id="mi-desc" rows="4">${escH(descExibicao)}</textarea></div>
      <div class="cav-g2">
        <div class="cav-field"><label class="cav-lbl">Peso (slots)</label>
          <input class="cav-inp" id="mi-peso" type="number" min="1" max="10" value="${item.peso||1}"/></div>
        <div class="cav-field"><label class="cav-lbl">Estágio (armas)</label>
          <select class="cav-sel" id="mi-estagio">
            <option value="">—</option>
            <option ${item.estagio==='Afiada'?'selected':''}>Afiada</option>
            <option ${item.estagio==='Cega/Desgastada'?'selected':''}>Cega/Desgastada</option>
            <option ${item.estagio==='Danificada'?'selected':''}>Danificada</option>
            <option ${item.estagio==='Inutilizável'?'selected':''}>Inutilizável</option>
          </select></div>
      </div>
      ${item.macro ? `
      <div style="margin-top:15px; padding:10px; background:#111214; border:1px solid #333; border-radius:4px;">
         <div style="color:#c9a84c; font-size:0.8rem; margin-bottom:8px; font-weight:bold;"><i class="fa-solid fa-microchip"></i> Ações Automatizadas</div>
         <div style="display:flex; gap:8px;">
            ${item.macro.rolagem ? `<button class="cbtn" style="background:#27ae60; color:#fff; flex:1;" id="mi-btn-rolar" type="button"><i class="fa-solid fa-dice"></i> Rolar Ataque/Uso</button>` : ''}
            ${item.macro.dano ? `<button class="cbtn" style="background:#c0392b; color:#fff; flex:1;" id="mi-btn-dano" type="button"><i class="fa-solid fa-burst"></i> Rolar Dano</button>` : ''}
         </div>
         ${item.macro.custo_valor ? `<div style="font-size:0.7rem; color:#888; margin-top:8px; text-align:center;">Custo de Ativação: -${item.macro.custo_valor} ${item.macro.custo_tipo}</div>` : ''}
      </div>` : ''}
      <div class="cav-modal-actions">
        <button class="cbtn cbtn-d" id="mi-del" type="button">Esvaziar Slot</button>
        <button class="cbtn cbtn-g" id="mi-cancel" type="button">Cancelar</button>
        <button class="cbtn cbtn-p" id="mi-save" type="button">Salvar</button>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const fechar = () => document.body.removeChild(overlay);
    overlay.querySelector('.cav-modal-close').addEventListener('click', fechar);
    overlay.querySelector('#mi-cancel').addEventListener('click', fechar);
    overlay.addEventListener('click', ev => { if (ev.target === overlay) fechar(); });

    const btnRolar = overlay.querySelector('#mi-btn-rolar');
    if (btnRolar) btnRolar.addEventListener('click', () => executarMacro(e, item, btnRolar, 'rolagem', () => autoSave(e, save)));
    
    const btnDano = overlay.querySelector('#mi-btn-dano');
    if (btnDano) btnDano.addEventListener('click', () => executarMacro(e, item, btnDano, 'dano', () => autoSave(e, save)));

    overlay.querySelector('#mi-del').addEventListener('click', () => {
      delete e.inventario.slots[idx];
      renderFn(); autoSave(e, save); fechar();
    });
    
    overlay.querySelector('#mi-save').addEventListener('click', () => {
      const nome = overlay.querySelector('#mi-nome').value.trim();
      let novaNarrativa = overlay.querySelector('#mi-desc').value.trim();
      
      let descFinal = novaNarrativa;
      try {
         const parsed = JSON.parse(item.desc);
         if (parsed.narrativa !== undefined) {
             parsed.narrativa = novaNarrativa;
             descFinal = JSON.stringify(parsed);
         }
      } catch(err) {}

      if (nome) {
        e.inventario.slots[idx] = {
          nome, desc: descFinal,
          imagem: item.imagem || '',
          peso: parseInt(overlay.querySelector('#mi-peso').value) || 1,
          estagio: overlay.querySelector('#mi-estagio').value,
          macro: item.macro 
        };
      } else delete e.inventario.slots[idx];
      renderFn(); autoSave(e, save); fechar();
    });
  }

  // ── NOTAS ─────────────────────────────────────────────────────────────
  function criarNotas(e, save) {
    const p = criarPanelSimples();
    const title = document.createElement('div'); title.className = 'cav-ptitle';
    title.innerHTML = '<span style="width:12px;height:1px;background:var(--bronze-dim);display:block;"></span>📝 Notas';
    p.appendChild(title);
    const ta = document.createElement('textarea'); ta.className = 'cav-ta';
    ta.style.width = '100%'; ta.placeholder = 'Anotações, missões, contatos...';
    ta.value = e.notas || '';
    ta.addEventListener('input', () => { e.notas = ta.value; autoSave(e, save); });
    p.appendChild(ta);
    return p;
  }

  // ── MODAL GENÉRICO ────────────────────────────────────────────────────
  function abrirModal(titulo, campos, onSave, onDelete) {
    const overlay = document.createElement('div'); overlay.className = 'cav-modal-overlay open';
    const modal   = document.createElement('div'); modal.className = 'cav-modal';

    let html = `<button class="cav-modal-close" type="button">✕</button>
      <div class="cav-modal-title">${escH(titulo)}</div>`;

    campos.forEach(c => {
      html += `<div class="cav-field"><label class="cav-lbl">${escH(c.label)}</label>`;
      if (c.tipo === 'textarea') html += `<textarea class="cav-ta" data-key="${c.key}" rows="4">${escH(c.val||'')}</textarea>`;
      else html += `<input class="cav-inp" data-key="${c.key}" type="text" value="${escH(c.val||'')}"/>`;
      html += `</div>`;
    });

    html += `<div class="cav-modal-actions">
      ${onDelete ? '<button class="cbtn cbtn-d" id="mg-del" type="button">Limpar</button>' : ''}
      <button class="cbtn cbtn-g" id="mg-cancel" type="button">Cancelar</button>
      <button class="cbtn cbtn-p" id="mg-save" type="button">Salvar</button>
    </div>`;

    modal.innerHTML = html;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const fechar = () => document.body.removeChild(overlay);
    modal.querySelector('.cav-modal-close').addEventListener('click', fechar);
    modal.querySelector('#mg-cancel').addEventListener('click', fechar);
    overlay.addEventListener('click', ev => { if (ev.target === overlay) fechar(); });

    if (onDelete) {
      modal.querySelector('#mg-del').addEventListener('click', () => { onDelete(); fechar(); });
    }
    modal.querySelector('#mg-save').addEventListener('click', () => {
      const dados = {};
      campos.forEach(c => {
        const el = modal.querySelector(`[data-key="${c.key}"]`);
        dados[c.key] = el?.value || '';
      });
      onSave(dados); fechar();
    });
  }

  // ── HELPERS ───────────────────────────────────────────────────────────
  function criarPanel(titulo) {
    const wrap = document.createElement('div');
    const p = document.createElement('div'); p.className = 'cav-panel';
    const t = document.createElement('div'); t.className = 'cav-ptitle';
    t.innerHTML = `<span style="width:12px;height:1px;background:var(--bronze-dim);display:block;"></span>${titulo}`;
    p.appendChild(t);
    wrap.appendChild(p);
    return wrap;
  }

  function criarPanelSimples() {
    const p = document.createElement('div'); p.className = 'cav-panel';
    return p;
  }

  function criarNumInput(valor, onChange) {
    const inp = document.createElement('input');
    inp.type = 'number'; inp.value = valor;
    inp.addEventListener('input', () => onChange(parseFloat(inp.value) || 0));
    return inp;
  }

  function setVal(root, id, v) {
    const el = root?.querySelector ? root.querySelector('#' + id) : document.getElementById(id);
    if (el) el.textContent = v;
  }

  function pct(cur, max) {
    const m = parseFloat(max) || 1;
    return Math.min(100, Math.max(0, (parseFloat(cur) || 0) / m * 100));
  }

  function escH(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function esc(s) { return escH(s); }

  // LIMPADOR DE FORMATAÇÃO HTML (Tira lixo do editor Quill)
  function limparFormatacao(htmlStr) {
    if (!htmlStr) return '';
    // Transforma <p> e <br> em quebras de linha limpas
    let txt = String(htmlStr).replace(/<br\s*[\/]?>/gi, '\n').replace(/<\/p>/gi, '\n\n');
    // Remove todas as tags HTML
    txt = txt.replace(/<[^>]*>?/gm, '');
    // Limpa os espaços HTML
    txt = txt.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return txt.trim();
  }

  let _saveTimer;
  function autoSave(e, fn) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
      if (e._avatarPendente && e.id) {
        const fd = new FormData();
        fd.append('nome_personagem', e.nome || 'Cavaleiro');
        fd.append('sistema', 'Cavaleiros de Armadura');
        fd.append('imagem', e._avatarPendente);
        fd.append('atributos', JSON.stringify({
          classe: e.classe, patente: e.patente,
          vitalidade: e.vit, impeto: e.imp, lucidez: e.luc,
          armadura: e.arm, arm_estagio: e.arm_estagio,
          arm_equipada: e.arm_equipada,
          atributos_cav: e.atrs, proficiencias: e.proficiencias,
          habilidades: e.habilidades, inventario: e.inventario,
          status: e.status, notas: e.notas,
        }));
        try {
          const res = await window.Api.atualizarFicha(e.id, fd);
          if (res?.ok) {
            const res2 = await window.Api.request(`/fichas/${e.id}`);
            if (res2?.ok) e.avatar_url = res2.data.ficha.imagem_url || e.avatar_url;
            e._avatarPendente = null;
          }
        } catch {}
      }

      if (typeof fn === 'function') fn(e);

      const ind = document.querySelector('.cav-saved');
      if (ind) { ind.classList.add('show'); setTimeout(() => ind.classList.remove('show'), 1800); }
    }, 800);
  }

  w.FichaCavaleiros = { render, ESTADO_DEFAULT };

})(window);