// backend/src/utils/rateLimit.js
// Limitador de tentativas simples, em memória (basta para uma única instância, como no Render).
// Janela fixa: no máximo `max` usos por `janelaMs` para cada chave.
//
// Reinicia quando o servidor reinicia; para vários servidores seria preciso um armazenamento
// compartilhado (ex.: Redis), o que este projeto ainda não precisa.

function criarLimitador({ max, janelaMs }) {
  const usos = new Map(); // chave -> { n, expira }

  // Limpa chaves vencidas de tempos em tempos, para a memória não crescer sem parar
  const faxina = setInterval(() => {
    const agora = Date.now();
    for (const [k, v] of usos) if (v.expira <= agora) usos.delete(k);
  }, Math.min(janelaMs, 10 * 60 * 1000));
  faxina.unref(); // não impede o servidor de encerrar

  return {
    /** Registra um uso. Devolve true se ainda estava dentro do limite. */
    permitir(chave) {
      const agora = Date.now();
      let u = usos.get(chave);
      if (!u || u.expira <= agora) { u = { n: 0, expira: agora + janelaMs }; usos.set(chave, u); }
      u.n += 1;
      return u.n <= max;
    },
  };
}

module.exports = { criarLimitador };
