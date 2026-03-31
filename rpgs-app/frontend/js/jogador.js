const API_URL = 'https://vk-studio.onrender.com/api';

// 1. Mapeamento de Categorias
const categoriasPorSistema = {
    "Decadência Cinza": ["LIVRO DE REGRAS", "ITENS", "BESTIÁRIO", "ARMAS BRANCAS", "ARMAS DE FOGO", "ARMADURAS", "CLASSES", "VEÍCULOS", "MAGIAS/RITUAIS"],
    "Oceano Estrelado": ["LIVRO DE REGRAS", "ITENS", "BESTIÁRIO", "ARMAS BRANCAS", "ARMAS DE FOGO", "ARMADURAS", "CLASSES", "EMBARCAÇÕES", "MAGIAS/RITUAIS", "TRIPULAÇÃO"],
    "Cavaleiros de Armadura": ["LIVRO DE REGRAS", "ITENS", "BESTIÁRIO", "ARMAS BRANCAS", "ARMAS DE FOGO", "ARMADURAS", "CLASSES", "MONTARIA", "MAGIAS/RITUAIS"]
};

function carregarEstiloSistema(sistema) {
    const temaAntigo = document.getElementById('tema-sistema');
    if (temaAntigo) temaAntigo.remove();

    const link = document.createElement('link');
    link.id = 'tema-sistema';
    link.rel = 'stylesheet';

    // Se o seu dashboard.html está na pasta frontend e os css na frontend/css:
    let arquivo = '';
    if (sistema === "Cavaleiros de Armadura") arquivo = '/css/cavaleiros.css';
    else if (sistema === "Oceano Estrelado") arquivo = '/css/oceano.css';
    else if (sistema === "Decadência Cinza") arquivo = '/css/decadencia.css';

    if (arquivo) {
        link.href = arquivo + '?v=' + new Date().getTime();
        document.head.appendChild(link);
    }
}

// Sua função abrirMenu atualizada para chamar o tema
function abrirMenu(sistema) {
    // Chamada do Transplante de Estilo
    carregarEstiloSistema(sistema);

    // --- Mantenha sua lógica original abaixo ---
    const modal = document.getElementById('modal-categorias');
    const grid = document.getElementById('botoes-categorias');
    const titulo = document.getElementById('modal-sistema-nome');

    if (titulo) titulo.innerText = sistema;

    const lista = categoriasPorSistema[sistema] || [];
    if (grid) {
        grid.innerHTML = lista.map(cat => `
            <button class="btn-categoria" onclick="verItens('${sistema}', '${cat}')">${cat}</button>
        `).join('');
    }

    if (modal) modal.style.display = 'flex';
}

// 3. Busca de Itens no Banco
async function verItens(sistema, categoria) {
    fecharModais();
    
    const viewSistemas = document.getElementById('view-sistemas');
    const viewItens = document.getElementById('view-itens');
    const listaCards = document.getElementById('lista-cards-itens');
    const tituloPagina = document.getElementById('itens-page-title');

    if (viewSistemas) viewSistemas.style.display = 'none';
    if (viewItens) viewItens.style.display = 'block';
    if (tituloPagina) tituloPagina.innerText = sistema + " > " + categoria;

    try {
        const response = await fetch(`${API_URL}/documentos/${sistema}/${categoria}`);
        const dados = await response.json();

        if (listaCards) {
            listaCards.innerHTML = ''; 
            if (!dados || dados.length === 0) {
                listaCards.innerHTML = '<p style="color: #666; margin-top: 50px;">Acervo vazio.</p>';
                return;
            }

            dados.forEach(item => {
                const card = document.createElement('div');
                card.className = "world-card";
                card.style = "padding: 20px; text-align: left; margin-bottom: 20px; cursor: pointer;";
                card.innerHTML = `
                    <img src="${item.ilustracao_url || ''}" style="width: 100%; max-height: 200px; object-fit: cover; margin-bottom: 15px; display: ${item.ilustracao_url ? 'block' : 'none'};">
                    <h3 style="color: #d4af37;">${item.titulo}</h3>
                    <p style="color: #888; font-size: 0.8em;">${item.conteudo}</p>
                `;
                card.onclick = () => abrirModalDetalhes(item);
                listaCards.appendChild(card);
            });
        }
    } catch (err) {
        console.error("Erro ao buscar itens:", err);
    }
}

function abrirModalDetalhes(item) {
    const modal = document.getElementById('modal-item-detalhes');
    if (!modal) return;

    // Capturando os elementos do Modal
    const titulo = document.getElementById('detalhe-titulo');
    const sub = document.getElementById('detalhe-sistema-categoria');
    const texto = document.getElementById('detalhe-conteudo');
    const imgElement = document.getElementById('detalhe-img');

    if (titulo) titulo.innerText = item.titulo;
    if (sub) sub.innerText = `${item.sistema} | ${item.categoria}`;
    if (texto) texto.innerText = item.conteudo;
    
    // Lógica da Imagem
    if (imgElement) {
        if (item.ilustracao_url) {
            imgElement.src = item.ilustracao_url;
            imgElement.style.display = 'block';
        } else {
            imgElement.style.display = 'none';
        }
    }
    
    modal.style.display = 'flex';
}

function fecharModais() {
    const m1 = document.getElementById('modal-categorias');
    const m2 = document.getElementById('modal-item-detalhes');
    if (m1) m1.style.display = 'none';
    if (m2) m2.style.display = 'none';
}

function voltarParaMundos() {
    const v1 = document.getElementById('view-itens');
    const v2 = document.getElementById('view-sistemas');
    if (v1) v1.style.display = 'none';
    if (v2) v2.style.display = 'block';
}

// 5. Inicialização Final (Segura e sem loops)
window.onload = function() {
    console.log("Dashboard carregado com sucesso.");
    
    const userData = localStorage.getItem('user');
    const btnForja = document.querySelector('.forja-link');

    if (userData) {
        try {
            const user = JSON.parse(userData);
            
            // SUBSTITUA PELO SEU E-MAIL REAL AQUI:
            const meuEmailMestre = 'vitorbarbosatocolli@gmail.com'; 
            
            const ehAdmin = (user.cargo === 'admin' || user.email === meuEmailMestre);

            if (btnForja) {
                // Se for admin/mestre, mostra. Se não, esconde.
                btnForja.style.display = ehAdmin ? 'block' : 'none';
                console.log("Acesso verificado. Admin:", ehAdmin);
            }
        } catch (e) {
            console.error("Erro ao processar dados do usuário:", e);
        }
    } else {
        console.warn("Usuário deslogado.");
        if (btnForja) btnForja.style.display = 'none';
    }
},

function carregarTema(sistema) {
    // 1. Procura se já existe um estilo de tema e remove
    const temaAntigo = document.getElementById('tema-sistema');
    if (temaAntigo) temaAntigo.remove();

    // 2. Cria o link para o novo CSS
    const link = document.createElement('link');
    link.id = 'tema-sistema';
    link.rel = 'stylesheet';

    // 3. Define qual arquivo carregar baseado no nome
    if (sistema === "Cavaleiros de Armadura") {
        link.href = 'css/cavaleiros.css';
    } else if (sistema === "Oceano Estrelado") {
        link.href = 'css/oceano.css';
    } else if (sistema === "Decadência Cinza") {
        link.href = 'css/decadencia.css';
    }
   
}

// --- MOTOR DE LOGIN E REGISTRO ---

// 1. Função de Login
const formLogin = document.getElementById('loginForm'); // O ID do <form> de login no seu HTML
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value; // ID do campo email
        const senha = document.getElementById('loginSenha').value; // ID do campo senha

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha })
            });

            const data = await response.json();
            if (response.ok) {
                // Salva o usuário no localStorage para a linha 160 achar ele depois
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('token', data.token);
                window.location.href = '/dashboard';
            } else {
                alert(data.error || 'Erro no login');
            }
        } catch (err) {
            console.error("Erro ao conectar na API:", err);
        }
    });
}

// 2. Função de Registro
const formRegistro = document.getElementById('registerForm'); // O ID do <form> de registro
if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('regNome').value;
        const email = document.getElementById('regEmail').value;
        const senha = document.getElementById('regSenha').value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, email, senha })
            });

            if (response.ok) {
                alert("Cadastro realizado! Agora entre com sua conta.");
                location.reload(); // Recarrega para você logar
            } else {
                const data = await response.json();
                alert(data.error || 'Erro no registro');
            }
        } catch (err) {
            console.error("Erro ao registrar:", err);
        }
    });
}