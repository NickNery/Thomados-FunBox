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
- Biblioteca de animações: captura os keyframes reais do clipe selecionado, mantém o tempo relativo ao início do clipe e inclui efeitos nativos ou de terceiros ausentes no destino antes de aplicar suas propriedades.
- Biblioteca de áudios: permite escolher uma pasta, navegar por subpastas, ouvir os arquivos e inseri-los no CTI da sequência.
- Baixador de mídias: usa o Node.js do CEP e `yt-dlp` para baixar vídeo MP4 ou áudio MP3 na pasta do projeto atual.
- Diagnóstico: registra chamadas JSX, mapeamento de parâmetros, tempos e erros em um arquivo que pode ser aberto ou copiado pelo painel.

## Downloads

O `yt-dlp.exe` é empacotado em `vendor/yt-dlp`. A pasta padrão vem de `app.project.path`; projetos ainda não salvos deixam o destino vazio até o usuário escolher uma pasta.

Vídeos funcionam sem FFmpeg usando um formato progressivo. Para áudio MP3 e para mesclar vídeo/áudio na melhor qualidade, instale FFmpeg e deixe `ffmpeg.exe` disponível no `PATH`, ou distribua-o em `vendor/ffmpeg/bin/ffmpeg.exe`.

Use o baixador apenas para mídias que você tem permissão para salvar.

Nota: o Premiere Pro 26.2.2 não expõe `setTemporalEaseAtKey()` nem a leitura dos handles temporais na API pública CEP. Para preservar visualmente uma curva registrada, o painel captura amostras dos valores entre os keyframes e as recria como pontos lineares intermediários.

No CEP, a coleção pública de componentes não oferece uma inclusão documentada de efeitos. Para o Premiere Pro 26.2.2, o painel usa o QE DOM com o nome localizado da interface para criar o efeito. Em seguida, recupera novamente o clipe e sua coleção `components` no DOM padrão antes de aplicar os keyframes. Plugins de terceiros precisam estar instalados no computador de destino.

Presets registrados antes da versão `1.6.0` devem ser criados novamente para armazenar a identidade dos efeitos e a base temporal detectada.
