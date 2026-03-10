## Sobre ‹/›

- O bot usa bibliotecas Mineflayer no JS.
- Usa Rust para macros e SQlite para data.

## Instalação §

¹ Instale pacotes do `nodejs` e `rust`.

² Instale dependências com:
```bash
npm install
```

³ Vá para o diretório macros-engine/

⁴ Compile o binário do napi + lib.rs:
```bash
npm run build
```

## Configuração *

- Use um editor de texto para criar o `.env`:

  NAME=nick (nick offline).
  PASSWORD=senha (para login auto).
  IP=endereço (prefira ip direto).
  PORT=porta (padrão? 25565).
  VERSION=1.19.4 (melhor vers).

## Macro $

- macro <add|del|list> <nome> <exe>

• macro add → adicionar

• macro del → deletar

• macro list → lista suas macros

° exemplo: macro add tp /tpa Nevisk

 Uso normal no cmd: > tp

 = executa o comando da {tp}!

### Leave & Enter ¢

- No cmd: > c 

= tenta conecta manualmente.

- No cmd: > q

= encerra totalmente o bot.

#### Faz o L
