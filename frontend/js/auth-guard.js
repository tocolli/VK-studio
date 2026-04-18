// frontend/js/auth-guard.js
// Incluir em TODAS as páginas protegidas (dashboard, forja, etc.)
// Protege sem causar loops de redirecionamento

(function () {
  'use strict';

  const PUBLIC_PATHS = ['/', '/index.html'];
  const currentPath = window.location.pathname;

  // Se estamos numa página pública, não faz nada
  if (PUBLIC_PATHS.includes(currentPath)) return;

  const token = Api.getToken();
  const user = Api.getUser();

  if (!token || !user) {
    // Sem token → vai para login (replace evita loop no histórico)
    window.location.replace('/');
    // Congela o script para não executar o resto da página
    throw new Error('AUTH_REDIRECT');
  }

  // Expõe usuário globalmente para os outros scripts
  window.VK = window.VK || {};
  window.VK.user = user;
  window.VK.token = token;
  window.VK.isMestre = user.role === 'mestre';

  // Função de logout global
  window.VK.logout = function () {
    Api.clearSession();
    window.location.replace('/');
  };
})();
