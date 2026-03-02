const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// --- 1. CONFIGURAÇÕES GLOBAIS ---
app.use(cors());

// AUMENTO DE LIMITE: Fundamental para evitar o erro PayloadTooLargeError
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// 1. Comando para o Node servir os arquivos da pasta 'frontend'
app.use(express.static(path.join(__dirname, '../frontend')));

// 2. Redirecionamento da página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// --- 2. CONFIGURAÇÃO DE UPLOADS ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- 3. CONEXÃO COM O BANCO ---
// --- 3. CONEXÃO COM O BANCO ---
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 13039,
    ssl: { rejectUnauthorized: false } // Obrigatório para o Aiven
});

db.connect((err) => {
    if (err) {
        console.error('❌ ERRO NO MYSQL:', err.message);
        return;
    }
    console.log('✅ VK.ENGINE ONLINE: Banco e Rotas de Salvamento ativos.');
});

// --- 4. ROTA DE BUSCA POR CATEGORIA ---
app.get('/buscar-documentacao/:sistema/:categoria', (req, res) => {
    const { sistema, categoria } = req.params;
    const sql = "SELECT * FROM documentacoes WHERE sistema = ? AND categoria = ? ORDER BY titulo ASC";
    
    db.query(sql, [sistema, categoria], (err, results) => {
        if (err) {
            console.error("Erro ao buscar docs:", err);
            return res.status(500).json({ error: "Erro interno no banco." });
        }
        res.json(results);
    });
});

// --- 5. ROTAS DE ACESSO (LOGIN/CADASTRO) ---
app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    const sql = "SELECT * FROM usuarios WHERE email = ?";
    db.query(sql, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: "Erro no banco." });
        if (results.length === 0) return res.status(401).json({ error: "E-mail não encontrado." });
        const usuario = results[0];
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
        if (senhaCorreta) {
            res.status(200).json({ user: { id: usuario.id, nome: usuario.nome, cargo: usuario.cargo } });
        } else {
            res.status(401).json({ error: "Senha incorreta!" });
        }
    });
});

app.post('/register', async (req, res) => {
    const { nome, email, senha } = req.body;
    try {
        const hash = await bcrypt.hash(senha, 10);
        const sql = "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)";
        db.query(sql, [nome, email, hash], (err) => {
            if (err) return res.status(500).json({ error: "Erro ao criar conta." });
            res.status(201).json({ message: "OK" });
        });
    } catch (e) { res.status(500).json({ error: "Erro interno." }); }
});

// --- 6. GESTÃO DE DOCUMENTAÇÃO E GALERIA ---
app.post('/admin/upload-galeria', upload.single('imagem'), (req, res) => {
    if (!req.file) return res.status(400).send("Nenhuma imagem enviada.");
    const urlCompleta = `http://localhost:3000/uploads/${req.file.filename}`;
    res.json({ url: urlCompleta });
});

app.post('/salvar-documentacao', upload.single('imagem'), (req, res) => {
    const { id, titulo, sistema, categoria, subcategoria, rank_item, livro_id, conteudo, link } = req.body; 
    const imagemPath = req.file ? `/uploads/${req.file.filename}` : null;
    const idDoLivro = (livro_id === "" || livro_id === "null" || !livro_id) ? null : livro_id;

    if (id && id !== "null" && id !== "") {
        const sql = "UPDATE documentacoes SET titulo=?, sistema=?, categoria=?, subcategoria=?, rank_item=?, livro_id=?, conteudo=?, imagem=COALESCE(?, imagem), link=? WHERE id=?";
        db.query(sql, [titulo, sistema, categoria, subcategoria || '', rank_item || '', idDoLivro, conteudo, imagemPath, link || '', id], (err) => {
            if (err) return res.status(500).json({ error: "Erro ao atualizar." });
            res.json({ message: "Registro Reforjado!", id: id });
        });
    } else {
        const sql = "INSERT INTO documentacoes (titulo, sistema, categoria, subcategoria, rank_item, livro_id, conteudo, imagem, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        db.query(sql, [titulo, sistema, categoria, subcategoria || '', rank_item || '', idDoLivro, conteudo, imagemPath, link || ''], (err, result) => {
            if (err) return res.status(500).json({ error: "Erro ao salvar." });
            res.status(201).json({ message: "Sucesso!", id: result.insertId });
        });
    }
});

// --- 7. SISTEMA DE FICHAS ---
app.post('/salvar-ficha', (req, res) => {
    const { id, usuario_id, nome_personagem, sistema, dados_json } = req.body;

    const dadosParaSalvar = typeof dados_json === 'string' ? dados_json : JSON.stringify(dados_json);

    if (id && id !== 'null' && id !== '') {
        const sql = "UPDATE fichas SET nome_personagem = ?, dados_json = ? WHERE id = ? AND usuario_id = ?";
        db.query(sql, [nome_personagem, dadosParaSalvar, id, usuario_id], (err) => {
            if (err) {
                console.error("Erro no SQL (Update):", err);
                return res.status(500).json({ error: "Erro ao atualizar ficha." });
            }
            res.json({ message: "Ficha sincronizada!", id: id });
        });
    } else {
        const sql = "INSERT INTO fichas (usuario_id, nome_personagem, sistema, dados_json) VALUES (?, ?, ?, ?)";
        db.query(sql, [usuario_id, nome_personagem, sistema, dadosParaSalvar], (err, result) => {
            if (err) {
                console.error("Erro no SQL (Insert):", err);
                return res.status(500).json({ error: "Erro ao criar ficha no banco." });
            }
            res.status(201).json({ message: "Ficha forjada com sucesso!", id: result.insertId });
        });
    }
});

app.get('/minhas-fichas/:usuarioId', (req, res) => {
    const { usuarioId } = req.params;
    // Query limpa para buscar os dados básicos
    const sql = "SELECT id, nome_personagem, sistema, data_criacao FROM fichas WHERE usuario_id = ? ORDER BY data_criacao DESC";
    
    db.query(sql, [usuarioId], (err, results) => {
        if (err) {
            console.error("❌ Erro ao buscar fichas:", err.message);
            // Retorna array vazio para o Dashboard não travar no .map()
            return res.status(200).json([]); 
        }
        res.status(200).json(results);
    });
});

app.get('/carregar-ficha/:id', (req, res) => {
    const { id } = req.params;
    db.query("SELECT * FROM fichas WHERE id = ?", [id], (err, results) => {
        if (err) return res.status(500).json({ error: "Erro ao carregar." });
        if (results.length === 0) return res.status(404).json({ error: "Não encontrada." });
        res.json(results[0]);
    });
});

app.delete('/deletar-ficha/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM fichas WHERE id = ?";
    
    db.query(sql, [id], (err) => {
        if (err) {
            console.error("❌ Erro ao deletar ficha:", err.message);
            return res.status(500).json({ error: "Erro ao deletar do banco." });
        }
        res.json({ message: "Ficha enviada para o abismo com sucesso!" });
    });
});
// --- 8. VIGILÂNCIA E LOGS ---
app.post('/admin/registrar-log', (req, res) => {
    const { usuario_id, ficha_id, alteracao } = req.body;
    const sql = "INSERT INTO logs_fichas (usuario_id, ficha_id, alteracao) VALUES (?, ?, ?)";
    db.query(sql, [usuario_id, ficha_id, alteracao], (err) => {
        if (err) return res.status(500).json({ error: "Erro ao gravar log." });
        res.json({ message: "Log registrado." });
    });
});

app.get('/admin/logs/:fichaId', (req, res) => {
    const { fichaId } = req.params;
    const sql = "SELECT * FROM logs_fichas WHERE ficha_id = ? ORDER BY data_hora DESC LIMIT 50";
    db.query(sql, [fichaId], (err, results) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar logs." });
        res.json(results);
    });
});

app.get('/admin/listar-usuarios', (req, res) => {
    db.query("SELECT id, nome, email, cargo FROM usuarios ORDER BY nome ASC", (err, results) => {
        if (err) return res.status(500).json({ error: "Erro ao listar." });
        res.json(results);
    });
});

app.get('/admin/fichas-usuario/:id', (req, res) => {
    const { id } = req.params;
    db.query("SELECT * FROM fichas WHERE usuario_id = ?", [id], (err, results) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar fichas." });
        res.json(results);
    });
});

// --- 9. PESQUISA E BESTIÁRIO ---
app.get('/pesquisar', (req, res) => {
    const termo = req.query.q;
    if (!termo) return res.status(200).json([]);
    const sql = "SELECT * FROM documentacoes WHERE titulo LIKE ? LIMIT 20";
    db.query(sql, [`%${termo}%`], (err, results) => {
        if (err) return res.status(500).json({ error: "Erro na busca." });
        res.status(200).json(results);
    });
});

app.post('/admin/criar-livro', upload.single('imagem'), (req, res) => {
    const { titulo_livro, sistema, conteudo } = req.body;
    const capaPath = req.file ? `/uploads/${req.file.filename}` : null;
    const sql = "INSERT INTO livros_bestiario (titulo_livro, sistema, conteudo, capa_imagem) VALUES (?, ?, ?, ?)";
    db.query(sql, [titulo_livro, sistema, conteudo || '', capaPath], (err) => {
        if (err) return res.status(500).json({ error: "Erro ao criar." });
        res.status(201).json({ message: "Livro forjado!" });
    });
});

app.get('/admin/listar-livros', (req, res) => {
    db.query("SELECT * FROM livros_bestiario ORDER BY titulo_livro ASC", (err, results) => {
        if (err) return res.status(500).json({ error: "Erro ao listar." });
        res.status(200).json(results);
    });
});

app.delete('/admin/deletar-livro/:id', (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM livros_bestiario WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: "Erro ao remover." });
        res.json({ message: "Removido!" });
    });
});

app.get('/admin/todas-documentacoes', (req, res) => {
    db.query("SELECT * FROM documentacoes ORDER BY id DESC", (err, results) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar." });
        res.status(200).json(results);
    });
});

app.delete('/documentacao/:id', (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM documentacoes WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: "Erro ao deletar." });
        res.json({ message: "Banido!" });
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n🔥 VK.ENGINE OPERANDO EM: http://localhost:${PORT}`);
});