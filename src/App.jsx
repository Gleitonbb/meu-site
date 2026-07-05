import { useState } from 'react';
import './App.css';

function App() {
  // Estado para controlar se o menu está aberto ou fechado
  const [menuAberto, setMenuAberto] = useState(false);

  // Lista de opções do menu lateral
  const opcoesMenu = [
    'Masculino',
    'Feminino',
    'Calçados',
    'Acessórios',
    'Esportes',
    'Fale Conosco',
    'Troca'
  ];

  return (
    <div className="app-container">
      {/* --- CORDÃO SUPERIOR / NAVBAR --- */}
      <header className="navbar">
        {/* Botão Hambúrguer */}
        <button 
          className="botao-hamburguer" 
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
        >
          &#9776; {/* Símbolo Unicode para o menu hambúrguer */}
        </button>

        <div className="logo">Minha Loja</div>
        <div className="espaco-vazio"></div>
      </header>

      {/* --- MENU LATERAL (SIDEBAR) --- */}
      {/* Se menuAberto for true, adiciona a classe 'aberto' */}
      <aside className={`sidebar ${menuAberto ? 'aberto' : ''}`}>
        <div className="sidebar-header">
          <h3>Categorias</h3>
          {/* Botão para fechar o menu */}
          <button className="botao-fechar" onClick={() => setMenuAberto(false)}>
            &times; {/* Símbolo Unicode para o 'X' de fechar */}
          </button>
        </div>

        <nav className="sidebar-links">
          <ul>
            {opcoesMenu.map((opcao, index) => (
              <li key={index}>
                <a href={`#${opcao.toLowerCase().replace(' ', '-')}`} onClick={() => setMenuAberto(false)}>
                  {opcao}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Fundo escuro atrás do menu quando ele estiver aberto */}
      {menuAberto && (
        <div className="overlay" onClick={() => setMenuAberto(false)}></div>
      )}

      {/* --- CONTEÚDO PRINCIPAL DA PÁGINA --- */}
      <main className="conteudo-principal">
        <h1>Bem-vindo à nossa loja!</h1>
        <p>Clique no menu hambúrguer no canto superior esquerdo para navegar pelas categorias.</p>
      </main>
    </div>
  );
}

export default App;
