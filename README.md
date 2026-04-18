# ⚔ VK.Studio — Plataforma de Gestão de RPG

**Universo:** Decadência Cinza  
**Stack:** Node.js + Express + MySQL (Aiven) + Vanilla JS

---

## 📁 Estrutura de Pastas

```
/vkstudio
  /frontend
    /css          → style.css, login.css, dashboard.css, forja.css
    /js           → api.js, auth-guard.js, login.js, dashboard.js, forja.js
    /img          → imagens estáticas
    index.html    → Página de Login/Registro
    dashboard.html → Câmara do Mestre / Painel do Jogador
    forja.html    → Criação e edição de fichas de personagem
  /backend
    /src
      /config     → database.js, cloudinary.js
      /controllers → authController.js, documentoController.js, fichaController.js
      /middlewares → auth.js (JWT)
      /routes     → auth.js, documentos.js, fichas.js
      server.js   → Entrada principal
  package.json
  .env            → Variáveis de ambiente (NÃO commitar!)
  .env.example    → Modelo das variáveis
```

---

## 🚀 Configuração e Deploy

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```env
DB_HOST=seu-host.aivencloud.com
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=vkstudio
DB_PORT=3306

CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME

JWT_SECRET=uma_string_longa_e_aleatoria_aqui

PORT=10000
NODE_ENV=production
```

### 3. Rodar localmente

```bash
npm run dev   # Desenvolvimento (nodemon)
npm start     # Produção
```

### 4. Deploy no Render

- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment:** Node
- Configure as variáveis de ambiente no painel do Render

---

## 🔐 Sistema de Autenticação (Anti-Loop)

### Como funciona:

1. `index.html` (login) → Carrega `login.js`
   - Se já existe token no localStorage → redireciona para `/dashboard` **imediatamente** (sem verificar no servidor)
   - Evita loop: não há verificação circular

2. `dashboard.html` e `forja.html` → Carregam `auth-guard.js` **antes** de qualquer outro script
   - Se não há token → `window.location.replace('/')` + `throw Error` (para execução)
   - Se há token → expõe `window.VK` com dados do usuário
   - `replace()` (em vez de `href`) impede voltar no histórico e criar loop

3. Backend: `authMiddleware` valida o JWT em todas as rotas protegidas
   - Token expirado retorna `{ expired: true }` — o `Api.js` captura e redireciona

### Fluxo seguro:
```
Usuário acessa /dashboard
  → auth-guard.js verifica localStorage
    → Sem token? → replace('/') → index.html
    → Com token? → página carrega normalmente
```

---

## 👑 Usuário Mestre

O e-mail `vitorbarbosatocolli@gmail.com` **sempre** recebe a role `mestre` ao registrar ou fazer login.

O Mestre tem acesso a:
- Criar, editar e deletar **documentos/lore**
- Ver **todos** os documentos (públicos e privados)
- Ver **todas** as fichas de personagem
- Visualizar estatísticas no dashboard

---

## 📊 Banco de Dados

As tabelas são criadas automaticamente na primeira inicialização:

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários (mestre e jogadores) |
| `documentos` | Lore, regras, NPCs, locais |
| `fichas` | Fichas de personagem com atributos em JSON |
| `sessoes` | Sessões de jogo (agendadas/realizadas) |

---

## 🎨 Design

- **Tema:** Dark Fantasy / Grimório
- **Fontes:** Cinzel Decorative (display), Cinzel (headings), Crimson Text (body)
- **Cores:** Fundo `#0e0e0f`, dourado fosco `#c9a84c`, bordas `#2a2820`
- **Responsivo:** Mobile-first com breakpoints em 640px e 900px

---

## 🔌 Endpoints da API

### Auth
- `POST /api/auth/registrar` — Criar conta
- `POST /api/auth/login` — Login
- `GET  /api/auth/perfil` — Perfil (autenticado)

### Documentos
- `GET    /api/documentos` — Listar (autenticado)
- `GET    /api/documentos/:id` — Detalhe (autenticado)
- `POST   /api/documentos` — Criar (só mestre)
- `PUT    /api/documentos/:id` — Editar (só mestre)
- `DELETE /api/documentos/:id` — Deletar (só mestre)

### Fichas
- `GET    /api/fichas` — Listar (mestre vê todas, jogador vê as suas)
- `GET    /api/fichas/:id` — Detalhe (autenticado)
- `POST   /api/fichas` — Criar (autenticado)
- `PUT    /api/fichas/:id` — Editar (autenticado)
- `DELETE /api/fichas/:id` — Arquivar (só mestre)

### Health
- `GET /api/health` — Status do servidor

---

## 📦 Dependências Principais

| Pacote | Uso |
|--------|-----|
| `express` | Framework web |
| `mysql2` | Conexão MySQL com suporte a async/await |
| `bcryptjs` | Hash de senhas |
| `jsonwebtoken` | Geração e verificação de JWT |
| `cloudinary` | Upload de imagens |
| `multer` + `multer-storage-cloudinary` | Middleware de upload |
| `cors` | Permitir requisições cross-origin |
| `dotenv` | Leitura de variáveis de ambiente |
