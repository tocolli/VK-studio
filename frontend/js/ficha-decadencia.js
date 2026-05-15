// frontend/js/ficha-decadencia.js
(function() {
    'use strict';

    const FichaDecadencia = {
        init() {
            try {
                this.bindFoto();
                this.bindBarras();
                this.bindPassivas();
                this.bindPainelSistema();
                this.bindBotoesDinamicos();
                this.initDragAndDrop();
                
                // Forçar a primeira atualização visual das barras
                this.updateBarras();
                
                console.log("Ficha Decadência Cinza carregada com sucesso! 🧟‍♂️");
            } catch (erro) {
                console.error("Erro fatal ao carregar a ficha:", erro);
            }
        },

        // ─── FOTO DE PERFIL ──────────────────────────────────────────────
        bindFoto() {
            const fotoContainer = document.getElementById('fotoPersonagem');
            const inpFoto = document.getElementById('inpFotoPersonagem');
            const fotoIcon = document.getElementById('fotoIcon');

            if (!fotoContainer || !inpFoto) return;

            fotoContainer.addEventListener('click', () => inpFoto.click());

            inpFoto.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        fotoContainer.style.backgroundImage = `url('${event.target.result}')`;
                        if (fotoIcon) fotoIcon.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
            });
        },

        // ─── BARRAS DE STATUS ────────────────────────────────────────────
        bindBarras() {
            const ids = ['vidaCur', 'vidaMax', 'sanCur', 'sanMax', 'estaCur', 'estaMax'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', () => this.updateBarras());
                }
            });
        },

        updateBarras() {
            const stats = [
                { cur: 'vidaCur', max: 'vidaMax', bar: 'barVida' },
                { cur: 'sanCur', max: 'sanMax', bar: 'barSan' },
                { cur: 'estaCur', max: 'estaMax', bar: 'barEsta' }
            ];

            stats.forEach(s => {
                const cur = parseInt(document.getElementById(s.cur)?.value) || 0;
                const max = parseInt(document.getElementById(s.max)?.value) || 1;
                const pct = Math.max(0, Math.min(100, (cur / max) * 100));
                
                const barEl = document.getElementById(s.bar);
                if (barEl) barEl.style.width = pct + '%';
            });
        },

        // ─── PASSIVAS (PESO, ESQUIVA) ────────────────────────────────────
        bindPassivas() {
            document.querySelectorAll('.attr-input').forEach(inp => {
                inp.addEventListener('input', () => this.calcularPassivas());
            });
            this.calcularPassivas(); // Calcular no início
        },

        calcularPassivas() {
            const fisico = parseInt(document.getElementById('attrFisico')?.value) || 0;
            const agilidade = parseInt(document.getElementById('attrAgilidade')?.value) || 0;
            const intelecto = parseInt(document.getElementById('attrIntelecto')?.value) || 0;

            const elPeso = document.getElementById('capPeso');
            const elEsquiva = document.getElementById('passivaEsquiva');
            const elPercepcao = document.getElementById('passivaPercepcao');

            if (elPeso) elPeso.value = (10 + fisico * 5) + 'kg';
            if (elEsquiva) elEsquiva.value = 5 + agilidade;
            if (elPercepcao) elPercepcao.value = 5 + intelecto;
        },

        // ─── PAINEL LATERAL ──────────────────────────────────────────────
        bindPainelSistema() {
            const btnAbrir = document.getElementById('btnAbrirMenuSistema');
            const painel = document.getElementById('painelSistemaItens');
            const btnFechar = document.getElementById('btnFecharPainelSistema');

            if (btnAbrir && painel) {
                btnAbrir.addEventListener('click', (e) => {
                    e.preventDefault();
                    painel.classList.add('open');
                });
            }

            if (btnFechar && painel) {
                btnFechar.addEventListener('click', (e) => {
                    e.preventDefault();
                    painel.classList.remove('open');
                });
            }
        },

        // ─── PERÍCIAS DINÂMICAS ──────────────────────────────────────────
        bindBotoesDinamicos() {
            const btnProf = document.getElementById('btnNovaPericiaProf');
            const btnOutra = document.getElementById('btnNovaPericiaOutra');
            const btnCarac = document.getElementById('btnNovaCaracteristica');

            if(btnProf) btnProf.addEventListener('click', () => this.adicionarLinha('lista-pericias-prof', 'pericia'));
            if(btnOutra) btnOutra.addEventListener('click', () => this.adicionarLinha('lista-pericias-outras', 'pericia'));
            if(btnCarac) btnCarac.addEventListener('click', () => this.adicionarLinha('lista-caracteristicas', 'caracteristica'));
        },

        adicionarLinha(containerId, tipo) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const row = document.createElement('div');
            row.className = 'pericia-row-dinamica';

            if (tipo === 'pericia') {
                row.innerHTML = `
                    <input type="text" placeholder="Nome da perícia..." class="mesa-inp">
                    <input type="number" class="mesa-inp-small" value="0">
                    <button class="btn-del" title="Remover"><i class="fa-solid fa-xmark"></i></button>
                `;
            } else {
                row.innerHTML = `
                    <input type="text" placeholder="Característica..." class="mesa-inp">
                    <input type="text" placeholder="Efeito..." class="mesa-inp">
                    <button class="btn-del" title="Remover"><i class="fa-solid fa-xmark"></i></button>
                `;
            }

            row.querySelector('.btn-del').onclick = () => row.remove();
            container.appendChild(row);
        },

        // ─── DRAG AND DROP (INVENTÁRIO) ──────────────────────────────────
        initDragAndDrop() {
            const dropzone = document.getElementById('inventario-dropzone');
            const items = document.querySelectorAll('.item-saque-card');

            if (!dropzone) return;

            // Tornar os cards da loja arrastáveis
            items.forEach(item => {
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('application/json', item.dataset.item);
                });
            });

            // Permitir largar no inventário
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('drag-over');
            });

            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('drag-over');
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('drag-over');
                
                try {
                    const dataStr = e.dataTransfer.getData('application/json');
                    if (dataStr) {
                        const itemData = JSON.parse(dataStr);
                        this.adicionarItem(itemData);
                    }
                } catch (err) {
                    console.error("Erro ao processar item arrastado:", err);
                }
            });
        },

        adicionarItem(item) {
            const container = document.getElementById('inventario-dropzone');
            
            // Remove a mensagem de "vazio"
            const placeholder = container.querySelector('.empty-inv-msg');
            if (placeholder) placeholder.remove();

            const div = document.createElement('div');
            div.className = 'item-card-outbreak';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color: #c9a84c;">${item.titulo}</strong>
                    <span style="color:#888; font-size:0.8rem;">${item.peso} kg</span>
                </div>
                <p style="margin:0; font-size:0.85rem; color:#ccc;">${item.descricao}</p>
                <button class="btn-del" style="margin-top: 8px; font-size: 0.8rem; background: transparent; color: #888; border: none; cursor: pointer;">
                    <i class="fa-solid fa-trash"></i> Descartar
                </button>
            `;
            
            // Botão de descartar item
            div.querySelector('.btn-del').onclick = () => {
                div.remove();
                if(container.querySelectorAll('.item-card-outbreak').length === 0) {
                    container.innerHTML = '<p class="empty-inv-msg">Nada na mochila ainda... (Arraste os itens aqui)</p>';
                }
            };

            container.appendChild(div);
        }
    };

    // Inicializar quando o documento carregar
    document.addEventListener('DOMContentLoaded', () => FichaDecadencia.init());

})();