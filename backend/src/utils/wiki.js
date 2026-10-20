// backend/src/utils/wiki.js
// Utilitários da wiki (estilo Obsidian): slugs e extração de [[links]].
// ATENÇÃO: slugify() existe duplicada em frontend/js/wiki.js — mantenha as duas iguais
// (backend/test/wiki.test.js confere o comportamento esperado).

const VISIBILIDADES = ['publico', 'jogador', 'mestre'];

/** "Maldições do Vazio" -> "maldicoes-do-vazio". Também aceita "pasta/Nome.md". */
function slugify(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 190);
}

/** Remove blocos e trechos de código, onde [[...]] não deve virar link. */
function semCodigo(md) {
  return String(md ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
}

/**
 * Extrai os destinos de [[links]] de um texto markdown.
 * Aceita [[Pagina]], [[Pagina|apelido]], [[Pagina#Secao]] e [[pasta/Pagina]].
 * @returns {{slug: string, texto: string}[]} destinos únicos (texto = nome como foi escrito)
 */
function extrairLinks(md) {
  const vistos = new Map();
  const re = /\[\[([^\]\n]+?)\]\]/g;
  const limpo = semCodigo(md);
  let m;
  while ((m = re.exec(limpo))) {
    let alvo = m[1].replace(/\\\|/g, '|').split('|')[0].split('#')[0].trim();
    if (!alvo) continue;
    alvo = alvo.split('/').pop().replace(/\.md$/i, '').trim();
    const slug = slugify(alvo);
    if (slug && !vistos.has(slug)) vistos.set(slug, { slug, texto: alvo.slice(0, 190) });
  }
  return [...vistos.values()];
}

/** Visibilidades que um nível de acesso enxerga. 0=anônimo, 1=jogador, 2=mestre. */
function visiveisPara(nivel) {
  return VISIBILIDADES.slice(0, Math.max(0, Math.min(2, nivel)) + 1);
}

module.exports = { VISIBILIDADES, slugify, semCodigo, extrairLinks, visiveisPara };
