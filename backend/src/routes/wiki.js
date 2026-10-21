// backend/src/routes/wiki.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/wikiController');
const { authMiddleware, optionalAuth, mestreOnly } = require('../middlewares/auth');

// Leitura: aberta a todos, mas o conteúdo é filtrado pelo papel (anônimo / jogador / mestre)
router.get('/paginas',        optionalAuth, ctrl.listarPaginas);
router.get('/paginas/:slug',  optionalAuth, ctrl.obterPagina);
router.get('/grafo',          optionalAuth, ctrl.grafo);
router.get('/busca',          optionalAuth, ctrl.buscar);
router.get('/eventos',        optionalAuth, ctrl.listarEventos);

// Escrita: somente o mestre
router.post('/paginas',         authMiddleware, mestreOnly, ctrl.criarPagina);
router.put('/paginas/:slug',    authMiddleware, mestreOnly, ctrl.atualizarPagina);
router.delete('/paginas/:slug', authMiddleware, mestreOnly, ctrl.deletarPagina);
router.get('/paginas/:slug/historico',            authMiddleware, mestreOnly, ctrl.listarHistorico);
router.post('/paginas/:slug/restaurar/:revId',    authMiddleware, mestreOnly, ctrl.restaurarVersao);
router.get('/excluidas',                          authMiddleware, mestreOnly, ctrl.listarExcluidas);
router.post('/eventos',         authMiddleware, mestreOnly, ctrl.criarEvento);
router.put('/eventos/:id',      authMiddleware, mestreOnly, ctrl.atualizarEvento);
router.delete('/eventos/:id',   authMiddleware, mestreOnly, ctrl.deletarEvento);

module.exports = router;
