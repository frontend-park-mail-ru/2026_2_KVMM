/**
 * Страница приложения: рисует себя в контейнер и при уходе освобождает подписки.
 */
export interface Page {
  render(): void;
  destroy?(): void;
}

/**
 * Параметры пути: для маршрута /profile/:id и пути /profile/7 — { id: "7" }.
 */
export type RouteParams = Record<string, string>;

/**
 * Класс страницы: создаётся роутером для каждого перехода.
 */
export type PageClass = new (
  root: HTMLElement,
  router: Router,
  params: RouteParams,
) => Page;

/**
 * Маршрут: класс страницы, нужна ли авторизация и необязательный редирект, который по пути и параметрам возвращает другой путь или null.
 */
export interface Route {
  page: PageClass;
  auth: boolean;
  redirect?: (path: string, params: RouteParams) => string | null;
}

interface Match {
  route: Route;
  params: RouteParams;
}

const PARAM = /^:(\w+)$/;
const ID_PATTERN = /^[1-9]\d{0,15}$/;

/**
 * Сопоставляет путь с шаблоном маршрута. Параметр :name совпадает с положительным целым id — других параметров в приложении нет.
 * @param pattern Шаблон, например /profile/:id.
 * @param path Путь без query и hash.
 * @returns Параметры или null, если путь не подходит.
 */
export function matchPath(pattern: string, path: string): RouteParams | null {
  const expected = pattern.split("/");
  const actual = path.split("/");
  if (expected.length !== actual.length) {
    return null;
  }
  const params: RouteParams = {};
  for (let index = 0; index < expected.length; index++) {
    const name = PARAM.exec(expected[index])?.[1];
    if (!name) {
      if (expected[index] !== actual[index]) {
        return null;
      }
    } else if (ID_PATTERN.test(actual[index])) {
      params[name] = actual[index];
    } else {
      return null;
    }
  }
  return params;
}

/**
 * Настройки роутера: как узнать, вошёл ли пользователь, и куда отправлять, если страница недоступна.
 */
export interface RouterOptions {
  isAuthorized: () => boolean;
  guestHome: string;
  userHome: string;
}

/**
 * Роутер SPA на History API.
 */
export class Router {
  #root: HTMLElement;
  #routes: Record<string, Route>;
  #options: RouterOptions;
  #page: Page | null = null;

  /**
   * @param root Элемент, в который рендерятся страницы.
   * @param routes Маршруты: путь → класс страницы, нужна ли авторизация и редирект.
   * @param options Проверка входа и домашние страницы гостя и пользователя.
   */
  constructor(
    root: HTMLElement,
    routes: Record<string, Route>,
    options: RouterOptions,
  ) {
    this.#root = root;
    this.#routes = routes;
    this.#options = options;
  }

  /**
   * Подписывается на кнопки браузера и клики по ссылкам с data-link, показывает текущую страницу.
   */
  start(): void {
    window.addEventListener("popstate", () => {
      this.navigate(window.location.pathname, true);
    });

    document.addEventListener("click", (event) => {
      const link = (event.target as Element).closest("a[data-link]");
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      event.preventDefault();
      this.navigate(link.getAttribute("href") ?? "/");
    });

    this.navigate(window.location.pathname, true);
  }

  /**
   * Переходит на путь. Если страница недоступна, гостя уводит на guestHome, вошедшего — на userHome.
   * @param path Запрошенный путь.
   * @param replace Заменить текущую запись истории вместо новой.
   */
  navigate(path: string, replace: boolean = false): void {
    const target = this.#resolve(path);

    if (replace || target !== path) {
      window.history.replaceState(null, "", target);
    } else if (target !== window.location.pathname) {
      window.history.pushState(null, "", target);
    }

    this.#render(target);
  }

  #match(path: string): Match | null {
    const exact = this.#routes[path];
    if (exact) {
      return { route: exact, params: {} };
    }
    for (const [pattern, route] of Object.entries(this.#routes)) {
      const params = pattern.includes(":") ? matchPath(pattern, path) : null;
      if (params) {
        return { route, params };
      }
    }
    return null;
  }

  #resolve(path: string): string {
    const match = this.#match(path);
    const isAuthorized = this.#options.isAuthorized();
    if (match && match.route.auth === isAuthorized) {
      return match.route.redirect?.(path, match.params) ?? path;
    }

    return isAuthorized ? this.#options.userHome : this.#options.guestHome;
  }

  #render(path: string): void {
    const { route, params } = this.#match(path) as Match;
    this.#page?.destroy?.();
    this.#root.innerHTML = "";
    this.#page = new route.page(this.#root, this, params);
    this.#page.render();
  }
}
