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
|-- mogrt/
|   `-- README.md
|-- scripts/
|   `-- copy-cep-assets.mjs
|-- src/
|   |-- components/
|   |   |-- BezierCurveEditor.tsx
|   |   `-- TextAnimationGallery.tsx
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
Animacoes de Texto: Concluido.

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

Observacao do primeiro teste no Premiere:
- A API publica de `ComponentParam` nao expoe selecao individual de keyframes; quando o host nao encontra uma API privada/alternativa, o painel aplica a acao em todos os keyframes do parametro selecionado.
- Em parametros como Scale, o Premiere nao disponibilizou `setTemporalEaseAtKey`; o painel reporta isso como fallback e aplica `setInterpolationTypeAtKey(..., KF_Interp_Mode_Bezier, ...)` quando possivel.
- Portanto, no estado atual, o teste pratico deve confirmar a mudanca de interpolacao para Bezier. Speed/Influence numerico continua sendo calculado no painel, mas nao e garantido pela API publica do Premiere nesses parametros.

Experimento adicionado apos esse teste:
- O painel agora possui um modo `Bake Curve`, separado de `Aplicar Bezier`.
- `Bake Curve` usa a curva Bezier do SVG como uma funcao de remapeamento entre o primeiro e o ultimo keyframe do parametro e cria keyframes intermediarios com `setValueAtKey()`.
- Para que a simulacao siga a curva desenhada, os keyframes gerados sao linearizados com `setInterpolationTypeAtKey(..., KF_Interp_Mode_Linear, ...)`.
- A opcao `Recriar intervalo` remove keyframes internos entre o primeiro e o ultimo keyframe antes de gerar novas amostras. Isso torna o teste iteravel, mas deve ser usado em um clipe duplicado ou teste porque substitui keyframes intermediarios existentes.

Modulo de Animacoes de Texto:
- Front-end concluido com `TextAnimationGallery.tsx`, exibindo presets em grid: Pop-in, Slide Up, Fade Scale e Typewriter.
- A galeria envia payloads via bridge CEP para `thomadosFunBox_applyTextAnimation(...)`, incluindo `type`, `duration`, `text` e `videoTrackOffset`.
- A abordagem escolhida para inserir textos foi hibrida e baseada em MOGRTs, por ser a rota mais estavel exposta pela API publica do Premiere: `Sequence.importMGT(path, time, vidTrackOffset, audTrackOffset)`.
- O host JSX procura os templates em `mogrt/`: `text-pop-in.mogrt`, `text-slide-up.mogrt`, `text-fade-scale.mogrt` e `text-typewriter.mogrt`.
- Apos importar o MOGRT no playhead, o JSX tenta aplicar keyframes matematicos em Scale, Position, Opacity e Reveal quando esses parametros estiverem expostos pelo item inserido.
- Criacao direta de texto Essential Graphics por script puro nao foi usada como caminho principal porque nao aparece como API publica estavel; sem os arquivos `.mogrt`, o host retorna uma mensagem clara com o caminho esperado.

## Proximos Passos

A proxima e ultima tarefa planejada sera Biblioteca e Preview de Audios.
