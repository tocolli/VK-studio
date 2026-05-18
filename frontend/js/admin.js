// frontend/js/admin.js
(function(){
  'use strict';

  const user = VK.user;
  
  // Se não for admin, ele ainda pode entrar se for mestre de alguma mesa para gerir as lojas
  if (!VK.isMestre) {
    const tabGeral = document.querySelector('.section-tab-btn[data-atab="geral"]');
    if (tabGeral) tabGeral.style.display = 'none';
    
    setTimeout(() => {
        const tabLojas = document.querySelector('.section-tab-btn[data-atab="lojas"]');
        if (tabLojas) tabLojas.click();
    }, 100);
  } else {
    // Se for Mestre (Super Admin), verifica se o ID é 1
    if (String(user.id) === "1" || parseInt(user.id) === 1) {
       const tabAuto = document.getElementById('tabAutomacaoSuper');
       if (tabAuto) tabAuto.style.display = 'inline-flex';
    }
  }

  document.getElementById('navUserName').textContent = user.nome;
  if (user.avatar_url) document.getElementById('navAvatar').innerHTML = `<img src="${user.avatar_url}" alt="${user.nome}"/>`;
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('hamburger').classList.toggle('open');
    document.getElementById('navMenu').classList.toggle('open');
  });

  // ===== CONTROLE DE TABS =====
  document.querySelectorAll('.section-tab-btn[data-atab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.section-tab-btn[data-atab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.dataset.atab;
      
      const atabGeral = document.getElementById('atabGeral');
      const atabLojas = document.getElementById('atabLojas');
      const atabAuto  = document.getElementById('atabAutomacao');
      
      if(atabGeral) atabGeral.style.display = t === 'geral' ? 'block' : 'none';
      if(atabLojas) atabLojas.style.display = t === 'lojas' ? 'block' : 'none';
      if(atabAuto)  atabAuto.style.display  = t === 'automacao' ? 'block' : 'none';
      
      if (t === 'lojas' && !lojasCarregadas) {
        carregarMesasParaLoja();
        lojasCarregadas = true;
      }
    });
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
    if(document.getElementById('stUsers')) document.getElementById('stUsers').textContent   = s.totalUsers;
    if(document.getElementById('stFichas')) document.getElementById('stFichas').textContent  = s.totalFichas;
    if(document.getElementById('stAtivHoje')) document.getElementById('stAtivHoje').textContent= s.atividadesHoje;
    if(document.getElementById('stAtivos7d')) document.getElementById('stAtivos7d').textContent= s.jogadoresAtivos7d;
  }

  // ===== USUÁRIOS =====
  async function carregarUsuarios() {
    const res = await Api.listarUsuarios();
    if (!res?.ok) return;
    const usuarios = res.data.usuarios;

    usuarios.forEach(u => { usuariosMap[u.id] = u; });

    const sel = document.getElementById('filtroUsuario');
    if (sel) {
      usuarios.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id; opt.textContent = u.nome + (u.role === 'mestre' ? ' (Mestre)' : '');
        sel.appendChild(opt);
      });
    }

    const tbody = usuarios.map(u => {
      const av = u.avatar_url
        ? `<span class="user-mini-avatar"><img src="${u.avatar_url}" alt="${escH(u.nome)}"/></span>`
        : `<span class="user-mini-avatar"><i class="fa-solid fa-user"></i></span>`;
      const data = new Date(u.created_at).toLocaleDateString('pt-BR');
      return `<tr>
        <td>${av}${escH(u.nome)}</td>
        <td style="color:var(--text-secondary);font-size:.85rem;">${escH(u.email)}</td>
        <td><span class="role-badge ${u.role}">${u.role}</span></td>
        <td style="color:var(--text-muted);font-size:.82rem;">${data}</td>
      </tr>`;
    }).join('');

    const tabUsers = document.getElementById('tabelaUsuarios');
    if (tabUsers) {
        tabUsers.innerHTML = `
          <table class="usuarios-table">
            <thead>
              <tr>
                <th>Nome</th><th>E-mail</th><th>Função</th><th>Membro desde</th>
              </tr>
            </thead>
            <tbody>${tbody}</tbody>
          </table>`;
    }
  }

  // ===== ATIVIDADES =====
  async function carregarAtividades(pagina = 1) {
    paginaAtual = pagina;
    const container = document.getElementById('feedAtividades');
    if (!container) return;
    container.innerHTML = '<div class="empty-feed">Carregando atividades...</div>';

    const params = { limite: LIMITE, pagina };
    if (filtroUsuario) params.usuario_id = filtroUsuario;

    const res = await Api.listarAtividades(params);
    if (!res?.ok) { container.innerHTML = '<div class="empty-feed">Erro ao carregar.</div>'; return; }

    let { atividades, total } = res.data;

    if (filtroCampo) atividades = atividades.filter(a => a.campo === filtroCampo);
    if(document.getElementById('totalAtividades')) document.getElementById('totalAtividades').textContent = `${total} registro${total !== 1 ? 's' : ''}`;

    if (!atividades.length) {
      container.innerHTML = '<div class="empty-feed">Nenhuma atividade encontrada.</div>';
      if(document.getElementById('paginacao')) document.getElementById('paginacao').style.display = 'none';
      return;
    }

    container.innerHTML = atividades.map(a => renderAtividade(a)).join('');

    const totalPaginas = Math.ceil(total / LIMITE);
    if (totalPaginas > 1 && document.getElementById('paginacao')) {
      document.getElementById('paginacao').style.display = 'flex';
      document.getElementById('paginaInfo').textContent = `Página ${pagina} de ${totalPaginas}`;
      document.getElementById('btnAnterior').disabled = pagina <= 1;
      document.getElementById('btnProxima').disabled  = pagina >= totalPaginas;
    } else if (document.getElementById('paginacao')) {
      document.getElementById('paginacao').style.display = 'none';
    }
  }

  function renderAtividade(a) {
    const hora = new Date(a.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    const u = usuariosMap[a.usuario_id];
    const av = (u?.avatar_url || a.usuario_avatar)
      ? `<img src="${u?.avatar_url || a.usuario_avatar}" alt="${escH(a.usuario_nome)}"/>`
      : '<i class="fa-solid fa-user"></i>';

    const tipoClass = ['vida','sanidade','estamina'].includes(a.campo) ? `tipo-${a.campo}`
                    : a.campo === 'ficha' ? 'tipo-ficha' : 'tipo-status';

    let diffHtml = '';
    if (a.valor_anterior !== '—' && a.valor_novo !== 'Ficha criada' && a.valor_novo !== 'Ficha salva' && a.valor_novo !== 'Arquivada') {
      diffHtml = `
        <div class="ativ-diff">
          <span class="val-ant">${escH(a.valor_anterior)}</span>
          <span class="seta">→</span>
          <span class="val-nov">${escH(a.valor_novo)}</span>
        </div>`;
    }

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

  if(document.getElementById('btnFiltrar')) {
      document.getElementById('btnFiltrar').addEventListener('click', () => {
        filtroUsuario = document.getElementById('filtroUsuario').value;
        filtroCampo   = document.getElementById('filtroCampo').value;
        carregarAtividades(1);
      });
  }

  if(document.getElementById('btnAnterior')) document.getElementById('btnAnterior').addEventListener('click', () => carregarAtividades(paginaAtual - 1));
  if(document.getElementById('btnProxima')) document.getElementById('btnProxima').addEventListener('click',  () => carregarAtividades(paginaAtual + 1));
  if(document.getElementById('btnRefresh')) document.getElementById('btnRefresh').addEventListener('click',  () => { carregarStats(); carregarAtividades(paginaAtual); });

  // =====================================================================
  // GESTÃO DE LOJAS E PASTAS (MERCADO DO MESTRE)
  // =====================================================================
  let lojasCarregadas = false;
  let lojasSessaoAtual = [];

  async function carregarMesasParaLoja() {
    const select = document.getElementById('selectMesaLoja');
    if (!select) return;
    select.innerHTML = '<option value="">Carregando mesas...</option>';
    
    try {
      const res = await Api.request('/sessoes');
      const sessoes = res.data.sessoes || res.data || [];
      
      if (!sessoes.length) {
        select.innerHTML = '<option value="">Nenhuma mesa encontrada.</option>';
        return;
      }
      
      select.innerHTML = '<option value="">Selecione uma mesa...</option>' + 
        sessoes.map(s => `<option value="${s.id}" data-sistema="${escH(s.sistema)}">${escH(s.nome)} (${escH(s.sistema || 'Genérico')})</option>`).join('');
        
    } catch(e) {
      select.innerHTML = '<option value="">Erro ao carregar mesas.</option>';
    }
  }

  if(document.getElementById('selectMesaLoja')) {
      document.getElementById('selectMesaLoja').addEventListener('change', (e) => {
        const sessaoId = e.target.value;
        const btnNova = document.getElementById('btnNovaPastaLoja');
        
        if (sessaoId) {
          if (btnNova) btnNova.disabled = false;
          carregarLojasDaSessao(sessaoId);
        } else {
          if (btnNova) btnNova.disabled = true;
          const lista = document.getElementById('listaPastasLoja');
          if (lista) lista.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
              <div class="icon"><i class="fa-solid fa-store"></i></div>
              <p>Selecione uma mesa acima para gerenciar as suas lojas e itens.</p>
            </div>`;
        }
      });
  }

  async function carregarLojasDaSessao(sessaoId) {
    const container = document.getElementById('listaPastasLoja');
    if(!container) return;
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="spinner"></div></div>`;
    
    try {
      const res = await Api.request(`/sessoes/${sessaoId}/lojas`);
      lojasSessaoAtual = res?.ok ? (res.data.lojas || []) : [];
      
      if (!lojasSessaoAtual.length) {
        container.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <div class="icon"><i class="fa-solid fa-box-open"></i></div>
            <p>Nenhuma loja criada para esta mesa. Clique em "Criar Nova Loja" acima.</p>
          </div>`;
        return;
      }
      
      container.innerHTML = lojasSessaoAtual.map(renderLojaCard).join('');
      
    } catch(e) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p>Crie sua primeira loja para começar!</p></div>`;
    }
  }

  function renderLojaCard(loja) {
    return `
      <div class="ficha-card fade-in">
        <div class="ficha-header" style="border-bottom: 1px solid #333; padding-bottom: 15px; margin-bottom: 10px;">
          <div class="ficha-avatar"><i class="fa-solid fa-store" style="color:var(--gold-dim); font-size:1.5rem;"></i></div>
          <div>
            <div class="ficha-nome">${escH(loja.nome)}</div>
            <div class="ficha-sistema">${(loja.itens || []).length} Itens em exibição</div>
          </div>
        </div>
        <button class="btn btn-sm btn-primary" onclick="abrirGerenciadorLoja('${loja.id}')" style="width:100%;"><i class="fa-solid fa-boxes-stacked"></i> Gerenciar Estoque</button>
      </div>`;
  }

  // --- MODAIS DA LOJA ---
  window.fecharModalLoja = (id) => { 
      const el = document.getElementById(id);
      if(el) el.classList.remove('open'); 
  };

  if(document.getElementById('btnNovaPastaLoja')) {
      document.getElementById('btnNovaPastaLoja').addEventListener('click', () => {
        document.getElementById('nomePastaLoja').value = '';
        document.getElementById('modalNovaPastaLoja').classList.add('open');
      });
  }

  if(document.getElementById('btnSalvarPastaLoja')) {
      document.getElementById('btnSalvarPastaLoja').addEventListener('click', async () => {
        const sessaoId = document.getElementById('selectMesaLoja').value;
        const nome = document.getElementById('nomePastaLoja').value.trim();
        if (!nome || !sessaoId) return;

        try {
          const res = await Api.request(`/sessoes/${sessaoId}/lojas`, { method: 'POST', body: { nome } });
          if (!res?.ok) throw new Error("Erro na API");
          window.fecharModalLoja('modalNovaPastaLoja');
          carregarLojasDaSessao(sessaoId);
        } catch(e) {
          lojasSessaoAtual.push({ id: 'mock_'+Date.now(), nome: nome, itens: [] });
          window.fecharModalLoja('modalNovaPastaLoja');
          const lista = document.getElementById('listaPastasLoja');
          if (lista) lista.innerHTML = lojasSessaoAtual.map(renderLojaCard).join('');
        }
      });
  }

  // --- O NOVO GERENCIADOR DE ESTOQUE ---
  window.abrirGerenciadorLoja = async (lojaId) => {
    const sessaoSel = document.getElementById('selectMesaLoja');
    const sistema = sessaoSel.options[sessaoSel.selectedIndex].dataset.sistema;
    const loja = lojasSessaoAtual.find(l => String(l.id) === String(lojaId));
    
    document.getElementById('managerLojaId').value = lojaId;
    document.getElementById('managerTitle').innerHTML = `<i class="fa-solid fa-store"></i> ${escH(loja.nome)}`;
    
    document.getElementById('modalGerenciarLoja').classList.add('open');
    
    renderManagerStoreList(loja.itens || []);
    
    const catalogList = document.getElementById('managerCatalogList');
    catalogList.innerHTML = '<div class="spinner"></div>';
    
    try {
      const res = await Api.request(`/documentos?sistema=${encodeURIComponent(sistema)}`);
      let docs = res.data.documentos.filter(d => ['Itens','Armas Brancas','Armas de Fogo','Armaduras','Consumíveis', 'Habilidades', 'Magias/Rituais'].includes(d.categoria));
      
      // Salva em cache para poder puxar a descrição inteira na hora de importar
      window.managerCatalogDocs = docs;

      // Filtra APENAS os itens automatizados
      docs = docs.filter(d => {
         try {
             if (d.conteudo && d.conteudo.startsWith('{')) {
                const obj = JSON.parse(d.conteudo);
                if (obj.macro && (obj.macro.rolagem || obj.macro.custo_valor || obj.macro.dano)) {
                   return true;
                }
             }
         } catch(e) {}
         return false;
      });

      if (!docs.length) {
         catalogList.innerHTML = '<div style="color:#888; text-align:center; padding:20px; font-size:0.8rem;">Nenhum item automatizado encontrado neste sistema. Vá na aba "Automação" para automatizar itens primeiro.</div>';
         return;
      }
      
      catalogList.innerHTML = docs.map(d => `
        <div class="manager-item" onclick="importarParaLoja(${d.id}, '${escH(d.titulo)}', '${escH(d.categoria)}')">
          <div class="manager-item-info">
            <span class="manager-item-name">${escH(d.titulo)} <i class="fa-solid fa-microchip" style="color:#27ae60; font-size:0.6rem; margin-left:3px;" title="Item Automatizado"></i></span>
            <span class="manager-item-cat">${escH(d.categoria)}</span>
          </div>
          <i class="fa-solid fa-circle-plus" style="color:var(--gold-dim);"></i>
        </div>
      `).join('');
    } catch(e) { catalogList.innerHTML = 'Erro ao carregar catálogo.'; }
  };

  function renderManagerStoreList(itens) {
    document.getElementById('managerStoreList').innerHTML = itens.map(item => `
      <div class="manager-item">
        <div class="manager-item-info">
          <span class="manager-item-name">${escH(item.nome)}</span>
          <span class="manager-item-cat">${item.preco} 💰</span>
        </div>
        <i class="fa-solid fa-trash-can" style="color:#e74c3c; cursor:pointer;" onclick="removerDaLoja(${item.id})"></i>
      </div>
    `).join('') || '<div style="color:#444; font-size:0.75rem; text-align:center; padding:20px;">Vazio</div>';
  }

 window.importarParaLoja = async (docId, nome, cat) => {
    const preco = prompt(`Defina o preço de venda para ${nome}:`, "10");
    if (preco === null) return;
    
    let desc = '';
    let macroHidden = '';
    const doc = window.managerCatalogDocs?.find(d => String(d.id) === String(docId));
    if (doc) {
        if (doc.conteudo && doc.conteudo.startsWith('{')) {
            try {
                const obj = JSON.parse(doc.conteudo);
                desc = obj['Descrição'] || obj['descricao'] || obj['Efeito'] || obj['Dano'] || '';
                if (obj.macro) {
                    macroHidden = '';
                }
            } catch(e){}
        } else if (doc.conteudo) {
            desc = doc.conteudo.replace(/(<([^>]+)>)/gi, "").substring(0, 150);
        }
    }
    
    // Injeta a macro escondida na descrição para a ficha conseguir ler sem alterar o backend
    if (macroHidden) desc += macroHidden;
    
    const sessaoId = document.getElementById('selectMesaLoja').value;
    const lojaId = document.getElementById('managerLojaId').value;
    
    try {
        const res = await Api.request(`/sessoes/${sessaoId}/lojas/${lojaId}/itens`, {
          method: 'POST', body: { nome, preco: parseInt(preco)||0, categoria: cat, descricao: desc }
        });
        
        if (res?.ok) {
           carregarLojasDaSessao(sessaoId).then(() => {
              const novaLoja = lojasSessaoAtual.find(l => String(l.id) === String(lojaId));
              renderManagerStoreList(novaLoja.itens);
           });
        }
    } catch(e) {
        alert("Erro ao adicionar");
    }
  };
  window.removerDaLoja = async (itemId) => {
      alert("A remoção de item na loja será ativada na próxima versão do backend.");
  };

  function escH(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // =====================================================================
  // MOTOR DE AUTOMAÇÃO GLOBAL (EXCLUSIVO ID 1)
  // =====================================================================
  let autoDocsBusca = [];

  // === INSERÇÃO DE TAGS DINÂMICAS ===
  let lastFocusedMacroInput = null;
  
  if (document.getElementById('autoRolagem')) {
      document.getElementById('autoRolagem').addEventListener('focus', function() { lastFocusedMacroInput = this; });
      document.getElementById('autoDano').addEventListener('focus', function() { lastFocusedMacroInput = this; });
  }

  window.inserirTagMacro = function(tag) {
     const input = lastFocusedMacroInput || document.getElementById('autoRolagem');
     if (!input) return;
     const start = input.selectionStart;
     const end = input.selectionEnd;
     const val = input.value;
     input.value = val.substring(0, start) + tag + val.substring(end);
     input.focus();
     input.selectionStart = input.selectionEnd = start + tag.length;
  };

  if (document.getElementById('autoSistemaSel')) {
    document.getElementById('autoSistemaSel').addEventListener('change', () => {
      document.getElementById('btnBuscarAutoItem').click();
    });
  }
  if (document.getElementById('autoCategoriaSel')) {
    document.getElementById('autoCategoriaSel').addEventListener('change', () => {
      document.getElementById('btnBuscarAutoItem').click();
    });
  }

  if (document.getElementById('btnBuscarAutoItem')) {
    document.getElementById('btnBuscarAutoItem').addEventListener('click', async () => {
      const sistema = document.getElementById('autoSistemaSel').value;
      const categoria = document.getElementById('autoCategoriaSel')?.value || '';
      const term = document.getElementById('autoBuscaInput').value.toLowerCase().trim();
      const container = document.getElementById('listaAutoItens');
      
      if (!sistema) {
         container.innerHTML = '<div class="empty-state" style="padding: 2rem;"><div class="icon"><i class="fa-solid fa-database"></i></div><p>Selecione um sistema acima para ver os itens.</p></div>';
         return;
      }
      
      container.innerHTML = '<div class="empty-state" style="padding:2rem;"><div class="spinner"></div></div>';

      try {
        // Busca todos os documentos do sistema
        const res = await Api.request(`/documentos?sistema=${encodeURIComponent(sistema)}`);
        if (!res?.ok) throw new Error();
        
        let docs = res.data.documentos || [];
        // Filtra os que fazem sentido ter macro
        docs = docs.filter(d => ['Itens','Consumíveis','Armas Brancas','Armas de Fogo','Armaduras','Magias/Rituais','Habilidades'].includes(d.categoria));
        
        if (categoria) {
           docs = docs.filter(d => d.categoria === categoria);
        }
        
        if (term) {
          docs = docs.filter(d => d.titulo.toLowerCase().includes(term));
        }
        
        // Mapeia quais têm macro para depois ordenar: Não automatizados primeiro
        docs = docs.map(d => {
           d.hasMacro = false;
           d.macroStr = "Sem automação configurada";
           try {
               if (d.conteudo && d.conteudo.startsWith('{')) {
                  const obj = JSON.parse(d.conteudo);
                  if (obj.macro && (obj.macro.rolagem || obj.macro.custo_valor || obj.macro.dano)) {
                     d.hasMacro = true;
                     const m = obj.macro;
                     let txt = [];
                     if(m.custo_tipo) txt.push(`Abate ${m.custo_valor} ${m.custo_tipo}`);
                     if(m.rolagem) txt.push(`Rola [${m.rolagem}]`);
                     if(m.dano) txt.push(`Dano [${m.dano}]`);
                     d.macroStr = txt.join(' · ') || "Automação Parcial";
                  }
               }
           } catch(e) {}
           return d;
        });

        // Ordena: Não automatizados primeiro
        docs.sort((a, b) => {
           if (a.hasMacro === b.hasMacro) return a.titulo.localeCompare(b.titulo);
           return a.hasMacro ? 1 : -1;
        });

        autoDocsBusca = docs;

        if (!docs.length) {
           container.innerHTML = '<div class="empty-state"><p>Nenhum item ou habilidade encontrado com esse nome.</p></div>';
           return;
        }

        container.innerHTML = docs.map(d => {
          const hasMacro = d.hasMacro;
          let macroStr = d.macroStr;
          
          // Se não tiver macro, tentar mostrar um resumo da descrição para facilitar
          if (!hasMacro) {
             try {
                if (d.conteudo && d.conteudo.startsWith('{')) {
                   const obj = JSON.parse(d.conteudo);
                   const desc = obj['Descrição'] || obj['Efeito'] || obj['Dano'] || obj['Custo'] || '';
                   if (desc) {
                      // Limita a descrição a 100 caracteres para não quebrar o layout
                      macroStr = "Sem automação · " + (desc.length > 100 ? desc.substring(0, 100) + '...' : desc);
                   }
                }
             } catch(e) {}
          }
          
          // Imagem do Item se existir no banco de dados
          const imgHtml = d.imagem_url 
            ? `<img src="${escH(d.imagem_url)}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #333;">` 
            : `<div style="width:40px;height:40px;background:#1a1a1a;border-radius:4px;display:flex;align-items:center;justify-content:center;border:1px solid #333;"><i class="fa-solid fa-box" style="color:#555;"></i></div>`;

          return `
            <div style="background:#0a0a0a; border:1px solid ${hasMacro ? 'var(--gold-dim)' : '#333'}; padding:10px; border-radius:4px; display:flex; align-items:center; gap:12px;">
              ${imgHtml}
              <div style="flex:1;">
                <div style="font-weight:bold; color:${hasMacro ? 'var(--gold)' : '#fff'}; font-size:1.1rem;">
                  ${escH(d.titulo)} 
                  <span style="font-size:0.7rem; color:var(--text-muted); background:#1a1a1a; padding:2px 5px; border-radius:2px; margin-left:5px;">${escH(d.categoria)}</span>
                </div>
                <div style="font-size:0.8rem; color:${hasMacro ? '#ccc' : 'var(--text-muted)'}; margin-top:3px;">
                  <i class="fa-solid fa-microchip" style="margin-right:5px; color:${hasMacro?'#27ae60':'#555'};"></i> ${escH(macroStr)}
                </div>
              </div>
              <div>
                <button class="btn btn-primary btn-sm" onclick="abrirConfigAuto(${d.id})"><i class="fa-solid fa-cogs"></i> ${hasMacro ? 'Editar' : 'Configurar'}</button>
              </div>
            </div>
          `;
        }).join('');

      } catch (e) {
        container.innerHTML = '<div class="empty-state"><p>Erro ao buscar itens.</p></div>';
      }
    });
  }

  window.abrirConfigAuto = (docId) => {
    const doc = autoDocsBusca.find(d => String(d.id) === String(docId));
    if (!doc) return;

    document.getElementById('autoItemId').value = doc.id;
    document.getElementById('autoItemNome').textContent = doc.titulo + ' (' + doc.categoria + ')';
    
    // Renderizar o preview do item na esquerda
    let previewHtml = '';
    if (doc.imagem_url) {
        previewHtml += `<div style="text-align:center; margin-bottom:15px;"><img src="${escH(doc.imagem_url)}" style="max-width:120px; max-height:120px; border-radius:6px; border:1px solid #333; object-fit:cover;"></div>`;
    }
    previewHtml += `<h3 style="color:var(--gold); margin:0 0 5px 0;">${escH(doc.titulo)}</h3>`;
    previewHtml += `<div style="font-size:0.8rem; color:#888; margin-bottom:20px; text-transform:uppercase; border-bottom:1px solid #333; padding-bottom:10px;">${escH(doc.categoria)}</div>`;
    
    let obj = {};
    try {
       if (doc.conteudo && doc.conteudo.startsWith('{')) {
          obj = JSON.parse(doc.conteudo);
       }
    } catch(e) {}

    let hasInfo = false;
    for (const [key, val] of Object.entries(obj)) {
        if (key === 'macro' || key === 'imagem' || key === 'imagem_url') continue; // Ignora campos internos
        if (val === null || val === '') continue;
        hasInfo = true;
        let valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
        // Não usar escH aqui garante que se a descrição tiver <p> ou <br> eles renderizam corretamente.
        previewHtml += `<div style="margin-bottom:12px; background:#111214; padding:8px; border-radius:4px; border:1px solid #222;">
            <strong style="color:var(--gold-dim); font-size:0.85rem; display:block; margin-bottom:4px; text-transform:capitalize;">${escH(key)}</strong>
            <div style="color:#ddd; font-size:0.85rem; line-height:1.4;">${valStr.replace(/\\n/g, '<br>')}</div>
        </div>`;
    }
    
    if (!hasInfo && doc.conteudo && !doc.conteudo.startsWith('{')) {
        hasInfo = true;
        previewHtml += `<div style="margin-bottom:12px; background:#111214; padding:8px; border-radius:4px; border:1px solid #222;">
            <strong style="color:var(--gold-dim); font-size:0.85rem; display:block; margin-bottom:4px;">Descrição Geral</strong>
            <div style="color:#ddd; font-size:0.85rem; line-height:1.4;">${doc.conteudo}</div>
        </div>`;
    }
    
    if (!hasInfo) {
        previewHtml += `<div style="color:#888; font-size:0.85rem; text-align:center; margin-top:20px;">Nenhuma descrição detalhada encontrada no banco de dados para este item.</div>`;
    }
    
    document.getElementById('autoItemPreview').innerHTML = previewHtml;

    // Reseta form
    document.getElementById('autoCustoTipo').value = '';
    document.getElementById('autoCustoValor').value = '';
    document.getElementById('autoRolagem').value = '';
    document.getElementById('autoAlvo').value = '';
    document.getElementById('autoDano').value = '';

    // Lê a macro existente
    if (obj.macro) {
       document.getElementById('autoCustoTipo').value = obj.macro.custo_tipo || '';
       document.getElementById('autoCustoValor').value = obj.macro.custo_valor || '';
       document.getElementById('autoRolagem').value = obj.macro.rolagem || '';
       document.getElementById('autoAlvo').value = obj.macro.alvo || '';
       document.getElementById('autoDano').value = obj.macro.dano || '';
    }

    document.getElementById('modalConfigAuto').classList.add('open');
  };

  window.fecharModalAuto = () => {
    document.getElementById('modalConfigAuto').classList.remove('open');
  };

 if (document.getElementById('btnSalvarAuto')) {
    document.getElementById('btnSalvarAuto').addEventListener('click', async () => {
      const docId = document.getElementById('autoItemId').value;
      const doc = autoDocsBusca.find(d => String(d.id) === String(docId));
      if (!doc) return;

      const macro = {
         custo_tipo: document.getElementById('autoCustoTipo').value,
         custo_valor: parseInt(document.getElementById('autoCustoValor').value) || null,
         rolagem: document.getElementById('autoRolagem').value.trim(),
         alvo: document.getElementById('autoAlvo').value,
         dano: document.getElementById('autoDano').value.trim()
      };

      try {
         const btn = document.getElementById('btnSalvarAuto');
         btn.disabled = true; btn.textContent = 'Salvando...';

         let obj = {};
         if (doc.conteudo && doc.conteudo.startsWith('{')) {
             obj = JSON.parse(doc.conteudo);
         }
         obj.macro = macro;
         const novoConteudo = JSON.stringify(obj);

         // Prepara o FormData com um "Clone" de todos os campos originais do documento
         const fd = new FormData();
         
         for (const key in doc) {
            // Ignora campos gerados no frontend ou nulos
            if (doc[key] !== null && doc[key] !== undefined && 
                key !== 'conteudo' && key !== 'campos_extras' && 
                key !== 'imagem_url' && key !== 'hasMacro' && key !== 'macroStr') {
                fd.append(key, doc[key]);
            }
         }
         
         // Sobrescreve apenas o conteúdo com a nova macro
         fd.append('conteudo', novoConteudo);
         fd.append('campos_extras', novoConteudo);
         
         const res = await Api.atualizarDocumento(doc.id, fd);
         
         if (res?.ok) {
            fecharModalAuto();
            document.getElementById('btnBuscarAutoItem').click(); // Atualiza a lista visualmente
         } else {
            alert('Ainda deu erro! Verifica a consola e avisa-me.');
         }
      } catch (e) {
         alert('Erro de conexão ao salvar macro.');
      } finally {
         const btn = document.getElementById('btnSalvarAuto');
         if(btn) { btn.disabled = false; btn.textContent = 'Salvar Automação'; }
      }
    });
  }

  // INIT
  carregarStats();
  carregarUsuarios().then(() => carregarAtividades(1));
})();