// backend/src/routes/sessoes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/sessaoController');
const { authMiddleware, mestreOnly } = require('../middlewares/auth');

// Sessões
router.get('/',                      authMiddleware, ctrl.listarSessoes);
router.post('/',                     authMiddleware, mestreOnly, ctrl.criarSessao);
router.get('/:id',                   authMiddleware, ctrl.buscarSessao);
router.put('/:id/encerrar',          authMiddleware, mestreOnly, ctrl.encerrarSessao);

// Mapas
router.get('/:sessaoId/mapas',       authMiddleware, ctrl.listarMapas);
router.post('/:sessaoId/mapas',      authMiddleware, mestreOnly, ctrl.uploadMapa.single('imagem'), ctrl.uploadMapaHandler);
router.put('/:sessaoId/mapas/:mapaId/ativar', authMiddleware, mestreOnly, ctrl.selecionarMapa);
router.delete('/:sessaoId/mapas/:mapaId',     authMiddleware, mestreOnly, ctrl.deletarMapa);

// Tokens
router.get('/:sessaoId/mapas/:mapaId/tokens',    authMiddleware, ctrl.listarTokens);
router.post('/:sessaoId/mapas/:mapaId/tokens',   authMiddleware, ctrl.criarToken);
router.put('/tokens/:tokenId',                    authMiddleware, ctrl.atualizarToken);
router.delete('/tokens/:tokenId',                 authMiddleware, mestreOnly, ctrl.deletarToken);

// Fog of War
router.get('/:sessaoId/mapas/:mapaId/fog',  authMiddleware, ctrl.getFog);
router.put('/:sessaoId/mapas/:mapaId/fog',  authMiddleware, mestreOnly, ctrl.atualizarFog);

// Chat
router.get('/:sessaoId/chat', authMiddleware, ctrl.buscarChat);

// Lojas e Itens (Mercado do Mestre)
router.get('/:sessaoId/lojas',               authMiddleware, ctrl.listarLojas);
router.post('/:sessaoId/lojas',              authMiddleware, mestreOnly, ctrl.criarLoja);
router.post('/:sessaoId/lojas/:lojaId/itens',authMiddleware, mestreOnly, ctrl.adicionarItemLoja);

module.exports = router;