// backend/src/middlewares/auth.js
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token não fornecido. Acesso negado.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role, nome }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado. Faça login novamente.',
        expired: true,
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Token inválido.',
    });
  }
}

// Como authMiddleware, mas NÃO bloqueia: sem token (ou token inválido/expirado) segue como
// visitante anônimo. Usado nas rotas públicas da wiki, que filtram o conteúdo pelo papel.
function optionalAuth(req, _res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch {
      req.user = undefined;
    }
  }
  next();
}

function mestreOnly(req, res, next) {
  if (req.user?.role !== 'mestre') {
    return res.status(403).json({
      success: false,
      message: 'Acesso restrito ao Mestre.',
    });
  }
  next();
}

module.exports = { authMiddleware, optionalAuth, mestreOnly };
