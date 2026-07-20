import React, { useState, useEffect } from 'react';
import './masc.css'; // Mantenha ou altere para o CSS específico se preferir

// Importação do ícone de entrega apontando para a sua pasta de imagens
import iconeCaminhao from '../../imagem/icone-caminhao.png'; // Ajuste a extensão (.png, .svg, .jpg) se necessário

function Feminino() {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [fotoAtual, setFotoAtual] = useState(0);

  const [tamanhoSelecionado, setTamanhoSelecionado] = useState('');
  const [corSelecionada, setCorSelecionada] = useState('');

  const [carrinho, setCarrinho] = useState(() => {
    try {
      const salvo = localStorage.getItem('meu_carrinho');
      return salvo ? JSON.parse(salvo) : [];
    } catch (error) {
      console.error("Erro ao ler localStorage:", error);
      return [];
    }
  });
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);

  const [enviandoPagamento, setEnviandoPagamento] = useState(false);
  const [checkoutAtivo, setCheckoutAtivo] = useState(false);
  const [dadosCheckout, setDadosCheckout] = useState({ itens: [], tipo: '', total: 0 });

  // --- ESTADOS DO FRETE ---
  const [carregandoFrete, setCarregandoFrete] = useState(false);
  const [opcoesFrete, setOpcoesFrete] = useState([]);
  const [freteSelecionado, setFreteSelecionado] = useState(null);
  const [erroFrete, setErroFrete] = useState('');

  const [clienteForm, setClienteForm] = useState({ nome: '', email: '', cpf: '', telefone: '' });
  const [enderecoForm, setEnderecoForm] = useState({ cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '' });

  useEffect(() => {
    const carregarProdutos = async () => {
      try {
        const resposta = await fetch('/api/produtos');
        if (!resposta.ok) throw new Error('Erro ao buscar dados do servidor');
        const dados = await resposta.json();
        // --- FILTRO DA CATEGORIA ---
        const apenasFeminino = dados.filter(p => p.categoria === 'Feminino');
        setProdutos(apenasFeminino);
      } catch (error) {
        console.error("Erro ao integrar com o Banco de Dados no setor feminino:", error);
      } finally {
        setCarregando(false);
      }
    };
    carregarProdutos();
  }, []);

  useEffect(() => {
    localStorage.setItem('meu_carrinho', JSON.stringify(carrinho));
  }, [carrinho]);

  useEffect(() => {
    setTamanhoSelecionado('');
    setCorSelecionada('');
  }, [produtoSelecionado]);

  // Reseta o frete e endereço sempre que o checkout fecha
  useEffect(() => {
    if (!checkoutAtivo) {
      setOpcoesFrete([]);
      setFreteSelecionado(null);
      setErroFrete('');
      setEnderecoForm({ cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '' });
    }
  }, [checkoutAtivo]);

  const proximaFoto = (e) => {
    e.stopPropagation();
    if (produtoSelecionado?.imagens?.length) {
      setFotoAtual((prev) => (prev + 1) % produtoSelecionado.imagens.length);
    }
  };

  const fotoAnterior = (e) => {
    e.stopPropagation();
    if (produtoSelecionado?.imagens?.length) {
      setFotoAtual((prev) => (prev - 1 + produtoSelecionado.imagens.length) % produtoSelecionado.imagens.length);
    }
  };

  const abrirModal = (produto) => {
    setProdutoSelecionado(produto);
    setFotoAtual(0);
  };

  const fecharModal = () => setProdutoSelecionado(null);

  const adicionarAoCarrinho = (produto) => {
    setCarrinho((carrinhoAtual) => {
      const itemExistente = carrinhoAtual.find(item =>
        item.id === produto.id &&
        item.tamanhoEscolhido === tamanhoSelecionado &&
        item.corEscolhida === corSelecionada
      );

      if (itemExistente) {
        return carrinhoAtual.map(item =>
          (item.id === produto.id && item.tamanhoEscolhido === tamanhoSelecionado && item.corEscolhida === corSelecionada)
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }

      return [...carrinhoAtual, {
        ...produto,
        quantidade: 1,
        tamanhoEscolhido: tamanhoSelecionado,
        corEscolhida: corSelecionada
      }];
    });

    setProdutoSelecionado(null);
    setCarrinhoAberto(true);
  };

  const alterarQuantidade = (id, incremento) => {
    setCarrinho((carrinhoAtual) =>
      carrinhoAtual.map(item => {
        if (item.id === id) {
          const novaQtd = item.quantidade + incremento;
          return novaQtd > 0 ? { ...item, quantidade: novaQtd } : item;
        }
        return item;
      })
    );
  };

  const removerDoCarrinho = (id) => {
    setCarrinho((carrinhoAtual) => carrinhoAtual.filter(item => item.id !== id));
  };

  const calcularTotalCarrinho = () => {
    return carrinho.reduce((total, item) => total + (Number(item.preco) * item.quantidade), 0);
  };

  const iniciarCheckout = (itens, tipo, valorTotal) => {
    setDadosCheckout({ itens, tipo, total: valorTotal });
    setProdutoSelecionado(null);
    setCarrinhoAberto(false);
    setCheckoutAtivo(true);
  };

  const finalizarCompraIsolada = (item) => {
    const itemFormatado = {
      ...item,
      quantidade: item.quantidade || 1,
      tamanhoEscolhido: tamanhoSelecionado,
      corEscolhida: corSelecionada
    };
    iniciarCheckout([itemFormatado], "individual", Number(itemFormatado.preco) * itemFormatado.quantidade);
  };

  const finalizarCompraTudo = () => {
    iniciarCheckout(carrinho, "carrinho_completo", calcularTotalCarrinho());
  };

  const handleClienteChange = (e) => {
    setClienteForm({ ...clienteForm, [e.target.name]: e.target.value });
  };

  const handleEnderecoChange = (e) => {
    setEnderecoForm({ ...enderecoForm, [e.target.name]: e.target.value });
  };

  const handleCepChange = (e) => {
    const valor = e.target.value.replace(/\D/g, '').slice(0, 8);
    setEnderecoForm(prev => ({ ...prev, cep: valor }));
  };

  // --- CÁLCULO DE FRETE (acionado pelo botão) ---
  const calcularFrete = async () => {
    const cepLimpo = enderecoForm.cep.replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
      setErroFrete('Digite um CEP válido com 8 dígitos.');
      return;
    }

    setCarregandoFrete(true);
    setErroFrete('');
    setOpcoesFrete([]);
    setFreteSelecionado(null);

    try {
      const resCep = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const dadosCep = await resCep.json();

      if (!dadosCep.erro) {
        setEnderecoForm(prev => ({
          ...prev,
          rua: dadosCep.logradouro || '',
          bairro: dadosCep.bairro || '',
          cidade: dadosCep.localidade || '',
          estado: dadosCep.uf || ''
        }));
      } else {
        setErroFrete('CEP não encontrado.');
        setCarregandoFrete(false);
        return;
      }

      const resFrete = await fetch('/api/frete/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cepDestino: cepLimpo,
          itens: dadosCheckout.itens.map(item => ({
            id: item.id,
            quantidade: item.quantidade
          }))
        })
      });

      if (!resFrete.ok) throw new Error('Falha ao calcular frete no backend');

      const fretes = await resFrete.json();
      const fretesValidos = fretes.filter(f => !f.error);

      if (fretesValidos.length === 0) {
        setErroFrete('Nenhuma transportadora disponível para este CEP.');
      }
      setOpcoesFrete(fretesValidos);
    } catch (error) {
      console.error("Erro ao processar frete:", error);
      setErroFrete('Não conseguimos obter as opções de envio para este CEP.');
    } finally {
      setCarregandoFrete(false);
    }
  };

  const confirmarPagamentoFinal = async (e) => {
    e.preventDefault();

    if (!freteSelecionado) {
      alert("Por favor, calcule e selecione um método de frete para continuar.");
      return;
    }

    setEnviandoPagamento(true);

    const valorDoFrete = Number(freteSelecionado.price);
    const totalComFrete = dadosCheckout.total + valorDoFrete;

    const payloadFinal = {
      pedido: {
        cliente: clienteForm,
        endereco: enderecoForm,
        total: totalComFrete,
        frete: {
          valor: valorDoFrete,
          meio: `${freteSelecionado.company.name} - ${freteSelecionado.name}`
        },
        itens: dadosCheckout.itens.map(item => ({
          id: item.id,
          nome: item.nome || item.name,
          preco_unitario: Number(item.preco),
          quantidade: item.quantidade,
          tamanho: item.tamanhoEscolhido || null,
          cor: item.corEscolhida || null
        }))
      }
    };

    try {
      const resposta = await fetch('/api/pagamento/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFinal)
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.error || dados.detalhes?.message || 'Erro ao processar checkout no servidor back-end.');
      }

      if (dados.url_pagamento) {
        if (dadosCheckout.tipo === "carrinho_completo") {
          setCarrinho([]);
        }
        setCheckoutAtivo(false);
        window.location.href = dados.url_pagamento;
      } else {
        alert("Erro: Link de redirecionamento não foi gerado pela Gateway.");
      }
    } catch (error) {
      console.error("Erro na integração do pagamento:", error);
      alert(error.message || "Houve uma falha ao conectar com o PagBank. Tente novamente.");
    } finally {
      setEnviandoPagamento(false);
    }
  };

  const parseAtributos = (atributo) => {
    if (!atributo) return [];
    if (typeof atributo === 'string') {
      try {
        return JSON.parse(atributo);
      } catch (e) {
        return [atributo];
      }
    }
    return atributo;
  };

  const tamanhosDisponiveis = parseAtributos(produtoSelecionado?.tamanhos_disponiveis);
  const coresDisponiveis = parseAtributos(produtoSelecionado?.cores_disponiveis);

  const podeProsseguir =
    (tamanhosDisponiveis.length === 0 || tamanhoSelecionado !== '') &&
    (coresDisponiveis.length === 0 || corSelecionada !== '');

  return (
    <div className="pagina-masculino"> {/* Mantido para usar o mesmo CSS */}

      <div className="carrinho-icone-container" onClick={() => setCarrinhoAberto(true)}>
        <span className="icone-carrinho-svg">🛒</span>
        {carrinho.length > 0 && <div className="carrinho-badge ativo"></div>}
      </div>

      {/* --- CABEÇALHO ADAPTADO --- */}
      <header className="masculino-header">
        <h2>Moda Feminina</h2>
        <p>Vestidos, blusas e conjuntos com o melhor do estilo contemporâneo</p>
      </header>

      {carregando && <p className="status-texto">Carregando catálogo feminino...</p>}

      {!carregando && produtos.length === 0 && (
        <p className="status-texto">Nenhum produto cadastrado na categoria Feminino.</p>
      )}

      <section className="grade-produtos">
        {produtos.map((produto) => {
          // Calcula um preço "antigo" simulado (35% mais caro) para efeito visual de desconto
          const precoAntigoSimulado = Number(produto.preco) * 1.35;

          return (
            <div key={produto.id} className="card-produto" onClick={() => abrirModal(produto)}>
              <div className="card-imagem-container">
                {produto.imagens && produto.imagens.length > 0 ? (
                  <img src={produto.imagens[0]} alt={produto.nome || produto.name} className="card-imagem" />
                ) : (
                  <div className="sem-foto">Sem Imagem</div>
                )}
              </div>
              <div className="card-info">
                <h3>{produto.nome || produto.name}</h3>
                <div className="container-precos-vitrine">
                  <span className="preco-antigo-rasurado">
                    R$ {precoAntigoSimulado.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="produto-preco">
                    R$ {Number(produto.preco).toFixed(2).replace('.', ',')}
                  </span>
                </div>

                {/* Indicador de frete abaixo do preço na vitrine */}
                <div className="card-entrega-container">
                  <span>para o seu endereço</span>
                  <img src={iconeCaminhao} alt="Ícone de entrega" className="icone-entrega-caminhao" />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {produtoSelecionado && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal-conteudo" onClick={(e) => e.stopPropagation()}>
            <button className="modal-botao-fechar" onClick={fecharModal}>&times;</button>
            <div className="modal-layout-flex">

              <div className="carrossel-container">
                {produtoSelecionado.imagens && produtoSelecionado.imagens.length > 1 && (
                  <button className="seta-carrossel seta-esquerda" onClick={fotoAnterior}>&#10094;</button>
                )}

                {produtoSelecionado.imagens && produtoSelecionado.imagens.length > 0 ? (
                  <img src={produtoSelecionado.imagens[fotoAtual]} alt="Foto" className="imagem-carrossel" />
                ) : (
                  <div className="sem-foto">Sem imagem disponível</div>
                )}

                {produtoSelecionado.imagens && produtoSelecionado.imagens.length > 1 && (
                  <button className="seta-carrossel seta-direita" onClick={proximaFoto}>&#10095;</button>
                )}

                <div className="carrossel-indicadores">
                  {produtoSelecionado.imagens && produtoSelecionado.imagens.map((_, index) => (
                    <span key={index} className={`bolinha ${index === fotoAtual ? 'ativa' : ''}`}></span>
                  ))}
                </div>
              </div>

              <div className="modal-detalhes-compra">
                <h2>{produtoSelecionado.nome || produtoSelecionado.name}</h2>

                <div className="container-precos-modal">
                  <span className="modal-preco-antigo">
                    R$ {(Number(produtoSelecionado.preco) * 1.35).toFixed(2).replace('.', ',')}
                  </span>
                  <span className="modal-preco">
                    R$ {Number(produtoSelecionado.preco).toFixed(2).replace('.', ',')}
                  </span>
                </div>

                {/* Indicador de frete abaixo do preço no Modal interno do produto */}
                <div className="modal-entrega-container">
                  <span>para o seu endereço</span>
                  <img src={iconeCaminhao} alt="Ícone de entrega" className="icone-entrega-caminhao" />
                </div>

                <p className="modal-descricao">
                  {produtoSelecionado.descricao || "Peça desenvolvida com tecidos selecionados proporcionando excelente caimento, durabilidade e conforto para o seu dia a dia."}
                </p>

                {tamanhosDisponiveis.length > 0 && (
                  <div className="seletor-atributo">
                    <h4>Selecione o Tamanho:</h4>
                    <div className="opcoes-container">
                      {tamanhosDisponiveis.map((tam) => (
                        <button
                          key={tam}
                          className={`btn-opcao ${tamanhoSelecionado === tam ? 'selecionado' : ''}`}
                          onClick={() => setTamanhoSelecionado(tam)}
                        >
                          {tam}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {coresDisponiveis.length > 0 && (
                  <div className="seletor-atributo">
                    <h4>Selecione a Cor:</h4>
                    <div className="opcoes-container">
                      {coresDisponiveis.map((cor) => (
                        <button
                          key={cor}
                          className={`btn-opcao ${corSelecionada === cor ? 'selecionado' : ''}`}
                          onClick={() => setCorSelecionada(cor)}
                        >
                          {cor}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="botoes-acoes">
                  <button
                    className="btn-comprar"
                    onClick={() => finalizarCompraIsolada(produtoSelecionado)}
                    disabled={!podeProsseguir}
                  >
                    {podeProsseguir ? 'Comprar Agora' : 'Selecione as opções obrigatórias'}
                  </button>
                  <button
                    className="btn-carrinho"
                    onClick={() => adicionarAoCarrinho(produtoSelecionado)}
                    disabled={!podeProsseguir}
                  >
                    Adicionar ao Carrinho
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`carrinho-lateral ${carrinhoAberto ? 'aberto' : ''}`}>
        <div className="carrinho-header">
          <h3>Meu Carrinho</h3>
          <button className="btn-fechar-carrinho" onClick={() => setCarrinhoAberto(false)}>&times;</button>
        </div>
        <div className="carrinho-itens">
          {carrinho.length === 0 ? (
            <p className="carrinho-vazio-texto">Seu carrinho está vazio.</p>
          ) : (
            carrinho.map((item, index) => (
              <div key={`${item.id}-${index}`} className="item-no-carrinho">
                <img src={item.imagens ? item.imagens[0] : ''} alt={item.nome || item.name} className="item-carrinho-img" />
                <div className="item-carrinho-detalhes">
                  <h4>{item.nome || item.name}</h4>

                  {(item.tamanhoEscolhido || item.corEscolhida) && (
                    <p className="item-carrinho-variacao">
                      {item.tamanhoEscolhido && <span>Tam: {item.tamanhoEscolhido}</span>}
                      {item.corEscolhida && <span> | Cor: {item.corEscolhida}</span>}
                    </p>
                  )}

                  <p className="item-carrinho-preco">R$ {(Number(item.preco) * item.quantidade).toFixed(2).replace('.', ',')}</p>
                  <div className="item-carrinho-qtd-seletor">
                    <button onClick={() => alterarQuantidade(item.id, -1)}>-</button>
                    <span>{item.quantidade}</span>
                    <button onClick={() => alterarQuantidade(item.id, 1)}>+</button>
                  </div>
                </div>
                <div className="item-carrinho-acoes-direita">
                  <button className="btn-remover-item" onClick={() => removerDoCarrinho(item.id)}>🗑️</button>
                  <button className="btn-comprar-isolado" onClick={() => finalizarCompraIsolada(item)}>Comprar</button>
                </div>
              </div>
            ))
          )}
        </div>
        {carrinho.length > 0 && (
          <div className="carrinho-footer">
            <div className="carrinho-total">
              <span>Total:</span>
              <span>R$ {calcularTotalCarrinho().toFixed(2).replace('.', ',')}</span>
            </div>
            <button className="btn-finalizar-tudo" onClick={finalizarCompraTudo}>
              Finalizar Compra do Conjunto
            </button>
          </div>
        )}
      </div>

      {checkoutAtivo && (
        <div className="modal-overlay">
          <div className="modal-conteudo modal-checkout">
            <button className="modal-botao-fechar" onClick={() => setCheckoutAtivo(false)}>&times;</button>

            <h3>Finalizar Pedido</h3>

            <div className="checkout-resumo-valores">
              <p><strong>Subtotal dos itens:</strong> R$ {dadosCheckout.total.toFixed(2).replace('.', ',')}</p>
              {freteSelecionado && (
                <p><strong>Frete ({freteSelecionado.company.name}):</strong> R$ {Number(freteSelecionado.price).toFixed(2).replace('.', ',')}</p>
              )}
              <h4 className="checkout-valor-destaque">
                <strong>Valor Total:</strong> R$ {(dadosCheckout.total + (freteSelecionado ? Number(freteSelecionado.price) : 0)).toFixed(2).replace('.', ',')}
              </h4>
            </div>

            <form onSubmit={confirmarPagamentoFinal} className="checkout-form">

              <h4 className="checkout-secao-titulo">Dados Pessoais</h4>
              <input type="text" name="nome" placeholder="Nome Completo" required value={clienteForm.nome} onChange={handleClienteChange} className="checkout-input" />
              <input type="email" name="email" placeholder="E-mail" required value={clienteForm.email} onChange={handleClienteChange} className="checkout-input" />

              <div className="form-row">
                <input
                  type="text"
                  name="cpf"
                  placeholder="CPF (Apenas 11 números)"
                  required
                  maxLength="11"
                  pattern="\d{11}"
                  title="Digite os 11 números do seu CPF (sem pontos ou traços)"
                  value={clienteForm.cpf}
                  onChange={handleClienteChange}
                  className="checkout-input flex-1"
                />
                <input
                  type="text"
                  name="telefone"
                  placeholder="WhatsApp (DDD + Número)"
                  required
                  maxLength="11"
                  pattern="\d{10,11}"
                  title="Digite o DDD + Número (apenas os 10 ou 11 números)"
                  value={clienteForm.telefone}
                  onChange={handleClienteChange}
                  className="checkout-input flex-1"
                />
              </div>

              <h4 className="checkout-secao-titulo">Endereço de Entrega</h4>
              <div className="form-row">
                <input
                  type="text"
                  name="cep"
                  placeholder="Digite seu CEP"
                  inputMode="numeric"
                  maxLength="8"
                  required
                  value={enderecoForm.cep}
                  onChange={handleCepChange}
                  className="checkout-input flex-1"
                />
                <button
                  type="button"
                  onClick={calcularFrete}
                  disabled={carregandoFrete}
                  className="btn-calcular-frete"
                >
                  {carregandoFrete ? 'Calculando...' : 'Calcular Frete'}
                </button>
              </div>

              {erroFrete && <p className="frete-status-msg erro">{erroFrete}</p>}

              {enderecoForm.rua && (
                <>
                  <div className="form-row">
                    <input type="text" name="rua" placeholder="Rua / Logradouro" required value={enderecoForm.rua} onChange={handleEnderecoChange} className="checkout-input flex-1" />
                    <input type="text" name="estado" placeholder="UF" maxLength="2" required value={enderecoForm.estado} onChange={handleEnderecoChange} className="checkout-input estado-input" />
                  </div>
                  <div className="form-row">
                    <input type="text" name="numero" placeholder="Número" required value={enderecoForm.numero} onChange={handleEnderecoChange} className="checkout-input numero-input" />
                    <input type="text" name="bairro" placeholder="Bairro" required value={enderecoForm.bairro} onChange={handleEnderecoChange} className="checkout-input flex-1" />
                  </div>
                  <input type="text" name="cidade" placeholder="Cidade" required value={enderecoForm.cidade} onChange={handleEnderecoChange} className="checkout-input" />
                </>
              )}

              {opcoesFrete.length > 0 && (
                <>
                  <h4 className="checkout-secao-titulo">Opções de Envio</h4>
                  <div className="opcoes-frete-lista">
                    {opcoesFrete.map((opcao) => (
                      <label key={opcao.id} className={`opcao-frete-card ${freteSelecionado?.id === opcao.id ? 'ativo' : ''}`}>
                        <input
                          type="radio"
                          name="frete_opcao"
                          value={opcao.id}
                          checked={freteSelecionado?.id === opcao.id}
                          onChange={() => setFreteSelecionado(opcao)}
                        />
                        <div className="frete-logo-nome">
                          <img src={opcao.company.picture} alt={opcao.company.name} className="frete-transportadora-logo" />
                          <div>
                            <span className="frete-nome-servico">{opcao.company.name} ({opcao.name})</span>
                            <span className="frete-prazo">Chega em até {opcao.delivery_time} dias úteis</span>
                          </div>
                        </div>
                        <span className="frete-valor">R$ {Number(opcao.price).toFixed(2).replace('.', ',')}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div className="checkout-alerta-pix">
                <p>
                  Você será redirecionado para o ambiente oficial do <strong>PagBank</strong> para efetuar o pagamento seguro.
                </p>
              </div>

              <button
                type="submit"
                className="btn-comprar checkout-btn-confirmar"
                disabled={enviandoPagamento || !freteSelecionado}
                style={{ opacity: !freteSelecionado ? 0.6 : 1 }}
              >
                {enviandoPagamento ? 'Conectando ao PagBank...' : 'Confirmar e Ir para o Pagamento 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}

      {carrinhoAberto && <div className="carrinho-overlay ativo" onClick={() => setCarrinhoAberto(false)}></div>}
    </div>
  );
}

export default Feminino;
