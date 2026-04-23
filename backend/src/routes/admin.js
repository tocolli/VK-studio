// backend/src/routes/admin.js
const express = require('express');
const router = express.Router();
const { listarAtividades, estatisticas } = require('../controllers/adminController');
const { authMiddleware, mestreOnly } = require('../middlewares/auth');

router.get('/atividades',   authMiddleware, mestreOnly, listarAtividades);
router.get('/estatisticas', authMiddleware, mestreOnly, estatisticas);

module.exports = router;
