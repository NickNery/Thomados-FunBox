# AI Context - Thomados FunBox

## Projeto

Nome: Thomados FunBox

Stack tecnologica:
- Adobe CEP (Common Extensibility Platform)
- Premiere Pro
- React
- TypeScript
- Tailwind CSS
- Vite
- ExtendScript (JSX)

## Arquitetura Planejada

O Thomados FunBox sera um painel CEP customizado para Adobe Premiere Pro.

A interface do painel sera criada em React + TypeScript, empacotada pelo Vite e estilizada com Tailwind CSS. O codigo do front-end ficara em `src/`.

A comunicacao com o Premiere Pro sera feita pela ponte CEP usando `CSInterface.evalScript`, chamando funcoes ExtendScript expostas em `host/host.jsx`.

Fluxo planejado:

1. Usuario interage com o painel React.
2. React chama uma funcao do bridge CEP em `src/cep/bridge.ts`.
3. O bridge executa `CSInterface.evalScript(...)`.
4. O Premiere Pro executa a funcao correspondente em `host/host.jsx`.
5. O resultado volta para o React como string, preferencialmente JSON serializado.

## Estrutura de Pastas

```text
Thomados-FunBox/
├── AI-CONTEXT.md
├── CSXS/
│   └── manifest.xml
├── host/
│   └── host.jsx
├── scripts/
│   └── copy-cep-assets.mjs
├── src/
│   ├── cep/
│   │   ├── bridge.ts
│   │   └── types.d.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── dist/
│   └── gerado pelo build
├── index.html
├── package.json
├── postcss.config.cjs
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Status Atual

Apenas a base inicial do projeto foi criada.

Itens presentes:
- Estrutura inicial de painel CEP.
- Manifest CEP configurado para Premiere Pro.
- Front-end React + TypeScript + Tailwind CSS.
- Bridge inicial para chamadas ao host via CSInterface.
- Script JSX inicial para validar a ponte com o Premiere Pro.
- Configuracao inicial de Git via `.gitignore`.

## Próximos Passos

A proxima tarefa planejada sera implementar o Editor de Velocidade de Keyframes.
