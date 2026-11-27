# @nexly/router

Роутер SPA на History API. Перехватывает клики по `a[data-link]` и кнопки «назад»/«вперёд», поддерживает UUID и положительные числовые ID в параметрах вида `/profile/:id` и проверяет доступ к маршруту.

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
