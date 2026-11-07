import { user } from "./user";

/**
 * Страница приложения: рисует себя в контейнер и при уходе освобождает подписки.
 */
export interface Page {
  render(): void;
  destroy?(): void;
}

/**
 * Класс страницы: создаётся роутером для каждого перехода.
 */
export type PageClass = new (root: HTMLElement, router: Router) => Page;

/**
 * Маршрут: класс страницы, нужна ли авторизация и необязательный редирект, который по пути возвращает другой путь или null.
 */
export interface Route {
  page: PageClass;
  auth: boolean;
  redirect?: (path: string) => string | null;
}

const GUEST_HOME = "/login";
const USER_HOME = "/feed";

/**
 * Роутер SPA на History API.
 */
export class Router {
  #root: HTMLElement;
  #routes: Record<string, Route>;
  #page: Page | null = null;

  /**
   * @param root Элемент, в который рендерятся страницы.
   * @param routes Маршруты: путь → класс страницы, нужна ли авторизация и редирект.
   */
  constructor(root: HTMLElement, routes: Record<string, Route>) {
    this.#root = root;
    this.#routes = routes;
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
   * Переходит на путь. Гостя уводит на /login, вошедшего — на /feed, если страница ему недоступна.
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

  #resolve(path: string): string {
    const route = this.#routes[path];
    if (route && route.auth === user.isAuthorized) {
      return route.redirect?.(path) ?? path;
    }

    return user.isAuthorized ? USER_HOME : GUEST_HOME;
  }

  #render(path: string): void {
    const { page: PageView } = this.#routes[path];
    this.#page?.destroy?.();
    this.#root.innerHTML = "";
    this.#page = new PageView(this.#root, this);
    this.#page.render();
  }
}
