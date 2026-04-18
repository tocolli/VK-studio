// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const { registrar, login, perfil } = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/auth');

router.post('/registrar', registrar);
router.post('/login', login);
router.get('/perfil', authMiddleware, perfil);

module.exports = router;
