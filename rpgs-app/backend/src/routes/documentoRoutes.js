const express = require('express');
const router = express.Router();
const documentoController = require('../controllers/documentoController');
const upload = require('../config/cloudinary');

router.post('/documentos', upload.single('ilustracao'), documentoController.criar);

router.get('/documentos/:sistema/:categoria', documentoController.listarFiltrado);

router.delete('/documentos/:id', documentoController.deletar);

router.get('/documentos/todos', documentoController.listarTodosGeral);

router.get('/documentos/id/:id', documentoController.buscarPorId);

router.put('/documentos/:id', upload.single('ilustracao'), documentoController.atualizar);

module.exports = router;