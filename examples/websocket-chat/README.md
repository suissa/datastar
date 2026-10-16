# WebSocket chat example

This example demonstrates the intended `@ws('chat')` action and a server that broadcasts messages only to clients connected to the same named channel.

## Run

```sh
cd examples/websocket-chat
npm install
npm start
```

Open http://localhost:3000 in two browser tabs. Messages are broadcast to every connected client in the `chat` channel.

The action source lives in `library/src/plugins/actions/ws.ts`. It must be included in the library's action-plugin entrypoint and the generated bundle rebuilt before the example can run with the repository bundle. The existing generated bundle is intentionally not hand-edited.
