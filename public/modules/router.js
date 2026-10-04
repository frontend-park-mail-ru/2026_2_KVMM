import { user } from "./user.js";

const GUEST_HOME = "/login";
const USER_HOME = "/feed";

/**
 * Роутер SPA на History API.
 */
export class Router {
  #root;
  #routes;
  #page;

  /**
   * @param {HTMLElement} root Элемент, в который рендерятся страницы.
   * @param {object} routes Маршруты: путь → { page: класс страницы, auth: нужна ли авторизация }.
   */
  constructor(root, routes) {
    this.#root = root;
    this.#routes = routes;
  }

  /**
   * Подписывается на кнопки браузера и клики по ссылкам с data-link, показывает текущую страницу.
   */
  start() {
    window.addEventListener("popstate", () => {
      this.navigate(window.location.pathname, true);
    });

    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[data-link]");
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      event.preventDefault();
      this.navigate(link.getAttribute("href"));
    });

    this.navigate(window.location.pathname, true);
  }

  /**
   * Переходит на путь. Гостя уводит на /login, вошедшего — на /feed, если страница ему недоступна.
   * @param {string} path Запрошенный путь.
   * @param {boolean} [replace] Заменить текущую запись истории вместо новой.
   */
  navigate(path, replace = false) {
    const target = this.#resolve(path);

    if (replace || target !== path) {
      window.history.replaceState(null, "", target);
    } else if (target !== window.location.pathname) {
      window.history.pushState(null, "", target);
    }

    this.#render(target);
  }

  #resolve(path) {
    const route = this.#routes[path];
    if (route && route.auth === user.isAuthorized) {
      return path;
    }

    return user.isAuthorized ? USER_HOME : GUEST_HOME;
  }

  #render(path) {
    const { page: Page } = this.#routes[path];
    this.#page?.destroy?.();
    this.#root.innerHTML = "";
    this.#page = new Page(this.#root, this);
    this.#page.render();
  }
}
