// backend/src/controllers/adminController.js
const { pool } = require('../config/database');

// Listar atividades recentes das fichas
async function listarAtividades(req, res) {
  try {
    const limite = parseInt(req.query.limite) || 100;
    const pagina = parseInt(req.query.pagina) || 1;
    const offset = (pagina - 1) * limite;
    const usuario_id = req.query.usuario_id || null;
    const ficha_id   = req.query.ficha_id   || null;

    let where = '';
    const params = [];
    if (usuario_id) { where += ' AND a.usuario_id = ?'; params.push(usuario_id); }
    if (ficha_id)   { where += ' AND a.ficha_id = ?';   params.push(ficha_id); }

    const [rows] = await pool.execute(
      `SELECT a.*, u.avatar_url as usuario_avatar
       FROM atividades_fichas a
       LEFT JOIN users u ON a.usuario_id = u.id
       WHERE 1=1 ${where}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limite, offset]
    );

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) as total FROM atividades_fichas a WHERE 1=1 ${where}`,
      params
    );

    return res.json({ success: true, atividades: rows, total, pagina, limite });
  } catch (err) {
    console.error('Erro ao listar atividades:', err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

// Estatísticas gerais para o painel
async function estatisticas(req, res) {
  try {
    const [[{ totalFichas }]]   = await pool.execute('SELECT COUNT(*) as totalFichas FROM fichas WHERE ativo = 1');
    const [[{ totalUsers }]]    = await pool.execute('SELECT COUNT(*) as totalUsers FROM users');
    const [[{ totalDocs }]]     = await pool.execute('SELECT COUNT(*) as totalDocs FROM documentos');
    const [[{ totalAtividades}]]= await pool.execute('SELECT COUNT(*) as totalAtividades FROM atividades_fichas');
    const [atividadesHoje]      = await pool.execute(
      `SELECT COUNT(*) as total FROM atividades_fichas WHERE DATE(created_at) = CURDATE()`
    );
    const [jogadoresAtivos]     = await pool.execute(
      `SELECT COUNT(DISTINCT usuario_id) as total FROM atividades_fichas
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );
    return res.json({
      success: true,
      stats: {
        totalFichas,
        totalUsers,
        totalDocs,
        totalAtividades,
        atividadesHoje: atividadesHoje[0].total,
        jogadoresAtivos7d: jogadoresAtivos[0].total,
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
}

module.exports = { listarAtividades, estatisticas };
