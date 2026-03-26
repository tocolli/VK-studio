const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Verifique se os nomes das funções (cadastrar, login, listarTodos) 
// batem EXATAMENTE com o que está no seu authController.js
router.post('/cadastro', authController.cadastrar); 
router.post('/login', authController.login);
router.get('/usuarios', authController.listarTodos);

module.exports = router;