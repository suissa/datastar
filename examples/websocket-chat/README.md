# WebSocket chat example

Chat em tempo real com `data-on:load="@ws('chat')"`, o bundle `bundles/datastar-more-actions.js` e renderização A2UI v0.9 por `bundles/datastar-a2ui.js`. Mensagens e componentes usam a mesma conexão WebSocket `#chat`.

## Executar

```sh
cd examples/websocket-chat
npm install
npm start
```

Abra http://localhost:3000 em duas ou mais abas. Mensagens do chat são transmitidas entre as abas conectadas ao canal `chat`.

## Ativar geração com CopilotKit

Configure uma chave da OpenAI para que as ações A2UI gerem o texto do componente por meio do CopilotKit Runtime:

```sh
export OPENAI_API_KEY="sua-chave"
# Opcional:
export COPILOTKIT_MODEL="openai/gpt-4o-mini"
npm start
```

Sem `OPENAI_API_KEY`, o exemplo usa respostas determinísticas para continuar funcionando sem credenciais. A API do runtime fica disponível em `/api/copilotkit`.

## Como funciona

- `data-a2ui="chat"` seleciona o catálogo local permitido para o componente.
- O navegador envia as ações pelo evento `datastar:ws-send`, encaminhado pela conexão já aberta por `@ws('chat')`.
- O servidor valida catálogo, ação e superfície. O LLM pode gerar somente o texto; o servidor continua escolhendo o tipo `Text` e o catálogo permitido.
- O servidor usa `CopilotRuntime` v2 com middleware A2UI habilitado e traduz a resposta do agente para uma mensagem A2UI v0.9 `updateComponents` no mesmo WebSocket.
- A interface renderiza o texto com `textContent`; não interpreta HTML vindo do agente.
- A URL da página permanece em `/`; o formulário não executa navegação nem adiciona query string.
