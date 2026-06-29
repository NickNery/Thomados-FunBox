# Thomados FunBox

Painel Adobe CEP para o Premiere Pro 26.2.2, criado com React, TypeScript, Tailwind CSS, Vite e ExtendScript.

## Compatibilidade

- Adobe Premiere Pro: `26.2.2`
- CEP/CSXS: `12.0`
- Windows: instalador local incluído

O manifest recusa outras versões do Premiere para evitar comportamentos imprevisíveis.

## Desenvolvimento

```bash
npm ci
npm run test:host
npm run build
```

O build valida o TypeScript, verifica `host.jsx` como ECMAScript 3, gera `dist/` e copia `CSXS/`, `host/` e `.debug`.

## Instalação No Premiere

```bash
npm run install:cep
```

O instalador:

- valida que o Premiere instalado é o `26.2.2`;
- ativa `PlayerDebugMode` para CSXS 12;
- instala a build em `%APPDATA%\Adobe\CEP\extensions\com.thomados.funbox`.

Reinicie o Premiere e abra `Window > Extensions (Legacy) > Thomados FunBox`.

## Módulos

- Editor de curvas: aplica interpolação Bézier e oferece geração de keyframes intermediários.
- Biblioteca de animações: captura os keyframes reais do clipe selecionado, mantém o tempo relativo ao início do clipe e mapeia propriedades como Escala entre vídeos e gráficos.
- Biblioteca de áudios: permite escolher uma pasta, navegar por subpastas, ouvir os arquivos e inseri-los no CTI da sequência.

Nota: o Premiere Pro 26.2.2 não expõe `setTemporalEaseAtKey()` nem a leitura dos handles temporais na API pública CEP. Para preservar visualmente uma curva registrada, o painel captura amostras dos valores entre os keyframes e as recria como pontos lineares intermediários.
