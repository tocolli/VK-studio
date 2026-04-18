// frontend/js/api.js
// Utilitário central de chamadas à API com JWT

const API_BASE = '/api';

const Api = {
  // === TOKEN ===
  getToken() {
    return localStorage.getItem('vk_token');
  },

  getUser() {
    try {
      const raw = localStorage.getItem('vk_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  setSession(token, usuario) {
    localStorage.setItem('vk_token', token);
    localStorage.setItem('vk_user', JSON.stringify(usuario));
  },

  clearSession() {
    localStorage.removeItem('vk_token');
    localStorage.removeItem('vk_user');
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  // === FETCH CENTRAL ===
  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = { ...options.headers };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = { ...options, headers };
    if (options.body && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    }

    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json();

    // Token expirado → redireciona para login sem loop
    if (res.status === 401 && data.expired) {
      this.clearSession();
      if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = '/';
      }
      return null;
    }

    return { ok: res.ok, status: res.status, data };
  },

  // === AUTH ===
  async login(email, senha) {
    return this.request('/auth/login', {
      method: 'POST',
      body: { email, senha },
    });
  },

  async registrar(nome, email, senha) {
    return this.request('/auth/registrar', {
      method: 'POST',
      body: { nome, email, senha },
    });
  },

  async perfil() {
    return this.request('/auth/perfil');
  },

  // === DOCUMENTOS ===
  async listarDocumentos() {
    return this.request('/documentos');
  },

  async criarDocumento(formData) {
    return this.request('/documentos', { method: 'POST', body: formData });
  },

  async atualizarDocumento(id, formData) {
    return this.request(`/documentos/${id}`, { method: 'PUT', body: formData });
  },

  async deletarDocumento(id) {
    return this.request(`/documentos/${id}`, { method: 'DELETE' });
  },

  // === FICHAS ===
  async listarFichas() {
    return this.request('/fichas');
  },

  async criarFicha(formData) {
    return this.request('/fichas', { method: 'POST', body: formData });
  },

  async atualizarFicha(id, formData) {
    return this.request(`/fichas/${id}`, { method: 'PUT', body: formData });
  },

  async deletarFicha(id) {
    return this.request(`/fichas/${id}`, { method: 'DELETE' });
  },
};

// Exporta globalmente
window.Api = Api;
