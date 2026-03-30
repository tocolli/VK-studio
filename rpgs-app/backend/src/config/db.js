const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false } // Aiven exige SSL
});

// Teste de conexão para o log do Render
pool.getConnection((err, connection) => {
    if (err) {
        console.error("❌ ERRO NO BANCO:", err.message);
    } else {
        console.log("✅ CONECTADO AO AIVEN COM SUCESSO!");
        connection.release();
    }
});

// CRITICAL: Exportar com .promise() para o Express 5/Async-Await funcionar
module.exports = pool.promise();