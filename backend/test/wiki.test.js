// backend/test/wiki.test.js — rode com: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify, extrairLinks, visiveisPara } = require('../src/utils/wiki');

test('slugify remove acentos, caixa e símbolos', () => {
  assert.equal(slugify('Maldições do Vazio'), 'maldicoes-do-vazio');
  assert.equal(slugify('maldições do vazio'), 'maldicoes-do-vazio'); // Obsidian não diferencia caixa
  assert.equal(slugify('Principe mestiço'), 'principe-mestico');
  assert.equal(slugify('a deusa da guerra - Amber'), 'a-deusa-da-guerra-amber');
  assert.equal(slugify('Regras_gerais.md'), 'regras-gerais');
  assert.equal(slugify('  '), '');
});

test('extrairLinks entende [[A]], [[A|apelido]], [[A#secao]], [[pasta/A]]', () => {
  const md = 'Veja [[Elementos]], [[Fogo|o fogo]], [[Terra#Pedra]] e [[fichas herois2/Shoden]].';
  assert.deepEqual(extrairLinks(md).map(l => l.slug), ['elementos', 'fogo', 'terra', 'shoden']);
});

test('extrairLinks ignora código e repetições', () => {
  const md = '[[A]] [[a]]\n```\n[[Falso]]\n```\n`[[Tambem falso]]` [[B]]';
  assert.deepEqual(extrairLinks(md).map(l => l.slug), ['a', 'b']);
});

test('extrairLinks aceita alias escapado dentro de tabela (\\|)', () => {
  assert.deepEqual(extrairLinks('| [[Fogo\\|chama]] |').map(l => l.slug), ['fogo']);
});

test('slugify do navegador (frontend/js/wiki.js) é idêntico ao do servidor', () => {
  // Se as duas divergirem, um [[link]] apontaria para a página errada. Extrai a função do arquivo do
  // front-end (que é um script de navegador, não importável) e compara em vários casos.
  const fs = require('node:fs');
  const path = require('node:path');
  const fonte = fs.readFileSync(path.join(__dirname, '../../frontend/js/wiki.js'), 'utf8');
  const trecho = fonte.match(/function slugify\(t\) \{[\s\S]*?\n  \}/);
  assert.ok(trecho, 'não achei slugify em frontend/js/wiki.js');
  const slugifyFront = new Function(`${trecho[0]}; return slugify;`)();
  const casos = ['Maldições do Vazio', 'a deusa da guerra - Amber', 'Regras_gerais.md', 'Orihaa o elo familiar',
    '  espaços  ', 'ÇÃO Ñandú', 'pasta/Nome', '', '---', 'x'.repeat(300)];
  for (const c of casos) assert.equal(slugifyFront(c), slugify(c), `diverge em: ${JSON.stringify(c)}`);
});

test('visiveisPara: anônimo < jogador < mestre', () => {
  assert.deepEqual(visiveisPara(0), ['publico']);
  assert.deepEqual(visiveisPara(1), ['publico', 'jogador']);
  assert.deepEqual(visiveisPara(2), ['publico', 'jogador', 'mestre']);
});
