# Thomados FunBox

Painel Adobe CEP para Premiere Pro criado com React, TypeScript, Tailwind CSS, Vite e ExtendScript.

## Scripts

```bash
npm install
npm run dev
npm run build
```

O build gera a pasta `dist/` com o front-end compilado e copia `CSXS/` e `host/` para dentro dela.

## Estrutura

```text
CSXS/          Manifest CEP
host/          Scripts ExtendScript executados no Premiere Pro
src/           Interface React e bridge CEP
scripts/       Automacoes locais de build
dist/          Saida gerada pelo build
```

## Ponte CEP

O front-end chama o Premiere Pro por meio de `evalScript` em `src/cep/bridge.ts`. As funcoes JSX ficam expostas em `host/host.jsx`.
