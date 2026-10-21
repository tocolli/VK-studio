# Compêndio (wiki estilo Obsidian)

O site ganhou um compêndio: páginas escritas em markdown com `[[links]]`, backlinks, mapa interligado (grafo) e linha do tempo. O conteúdo fica no banco e é editado pelo próprio site.

| Endereço | O que é |
| --- | --- |
| `/wiki` | início (páginas recentes; para o mestre, também as páginas citadas mas ainda não escritas) |
| `/wiki/p/<pagina>` | uma página. Dá para mandar esse link aos jogadores |
| `/wiki/p/<pagina>/editar`, `/wiki/novo` | editor (só mestre), com prévia ao vivo e autocompletar de `[[` |
| `/wiki/grafo` | mapa interligado |
| `/wiki/linha-do-tempo` | eventos do universo, agrupados por era |

## Quem vê o quê

Cada página (e cada evento) tem uma visibilidade:

- **Público**: qualquer pessoa com o link, sem login.
- **Jogadores**: só quem está logado.
- **Somente mestre**: só o mestre.

Uma página que a pessoa não pode ver **se comporta como se não existisse**: responde 404, não aparece na busca, nos backlinks nem no mapa, e um `[[link]]` para ela aparece como "não escrita". Nada vaza, nem o título.

Por padrão **nada é público**. Para liberar uma página por link, abra o editor e troque a visibilidade.

## Banco de dados

As tabelas novas (`wiki_paginas`, `wiki_links`, `wiki_eventos`, `wiki_revisoes`) e a tabela de controle `schema_migrations` são criadas **sozinhas** quando o servidor sobe (`backend/src/config/migrations.js`). Só adiciona tabelas; não mexe nas existentes. No primeiro deploy, o Render cria as tabelas no Aiven sozinho; não precisa rodar nada no banco à mão.

## Histórico de edições (rede de segurança)

Como o conteúdo agora é editado pelo site, **nada que o mestre salva ou exclui se perde**:

- Ao salvar uma página alterada, a versão anterior vai para o histórico (salvar sem mudar nada não cria versão). Ficam as últimas 50 versões de cada página.
- Na página, o botão **Histórico** (só mestre) lista as versões e permite **Restaurar**. Restaurar também guarda a versão atual, então dá para desfazer.
- Páginas **excluídas** aparecem na tela inicial do mestre ("Páginas excluídas") e podem ser restauradas com um clique, inclusive com os links de volta.

Para mudar o banco daqui em diante, **acrescente** uma migração no fim da lista em `migrations.js`. Nunca edite uma que já rodou em produção.

## Importar o vault do Obsidian

```bash
# 1) simulação: mostra o que seria importado e avisa de problemas (não precisa de banco)
npm run importar-vault -- "C:/caminho/Decadência cinza" --dry-run

# 2) importar de verdade (usa o .env: DB_HOST, DB_USER... do banco que você apontar)
npm run importar-vault -- "C:/caminho/Decadência cinza" --semear-timeline
```

- O importador **não sobrescreve** páginas que já existem (para não apagar o que você editou pelo site). Use `--atualizar` só quando quiser mesmo substituir.
- A visibilidade de cada nota vem de `backend/scripts/vault-config.json`. Notas de mestre, rascunhos e fichas entram como "somente mestre"; o resto, como "jogadores".
- A regra `dividir` separa o final de "Regras gerais" (o trecho "Divindades e Magias", que é Documento de Mestre) numa página própria só do mestre.
- `--semear-timeline` cria 6 eventos iniciais a partir das gerações de deuses, **só se a linha do tempo estiver vazia**. Eles entram como "somente mestre".
- Ao final, o importador lista as páginas citadas por `[[link]]` que ainda não existem.

Para importar na produção (Aiven), rode o comando na sua máquina com um `.env` apontando para o banco do Aiven.

## Bibliotecas

`frontend/vendor/` guarda marked (markdown), DOMPurify (segurança do HTML) e d3 (mapa), copiadas para o projeto em vez de CDN. Detalhes em `frontend/vendor/LEIAME.txt`.

## Testes

```bash
npm test
```

Cobre slugs, extração de `[[links]]` e a igualdade entre o `slugify` do servidor e o do navegador.

Há também testes de **integração** (permissões: o que anônimo/jogador/mestre enxergam, busca, mapa, links e histórico). Eles criam usuários e páginas, então só rodam quando você pede e **só contra um banco local de teste** (o código recusa qualquer `DB_HOST` que não seja local):

```bash
DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=... DB_PASSWORD=... DB_NAME=vk_teste DB_SSL=false \
JWT_SECRET=qualquer WIKI_TESTE_DB=1 npm test
```

(`DB_SSL=false` serve só para banco local sem SSL; o Aiven continua usando SSL por padrão.)

## Limites conhecidos

- O endereço (slug) de uma página **não muda** ao renomear o título, para nenhum `[[link]]` quebrar. Para mudar o endereço, crie outra página e exclua a antiga.
- `[[Pagina#Secao]]` leva à página, não à seção.
- Imagens coladas com `![[arquivo.png]]` do Obsidian ainda não são suportadas.
