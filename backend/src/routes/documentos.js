// backend/src/routes/documentos.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/documentoController');
const { authMiddleware, mestreOnly } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

router.get('/sistemas', authMiddleware, ctrl.getSistemas);
router.get('/', authMiddleware, ctrl.listar);
router.get('/:id', authMiddleware, ctrl.buscarPorId);
router.post('/', authMiddleware, mestreOnly, upload.single('imagem'), ctrl.criar);
router.put('/:id', authMiddleware, mestreOnly, upload.single('imagem'), ctrl.atualizar);
router.delete('/:id', authMiddleware, mestreOnly, ctrl.deletar);

module.exports = router;
