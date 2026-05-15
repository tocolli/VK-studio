// backend/src/socket.js
// Motor de tempo real do Tabletop VK.Studio
// Todos os eventos passam aqui — arquitetado para extensão futura

const jwt   = require('jsonwebtoken');
const { pool } = require('./config/database');

// Salas ativas em memória: { salaId: { usuarios: Map, mapa: obj, fog: obj } }
const SALAS = new Map();

function iniciarSocket(io) {

  // ── AUTENTICAÇÃO DO SOCKET ──────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token ausente.'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { id, nome, email, role }
      next();
    } catch {
      next(new Error('Token inválido.'));
    }
  });

  io.on('connection', (socket) => {
    const user     = socket.user;
    const isMestre = user.role === 'mestre';
    let salaSessao = null; // ID da sessão em que este socket está

    console.log(`🔌 [Mesa] ${user.nome} conectou`);

    // ── ENTRAR NA SALA ─────────────────────────────────────────────────
    socket.on('mesa:entrar', async ({ codigo }) => {
      try {
        const [rows] = await pool.execute(
          `SELECT s.*, m.imagem_url as mapa_url, m.largura_grid, m.altura_grid,
                  m.tamanho_cel, m.id as mapa_id, m.nome as mapa_nome
           FROM sessoes_mesa s
           LEFT JOIN mapas_mesa m ON s.mapa_ativo_id = m.id
           WHERE s.codigo = ? AND s.status != 'encerrada'`,
          [codigo]
        );

        if (!rows.length) {
          socket.emit('mesa:erro', { msg: 'Sessão não encontrada ou encerrada.' });
          return;
        }

        const sessao = rows[0];
        salaSessao   = String(sessao.id);

        // Inicializa sala em memória se não existir
        if (!SALAS.has(salaSessao)) {
          SALAS.set(salaSessao, {
            sessao,
            usuarios: new Map(),
          });
        }

        const sala = SALAS.get(salaSessao);
        sala.usuarios.set(socket.id, {
          id: user.id, nome: user.nome, role: user.role, socketId: socket.id
        });

        socket.join(salaSessao);

        // Envia estado inicial para quem entrou
        socket.emit('mesa:estado_inicial', {
          sessao,
          usuarios: [...sala.usuarios.values()],
        });

        // Carrega tokens do mapa ativo
        if (sessao.mapa_id) {
          const [tokens] = await pool.execute(
            'SELECT * FROM tokens_mesa WHERE sessao_id = ? AND mapa_id = ?',
            [salaSessao, sessao.mapa_id]
          );
          socket.emit('tokens:lista', { tokens });

          // Carrega fog
          const [fog] = await pool.execute(
            'SELECT celulas FROM fog_of_war WHERE sessao_id = ? AND mapa_id = ?',
            [salaSessao, sessao.mapa_id]
          );
          if (fog.length) {
            socket.emit('fog:atualizado', { celulas: JSON.parse(fog[0].celulas) });
          }
        }

        // Carrega chat recente
        const [msgs] = await pool.execute(
          `SELECT m.*, u.avatar_url FROM mensagens_chat m
           JOIN users u ON m.usuario_id = u.id
           WHERE m.sessao_id = ? AND (m.tipo != 'privado' OR m.usuario_id = ?)
           ORDER BY m.created_at ASC LIMIT 100`,
          [salaSessao, user.id]
        );
        socket.emit('chat:historico', { mensagens: msgs });

        // Avisa os outros que alguém entrou
        socket.to(salaSessao).emit('mesa:usuario_entrou', {
          usuario: { id: user.id, nome: user.nome, role: user.role }
        });

        // Mensagem de sistema no chat
        await emitirSistema(io, salaSessao, `${user.nome} entrou na mesa.`);

      } catch (err) {
        console.error('[mesa:entrar]', err);
        socket.emit('mesa:erro', { msg: 'Erro ao entrar na sessão.' });
      }
    });

    // ── TROCAR MAPA (só mestre) ────────────────────────────────────────
    socket.on('mapa:selecionar', async ({ sessaoId, mapaId }) => {
      if (!isMestre) return;
      try {
        await pool.execute(
          'UPDATE sessoes_mesa SET mapa_ativo_id = ? WHERE id = ?',
          [mapaId, sessaoId]
        );

        const [mapas] = await pool.execute(
          'SELECT * FROM mapas_mesa WHERE id = ?', [mapaId]
        );
        if (!mapas.length) return;
        const mapa = mapas[0];

        // Carrega tokens deste mapa
        const [tokens] = await pool.execute(
          'SELECT * FROM tokens_mesa WHERE sessao_id = ? AND mapa_id = ?',
          [sessaoId, mapaId]
        );

        // Carrega fog
        const [fogRows] = await pool.execute(
          'SELECT celulas FROM fog_of_war WHERE sessao_id = ? AND mapa_id = ?',
          [sessaoId, mapaId]
        );
        const celulas = fogRows.length ? JSON.parse(fogRows[0].celulas) : null;

        // Emite para toda a sala
        io.to(String(sessaoId)).emit('mapa:trocado', { mapa, tokens, celulas });
        await emitirSistema(io, String(sessaoId), `Mapa alterado para: ${mapa.nome}`);

      } catch (err) {
        console.error('[mapa:selecionar]', err);
      }
    });

    // ── TOKENS ────────────────────────────────────────────────────────
    socket.on('token:mover', async ({ tokenId, pos_x, pos_y, sessaoId }) => {
      try {
        // Qualquer um pode mover (validação de posse pode ser adicionada depois)
        await pool.execute(
          'UPDATE tokens_mesa SET pos_x=?, pos_y=? WHERE id=?',
          [pos_x, pos_y, tokenId]
        );
        io.to(String(sessaoId)).emit('token:movido', { tokenId, pos_x, pos_y });
      } catch (err) {
        console.error('[token:mover]', err);
      }
    });

    socket.on('token:criar', async ({ sessaoId, mapaId, dados }) => {
      if (!isMestre) return;
      try {
        const [result] = await pool.execute(
          `INSERT INTO tokens_mesa
             (sessao_id, mapa_id, nome, imagem_url, pos_x, pos_y, tamanho, cor, hp_atual, hp_max, ficha_id, jogador_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sessaoId, mapaId,
           dados.nome, dados.imagem_url||null,
           dados.pos_x||0, dados.pos_y||0,
           dados.tamanho||1, dados.cor||'#c9a84c',
           dados.hp_atual||10, dados.hp_max||10,
           dados.ficha_id||null, dados.jogador_id||null]
        );
        const [token] = await pool.execute('SELECT * FROM tokens_mesa WHERE id=?', [result.insertId]);
        io.to(String(sessaoId)).emit('token:criado', { token: token[0] });
      } catch (err) {
        console.error('[token:criar]', err);
      }
    });

    socket.on('token:atualizar', async ({ sessaoId, tokenId, dados }) => {
      if (!isMestre) return;
      try {
        const campos = Object.entries(dados)
          .filter(([k]) => ['nome','cor','hp_atual','hp_max','visivel','tamanho'].includes(k))
          .map(([k]) => `${k}=?`).join(',');
        const vals = Object.entries(dados)
          .filter(([k]) => ['nome','cor','hp_atual','hp_max','visivel','tamanho'].includes(k))
          .map(([,v]) => v);
        if (!campos) return;
        await pool.execute(`UPDATE tokens_mesa SET ${campos} WHERE id=?`, [...vals, tokenId]);
        io.to(String(sessaoId)).emit('token:atualizado', { tokenId, dados });
      } catch (err) {
        console.error('[token:atualizar]', err);
      }
    });

    socket.on('token:deletar', async ({ sessaoId, tokenId }) => {
      if (!isMestre) return;
      try {
        await pool.execute('DELETE FROM tokens_mesa WHERE id=?', [tokenId]);
        io.to(String(sessaoId)).emit('token:deletado', { tokenId });
      } catch (err) {
        console.error('[token:deletar]', err);
      }
    });

    // ── ALTERAÇÃO DE FICHA (jogador salva → notifica mestre) ──────────
    socket.on('ficha:alterada', async ({ sessaoId, jogadorId, jogadorNome, fichaId, personagem, resumo }) => {
      // Repassa para toda a sala (o mestre vê no chat de sistema)
      socket.to(String(sessaoId)).emit('ficha:alterada', {
        jogadorId, jogadorNome, fichaId, personagem, resumo,
      });

      // Registra no log de atividades (tabela que já existe)
      try {
        const mudancas = [];
        if (resumo?.vit) mudancas.push(`Vida ${resumo.vit[0]}/${resumo.vit[1]}`);
        if (resumo?.imp) mudancas.push(`Ímpeto ${resumo.imp[0]}/${resumo.imp[1]}`);
        if (resumo?.luc) mudancas.push(`Lucidez ${resumo.luc[0]}/${resumo.luc[1]}`);

        await pool.execute(
          `INSERT INTO atividades_fichas
             (usuario_id, usuario_nome, ficha_id, personagem_nome, campo, valor_anterior, valor_novo)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [jogadorId, jogadorNome, fichaId, personagem,
           'mesa (tabletop)', '—', mudancas.join(' · ')]
        );
      } catch (e) {
        console.error('[ficha:alterada] log falhou:', e.message);
      }
    });

    // ── FOG OF WAR ────────────────────────────────────────────────────
    socket.on('fog:atualizar', async ({ sessaoId, mapaId, celulas }) => {
      if (!isMestre) return;
      try {
        const celStr = JSON.stringify(celulas);
        await pool.execute(
          `INSERT INTO fog_of_war (sessao_id, mapa_id, celulas)
           VALUES (?,?,?) ON DUPLICATE KEY UPDATE celulas=VALUES(celulas)`,
          [sessaoId, mapaId, celStr]
        );
        // Mestre vê tudo, jogadores veem com fog
        socket.to(String(sessaoId)).emit('fog:atualizado', { celulas });
        socket.emit('fog:atualizado_mestre', { celulas }); // sem fog pra mestre
      } catch (err) {
        console.error('[fog:atualizar]', err);
      }
    });

    // Mestre revela/cobre célula individual
    socket.on('fog:celula', async ({ sessaoId, mapaId, row, col, valor }) => {
      if (!isMestre) return;
      try {
        const [fogRows] = await pool.execute(
          'SELECT celulas FROM fog_of_war WHERE sessao_id=? AND mapa_id=?',
          [sessaoId, mapaId]
        );
        if (!fogRows.length) return;
        const celulas = JSON.parse(fogRows[0].celulas);
        if (celulas[row]) celulas[row][col] = valor; // 0=revelado, 1=coberto
        const celStr = JSON.stringify(celulas);
        await pool.execute(
          'UPDATE fog_of_war SET celulas=? WHERE sessao_id=? AND mapa_id=?',
          [celStr, sessaoId, mapaId]
        );
        socket.to(String(sessaoId)).emit('fog:celula_atualizada', { row, col, valor });
        socket.emit('fog:celula_atualizada', { row, col, valor });
      } catch (err) {
        console.error('[fog:celula]', err);
      }
    });

    // ── CHAT E ROLAGENS ───────────────────────────────────────────────
    socket.on('chat:mensagem', async ({ sessaoId, texto }) => {
      if (!texto?.trim()) return;
      try {
        const [result] = await pool.execute(
          'INSERT INTO mensagens_chat (sessao_id, usuario_id, nome, tipo, conteudo) VALUES (?,?,?,?,?)',
          [sessaoId, user.id, user.nome, 'texto', texto.trim()]
        );
        const msg = {
          id: result.insertId, usuario_id: user.id, nome: user.nome,
          tipo: 'texto', conteudo: texto.trim(),
          created_at: new Date().toISOString(),
        };
        io.to(String(sessaoId)).emit('chat:nova_mensagem', msg);
      } catch (err) {
        console.error('[chat:mensagem]', err);
      }
    });

    socket.on('chat:rolar', async ({ sessaoId, expressao, privado }) => {
      try {
        const resultado = rolarDados(expressao);
        if (!resultado) {
          socket.emit('chat:erro', { msg: `Expressão inválida: ${expressao}` });
          return;
        }

        const tipo    = (privado && isMestre) ? 'privado' : 'rolagem';
        const conteudo = `${user.nome} rolou ${expressao}`;
        const dados_rol = JSON.stringify(resultado);

        const [result] = await pool.execute(
          'INSERT INTO mensagens_chat (sessao_id, usuario_id, nome, tipo, conteudo, dados_rol) VALUES (?,?,?,?,?,?)',
          [sessaoId, user.id, user.nome, tipo, conteudo, dados_rol]
        );

        const msg = {
          id: result.insertId, usuario_id: user.id, nome: user.nome,
          tipo, conteudo, dados_rol: resultado,
          created_at: new Date().toISOString(),
        };

        if (tipo === 'privado') {
          // Só o mestre vê
          socket.emit('chat:nova_mensagem', { ...msg, privado: true });
        } else {
          io.to(String(sessaoId)).emit('chat:nova_mensagem', msg);
        }
      } catch (err) {
        console.error('[chat:rolar]', err);
      }
    });

    // ── PING de status ────────────────────────────────────────────────
    socket.on('mesa:ping', () => socket.emit('mesa:pong'));

    // ── DESCONEXÃO ────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 [Mesa] ${user.nome} desconectou`);
      if (salaSessao && SALAS.has(salaSessao)) {
        const sala = SALAS.get(salaSessao);
        sala.usuarios.delete(socket.id);
        if (!sala.usuarios.size) SALAS.delete(salaSessao);
        io.to(salaSessao).emit('mesa:usuario_saiu', { usuario: { id: user.id, nome: user.nome } });
      }
    });
  });
}

// ── PARSER DE DADOS ──────────────────────────────────────────────────
// Suporta: 1d10, 2d6+3, 1d20-2, 3d4*2, d10, 10
function rolarDados(expressao) {
  try {
    const expr = expressao.trim().toLowerCase().replace(/\s/g, '');

    // Regex: [N]dM[+-*/N]
    const match = expr.match(/^(\d*)d(\d+)([+\-*/]\d+)?$/);

    if (!match && /^\d+$/.test(expr)) {
      // Número fixo
      return { expressao, dados: [], total: parseInt(expr), mod: 0, tipo: 'fixo' };
    }

    if (!match) return null;

    const qtd   = parseInt(match[1]) || 1;
    const faces = parseInt(match[2]);
    const modStr= match[3] || '';

    if (qtd < 1 || qtd > 50 || faces < 2 || faces > 1000) return null;

    const resultados = Array.from({ length: qtd }, () =>
      Math.floor(Math.random() * faces) + 1
    );
    const soma = resultados.reduce((a, b) => a + b, 0);

    let total = soma;
    let mod   = 0;
    if (modStr) {
      mod = parseInt(modStr);
      total = soma + mod;
    }

    const critico  = resultados.some(r => r === faces);
    const desastre = resultados.some(r => r === 1);

    return { expressao, dados: resultados, soma, total, mod, faces, qtd, critico, desastre, tipo: 'dado' };
  } catch {
    return null;
  }
}

async function emitirSistema(io, sessaoId, texto) {
  try {
    // Não salva mensagens de sistema no banco para não poluir o chat
    io.to(sessaoId).emit('chat:nova_mensagem', {
      tipo: 'sistema', conteudo: texto,
      created_at: new Date().toISOString(),
    });
  } catch {}
}

module.exports = { iniciarSocket };
