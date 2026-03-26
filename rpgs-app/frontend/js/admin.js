const API_URL = 'https://vk-studio.onrender.com/api';

// 1. CARREGAR USUÁRIOS (VIGIAR)
async function carregarUsuarios() {
    const container = document.getElementById('main-container');
    const token = localStorage.getItem('token');
    document.getElementById('page-title').innerText = "Vigiar Usuários";

    try {
        const response = await fetch(`${API_URL}/usuarios`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dados = await response.json();

        if (!response.ok) throw new Error(dados.error || 'Erro no servidor');

        container.innerHTML = `<div class="cards-grid"></div>`;
        const grid = container.querySelector('.cards-grid');

        dados.forEach(user => {
            grid.innerHTML += `
                <div class="card-gold">
                    <span class="tag-cargo">${user.cargo || 'membro'}</span>
                    <h3>${user.nome}</h3>
                    <p>${user.email}</p>
                </div>
            `;
        });
    } catch (err) {
        container.innerHTML = `<p>Erro ao contatar o abismo: ${err.message}</p>`;
    }
}

// 2. MOSTRAR FORMULÁRIO DE DOCUMENTO
function mostrarFormDocumento() {
    document.getElementById('page-title').innerText = "Forjar Novo Conhecimento";
    const container = document.getElementById('main-container');
    
    container.innerHTML = `
    <form id="formDocumento" class="form-master">
        <div class="form-group">
            <label>TÍTULO</label>
            <input type="text" id="docTitulo" placeholder="Ex: O Despertar do Vazio" required>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>SISTEMA</label>
                <select id="docSistema">
                    <option value="Decadência Cinza">Decadência Cinza</option>
                    <option value="Oceano Estrelado">Oceano Estrelado</option>
                    <option value="Cavaleiros de Armadura">Cavaleiros de Armadura</option>
                </select>
            </div>
            <div class="form-group">
                <label>CATEGORIA</label>
                <select id="docCategoria">
                    <option value="Livro de Regras">Livro de Regras</option>
                    <option value="Itens">Itens</option>
                    <option value="Bestiário">Bestiário</option>
                    <option value="Armas Brancas">Armas Brancas</option>
                    <option value="Armas de Fogo">Armas de Fogo</option>
                    <option value="Armaduras">Armaduras</option>
                    <option value="Classes">Classes</option>
                    <option value="Montaria">Montaria</option>
                    <option value="Magias/Rituais">Magias/Rituais</option>
                </select>
            </div>
        </div>

        <div class="form-group">
            <label>RANK DE LICENÇA</label>
            <select id="docRank">
                <option value="Sem Rank">Sem Rank</option>
                <option value="Rank E">Rank E</option>
                <option value="Rank D">Rank D</option>
                <option value="Rank C">Rank C</option>
                <option value="Rank B">Rank B</option>
                <option value="Rank A">Rank A</option>
                <option value="Rank S">Rank S</option>
            </select>
        </div>

        <div class="form-group">
            <label>ILUSTRAÇÃO PRINCIPAL (CLOUDINARY)</label>
            <input type="file" id="docIlustracao" accept="image/*">
        </div>

        <div class="form-group">
            <label>CONTEÚDO</label>
            <textarea id="docConteudo" rows="10" placeholder="Escreva a lore aqui..."></textarea>
        </div>

        <button type="submit" class="btn-forjar">SELAR DOCUMENTO</button>
    </form>
    `;
}

// 3. FUNÇÃO DE SALVAR (SELAR)
async function salvarDoc(e) {
    e.preventDefault();
    const form = e.target;
    const editId = form.dataset.editId; // Verifica se guardamos um ID aqui
    const token = localStorage.getItem('token');

    const formData = new FormData();

    try {
        // Se tiver editId, usamos o método PUT para a rota de edição
        const url = editId ? `${API_URL}/documentos/${editId}` : `${API_URL}/documentos`;
        const metodo = editId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: metodo,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (response.ok) {
            alert(editId ? "Item Reforjado!" : "Item Selado!");
            delete form.dataset.editId; // Limpa o ID após terminar
            carregarAcervo(); // Volta para a lista
        }
    } catch (err) {
        console.error("Erro na requisição:", err);
        alert("O servidor não respondeu ao chamado. Verifique se o terminal está rodando.");
    }
}

// 4. OUVINTE DE EVENTOS (ÚNICO E GLOBAL)
document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'formDocumento') {
        selarDocumento(e);
    }
});

// 5. GERENCIAR ACERVO 
async function carregarAcervo() {
    const container = document.getElementById('main-container');
    document.getElementById('page-title').innerText = "Gerenciar Acervo";
    container.innerHTML = "<p style='color: #666;'>Consultando os registros nos tomos...</p>";

    try {
        const response = await fetch(`${API_URL}/documentos/todos`);
        const documentos = await response.json();

        container.innerHTML = `<div class="admin-list"></div>`;
        const list = container.querySelector('.admin-list');

        if (!documentos || documentos.length === 0) {
            list.innerHTML = "<p style='color: #666; margin-top: 30px;'>O acervo está vazio.</p>";
            return;
        }

        documentos.forEach(doc => {
            const item = document.createElement('div');
            item.className = "card-admin-gerenciar"; 
            
            item.innerHTML = `
                <div class="card-admin-info">
                    <p>[${doc.sistema}] - ${doc.categoria}</p>
                    <h3>${doc.titulo}</h3>
                </div>
                
                <div class="card-admin-actions">
                    <button class="btn-banir" onclick="banirDocumento(${doc.id})">BANIR</button>
                    <button class="btn-reforjar" onclick="prepararEdicao(${doc.id})">REFORJAR</button>
                </div>
            `;
            list.appendChild(item);
        });
    } catch (err) {
        console.error("Erro ao carregar acervo:", err);
        container.innerHTML = "<p>Erro ao contatar os registros.</p>";
    }
}

// 6. FUNÇÃO PARA BANIR (DELETE)
async function banirDocumento(id) {
    if (!confirm("Tem certeza que deseja apagar esse registro para sempre?")) return;

    try {
        const response = await fetch(`${API_URL}/documentos/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert("Item removido com sucesso!");
            carregarAcervo(); // Recarrega a lista
        } else {
            alert("Erro ao remover o item.");
        }
    } catch (err) {
        console.error("Erro na exclusão:", err);
    }
}

// 7. PREPARAR EDIÇÃO (REFORJAR) - CORRIGIDA
async function prepararEdicao(id) {
    const container = document.getElementById('main-container');
    container.innerHTML = "<p style='color: #666;'>Invocando o conhecimento...</p>";

    try {
        // 1. Busca os dados atuais do item (agora o backend envia o objeto direto)
        const response = await fetch(`${API_URL}/documentos/id/${id}`);
        const doc = await response.json();

        if (!response.ok) throw new Error(doc.error || "Erro ao buscar o registro.");

        console.log("Dados recebidos para edição:", doc); // Log para conferir no navegador (F12)

        // 2. Abre o formulário de criação
        mostrarFormDocumento();

        // 3. Preenche os campos (com os nomes exatos das colunas do banco)
        // Ajustamos o título para ficar igual ao antigo (Print 2)
        document.getElementById('page-title').innerText = "Reforjando: " + doc.titulo;
        
        // Preenchendo os campos
        document.getElementById('docTitulo').value = doc.titulo;
        document.getElementById('docSistema').value = doc.sistema;
        document.getElementById('docCategoria').value = doc.categoria;
        // doc.rank_licenca é o nome da coluna no banco
        document.getElementById('docRank').value = doc.rank_licenca || 'Sem Rank';
        document.getElementById('docConteudo').value = doc.conteudo;

        // 4. Transformamos o botão "SELAR" em "REFORJAR"
        const btn = document.querySelector('.btn-forjar');
        if (btn) {
            btn.innerText = "CONFIRMAR REFORJA";
            btn.classList.add('btn-reforjar-confirmar'); // Opcional: classe CSS para mudar a cor
        }
        
        // 5. Guardamos o ID no formulário para saber que é uma EDIÇÃO
        const form = document.getElementById('formDocumento');
        if (form) {
            form.dataset.editId = id;
        }

    } catch (err) {
        console.error("Erro ao preparar edição:", err);
        alert("Erro do Conselho: " + err.message);
        carregarAcervo(); // Volta para a lista se der erro
    }
}