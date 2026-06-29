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
- Biblioteca de animações: captura os keyframes reais do clipe selecionado, salva o preset com um nome e reaplica a combinação em outros clipes compatíveis.
- Biblioteca de áudios: lista, reproduz, importa e insere os WAVs locais no CTI da sequência.

Nota: o Premiere Pro 26.2.2 não expõe `setTemporalEaseAtKey()` na API pública CEP. Por isso, velocidade e influência numéricas usam a geração de keyframes intermediários; a ação Bézier direta altera o tipo de interpolação.
