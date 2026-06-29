# Thomados FunBox

Painel Adobe CEP para Premiere Pro 26.2.2, criado com React, TypeScript, Tailwind CSS, Vite e ExtendScript.

## Compatibilidade

- Adobe Premiere Pro: `26.2.2`
- CEP/CSXS: `12.0`
- Windows: instalador local incluido

O manifest recusa outras versoes do Premiere para evitar comportamento imprevisivel.

## Desenvolvimento

```bash
npm ci
npm run test:host
npm run build
```

O build valida TypeScript, verifica `host.jsx` como ECMAScript 3, gera `dist/` e copia `CSXS/`, `host/` e `.debug`.

## Instalar No Premiere

```bash
npm run install:cep
```

O instalador:

- valida que o Premiere instalado e `26.2.2`;
- ativa `PlayerDebugMode` para CSXS 12;
- instala a build em `%APPDATA%\Adobe\CEP\extensions\com.thomados.funbox`.

Reinicie o Premiere e abra `Window > Extensions (Legacy) > Thomados FunBox`.

## Modulos

- Editor de Curvas: aplica interpolacao Bezier e oferece Bake Curve para reproduzir Speed/Influence com keyframes intermediarios.
- Animacoes de Texto: anima Position, Scale, Opacity e controles Reveal expostos pelo item selecionado.
- Biblioteca de Audio: lista, reproduz, importa e insere os WAVs locais no CTI da sequencia.

Nota: Premiere Pro 26.2.2 nao expoe `setTemporalEaseAtKey()` na API publica CEP. Por isso, Speed/Influence numerico usa o modo Bake Curve; a acao Bezier direta altera apenas o tipo de interpolacao.
