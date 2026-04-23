// frontend/js/api.js
const API_BASE = '/api';

const Api = {
  getToken()  { return localStorage.getItem('vk_token'); },
  getUser()   { try { return JSON.parse(localStorage.getItem('vk_user')); } catch { return null; } },
  setSession(token, usuario) {
    localStorage.setItem('vk_token', token);
    localStorage.setItem('vk_user', JSON.stringify(usuario));
  },
  clearSession() { localStorage.removeItem('vk_token'); localStorage.removeItem('vk_user'); },
  isLoggedIn() { return !!this.getToken(); },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = { ...options.headers };
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const config = { ...options, headers };
    if (options.body && !(options.body instanceof FormData)) config.body = JSON.stringify(options.body);
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json();
    if (res.status === 401 && data.expired) {
      this.clearSession();
      if (window.location.pathname !== '/') window.location.replace('/');
      return null;
    }
    return { ok: res.ok, status: res.status, data };
  },

  // AUTH
  async login(email, senha)          { return this.request('/auth/login',     { method:'POST', body:{email,senha} }); },
  async registrar(nome, email, senha){ return this.request('/auth/registrar', { method:'POST', body:{nome,email,senha} }); },
  async perfil()                     { return this.request('/auth/perfil'); },
  async atualizarAvatar(fd)          { return this.request('/auth/avatar',    { method:'POST', body:fd }); },
  async listarUsuarios()             { return this.request('/auth/usuarios'); },

  // DOCUMENTOS
  async listarDocumentos(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/documentos${qs ? '?'+qs : ''}`);
  },
  async criarDocumento(fd)         { return this.request('/documentos',      { method:'POST',   body:fd }); },
  async atualizarDocumento(id, fd) { return this.request(`/documentos/${id}`,{ method:'PUT',    body:fd }); },
  async deletarDocumento(id)       { return this.request(`/documentos/${id}`,{ method:'DELETE'       }); },

  // FICHAS
  async listarFichas()             { return this.request('/fichas'); },
  async criarFicha(fd)             { return this.request('/fichas',      { method:'POST',  body:fd }); },
  async atualizarFicha(id, fd)     { return this.request(`/fichas/${id}`,{ method:'PUT',   body:fd }); },
  async deletarFicha(id)           { return this.request(`/fichas/${id}`,{ method:'DELETE'       }); },

  // ADMIN
  async listarAtividades(params={}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/admin/atividades${qs ? '?'+qs : ''}`);
  },
  async estatisticas() { return this.request('/admin/estatisticas'); },
};

window.Api = Api;
