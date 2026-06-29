# AI Context - Thomados FunBox

## Projeto

Nome: Thomados FunBox

Versao alvo fixa: Adobe Premiere Pro 26.2.2 com CEP/CSXS 12.0.

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
|-- public/
|   `-- assets/
|       `-- sfx/
|           |-- soft-whoosh.wav
|           `-- ui-click.wav
|-- scripts/
|   `-- copy-cep-assets.mjs
|-- src/
|   |-- components/
|   |   |-- AudioLibrary.tsx
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
Biblioteca de Audios: Concluido.
Compatibilidade Premiere Pro 26.2.2: Concluida.

MVP (Minimum Viable Product) das 3 funcionalidades principais foi alcancado.

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
- Manifest restrito a PPRO 26.2.2 e runtime CSXS 12.0.
- Permissoes CEF para Node.js e arquivos locais.
- Diagnostico de runtime antes de executar comandos no host.
- Validacao automatica de `host.jsx` como ECMAScript 3.
- Testes de contrato para curva, Bake Curve, animacao de texto e audio.
- Instalador PowerShell que valida o Premiere, gera a build, ativa PlayerDebugMode e instala no CEP do usuario.

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
- A galeria envia payloads via bridge CEP para `thomadosFunBox_applyTextAnimation(...)`, incluindo `type`, `duration` e alvo `selection`.
- A abordagem atual aplica a animacao no texto ou graphic clip ja selecionado na timeline, sem importar um novo MOGRT.
- Cada template de animacao e um preset de codigo: uma entrada em `TextAnimationGallery.tsx` e uma receita de keyframes no `applyTransformAnimation()` do `host/host.jsx`.
- Usuarios podem criar presets proprios dentro do painel no Premiere. Esses presets sao salvos em `localStorage` com nome, duracao, base visual e receita customizada.
- Presets customizados sao enviados como `type: "custom"` com `recipe`, incluindo parametros como `scaleStart`, `scaleOvershoot`, `positionYOffset`, `opacityStart` e `reveal`.
- O host usa `sequence.getSelection()` para pegar os itens selecionados e tenta injetar keyframes em Scale, Position, Opacity e Reveal quando esses parametros estiverem expostos pelo clip.
- O preset Typewriter so faz revelacao real se o texto selecionado expuser um parametro Reveal/Progress; caso contrario, aplica fade como fallback.

Modulo de Biblioteca de Audios:
- Front-end concluido com `AudioLibrary.tsx`, listando arquivos dinamicamente a partir de `dist/assets/sfx`.
- O acesso a `fs` e `path` usa `window.cep_node.require` ou `window.require` em runtime CEP, evitando imports Node estaticos que o Vite tentaria externalizar.
- O preview usa um elemento HTML5 `<audio>` e URLs `file:///` geradas a partir dos caminhos absolutos encontrados no disco.
- O painel envia o caminho absoluto para `thomadosFunBox_importAndInsertAudio(...)` via bridge CEP.
- O host JSX usa `app.project.importFiles(...)`, localiza o `ProjectItem`, encontra a primeira track de audio desbloqueada e insere o clip no CTI atual da sequencia.
- Dois WAVs originais de teste acompanham o projeto: `ui-click.wav` e `soft-whoosh.wav`.

Correcao de compatibilidade 26.2.2:
- O host instalado foi confirmado como Premiere Pro 26.2.2 com CEPHtmlEngine/CSXS 12.0.1.
- `CSXS/manifest.xml` foi atualizado de CSXS 11 para CSXS 12 e limitado a PPRO 26.2.2.
- A insercao de audio passou a usar ticks e as assinaturas documentadas de `Track.overwriteClip`, `Sequence.insertClip` e `Track.insertClip`.
- A busca de Position, Scale e Opacity agora usa `Component.matchName` e normalizacao de nomes localizados.
- Duracoes de animacao sao limitadas ao comprimento real do clip.
- O modulo de audio usa o caminho da extensao fornecido pelo CEP e possui permissoes de acesso a arquivos locais.
- A extensao e instalada em `%APPDATA%/Adobe/CEP/extensions/com.thomados.funbox` por `npm run install:cep`.

## Proximos Passos

Reiniciar o Premiere Pro 26.2.2 e executar o smoke test final dentro do painel instalado.
