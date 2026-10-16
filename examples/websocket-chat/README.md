# WebSocket chat example

Chat em tempo real com `data-on:load="@ws('chat')"`, usando o bundle suplementar `bundles/datastar-more-actions.js` e um servidor WebSocket que transmite mensagens por canal.

## Executar

```sh
cd examples/websocket-chat
npm install
npm start
```

Abra http://localhost:3000 em duas ou mais abas. Mensagens enviadas em uma aba aparecem nas outras conectadas ao canal `chat`.

## Como funciona

- O bundle suplementar implementa o disparo da action de load e a action `@ws('channel')`.
- A conexão usa `ws://localhost:3000/ws?channel=chat` (ou `wss:` sob HTTPS).
- A URL da página permanece `http://localhost:3000/`; o formulário cancela o submit padrão, sem navegação nem query string.
- O servidor transmite mensagens somente aos clientes conectados ao mesmo canal.

O exemplo carrega o bundle suplementar diretamente, pois a action `load` ainda não existe no bundle principal.
