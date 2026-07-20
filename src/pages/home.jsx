import React, { useState, useEffect } from 'react';
import './home.css';
import iconeCaminhao from '../../imagem/icone-caminhao.png';

function Home() {
  const [produtoDestaque, setProdutoDestaque] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [fotoAtual, setFotoAtual] = useState(0);

  const [checkoutAtivo, setCheckoutAtivo] = useState(false);
  const [enviandoPagamento, setEnviandoPagamento] = useState(false);

  // --- ESTADOS DO FRETE ---
  const [carregandoFrete, setCarregandoFrete] = useState(false);
  const [opcoesFrete, setOpcoesFrete] = useState([]);
  const [freteSelecionado, setFreteSelecionado] = useState(null);
  const [erroFrete, setErroFrete] = useState('');

  const [clienteForm, setClienteForm] = useState({ nome: '', email: '', cpf: '', telefone: '' });
  const [enderecoForm, setEnderecoForm] = useState({ cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '' });

  useEffect(() => {
    const carregarDestaque = async () => {
      try {
        const resposta = await fetch('/api/produtos');
        if (!resposta.ok) throw new Error('Erro ao buscar dados do servidor');
        const dados = await resposta.json();
        if (dados.length > 0) {
          setProdutoDestaque(dados[12]);
        }
      } catch (error) {
        console.error("Erro ao carregar produto em destaque:", error);
      } finally {
        setCarregando(false);
      }
    };
    carregarDestaque();
  }, []);

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
    setFotoAtual((prev) => (prev + 1) % produtoDestaque.imagens.length);
  };

  const fotoAnterior = (e) => {
    e.stopPropagation();
    setFotoAtual((prev) => (prev - 1 + produtoDestaque.imagens.length) % produtoDestaque.imagens.length);
  };

  const abrirModal = () => {
    setFotoAtual(0);
    setModalAberto(true);
  };

  const fecharModal = () => setModalAberto(false);

  const iniciarCompra = () => {
    setModalAberto(false);
    setCheckoutAtivo(true);
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
          itens: [{ id: produtoDestaque.id, quantidade: 1 }]
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
    const totalComFrete = Number(produtoDestaque.preco) + valorDoFrete;

    const payloadFinal = {
      pedido: {
        cliente: clienteForm,
        endereco: enderecoForm,
        total: totalComFrete,
        frete: {
          valor: valorDoFrete,
          meio: `${freteSelecionado.company.name} - ${freteSelecionado.name}`
        },
        itens: [{
          id: produtoDestaque.id,
          nome: produtoDestaque.nome || produtoDestaque.name,
          preco_unitario: Number(produtoDestaque.preco),
          quantidade: 1,
          tamanho: null,
          cor: null
        }]
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
        throw new Error(dados.error || 'Erro ao processar checkout no servidor back-end.');
      }

      if (dados.url_pagamento) {
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

  if (carregando) {
    return <div className="home-carregando">Carregando destaque...</div>;
  }

  if (!produtoDestaque) {
    return (
      <div className="home-hero">
        <h1>Bem-vindo à nossa loja!</h1>
        <p>Nenhum produto em destaque no momento.</p>
      </div>
    );
  }

  const precoAntigoSimulado = Number(produtoDestaque.preco) * 1.35;

  return (
    <div className="home-container">

      <section className="home-hero">
        <div className="home-hero-texto">
          <span className="home-tag">Destaque do Mês</span>
          <h1>{produtoDestaque.nome || produtoDestaque.name}</h1>
          <p className="home-hero-descricao">
            {produtoDestaque.descricao || "Uma seleção especial, escolhida só para você."}
          </p>

          <div className="container-precos-vitrine">
            <span className="preco-antigo-rasurado">
              R$ {precoAntigoSimulado.toFixed(2).replace('.', ',')}
            </span>
            <span className="home-hero-preco">
              R$ {Number(produtoDestaque.preco).toFixed(2).replace('.', ',')}
            </span>
          </div>

          <div className="card-entrega-container">
            <span>para o seu endereço</span>
            <img src={iconeCaminhao} alt="Ícone de entrega" className="icone-entrega-caminhao" />
          </div>

          <div className="home-hero-botoes">
            <button className="home-btn-primario" onClick={iniciarCompra}>
              Comprar Agora
            </button>
            <button className="home-btn-secundario" onClick={abrirModal}>
              Ver Fotos
            </button>
          </div>
        </div>

        <div className="home-hero-imagem" onClick={abrirModal}>
          {produtoDestaque.imagens && produtoDestaque.imagens.length > 0 ? (
            <img src={produtoDestaque.imagens[0]} alt={produtoDestaque.nome || produtoDestaque.name} />
          ) : (
            <div className="sem-foto">Sem Imagem</div>
          )}
        </div>
      </section>

      {modalAberto && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal-conteudo" onClick={(e) => e.stopPropagation()}>
            <button className="modal-botao-fechar" onClick={fecharModal}>&times;</button>
            <div className="modal-layout-flex">

              <div className="carrossel-container">
                {produtoDestaque.imagens && produtoDestaque.imagens.length > 1 && (
                  <button className="seta-carrossel seta-esquerda" onClick={fotoAnterior}>&#10094;</button>
                )}

                {produtoDestaque.imagens && produtoDestaque.imagens.length > 0 ? (
                  <img src={produtoDestaque.imagens[fotoAtual]} alt="Foto" className="imagem-carrossel" />
                ) : (
                  <div className="sem-foto">Sem imagem disponível</div>
                )}

                {produtoDestaque.imagens && produtoDestaque.imagens.length > 1 && (
                  <button className="seta-carrossel seta-direita" onClick={proximaFoto}>&#10095;</button>
                )}

                <div className="carrossel-indicadores">
                  {produtoDestaque.imagens && produtoDestaque.imagens.map((_, index) => (
                    <span key={index} className={`bolinha ${index === fotoAtual ? 'ativa' : ''}`}></span>
                  ))}
                </div>
              </div>

              <div className="modal-detalhes-compra">
                <h2>{produtoDestaque.nome || produtoDestaque.name}</h2>

                <div className="container-precos-modal">
                  <span className="modal-preco-antigo">
                    R$ {precoAntigoSimulado.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="modal-preco">
                    R$ {Number(produtoDestaque.preco).toFixed(2).replace('.', ',')}
                  </span>
                </div>

                <div className="modal-entrega-container">
                  <span>para o seu endereço</span>
                  <img src={iconeCaminhao} alt="Ícone de entrega" className="icone-entrega-caminhao" />
                </div>

                <p className="modal-descricao">
                  {produtoDestaque.descricao || "Peça em destaque, selecionada especialmente para você."}
                </p>
                <div className="botoes-acoes">
                  <button className="btn-comprar" onClick={iniciarCompra}>
                    Comprar Agora
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {checkoutAtivo && (
        <div className="modal-overlay">
          <div className="modal-conteudo modal-checkout">
            <button className="modal-botao-fechar" onClick={() => setCheckoutAtivo(false)}>&times;</button>

            <h3>Finalizar Pedido</h3>

            <div className="checkout-resumo-valores">
              <p><strong>Subtotal:</strong> R$ {Number(produtoDestaque.preco).toFixed(2).replace('.', ',')}</p>
              {freteSelecionado && (
                <p><strong>Frete ({freteSelecionado.company.name}):</strong> R$ {Number(freteSelecionado.price).toFixed(2).replace('.', ',')}</p>
              )}
              <h4 className="checkout-valor-destaque">
                <strong>Valor Total:</strong> R$ {(Number(produtoDestaque.preco) + (freteSelecionado ? Number(freteSelecionado.price) : 0)).toFixed(2).replace('.', ',')}
              </h4>
            </div>

            <form onSubmit={confirmarPagamentoFinal} className="checkout-form">

              <h4 className="checkout-secao-titulo">Dados Pessoais</h4>
              <input type="text" name="nome" placeholder="Nome Completo" required value={clienteForm.nome} onChange={handleClienteChange} className="checkout-input" />
              <input type="email" name="email" placeholder="E-mail" required value={clienteForm.email} onChange={handleClienteChange} className="checkout-input" />

              <div className="form-row">
                <input
                  type="text" name="cpf" placeholder="CPF (Apenas 11 números)" required
                  maxLength="11" pattern="\d{11}"
                  title="Digite os 11 números do seu CPF (sem pontos ou traços)"
                  value={clienteForm.cpf} onChange={handleClienteChange} className="checkout-input flex-1"
                />
                <input
                  type="text" name="telefone" placeholder="WhatsApp (DDD + Número)" required
                  maxLength="11" pattern="\d{10,11}"
                  title="Digite o DDD + Número (apenas os 10 ou 11 números)"
                  value={clienteForm.telefone} onChange={handleClienteChange} className="checkout-input flex-1"
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
                <p>Você irá para o ambiente oficial do <strong>PagBank</strong> para efetuar o pagamento seguro (Pix, Cartão ou Boleto).</p>
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

    </div>
  );
}

export default Home;