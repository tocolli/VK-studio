// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const { registrar, login, perfil, atualizarAvatar, listarUsuarios } = require('../controllers/authController');
const { authMiddleware, mestreOnly } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

router.post('/registrar', registrar);
router.post('/login', login);
router.get('/perfil', authMiddleware, perfil);
router.post('/avatar', authMiddleware, upload.single('avatar'), atualizarAvatar);
router.get('/usuarios', authMiddleware, mestreOnly, listarUsuarios);

module.exports = router;
