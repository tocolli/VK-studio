// ficha-cavaleiros.js
// Lógica completa da ficha de Cavaleiros de Armadura
// Integra com Api e fichaState do forja.js

(function (w) {
  'use strict';

  // ─── CONSTANTES ────────────────────────────────────────────────────
  const ATRIBUTOS = ['Temperança','Vigor Bruto','Zelo','Humanidade','Lucidez','Inteligência'];
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

  // Estado padrão de uma ficha nova
  const ESTADO_DEFAULT = () => ({
    nome: '', classe: '', patente: 'Soldado',
    vit: [7,7], imp: [9,9], luc: [10,10],
    arm: [10,10], arm_estagio: 'Impecável',
    atrs: { 'Temperança':0,'Vigor Bruto':0,'Zelo':0,'Humanidade':0,'Lucidez':0,'Inteligência':0 },
    proficiencias: Array(PROF_SLOTS).fill(null).map(() => ({ nome:'', desc:'' })),
    habilidades: [],
    inventario: { alforge_idx:0, slots:{} },
    status: [],
    notas: '',
  });

  // ─── RENDER PRINCIPAL ───────────────────────────────────────────────
  function render(container, estado, onSave) {
    container.innerHTML = '';
    container.className = 'ficha-cav';

    const el = criarFicha(estado, onSave);
    container.appendChild(el);
  }

  function criarFicha(estado, onSave) {
    const root = document.createElement('div');

    // ── Header ──
    root.appendChild(criarHeader(estado, onSave));

    // ── Recursos vitais ──
    root.appendChild(criarRecursos(estado, onSave));

    // ── Capacitações calculadas ──
    root.appendChild(criarCapacitacoes(estado));

    // ── Atributos ──
    root.appendChild(criarAtributos(estado, onSave, root));

    // ── Integridade da Armadura ──
    root.appendChild(criarArmadura(estado, onSave));

    // ── Status de condição ──
    root.appendChild(criarStatus(estado, onSave));

    // ── Proficiências ──
    root.appendChild(criarProficiencias(estado, onSave));

    // ── Habilidades / Armas ──
    root.appendChild(criarHabilidades(estado, onSave));

    // ── Inventário ──
    root.appendChild(criarInventario(estado, onSave));

    // ── Notas ──
    root.appendChild(criarNotas(estado, onSave));

    // Indicador de salvo
    const saved = document.createElement('div');
    saved.className = 'cav-saved';
    saved.id = 'cavSaved_' + Date.now();
    saved.textContent = 'Salvo ✓';
    root.appendChild(saved);

    return root;
  }

  // ── HEADER ──────────────────────────────────────────────────────────
  function criarHeader(e, save) {
    const div = document.createElement('div');
    div.className = 'cav-header';

    // Avatar
    const av = document.createElement('div');
    av.className = 'cav-avatar';
    av.innerHTML = e.avatar_url ? `<img src="${e.avatar_url}" alt="avatar"/>` : '⚔';
    div.appendChild(av);

    const info = document.createElement('div');
    info.className = 'cav-header-info';

    // Nome
    const nome = document.createElement('input');
    nome.className = 'cav-nome-input';
    nome.type = 'text';
    nome.placeholder = 'NOME DO CAVALEIRO';
    nome.value = e.nome || '';
    nome.addEventListener('input', () => { e.nome = nome.value; autoSave(e, save); });
    info.appendChild(nome);

    // Meta row
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

    // Patente (select estilizado)
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

  // ── RECURSOS ─────────────────────────────────────────────────────────
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

  // ── CAPACITAÇÕES ─────────────────────────────────────────────────────
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
    // Atualizar imediatamente
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

  // ── ATRIBUTOS ─────────────────────────────────────────────────────────
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
          // Atualiza dots
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

  // ── ARMADURA ──────────────────────────────────────────────────────────
  function criarArmadura(e, save) {
    const panel = criarPanel('🛡 Integridade da Armadura');
    const p = panel.querySelector ? panel : panel;

    const row = document.createElement('div'); row.className = 'arm-row';

    const inputs = document.createElement('div'); inputs.className = 'arm-inputs';
    const cur = criarNumInput(e.arm[0], v => { e.arm[0] = v; atualizarBarraArm(panel); atualizarEstagio(e, panel); autoSave(e, save); });
    cur.className = 'rec-num';
    const sep = document.createElement('span'); sep.className = 'rec-sep'; sep.textContent = '/';
    const max = criarNumInput(e.arm[1], v => { e.arm[1] = v; atualizarBarraArm(panel); autoSave(e, save); });
    max.className = 'rec-num';
    inputs.appendChild(cur); inputs.appendChild(sep); inputs.appendChild(max);
    row.appendChild(inputs);

    const sel = document.createElement('select'); sel.className = 'arm-stage';
    ['Impecável','Riscada','Amassada','Rompida'].forEach(s => {
      const opt = document.createElement('option'); opt.value = s; opt.textContent = s;
      if (e.arm_estagio === s) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => { e.arm_estagio = sel.value; atualizarEstagio(e, panel); autoSave(e, save); });
    row.appendChild(sel);

    // Aviso rompida
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

    const cont = criarPanelSimples();
    cont.appendChild(row);
    cont.appendChild(bCont);
    return cont;
  }

  function atualizarBarraArm(root) {
    // será chamado com o container acima — busca no root global
    const fill = document.getElementById('barra-arm');
    if (fill) {
      const cur = parseFloat(fill.closest('.ficha-cav')?.querySelector('.arm-inputs .rec-num')?.value) || 0;
      const max = parseFloat(fill.closest('.ficha-cav')?.querySelectorAll('.arm-inputs .rec-num')[1]?.value) || 1;
      fill.style.width = pct(cur, max) + '%';
    }
  }

  function atualizarEstagio(e, root) {
    const aviso = document.getElementById('arm-aviso');
    if (aviso) aviso.style.display = e.arm_estagio === 'Rompida' ? 'inline-block' : 'none';
  }

  // ── STATUS ────────────────────────────────────────────────────────────
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

  // ── PROFICIÊNCIAS ─────────────────────────────────────────────────────
  function criarProficiencias(e, save) {
    const ocupados = e.proficiencias.filter(p => p.nome).length;
    const panel = criarPanel(`📖 Proficiências · <span style="color:var(--text-muted);font-size:.58rem;">${ocupados}/${PROF_SLOTS} usados</span>`);
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
      // Re-render grid
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

  // ── HABILIDADES / ARMAS ───────────────────────────────────────────────
  function criarHabilidades(e, save) {
    const panel = criarPanel('⚡ Habilidades & Armas');
    const ptitle = panel.querySelector ? panel.querySelector('.cav-ptitle') : null;

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-small'; addBtn.textContent = '+ Adicionar';

    const list = document.createElement('div'); list.className = 'hab-list'; list.id = 'hab-list';

    function renderHabs() {
      list.innerHTML = '';
      if (!e.habilidades.length) {
        const empty = document.createElement('div'); empty.className = 'hab-empty';
        empty.textContent = 'Nenhuma habilidade adicionada.';
        list.appendChild(empty); return;
      }
      e.habilidades.forEach((h, i) => {
        const item = document.createElement('div'); item.className = 'hab-item';

        const body = document.createElement('div'); body.className = 'hab-body';
        const nome = document.createElement('div'); nome.className = 'hab-nome'; nome.textContent = h.nome || 'Sem nome';
        const desc = document.createElement('div'); desc.className = 'hab-desc'; desc.textContent = h.desc || '';
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

        const del = document.createElement('button'); del.className = 'hab-del'; del.textContent = '✕';
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

    const p = criarPanelSimples();
    const title = document.createElement('div'); title.className = 'cav-ptitle';
    title.innerHTML = '<span style="width:12px;height:1px;background:var(--bronze-dim);display:block;"></span>⚡ Habilidades & Armas';
    title.appendChild(addBtn);
    p.appendChild(title);
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
        <input class="cav-inp" id="mh-nome" type="text" value="${esc(h.nome)}" placeholder="Ex: Estocar, Espada Longa..."/></div>
      <div class="cav-field"><label class="cav-lbl">Descrição</label>
        <textarea class="cav-ta" id="mh-desc" rows="3">${esc(h.desc)}</textarea></div>
      <div class="cav-g3">
        <div class="cav-field"><label class="cav-lbl">Atributo</label>
          <select class="cav-sel" id="mh-attr">
            <option value="">—</option>
            ${ATRIBUTOS.map(a => `<option value="${a}" ${h.atributo===a?'selected':''}>${a}</option>`).join('')}
          </select></div>
        <div class="cav-field"><label class="cav-lbl">Custo Ímpeto</label>
          <input class="cav-inp" id="mh-custo" type="number" min="0" max="10" value="${h.custo||0}"/></div>
        <div class="cav-field"><label class="cav-lbl">Dado de Dano</label>
          <input class="cav-inp" id="mh-dano" type="text" value="${esc(h.dano)}" placeholder="Ex: 1d6"/></div>
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

  // ── INVENTÁRIO ────────────────────────────────────────────────────────
  function criarInventario(e, save) {
    const p = criarPanelSimples();

    const title = document.createElement('div'); title.className = 'cav-ptitle';
    title.innerHTML = '<span style="width:12px;height:1px;background:var(--bronze-dim);display:block;"></span>🎒 Inventário';
    p.appendChild(title);

    const controls = document.createElement('div'); controls.className = 'inv-controls';

    const sel = document.createElement('select'); sel.className = 'inv-select';
    ALFORGES.forEach((a, i) => {
      const opt = document.createElement('option'); opt.value = i; opt.textContent = a.label;
      if ((e.inventario.alforge_idx || 0) === i) opt.selected = true;
      sel.appendChild(opt);
    });

    const carga = document.createElement('span'); carga.className = 'inv-carga'; carga.id = 'inv-carga';

    const grid = document.createElement('div'); grid.className = 'inv-grid'; grid.id = 'inv-grid';

    function renderGrid() {
      grid.innerHTML = '';
      const vigor     = e.atrs['Vigor Bruto'] || 0;
      const baseSlots = vigor + 5;
      const extraSlots = ALFORGES[e.inventario.alforge_idx || 0]?.slots || 0;
      const totalSlots = baseSlots + extraSlots;
      const usados = Object.keys(e.inventario.slots).length;

      carga.textContent = `Carga: ${usados} / ${baseSlots} (${usados}/${totalSlots} c/ alforge)`;
      carga.className = 'inv-carga' + (usados > totalSlots ? ' sobre' : '');

      for (let i = 0; i < totalSlots; i++) {
        const slot = document.createElement('div');
        const item = e.inventario.slots[i];
        slot.className = 'inv-slot' + (item ? ' tem' : '');
        slot.textContent = item ? item.nome.substring(0, 5) : '';
        if (i >= baseSlots) slot.style.opacity = '.7'; // slots de alforge
        slot.addEventListener('click', () => abrirModalInv(e, i, save, renderGrid));
        grid.appendChild(slot);
      }
    }

    sel.addEventListener('change', () => {
      e.inventario.alforge_idx = parseInt(sel.value);
      renderGrid(); autoSave(e, save);
    });

    controls.appendChild(sel); controls.appendChild(carga);
    p.appendChild(controls); p.appendChild(grid);
    renderGrid();
    return p;
  }

  function abrirModalInv(e, idx, save, renderFn) {
    const item = e.inventario.slots[idx] || {};
    const overlay = document.createElement('div'); overlay.className = 'cav-modal-overlay open';
    const modal   = document.createElement('div'); modal.className = 'cav-modal';

    modal.innerHTML = `
      <button class="cav-modal-close" type="button">✕</button>
      <div class="cav-modal-title">Slot ${idx + 1} — ${idx >= (e.atrs['Vigor Bruto']||0)+5 ? 'Alforge' : 'Inventário'}</div>
      <div class="cav-field"><label class="cav-lbl">Nome do Item</label>
        <input class="cav-inp" id="mi-nome" type="text" value="${esc(item.nome||'')}" placeholder="Ex: Espada Longa, Ração..."/></div>
      <div class="cav-field"><label class="cav-lbl">Descrição / Efeito</label>
        <textarea class="cav-ta" id="mi-desc" rows="3">${esc(item.desc||'')}</textarea></div>
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

    overlay.querySelector('#mi-del').addEventListener('click', () => {
      delete e.inventario.slots[idx];
      renderFn(); autoSave(e, save); fechar();
    });
    overlay.querySelector('#mi-save').addEventListener('click', () => {
      const nome = overlay.querySelector('#mi-nome').value.trim();
      if (nome) {
        e.inventario.slots[idx] = {
          nome, desc: overlay.querySelector('#mi-desc').value.trim(),
          peso: parseInt(overlay.querySelector('#mi-peso').value) || 1,
          estagio: overlay.querySelector('#mi-estagio').value,
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
      <div class="cav-modal-title">${esc(titulo)}</div>`;

    campos.forEach(c => {
      html += `<div class="cav-field"><label class="cav-lbl">${esc(c.label)}</label>`;
      if (c.tipo === 'textarea') html += `<textarea class="cav-ta" data-key="${c.key}" rows="4">${esc(c.val||'')}</textarea>`;
      else html += `<input class="cav-inp" data-key="${c.key}" type="text" value="${esc(c.val||'')}"/>`;
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

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  let _saveTimer;
  function autoSave(e, fn) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      if (typeof fn === 'function') fn(e);
      // Indicador visual
      const ind = document.querySelector('.cav-saved');
      if (ind) { ind.classList.add('show'); setTimeout(() => ind.classList.remove('show'), 1800); }
    }, 800);
  }

  // ─── EXPORT ─────────────────────────────────────────────────────────
  w.FichaCavaleiros = { render, ESTADO_DEFAULT };

})(window);