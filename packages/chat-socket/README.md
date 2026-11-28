# @nexly/chat-socket

Клиент WebSocket чатов Nexly: одно соединение на браузер, сколько бы вкладок ни было открыто.

- Соединение открывает одна вкладка — лидер (Web Locks). Остальные вкладки получают события и отправляют сообщения через неё по BroadcastChannel. Закрыли лидера — соединение подхватывает следующая вкладка.
- Первое сообщение — `{"type":"auth","csrf_token"}`, дальше события `connected`, `subscribed`, `message`, `error`.
- Обрыв — переподключение с паузами 1–30 с. Если соединение трижды подряд рвётся сразу после подключения, клиент перестаёт переподключаться до показа вкладки или отправки.
- `refresh([chatUid])` переподключается, если соединение не подписано на чат с этим UUID.
- `send(chatUid, text)` возвращает сохранённое сообщение или код ошибки (`timeout`, `connection_lost`, `stopped` или код бэка).

```ts
import { ChatSocket } from "@nexly/chat-socket";

const chatSocket = new ChatSocket({
  path: "/api/chats/ws",
  lockName: "nexly-chat-socket-v2",
  channelName: "nexly-chat-v2",
  getCsrf: () => user.csrfToken,
  getMyUid: () => user.profile?.uid ?? "",
});

chatSocket.onEvent((event) => {
  if (event.type === "message") {
    render(event.message);
  }
});
chatSocket.start();
```

Сборка: `npm run build -w @nexly/chat-socket`.
