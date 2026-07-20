import { useState } from 'react';
import './App.css';
import logo from '../imagem/minha-logo02.png';
import iconeHome from '../imagem/icone-home.png';

// IMPORTANDO TODAS AS SUAS PÁGINAS
import Home from './pages/home';
import Masculino from './pages/masculino';
import Feminino from './pages/feminino';
import Esportes from './pages/esportes';
import Calcados from './pages/calcados';
import Acessorios from './pages/acessorios';
import FaleConosco from './pages/fleConosco';

function App() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [telaAtiva, setTelaAtiva] = useState('Home');

  const opcoesMenu = [
    'Home',
    'Masculino',
    'Feminino',
    'Calçados',
    'Acessórios',
    'Esportes',
    'Fale Conosco',
    'Troca'
  ];

  const navegarPara = (opcao) => {
    setTelaAtiva(opcao);
    setMenuAberto(false);
  };

  return (
    <div className="app-container">
      {/* NAVBAR */}
      <header className="navbar">
        <button className="botao-hamburguer" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
          &#9776;
        </button>

        {/* LOGO SUBSTITUÍDA POR IMAGEM */}
        <div className="logo-container" onClick={() => setTelaAtiva('Home')}>
          <img src={logo} alt="Logo Malavada" className="logo-img" />
        </div>

        {/* BOTÃO HOME COM ÍCONE */}
        <button className="botao-home" onClick={() => setTelaAtiva('Home')} aria-label="Voltar para o início">
          <img src={iconeHome} alt="Início" className="icone-home-img" />
        </button>
      </header>

      {/* SIDEBAR */}
      <aside className={`sidebar ${menuAberto ? 'aberto' : ''}`}>
        <div className="sidebar-header">
          <h3>Categorias</h3>
          <button className="botao-fechar" onClick={() => setMenuAberto(false)}>&times;</button>
        </div>

        <nav className="sidebar-links">
          <ul>
            {opcoesMenu.map((opcao, index) => (
              <li key={index}>
                <button
                  className="link-menu"
                  onClick={() => navegarPara(opcao)}
                  style={{
                    background: 'none',
                    border: 'none',
                    font: 'inherit',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 0'
                  }}
                >
                  {opcao}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)}></div>}

      {/* CONTEÚDO PRINCIPAL DINÂMICO */}
      <main className="conteudo-principal">

        {telaAtiva === 'Home' && <Home />}
        {telaAtiva === 'Masculino' && <Masculino />}
        {telaAtiva === 'Feminino' && <Feminino />}
        {telaAtiva === 'Esportes' && <Esportes />}
        {telaAtiva === 'Calçados' && <Calcados />}
        {telaAtiva === 'Acessórios' && <Acessorios />}
        {telaAtiva === 'Fale Conosco' && <FaleConosco />}

        {telaAtiva === 'Troca' && (
          <div>
            <h1>Página de Trocas</h1>
            <p>Em breve você poderá gerenciar suas trocas e devoluções aqui.</p>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;