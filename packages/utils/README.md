# @nexly/utils

Мелкие функции фронтенда Nexly без зависимостей:

- `escapeHtml(value)` — экранирует текст для вставки в HTML-шаблон;
- `formatDate(iso, now?)` — «Сегодня в 18:42», «Вчера в 18:42», «5 октября в 18:42»;
- `nextCursor(current, page)` — следующий курсор для списков с keyset-пагинацией (посты, чаты, сообщения);
- `nextOffset(current, page)` — следующее смещение для списков с offset-пагинацией (друзья, заявки).

```ts
import { escapeHtml, nextCursor } from "@nexly/utils";

const { cursor, hasMore } = nextCursor(0, { has_more: true, next_cursor: 41 });
```

Сборка: `npm run build -w @nexly/utils` (TypeScript → `dist/`, ES-модули и `.d.ts`).
