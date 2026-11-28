# @nexly/utils

Мелкие функции фронтенда Nexly без зависимостей:

- `escapeHtml(value)` — экранирует текст для вставки в HTML-шаблон;
- `formatDate(iso, now?)` — «Сегодня в 18:42», «Вчера в 18:42», «5 октября в 18:42»;
- `nextCursor(current, page, seen)` — следующий UUID-курсор для постов, чатов и сообщений;
- `nextOffset(current, page)` — следующее смещение для списков с offset-пагинацией (друзья, заявки).

```ts
import { escapeHtml, nextCursor } from "@nexly/utils";

const seen = new Set<string>();
const page = { has_more: true, next_cursor: "550e8400-e29b-41d4-a716-446655440000" };
const { cursor, hasMore } = nextCursor("", page, seen);
```

Сборка: `npm run build -w @nexly/utils` (TypeScript → `dist/`, ES-модули и `.d.ts`).
