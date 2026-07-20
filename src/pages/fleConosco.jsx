import React from 'react';
import './masc.css'; // Importa o CSS da mesma pasta

function Masculino() {
  return (
    <div className="pagina-masculino">
      <header className="masculino-header">
        <h2>Em que posso ajudar? deixe sua mensagem.</h2>
        <p>A página foi conectada com sucesso!</p>
      </header>

      <div className="card-teste">
        <h3>Área de Desenvolvimento</h3>
        <p>Pronto para começar a montar o seu vestuário de roupas masculinas aqui.</p>
      </div>
    </div>
  );
}

export default Masculino;