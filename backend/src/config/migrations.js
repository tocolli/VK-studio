// backend/src/config/migrations.js
// Migrações versionadas. Cada migração roda uma única vez por banco e fica registrada em
// schema_migrations. Para mudar o banco daqui em diante: ADICIONE uma migração no fim da lista
// (nunca edite uma que já rodou em produção).

const CHARSET = 'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';

const MIGRATIONS = [
  {
    id: '001_wiki',
    descricao: 'Wiki estilo Obsidian: páginas, links entre páginas e linha do tempo',
    async up(conn) {
      await conn.execute(`CREATE TABLE IF NOT EXISTS wiki_paginas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(190) NOT NULL,
        titulo VARCHAR(200) NOT NULL,
        conteudo LONGTEXT,
        pasta VARCHAR(190) NOT NULL DEFAULT '',
        visibilidade ENUM('publico','jogador','mestre') NOT NULL DEFAULT 'jogador',
        autor_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_wiki_slug (slug),
        INDEX idx_wiki_pasta (pasta),
        INDEX idx_wiki_visibilidade (visibilidade),
        FOREIGN KEY (autor_id) REFERENCES users(id) ON DELETE SET NULL
      ) ${CHARSET}`);

      // destino_slug NÃO é chave estrangeira de propósito: o link pode apontar para uma página
      // que ainda não existe (link "vermelho" do Obsidian) e passa a valer quando ela for criada.
      await conn.execute(`CREATE TABLE IF NOT EXISTS wiki_links (
        origem_id INT NOT NULL,
        destino_slug VARCHAR(190) NOT NULL,
        texto VARCHAR(190) NOT NULL,
        PRIMARY KEY (origem_id, destino_slug),
        INDEX idx_wiki_links_destino (destino_slug),
        FOREIGN KEY (origem_id) REFERENCES wiki_paginas(id) ON DELETE CASCADE
      ) ${CHARSET}`);

      await conn.execute(`CREATE TABLE IF NOT EXISTS wiki_eventos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(200) NOT NULL,
        descricao TEXT,
        era VARCHAR(120) NOT NULL DEFAULT '',
        data_texto VARCHAR(120) NOT NULL DEFAULT '',
        ordem INT NOT NULL DEFAULT 0,
        pagina_slug VARCHAR(190) NULL,
        visibilidade ENUM('publico','jogador','mestre') NOT NULL DEFAULT 'jogador',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_wiki_eventos_ordem (ordem)
      ) ${CHARSET}`);
    },
  },
  {
    id: '002_wiki_revisoes',
    descricao: 'Histórico de edições da wiki (rede de segurança para quem edita direto pelo site)',
    async up(conn) {
      // pagina_slug NÃO é chave estrangeira de propósito: o histórico sobrevive à exclusão da página,
      // e assim dá para restaurar uma página apagada por engano.
      await conn.execute(`CREATE TABLE IF NOT EXISTS wiki_revisoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pagina_slug VARCHAR(190) NOT NULL,
        titulo VARCHAR(200) NOT NULL,
        conteudo LONGTEXT,
        pasta VARCHAR(190) NOT NULL DEFAULT '',
        visibilidade ENUM('publico','jogador','mestre') NOT NULL DEFAULT 'jogador',
        acao ENUM('editou','excluiu') NOT NULL DEFAULT 'editou',
        editor_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_wiki_rev_slug (pagina_slug, id),
        FOREIGN KEY (editor_id) REFERENCES users(id) ON DELETE SET NULL
      ) ${CHARSET}`);
    },
  },
];

async function runMigrations(conn) {
  await conn.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  const [feitas] = await conn.execute('SELECT id FROM schema_migrations');
  const jaRodou = new Set(feitas.map(r => r.id));

  for (const m of MIGRATIONS) {
    if (jaRodou.has(m.id)) continue;
    console.log(`⏳ Migração ${m.id}: ${m.descricao}`);
    await m.up(conn);
    await conn.execute('INSERT INTO schema_migrations (id) VALUES (?)', [m.id]);
    console.log(`✅ Migração ${m.id} aplicada`);
  }
}

module.exports = { runMigrations, MIGRATIONS };
