import { user } from "./user.js";

const GUEST_HOME = "/login";
const USER_HOME = "/feed";

export class Router {
  #root;
  #routes;

  constructor(root, routes) {
    this.#root = root;
    this.#routes = routes;
  }

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
    this.#root.innerHTML = "";
    new Page(this.#root, this).render();
  }
}
