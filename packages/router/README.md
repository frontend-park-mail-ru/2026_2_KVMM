# @nexly/router

Роутер SPA на History API. Перехватывает клики по `a[data-link]` и кнопки «назад»/«вперёд», поддерживает параметры вида `/profile/:id` (только положительные целые id) и проверяет, доступна ли страница гостю или вошедшему пользователю.

```ts
import { Router } from "@nexly/router";
import type { Route } from "@nexly/router";

const routes: Record<string, Route> = {
  "/login": { page: LoginPage, auth: false },
  "/profile/:id": { page: UserPage, auth: true },
};

new Router(document.getElementById("root")!, routes, {
  isAuthorized: () => user.isAuthorized,
  guestHome: "/login",
  userHome: "/feed",
}).start();
```

Страница — класс с `render()` и необязательным `destroy()`; конструктор получает контейнер, роутер и параметры пути.

Сборка: `npm run build -w @nexly/router`.
