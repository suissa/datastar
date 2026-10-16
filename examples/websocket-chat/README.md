# WebSocket chat example

Chat de demonstração em tempo real usando `data-on:load="@ws('chat')"`, o bundle suplementar `bundles/datastar-more-actions.js` e um servidor WebSocket com broadcast por canal.

## Executar

```sh
cd examples/websocket-chat
npm install
npm start
```

Abra http://localhost:3000 em duas ou mais abas. Envie mensagens e veja o broadcast nas abas conectadas ao canal `chat`.

## Como funciona

- `data-on:load="@ws('chat')"` dispara a conexão quando o elemento entra no DOM.
- `bundles/datastar-more-actions.js` implementa o disparo de `load` e a action `@ws`.
- A conexão WebSocket é feita em `ws://localhost:3000/ws?channel=chat` (ou `wss:` sob HTTPS).
- A URL da página permanece em `http://localhost:3000/`. O formulário cancela o submit padrão e não adiciona a mensagem à query string.
- O servidor transmite as mensagens somente aos sockets do mesmo canal.

O bundle é standalone e suplementar; este exemplo o carrega diretamente para não depender de uma action `load` inexistente no bundle principal.
