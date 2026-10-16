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

## Conversa por áudio e Web Speech API

A primeira mensagem pergunta **“Você prefere conversar via áudio?”**, com os botões **🎙️ SIM** e **💬 NÃO**.

- **SIM** solicita a permissão do microfone. No modo de áudio, a transcrição final é enviada ao bot pelo WebSocket sem ser mostrada no histórico visual durante a conversa.
- As respostas do bot são lidas em voz alta em português (`pt-BR`). A captura é pausada durante a fala do bot para reduzir a transcrição do próprio áudio e é retomada depois.
- As mensagens de usuário e bot são salvas em `localStorage`. Ao selecionar **⏹️ Encerrar conversa por áudio**, o histórico salvo é renderizado no chat como mensagens comuns, e o campo de texto volta a ficar disponível.
- **NÃO** fecha a pergunta inicial e mantém a conversa por texto.
- Os controles de transcrição **Mostrar enquanto falo** e **Mostrar a cada pausa** continuam disponíveis para ditado no modo texto; a opção de pausa atualiza resultados parciais após aproximadamente 700 ms sem novas palavras.

O reconhecimento depende do suporte do navegador e da permissão do microfone. Use uma versão compatível do Chrome ou Edge e, fora de `localhost`, sirva a página por HTTPS. O reconhecimento de voz pode depender de serviços do navegador; não é garantido que funcione offline. O histórico de áudio permanece no armazenamento local do navegador até ser apagado manualmente.
