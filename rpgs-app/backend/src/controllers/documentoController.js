const db = require('../config/db');

const documentoController = {
    async criar(req, res) {
        // Log para depuração no Render
        console.log("--- DADOS RECEBIDOS ---");
        console.log("Body:", req.body); 
        console.log("Arquivo:", req.file ? "OK" : "Sem foto");

        // AJUSTE AQUI: Pegando 'rank_item' do req.body (nome que vem do HTML)
        const { titulo, sistema, categoria, rank_item, conteudo } = req.body;
        const ilustracao_url = req.file ? req.file.path : null;

        try {
            const query = `
                INSERT INTO documentos (titulo, sistema, categoria, rank_licenca, conteudo, ilustracao_url) 
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            // Usamos rank_item ou um padrão seguro
            await db.query(query, [
                titulo, 
                sistema, 
                categoria, 
                rank_item || 'Sem Rank', 
                conteudo, 
                ilustracao_url
            ]);
            
            res.status(201).json({ message: 'Conhecimento selado com sucesso!' });
        } catch (err) {
            console.error("ERRO NO BANCO:", err.message);
            res.status(500).json({ error: 'Erro no banco de dados: ' + err.message });
        }
    },

    async listarFiltrado(req, res) {
        const { sistema, categoria } = req.params;
        try {
            const [rows] = await db.query(
                'SELECT * FROM documentos WHERE sistema = ? AND categoria = ?', 
                [sistema, categoria]
            );
            res.json(rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Erro ao consultar o acervo.' });
        }
    },

    async buscarGeral(req, res) {
        const { termo } = req.query;
        try {
            const [rows] = await db.query(
                'SELECT * FROM documentos WHERE titulo LIKE ? OR conteudo LIKE ?', 
                [`%${termo}%`, `%${termo}%`]
            );
            res.json(rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Erro na busca.' });
        }
    },

    async deletar(req, res) {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM documentos WHERE id = ?', [id]);
        res.json({ message: 'Conhecimento banido do acervo!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao tentar banir o item.' });
    }
},

async listarTodosGeral(req, res) {
    try {
        const [rows] = await db.query('SELECT * FROM documentos ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar tudo.' });
    }
},

async buscarPorId(req, res) {
    const { id } = req.params;
    try {
        //db.query retorna [rows, fields]. Nós só queremos o primeiro item de rows.
        const [rows] = await db.query('SELECT * FROM documentos WHERE id = ?', [id]);
        
        // Se o array 'rows' estiver vazio, o item não existe
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Item não encontrado no acervo.' });
        }

        // --- CORREÇÃO AQUI ---
        // Enviamos apenas o primeiro objeto (rows[0]), não o array inteiro
        const item = rows[0];
        console.log("Item invocado para reforja:", item.titulo); // Log para conferir no terminal
        res.json(item);

    } catch (err) {
        console.error("Erro na busca por ID:", err.message);
        res.status(500).json({ error: 'Erro ao invocar o conhecimento.' });
    }
},

// Salva as alterações (O "Reforjar")
async atualizar(req, res) {
        const { id } = req.params;
        // AJUSTE AQUI: Lendo 'rank_item' também na atualização
        const { titulo, sistema, categoria, rank_item, conteudo } = req.body;
        
        let query = 'UPDATE documentos SET titulo=?, sistema=?, categoria=?, rank_licenca=?, conteudo=?';
        let params = [titulo, sistema, categoria, rank_item || 'Sem Rank', conteudo];

        if (req.file) {
            query += ', ilustracao_url=?';
            params.push(req.file.path);
        }

        query += ' WHERE id=?';
        params.push(id);

        try {
            await db.query(query, params);
            res.json({ message: 'Conhecimento reforjado com sucesso!' });
        } catch (err) {
            console.error("ERRO NA ATUALIZAÇÃO:", err.message);
            res.status(500).json({ error: 'Erro ao atualizar: ' + err.message });
        }
    }

};

module.exports = documentoController;