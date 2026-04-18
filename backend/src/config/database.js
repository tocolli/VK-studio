// backend/src/config/database.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 3306,
  ssl: { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 20000,
});

async function initializeDatabase() {
  const conn = await pool.getConnection();
  try {
    console.log('✅ Conectado ao MySQL (Aiven)');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        senha VARCHAR(255) NOT NULL,
        role ENUM('mestre','jogador') DEFAULT 'jogador',
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS documentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(200) NOT NULL,
        conteudo LONGTEXT,
        sistema VARCHAR(100) DEFAULT 'Decadência Cinza',
        categoria VARCHAR(100) DEFAULT 'Livro de Regras',
        visibilidade ENUM('publico','privado') DEFAULT 'publico',
        autor_id INT NOT NULL,
        imagem_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (autor_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Migração segura: adiciona coluna sistema se ainda não existir (banco legado)
    try {
      await conn.execute(`ALTER TABLE documentos ADD COLUMN sistema VARCHAR(100) DEFAULT 'Decadência Cinza' AFTER conteudo`);
      console.log('✅ Coluna sistema adicionada à tabela documentos');
    } catch (e) {
      if (!e.message.includes('Duplicate column')) throw e;
    }

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS fichas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome_personagem VARCHAR(150) NOT NULL,
        jogador_id INT NOT NULL,
        sistema VARCHAR(100) DEFAULT 'Decadência Cinza',
        atributos JSON NOT NULL,
        imagem_url VARCHAR(500),
        ativo TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (jogador_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS sessoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(200) NOT NULL,
        descricao TEXT,
        data_sessao DATETIME,
        status ENUM('agendada','realizada','cancelada') DEFAULT 'agendada',
        resumo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tabelas verificadas com sucesso');
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, initializeDatabase };
