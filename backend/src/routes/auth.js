// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const { registrar, login, perfil, atualizarAvatar, listarUsuarios } = require('../controllers/authController');
const reset = require('../controllers/passwordResetController');
const { authMiddleware, mestreOnly } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

router.post('/registrar', registrar);
router.post('/login', login);
// Recuperação de senha por e-mail (rotas públicas)
router.post('/esqueci-senha', reset.esqueciSenha);
router.get('/redefinir-senha/validar', reset.validarToken);
router.post('/redefinir-senha', reset.redefinirSenha);
router.get('/perfil', authMiddleware, perfil);
router.post('/avatar', authMiddleware, upload.single('avatar'), atualizarAvatar);
router.get('/usuarios', authMiddleware, mestreOnly, listarUsuarios);

module.exports = router;
