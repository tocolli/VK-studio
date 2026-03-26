const db = require('../config/db');

const documentoController = {
    async criar(req, res) {
        // Log para ver o que está vindo do seu Admin
        console.log("--- DADOS RECEBIDOS ---");
        console.log(req.body); 
        console.log("Arquivo:", req.file ? "OK" : "Sem foto");
        console.log("-----------------------");

        const { titulo, sistema, categoria, rank, conteudo } = req.body;
        const ilustracao_url = req.file ? req.file.path : null;

        try {
            // Verifique se os nomes das colunas (titulo, sistema, etc) batem com o seu banco no Aiven
            const query = `
                INSERT INTO documentos (titulo, sistema, categoria, rank_licenca, conteudo, ilustracao_url) 
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            // Usamos 'rank' para a coluna 'rank_licenca'
            await db.query(query, [titulo, sistema, categoria, rank || 'Sem Rank', conteudo, ilustracao_url]);
            
            res.status(201).json({ message: 'Conhecimento selado com sucesso!' });
        } catch (err) {
            console.error("ERRO DETALHADO DO BANCO:", err.message);
            // Isso impede o erro "Unexpected token <" enviando um JSON de erro em vez de HTML
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
    const { titulo, sistema, categoria, rank, conteudo } = req.body;
    let query = 'UPDATE documentos SET titulo=?, sistema=?, categoria=?, rank_licenca=?, conteudo=?';
    let params = [titulo, sistema, categoria, rank, conteudo];

    // Se o mestre enviou uma NOVA imagem, atualizamos o link
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
        res.status(500).json({ error: 'Erro ao atualizar: ' + err.message });
    }
}

};

module.exports = documentoController;