require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();

// Middlewares obrigatórios
app.use(cors());
app.use(express.json());

// Configuração da conexão com o MySQL usando Pool de Promises
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Teste de conexão inicial
(async () => {
    try {
        await db.getConnection();
        console.log('🚀 Sucesso: Conectado ao pool do banco de dados loja_automacao!');
    } catch (err) {
        console.error('❌ Erro crítico ao conectar ao MySQL:', err.message);
    }
})();

// ============================================================
// ROTA 1: Status do Servidor
// ============================================================
app.get('/api/status', (req, res) => {
    res.json({ status: "online", mensagem: "Backend integrado!" });
});

// ============================================================
// ROTA 2: Cadastrar um novo Produto (POST)
// ============================================================
app.post('/api/produtos', async (req, res) => {
    try {
        const { nome, descricao, preco, categoria, imagens } = req.body;
        const imagesJSON = JSON.stringify(imagens);

        const query = 'INSERT INTO produtos (nome, descricao, preco, categoria, imagens) VALUES (?, ?, ?, ?, ?)';
        const [result] = await db.query(query, [nome, descricao, preco, categoria, imagesJSON]);

        res.status(201).json({ id: result.insertId, message: 'Produto cadastrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao inserir produto:', err);
        res.status(500).json({ error: 'Erro ao cadastrar produto' });
    }
});

// ============================================================
// ROTA 3: Listar todos os Produtos (GET)
// ============================================================
app.get('/api/produtos', async (req, res) => {
    try {
        const query = 'SELECT * FROM produtos';
        const [results] = await db.query(query);

        const produtosFormatados = results.map(produto => {
            const listaImagens = typeof produto.imagens === 'string'
                ? JSON.parse(produto.imagens)
                : produto.imagens;

            return {
                ...produto,
                imagens: listaImagens
            };
        });

        res.json(produtosFormatados);
    } catch (err) {
        console.error("Erro ao buscar produtos:", err.message);
        res.status(500).json({ error: "Erro ao buscar produtos no banco." });
    }
});

// ============================================================
// ROTA 4: Checkout PagBank (CORRIGIDA - frete agora é somado)
// ============================================================
app.post('/api/pagamento/checkout', async (req, res) => {
    try {
        console.log("=== REQUISIÇÃO DE CHECKOUT RECEBIDA ===");

        if (!req.body.pedido) {
            return res.status(400).json({ error: "O objeto 'pedido' não foi enviado no corpo da requisição." });
        }

        const { cliente, endereco, total, itens, frete } = req.body.pedido;

        if (!cliente || !endereco || !itens || itens.length === 0 || !frete || frete.valor === undefined) {
            return res.status(400).json({ error: "Dados cadastrais, de entrega, itens ou frete ausentes." });
        }

        // 1. Limpeza e padronização do CPF
        let cpfLimpo = cliente.cpf ? String(cliente.cpf).replace(/\D/g, '') : '';
        if (cpfLimpo.length > 0 && cpfLimpo.length < 11) {
            cpfLimpo = cpfLimpo.padStart(11, '0');
        }

        if (cpfLimpo.length !== 11) {
            return res.status(400).json({ error: `O CPF enviado tem ${cpfLimpo.length} dígitos, mas deve conter exatamente 11.` });
        }

        // 2. TRATAMENTO SEGURO DO TELEFONE
        let telefoneLimpo = cliente.telefone ? String(cliente.telefone).replace(/\D/g, '') : '';

        if (telefoneLimpo.length > 11 && telefoneLimpo.startsWith('55')) {
            telefoneLimpo = telefoneLimpo.substring(2);
        }

        if (telefoneLimpo.length === 8 || telefoneLimpo.length === 9) {
            console.log("⚠️ Telefone enviado sem DDD. Aplicando DDD padrão 62.");
            telefoneLimpo = '62' + telefoneLimpo;
        }

        if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
            return res.status(400).json({ error: "O Telefone informado é inválido. Envie o formato: DDD + Número." });
        }

        const ddd = telefoneLimpo.substring(0, 2);
        const numeroTelefone = telefoneLimpo.substring(2);

        // 3. Sanitização do Estado (UF) - sempre 2 letras maiúsculas
        const ufLimpa = endereco.estado ? String(endereco.estado).trim().toUpperCase().substring(0, 2) : '';

        if (ufLimpa.length !== 2) {
            return res.status(400).json({ error: "O Estado (UF) informado é inválido. Envie a sigla com 2 letras, ex: GO, SP." });
        }

        // 4. Complemento nunca pode ir vazio para o PagBank
        const complementoFinal = endereco.complemento && String(endereco.complemento).trim() !== ''
            ? String(endereco.complemento).trim()
            : 'Não informado';

        const cepLimpo = endereco.cep ? String(endereco.cep).replace(/\D/g, '') : '';

        const referenciaUnica = `PED-${Date.now()}`;

        // 5. Valor do frete, tratado com segurança
        const valorFreteNumerico = parseFloat(frete.valor) || 0;

        // 6. Salva o pedido, agora incluindo frete_valor e frete_meio
        const queryPedido = `
            INSERT INTO pedidos (
                reference_id, cliente_nome, cliente_email, cliente_cpf, cliente_telefone,
                total, cep, logradouro, numero, bairro, cidade, estado,
                frete_valor, frete_meio, status_pagamento
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE')
        `;

        const [resultPedido] = await db.query(queryPedido, [
            referenciaUnica,
            cliente.nome,
            cliente.email,
            cpfLimpo,
            telefoneLimpo,
            total,
            endereco.cep,
            endereco.rua,
            endereco.numero,
            endereco.bairro,
            endereco.cidade,
            ufLimpa,
            valorFreteNumerico,
            frete.meio || null
        ]);

        const pedidoId = resultPedido.insertId;

        // 7. Salva os produtos vinculados sequencialmente na tabela itens_pedido
        for (const item of itens) {
            const queryItem = `
                INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario, tamanho, cor)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            await db.query(queryItem, [pedidoId, item.id, item.quantidade, item.preco_unitario, item.tamanho, item.cor]);
        }

        // 8. Formata itens para a API do PagBank
        const itemsPagBank = itens.map(item => {
            let nomeItem = item.nome;
            if (item.tamanho || item.cor) {
                nomeItem += ` (${item.tamanho ? 'Tam: ' + item.tamanho : ''}${item.tamanho && item.cor ? ' - ' : ''}${item.cor ? 'Cor: ' + item.cor : ''})`;
            }
            return {
                reference_id: String(item.id),
                name: nomeItem,
                quantity: parseInt(item.quantidade, 10),
                unit_amount: Math.round(parseFloat(item.preco_unitario) * 100)
            };
        });

        // 9. Estruturação do Payload PagBank (frete agora é somado corretamente)
        const bodyPagBank = {
            reference_id: referenciaUnica,
            customer_modifiable: false,
            customer: {
                name: cliente.nome,
                email: cliente.email,
                tax_id: cpfLimpo,
                type: "INDIVIDUAL",
                phone: {
                    country: "55",
                    area: ddd,
                    number: numeroTelefone
                }
            },
            items: itemsPagBank,
            shipping: {
                type: "FIXED",
                amount: Math.round(valorFreteNumerico * 100), // valor real do frete, em centavos
                address: {
                    street: endereco.rua,
                    number: String(endereco.numero),
                    complement: complementoFinal,
                    locality: endereco.bairro,
                    city: endereco.cidade,
                    region_code: ufLimpa,
                    country: "BRA",
                    postal_code: cepLimpo
                }
            },
            redirect_url: "https://www.google.com.br",
            notification_urls: [
                "https://www.google.com.br/webhook-teste"
            ],
            payment_methods: [
                { type: "CREDIT_CARD" },
                { type: "BOLETO" },
                { type: "PIX" }
            ]
        };

        // 10. Requisição oficial ao Gateway
        const respostaPagBank = await fetch(`${process.env.PAGBANK_URL_SANDBOX}/checkouts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PAGBANK_TOKEN_SANDBOX}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify(bodyPagBank)
        });

        const dadosPagBank = await respostaPagBank.json();

        if (!respostaPagBank.ok) {
            console.error("❌ Erro PagBank:", JSON.stringify(dadosPagBank, null, 2));
            return res.status(500).json({ error: "Falha na comunicação com o PagBank.", detalhes: dadosPagBank });
        }

        if (dadosPagBank.id) {
            await db.query('UPDATE pedidos SET pagbank_checkout_id = ? WHERE id = ?', [dadosPagBank.id, pedidoId]);
        }

        const linkPagamento = dadosPagBank.links?.find(l => l.rel === 'PAY')?.href;

        console.log(`🚀 Sucesso! Link gerado: ${linkPagamento}`);
        return res.json({ url_pagamento: linkPagamento });

    } catch (error) {
        console.error("💥 Erro interno no checkout:", error);
        return res.status(500).json({ error: "Erro interno no servidor." });
    }
});

// ============================================================
// ROTA 5: O ESCUTADOR (WEBHOOK)
// ============================================================
app.post('/api/pagbank/webhook', async (req, res) => {
    res.status(200).send("OK");

    try {
        const notificacao = req.body;
        if (!notificacao || notificacao.status !== "PAID") return;

        const referencia = notificacao.reference_id;

        await db.query("UPDATE pedidos SET status_pagamento = 'PAGO' WHERE reference_id = ?", [referencia]);

        const [pedido] = await db.query("SELECT * FROM pedidos WHERE reference_id = ?", [referencia]);
        if (pedido.length === 0) return;

        const [itens] = await db.query(`
            SELECT ip.quantidade, ip.tamanho, ip.cor, p.nome FROM itens_pedido ip
            JOIN produtos p ON ip.produto_id = p.id WHERE ip.pedido_id = ?
        `, [pedido[0].id]);

        let itensTexto = "";
        itens.forEach(i => {
            itensTexto += `📦 ${i.quantidade}x ${i.nome} (${i.tamanho || 'U'}/${i.cor || 'Única'})\n`;
        });

        const msgWhats = `🛍️ *PEDIDO CONFIRMADO E PAGO!* 🛍️\n\n` +
                         `👤 *Cliente:* ${pedido[0].cliente_nome}\n` +
                         `📞 *WhatsApp:* ${pedido[0].cliente_telefone}\n` +
                         `🏠 *Destino:* ${pedido[0].logradouro}, Nº ${pedido[0].numero} - ${pedido[0].cidade}/${pedido[0].estado}\n` +
                         `💰 *Total:* R$ ${Number(pedido[0].total).toFixed(2).replace('.', ',')}\n\n` +
                         `📋 *Produtos:*\n${itensTexto}\n` +
                         `Acesse o painel do administrador para despachar a mercadoria! 🚀`;

        console.log("=== DISPARANDO NOTIFICAÇÃO VIA WHATSAPP ===");
        console.log(msgWhats);

    } catch (err) {
        console.error("Erro ao rodar automações do Webhook:", err);
    }
});

// ============================================================
// ENDPOINTS ADICIONAIS: PAINEL ADMINISTRATIVO
// ============================================================
app.get('/api/admin/pedidos', async (req, res) => {
    try {
        const [pedidos] = await db.query(`
            SELECT id, reference_id, cliente_nome as cliente, status_pagamento as status,
            total, criado_em as data FROM pedidos ORDER BY id DESC
        `);
        res.json(pedidos);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar pedidos administrados." });
    }
});

app.get('/api/admin/pedidos/:id', async (req, res) => {
    try {
        const [pedido] = await db.query("SELECT * FROM pedidos WHERE id = ?", [req.params.id]);
        if (pedido.length === 0) return res.status(404).json({ error: "Pedido inexistente." });

        const [produtos] = await db.query(`
            SELECT ip.quantidade, ip.preco_unitario, ip.tamanho, ip.cor, p.nome
            FROM itens_pedido ip
            JOIN produtos p ON ip.produto_id = p.id
            WHERE ip.pedido_id = ?
        `, [req.params.id]);

        res.json({ pedido: pedido[0], produtos });
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar detalhes do pedido administrativo." });
    }
});

// ============================================================
// ROTA 6: CALCULAR FRETE (MELHOR ENVIO) - INTEGRADO AO FRONT-END
// ============================================================
app.post('/api/frete/calcular', async (req, res) => {
    try {
        // Ajustado para ler 'cepDestino' exatamente como o front envia
        const { cepDestino, itens } = req.body;

        if (!cepDestino || !itens || itens.length === 0) {
            return res.status(400).json({ error: "CEP de destino e itens do carrinho são obrigatórios." });
        }

        // 1. Buscar dimensões, pesos e preços reais dos produtos no banco de dados (Adicionado a coluna 'preco')
        const ids = itens.map(item => item.id);
        const placeholders = ids.map(() => '?').join(',');
        
        const [produtosDb] = await db.query(
            `SELECT id, nome, peso, largura, altura, comprimento, preco FROM produtos WHERE id IN (${placeholders})`,
            ids
        );

        // 2. Montar a lista de produtos (products) no formato esperado pelo Melhor Envio
        const productsPayload = itens.map(item => {
            const produtoInfo = produtosDb.find(p => p.id === item.id);
            
            // Valores padrão caso não existam no banco
            const peso = produtoInfo ? parseFloat(produtoInfo.peso) : 0.1;
            const largura = produtoInfo ? parseFloat(produtoInfo.largura) : 11.0;
            const altura = produtoInfo ? parseFloat(produtoInfo.altura) : 2.0;
            const comprimento = produtoInfo ? parseFloat(produtoInfo.comprimento) : 16.0;
            const precoReal = produtoInfo ? parseFloat(produtoInfo.preco) : 0.0;

            return {
                id: String(item.id),
                weight: peso,
                width: largura,
                height: altura,
                length: comprimento,
                insurance_value: precoReal, // Passa o valor do banco para o seguro do frete
                quantity: parseInt(item.quantidade, 10)
            };
        });

        // 3. Montar o payload final de cálculo
        const cepOrigemLimpo = process.env.LOJA_CEP_ORIGEM.replace(/\D/g, '');
        const cepDestinoLimpo = cepDestino.replace(/\D/g, '');

        const payloadMelhorEnvio = {
            from: { postal_code: cepOrigemLimpo },
            to: { postal_code: cepDestinoLimpo },
            products: productsPayload
        };

        // 4. Requisição para o Melhor Envio
        const response = await fetch(`${process.env.MELHORENVIO_URL}/api/v2/me/shipment/calculate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MELHORENVIO_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Aplicação Automação (contato@sualoja.com)'
            },
            body: JSON.stringify(payloadMelhorEnvio)
        });

        const dadosFrete = await response.json();

        if (!response.ok) {
            console.error("❌ Erro do Melhor Envio ao calcular:", dadosFrete);
            return res.status(500).json({ error: "Erro ao calcular frete no Melhor Envio.", detalhes: dadosFrete });
        }

        // 5. Filtra as opções sem erros e devolve o objeto bruto completo para o front ler sem falhas!
        const opcoesValidas = dadosFrete.filter(opcao => !opcao.error);

        return res.json(opcoesValidas);

    } catch (error) {
        console.error("💥 Erro interno ao calcular frete:", error);
        return res.status(500).json({ error: "Erro interno no servidor de frete." });
    }
});

// ============================================================
// ROTA 7: GERAR E COMPRAR ETIQUETA (MELHOR ENVIO)
// ============================================================
app.post('/api/frete/gerar-etiqueta', async (req, res) => {
    try {
        const { pedido_id, service_id } = req.body;

        if (!pedido_id || !service_id) {
            return res.status(400).json({ error: "ID do pedido e ID do serviço de frete são obrigatórios." });
        }

        // 1. Buscar os detalhes do pedido no banco de dados
        const [pedidos] = await db.query("SELECT * FROM pedidos WHERE id = ?", [pedido_id]);
        if (pedidos.length === 0) {
            return res.status(404).json({ error: "Pedido não localizado." });
        }
        const pedido = pedidos[0];

        // 2. Buscar os itens do pedido com suas respectivas dimensões físicas
        const [itens] = await db.query(`
            SELECT ip.quantidade, ip.preco_unitario, p.id, p.nome, p.peso, p.largura, p.altura, p.comprimento
            FROM itens_pedido ip
            JOIN produtos p ON ip.produto_id = p.id
            WHERE ip.pedido_id = ?
        `, [pedido_id]);

        const volumes = itens.map(item => ({
            weight: parseFloat(item.peso),
            width: parseFloat(item.largura),
            height: parseFloat(item.altura),
            length: parseFloat(item.comprimento),
            insurance_value: parseFloat(item.preco_unitario),
            quantity: parseInt(item.quantidade, 10)
        }));

        // Limpeza dos dados cadastrais
        const ddd = pedido.cliente_telefone.substring(0, 2);
        const numeroTelefone = pedido.cliente_telefone.substring(2);

        // 3. Montar o payload para registrar a etiqueta no Carrinho do Melhor Envio
        const payloadEtiqueta = {
            service: parseInt(service_id, 10),
            agency: 1, 
            from: {
                name: "Gleiton Brito Bernardes", 
                phone: "62999999999",
                email: "gleiton@exemplo.com",
                document: "00000000000", 
                address: "R. C-257",
                number: "146",
                district: "Nova Suiça",
                city: "Goiânia",
                state_abbr: "GO",
                postal_code: process.env.LOJA_CEP_ORIGEM.replace(/\D/g, '')
            },
            to: {
                name: pedido.cliente_nome,
                phone: `${ddd}${numeroTelefone}`,
                email: pedido.cliente_email,
                document: pedido.cliente_cpf,
                address: pedido.logradouro,
                number: pedido.numero,
                district: pedido.bairro,
                city: pedido.cidade,
                state_abbr: pedido.estado,
                postal_code: pedido.cep.replace(/\D/g, '')
            },
            products: itens.map(item => ({
                name: item.nome,
                quantity: item.quantidade,
                unitary_value: parseFloat(item.preco_unitario)
            })),
            volumes: volumes,
            options: {
                insurance_value: parseFloat(pedido.total),
                receipt: false,
                own_hand: false,
                reverse: false,
                non_commercial: true 
            }
        };

        // 4. Enviar a etiqueta para o carrinho do Melhor Envio
        const responseCarrinho = await fetch(`${process.env.MELHORENVIO_URL}/api/v2/me/cart`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MELHORENVIO_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Aplicação Automação (contato@sualoja.com)'
            },
            body: JSON.stringify(payloadEtiqueta)
        });

        const dadosCarrinho = await responseCarrinho.json();

        if (!responseCarrinho.ok) {
            console.error("❌ Erro ao adicionar etiqueta ao carrinho:", dadosCarrinho);
            return res.status(500).json({ error: "Erro ao adicionar etiqueta ao carrinho do Melhor Envio.", detalhes: dadosCarrinho });
        }

        const etiquetaId = dadosCarrinho.id; 

        // 5. Comprar a etiqueta que está no carrinho
        const responseCompra = await fetch(`${process.env.MELHORENVIO_URL}/api/v2/me/shipment/checkout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MELHORENVIO_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ orders: [etiquetaId] })
        });

        const dadosCompra = await responseCompra.json();

        if (!responseCompra.ok) {
            console.error("❌ Erro ao pagar etiqueta:", dadosCompra);
            return res.status(500).json({ error: "Erro ao finalizar a compra da etiqueta no Melhor Envio.", detalhes: dadosCompra });
        }

        // 6. Atualizar os dados do frete e etiqueta no banco de dados local
        await db.query(
            "UPDATE pedidos SET melhorenvio_etiqueta_id = ?, status_envio = 'PREPARANDO' WHERE id = ?",
            [etiquetaId, pedido_id]
        );

        return res.json({
            message: "Etiqueta criada e comprada com sucesso!",
            etiqueta_id: etiquetaId,
            detalhes: dadosCompra
        });

    } catch (error) {
        console.error("💥 Erro interno ao gerar etiqueta:", error);
        return res.status(500).json({ error: "Erro interno ao gerar etiqueta de frete." });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Sucesso: Servidor rodando redondinho na porta ${PORT}!`);
});
