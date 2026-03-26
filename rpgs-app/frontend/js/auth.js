// URL base da sua API (quando subir para o Render, mudaremos para a URL real)
const API_URL = 'https://vk-studio.onrender.com/api';

// 1. Função para virar a carta
function toggleCard() {
    const card = document.getElementById('authCard');
    card.classList.toggle('flipped');
}

// 2. Lógica de CADASTRO
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('regNome').value;
    const email = document.getElementById('regEmail').value;
    const senha = document.getElementById('regSenha').value;
    const confirmaSenha = document.getElementById('regConfirma').value;

    // Validação básica de senha no lado do cliente
    if (senha !== confirmaSenha) {
        alert("As senhas não coincidem, mestre!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/cadastro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha, confirmaSenha })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            toggleCard(); // Volta para a face de login após cadastrar
        } else {
            alert(data.error || "Erro ao forjar conta.");
        }
    } catch (err) {
        console.error("Erro na conexão:", err);
        alert("O servidor de cinzas parece estar offline.");
    }
});

// 3. Lógica de LOGIN
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json();

        if (response.ok) {
            // SALVAR DADOS NO NAVEGADOR
            // O token é o que mantém você logado
            localStorage.setItem('token', data.token);
            localStorage.setItem('userCargo', data.user.cargo);
            localStorage.setItem('userNome', data.user.nome);

            alert(`Bem-vindo, ${data.user.nome}!`);

            // Redirecionamento baseado no cargo
            if (data.user.cargo === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        } else {
            alert(data.error || "Credenciais inválidas.");
        }
    } catch (err) {
        console.error("Erro na conexão:", err);
        alert("Falha ao contatar o grande servidor.");
    }
});