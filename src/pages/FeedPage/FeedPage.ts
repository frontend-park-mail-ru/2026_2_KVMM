import { api } from "../../modules/api";
import type { Router } from "@nexly/router";
import { user } from "../../modules/user";
import { AppLayout } from "../../components/AppLayout/AppLayout";
import { PostList } from "../../components/PostList/PostList";

const MESSAGES = {
  loading: "Загружаем ленту",
  empty: "Здесь пока нет постов",
  end: "Нет более старых постов",
  error: "Произошла ошибка, обновите страницу",
};

/**
 * Страница ленты: шапка с выходом, меню разделов, посты всех пользователей, подгрузка при прокрутке и кнопка «Показать новые посты», когда появились свежие.
 */
export class FeedPage {
  #parent: HTMLElement;
  #router: Router;
  #list: PostList | null = null;

  /**
   * @param parent Контейнер страницы.
   * @param router Роутер для перехода на /login.
   */
  constructor(parent: HTMLElement, router: Router) {
    this.#parent = parent;
    this.#router = router;
  }

  /**
   * Рисует страницу и загружает первую порцию постов.
   */
  render(): void {
    const main = new AppLayout(this.#parent, this.#router, "feed").render();
    this.#list = new PostList(main, {
      load: (cursor, limit) => api.feed(cursor, limit),
      messages: MESSAGES,
      fill: true,
      watchNew: true,
      onUnauthorized: () => {
        user.clear();
        this.#router.navigate("/login");
      },
    });
    this.#list.render();
  }

  /**
   * Снимает подгрузку при прокрутке и игнорирует ответы, пришедшие после ухода со страницы.
   */
  destroy(): void {
    this.#list?.destroy();
  }
}
