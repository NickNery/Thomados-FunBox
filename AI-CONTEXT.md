# Contexto de IA - Thomados FunBox

## Projeto

Nome: Thomados FunBox

Versão-alvo fixa: Adobe Premiere Pro 26.2.2 com CEP/CSXS 12.0.

Stack tecnológica:
- Adobe CEP
- Premiere Pro
- React
- TypeScript
- Tailwind CSS
- Vite
- ExtendScript (JSX)

## Arquitetura

O front-end fica em `src/` e é empacotado pelo Vite. A comunicação com o Premiere usa `CSInterface.evalScript` por meio de `src/cep/bridge.ts`. As operações do host ficam em `host/host.jsx` e retornam JSON serializado.

Fluxo:
1. O usuário interage com o painel React.
2. O bridge envia uma chamada JSX para o Premiere.
3. O host manipula sequência, clipes, componentes e keyframes.
4. O resultado volta ao React como JSON.

## Status Atual

- Editor de curvas: concluído.
- Biblioteca de animações capturadas: concluída.
- Biblioteca de áudios: concluída.
- Compatibilidade com Premiere Pro 26.2.2: concluída.
- Instalador CEP para Windows: concluído.

## Biblioteca de Animações

O módulo não usa mais receitas fixas como Pop-in, Slide Up ou Typewriter.

Fluxo atual:
1. O usuário cria uma animação normalmente no Premiere usando keyframes.
2. Seleciona o clipe animado na timeline.
3. Digita um nome e usa `Registrar keyframes`.
4. O host percorre os componentes e parâmetros animados do clipe.
5. O host calcula a base absoluta como `Sequence.zeroPoint + TrackItem.start`, detecta a base retornada pelo `ComponentParam` e salva offsets relativos ao início do clipe.
6. Propriedades conhecidas, como Escala, Posição e Opacidade, recebem uma identidade semântica para funcionar entre Movimento de vídeo e Movimento Vetorial de gráficos.
7. Como a API CEP não expõe os handles temporais, curvas numéricas são amostradas entre os keyframes e reaplicadas com pontos lineares intermediários.
8. O preset é salvo em LocalStorage.
9. Ao aplicar o preset, o host encontra o parâmetro equivalente e converte cada offset para a base temporal esperada pelo clipe de destino.

O formato atual dos presets é a versão `3`, com `timeBasis: "clip-offset"`. Ele armazena também o zero point da sequência de origem. Presets anteriores devem ser registrados novamente e ficam desabilitados na interface.

O formato TypeScript principal é `CapturedTextAnimationPreset`, definido em `src/cep/bridge.ts`.

Funções JSX:
- `thomadosFunBox_captureTextAnimation()`
- `thomadosFunBox_applyCapturedTextAnimation(payload)`

## Editor de Curvas

O Premiere Pro 26.2.2 não expõe `setTemporalEaseAtKey()` na API pública CEP. O painel aplica interpolação Bézier quando disponível e oferece a geração de keyframes lineares intermediários para reproduzir visualmente a curva desenhada.

## Biblioteca de Áudios

O diretório inicial fica em `public/assets/sfx`, mas o usuário pode escolher qualquer pasta pelo seletor nativo do CEP. A raiz escolhida é persistida em LocalStorage. O painel lista áudios e subpastas do nível atual, oferece breadcrumbs e permite navegar sem sair da raiz selecionada. O host importa o áudio no projeto e o insere no CTI da sequência usando ticks.

## Qualidade

- `npm run typecheck`: valida o TypeScript.
- `npm run validate:host`: valida `host.jsx` como ECMAScript 3.
- `npm run test:host`: testa runtime, curvas, captura/aplicação de animações e áudio.
- `npm run build`: gera a extensão em `dist/`.
- `npm run install:cep`: valida o Premiere 26.2.2 e instala a extensão.

## Diagnóstico

Todas as chamadas ao host geram registros com payload, resposta, avisos e decisões de mapeamento. O arquivo fica em `Thomados FunBox/logs/thomados-funbox-diagnostics.log`, dentro da pasta de dados do usuário retornada pelo CEP. O painel permite abrir o arquivo no Explorador ou copiar seu conteúdo.

## Próximos Passos

Executar um smoke test no Premiere com um novo preset de pop-in de Escala e, em caso de falha, analisar o arquivo de diagnóstico gerado pelo painel.
