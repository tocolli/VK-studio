#!/usr/bin/env node
// backend/scripts/importar-vault.js
// Importa um vault do Obsidian (pasta de .md com [[links]]) para a wiki do site.
//
// Uso:
//   node backend/scripts/importar-vault.js <pasta-do-vault> [opções]
//
// Opções:
//   --dry-run           só mostra o que seria feito (não precisa de banco)
//   --atualizar         sobrescreve páginas que já existem (PADRÃO: pula, para não apagar edições
//                       feitas pelo site)
//   --autor-id=N        id do usuário autor (padrão: o primeiro mestre cadastrado)
//   --semear-timeline   cria os eventos iniciais da linha do tempo, se ela estiver vazia
//
// Regras de visibilidade e divisão de páginas: backend/scripts/vault-config.json

const fs = require('fs');
const path = require('path');
const { slugify, extrairLinks, VISIBILIDADES } = require('../src/utils/wiki');

const args = process.argv.slice(2);
const flag = (nome) => args.includes(`--${nome}`);
const valor = (nome) => (args.find(a => a.startsWith(`--${nome}=`)) || '').split('=')[1];
const pastaArg = args.find(a => !a.startsWith('--'));

if (!pastaArg) {
  console.error('Uso: node backend/scripts/importar-vault.js <pasta-do-vault> [--dry-run] [--atualizar] [--autor-id=N] [--semear-timeline]');
  process.exit(1);
}

// ─── leitura do vault ──────────────────────────────────────────────────────

/** Se a pasta só contém UMA subpasta (ex.: o zip traz "Decadência cinza/"), desce nela. */
function raizDoVault(dir) {
  let atual = path.resolve(dir);
  for (;;) {
    const itens = fs.readdirSync(atual, { withFileTypes: true }).filter(e => !e.name.startsWith('.'));
    const temMd = itens.some(e => e.isFile() && e.name.toLowerCase().endsWith('.md'));
    const subs = itens.filter(e => e.isDirectory());
    if (!temMd && subs.length === 1) atual = path.join(atual, subs[0].name);
    else return atual;
  }
}

function lerMarkdowns(raiz) {
  const achados = [];
  (function andar(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue; // .obsidian, .trash, .git
      const caminho = path.join(dir, e.name);
      if (e.isDirectory()) andar(caminho);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        const rel = path.relative(raiz, caminho).split(path.sep);
        const conteudo = fs.readFileSync(caminho, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
        achados.push({
          titulo: e.name.replace(/\.md$/i, ''),
          pasta: rel.slice(0, -1).join('/'),
          conteudo,
        });
      }
    }
  })(raiz);
  return achados;
}

// ─── regras (config) ───────────────────────────────────────────────────────

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'vault-config.json'), 'utf8'));
const conjunto = (lista) => new Set((lista || []).map(slugify));
const emMestre = conjunto(config.mestre);
const emPublico = conjunto(config.publico);
const pastasMestre = conjunto(config.pastasMestre);

function visibilidadeDe(pagina) {
  if (pagina.visibilidade) return pagina.visibilidade; // definida por uma regra de divisão
  const slug = slugify(pagina.titulo);
  if (pastasMestre.has(slugify(pagina.pasta.split('/')[0] || ''))) return 'mestre';
  if (emMestre.has(slug)) return 'mestre';
  if (emPublico.has(slug)) return 'publico';
  return VISIBILIDADES.includes(config.visibilidadePadrao) ? config.visibilidadePadrao : 'jogador';
}

/** Aplica as regras "dividir": corta o final de uma página e cria outra. */
function aplicarDivisoes(paginas, avisos) {
  for (const regra of config.dividir || []) {
    const alvo = paginas.find(p => slugify(p.titulo) === slugify(regra.pagina));
    if (!alvo) continue;
    const linhas = alvo.conteudo.split('\n');
    const i = linhas.findIndex(l => l.trim() === regra.aPartirDaLinha);
    if (i < 0) { avisos.push(`Divisão ignorada: linha "${regra.aPartirDaLinha}" não encontrada em "${regra.pagina}".`); continue; }
    const resto = linhas.slice(i).join('\n');
    alvo.conteudo = linhas.slice(0, i).join('\n').replace(/\s+$/, '') + '\n';
    paginas.push({ titulo: regra.novaPagina, pasta: alvo.pasta, conteudo: resto.replace(/\s+$/, '') + '\n', visibilidade: regra.visibilidade });
    avisos.push(`"${regra.pagina}" foi dividida: o trecho a partir de "${regra.aPartirDaLinha}" virou a página "${regra.novaPagina}" (${regra.visibilidade}).`);
  }
}

// ─── principal ─────────────────────────────────────────────────────────────

async function main() {
  const raiz = raizDoVault(pastaArg);
  const avisos = [];
  const paginas = lerMarkdowns(raiz);
  if (!paginas.length) { console.error(`Nenhum .md encontrado em ${raiz}`); process.exit(1); }
  aplicarDivisoes(paginas, avisos);

  // slugs duplicados (duas notas de mesmo nome em pastas diferentes) = erro, pois [[links]] ficariam ambíguos
  const porSlug = new Map();
  for (const p of paginas) {
    p.slug = slugify(p.titulo);
    p.visibilidade = visibilidadeDe(p);
    if (porSlug.has(p.slug)) {
      console.error(`ERRO: "${p.titulo}" e "${porSlug.get(p.slug).titulo}" geram o mesmo endereço (${p.slug}). Renomeie uma delas.`);
      process.exit(1);
    }
    porSlug.set(p.slug, p);
    // aviso de conteúdo repetido: mesmo título de nível 1 mais de uma vez na mesma nota
    const h1 = p.conteudo.split('\n').filter(l => /^# /.test(l)).map(l => l.trim());
    const rep = h1.filter((t, i) => h1.indexOf(t) !== i);
    if (rep.length) avisos.push(`"${p.titulo}" repete o título "${[...new Set(rep)][0]}" — a nota parece conter o texto duplicado. Importei como está; revise no editor.`);
  }

  console.log(`\nVault: ${raiz}`);
  console.log(`${paginas.length} páginas${flag('dry-run') ? ' (simulação — nada será gravado)' : ''}:\n`);
  const larg = Math.max(...paginas.map(p => p.titulo.length));
  for (const p of paginas.sort((a, b) => (a.pasta + a.titulo).localeCompare(b.pasta + b.titulo, 'pt'))) {
    console.log(`  ${p.visibilidade.padEnd(8)} ${p.titulo.padEnd(larg)}  ${p.pasta ? `[${p.pasta}]` : ''}  (${extrairLinks(p.conteudo).length} links)`);
  }

  // links para páginas que não existem (no vault)
  const faltando = new Map();
  for (const p of paginas) {
    for (const l of extrairLinks(p.conteudo)) {
      if (!porSlug.has(l.slug)) {
        const f = faltando.get(l.slug) || { nome: l.texto, citada: [] };
        f.citada.push(p.titulo);
        faltando.set(l.slug, f);
      }
    }
  }

  if (flag('dry-run')) { relatorio(avisos, faltando); return; }

  const { pool } = require('../src/config/database');
  const { runMigrations } = require('../src/config/migrations');
  const conn = await pool.getConnection();
  let criadas = 0, atualizadas = 0, puladas = 0;
  try {
    await runMigrations(conn);

    let autorId = Number.parseInt(valor('autor-id'), 10);
    if (!Number.isFinite(autorId)) {
      const [m] = await conn.execute(`SELECT id FROM users WHERE role='mestre' ORDER BY id LIMIT 1`);
      autorId = m.length ? m[0].id : null;
    }

    for (const p of paginas) {
      const [ja] = await conn.execute('SELECT id FROM wiki_paginas WHERE slug = ?', [p.slug]);
      if (ja.length && !flag('atualizar')) { puladas++; continue; }
      await conn.beginTransaction();
      let id;
      if (ja.length) {
        id = ja[0].id;
        await conn.execute('UPDATE wiki_paginas SET titulo=?, conteudo=?, pasta=?, visibilidade=? WHERE id=?',
          [p.titulo, p.conteudo, p.pasta, p.visibilidade, id]);
        atualizadas++;
      } else {
        const [r] = await conn.execute(
          'INSERT INTO wiki_paginas (slug, titulo, conteudo, pasta, visibilidade, autor_id) VALUES (?,?,?,?,?,?)',
          [p.slug, p.titulo, p.conteudo, p.pasta, p.visibilidade, autorId]);
        id = r.insertId;
        criadas++;
      }
      await conn.execute('DELETE FROM wiki_links WHERE origem_id = ?', [id]);
      for (const l of extrairLinks(p.conteudo)) {
        await conn.execute('INSERT INTO wiki_links (origem_id, destino_slug, texto) VALUES (?,?,?)', [id, l.slug, l.texto]);
      }
      await conn.commit();
    }

    let eventos = 0;
    if (flag('semear-timeline')) {
      const [[{ n }]] = await conn.execute('SELECT COUNT(*) AS n FROM wiki_eventos');
      if (n === 0) {
        const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'timeline-seed.json'), 'utf8'));
        for (const e of seed) {
          await conn.execute(
            'INSERT INTO wiki_eventos (titulo, descricao, era, data_texto, ordem, pagina_slug, visibilidade) VALUES (?,?,?,?,?,?,?)',
            [e.titulo, e.descricao, e.era, e.data_texto, e.ordem, e.pagina_slug, e.visibilidade]);
          eventos++;
        }
      } else avisos.push('Linha do tempo já tem eventos: não semeei nada.');
    }

    console.log(`\n✅ ${criadas} criadas, ${atualizadas} atualizadas, ${puladas} já existiam (puladas)${flag('semear-timeline') ? `, ${eventos} eventos na linha do tempo` : ''}.`);
    if (puladas && !flag('atualizar')) console.log('   (use --atualizar para sobrescrever as que já existem — isso apaga edições feitas pelo site)');
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('❌ Falha na importação:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
  relatorio(avisos, faltando);
}

function relatorio(avisos, faltando) {
  if (avisos.length) {
    console.log('\nAvisos:');
    avisos.forEach(a => console.log('  • ' + a));
  }
  if (faltando.size) {
    console.log(`\nPáginas citadas por [[link]] que ainda NÃO existem (${faltando.size}) — aparecem como links "não escritos":`);
    [...faltando.values()].sort((a, b) => b.citada.length - a.citada.length)
      .forEach(f => console.log(`  • ${f.nome}  ← ${[...new Set(f.citada)].join(', ')}`));
  }
  console.log('');
}

main().catch(err => { console.error(err); process.exit(1); });
