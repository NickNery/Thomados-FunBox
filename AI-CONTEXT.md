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

O Thomados FunBox e um painel CEP customizado para Adobe Premiere Pro.

A interface do painel e criada em React + TypeScript, empacotada pelo Vite e estilizada com Tailwind CSS. O codigo do front-end fica em `src/`.

A comunicacao com o Premiere Pro e feita pela ponte CEP usando `CSInterface.evalScript`, chamando funcoes ExtendScript expostas em `host/host.jsx`.

Fluxo planejado:

1. Usuario interage com o painel React.
2. React chama uma funcao do bridge CEP em `src/cep/bridge.ts`.
3. O bridge executa `CSInterface.evalScript(...)`.
4. O Premiere Pro executa a funcao correspondente em `host/host.jsx`.
5. O resultado volta para o React como string, preferencialmente JSON serializado.

## Estrutura de Pastas

```text
Thomados-FunBox/
|-- AI-CONTEXT.md
|-- CSXS/
|   `-- manifest.xml
|-- host/
|   `-- host.jsx
|-- scripts/
|   `-- copy-cep-assets.mjs
|-- src/
|   |-- components/
|   |   `-- BezierCurveEditor.tsx
|   |-- cep/
|   |   |-- bridge.ts
|   |   `-- types.d.ts
|   |-- App.tsx
|   |-- index.css
|   `-- main.tsx
|-- dist/
|   `-- gerado pelo build
|-- index.html
|-- package.json
|-- postcss.config.cjs
|-- tailwind.config.ts
|-- tsconfig.json
|-- tsconfig.node.json
`-- vite.config.ts
```

## Status Atual

Editor de Curvas: Concluido.

Itens presentes:
- Estrutura inicial de painel CEP.
- Manifest CEP configurado para Premiere Pro.
- Front-end React + TypeScript + Tailwind CSS.
- Bridge inicial para chamadas ao host via CSInterface.
- Componente `BezierCurveEditor.tsx` com SVG interativo para handles de curva cubica.
- Calculo de Speed e Influence para outgoing e incoming.
- Presets locais salvos em LocalStorage.
- Funcao TypeScript para enviar parametros temporais ao host JSX.
- Script JSX para percorrer clips selecionados, encontrar parametros keyframados e aplicar easing temporal quando suportado.
- Fallback JSX para interpolacao Bezier nativa via `setInterpolationTypeAtKey()`.

## Proximos Passos

A proxima tarefa planejada sera implementar Animacoes Predefinidas de Textos.
