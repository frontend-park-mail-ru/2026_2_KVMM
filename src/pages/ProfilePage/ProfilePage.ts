import { api, isSession } from "../../modules/api";
import type { ApiResult, Post as PostData, Profile } from "../../modules/api";
import type { Router } from "../../modules/router";
import { user } from "../../modules/user";
import { registerFieldError, serverErrorMessage } from "../../modules/errors";
import { escapeHtml } from "../../modules/utils";
import { AppLayout } from "../../components/AppLayout/AppLayout";
import { PostList } from "../../components/PostList/PostList";
import { PostEditor } from "../../components/PostEditor/PostEditor";
import { confirmDialog } from "../../components/Dialog/Dialog";

const MESSAGES = {
  loading: "Загружаем вашу страницу",
  empty: "Напишите свой первый пост",
  end: "Нет более старых постов",
  error: "Произошла ошибка, обновите страницу",
};

function displayName(profile: Profile): string {
  const name = [profile.profile_name, profile.surname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || profile.nickname;
}

function cardTemplate(profile: Profile): string {
  const name = displayName(profile);
  const letter = [...name][0]?.toUpperCase() ?? "?";
  const bio = profile.bio?.trim();
  return `
    <section class="profile-card">
      <div class="profile-card__main">
        <div class="profile-card__avatar">${escapeHtml(letter)}</div>
        <h1 class="profile-card__name" title="${escapeHtml(name)}">${escapeHtml(name)}</h1>
      </div>
      ${bio ? `<p class="profile-card__bio">О себе: ${escapeHtml(bio)}</p>` : ""}
    </section>
  `;
}

/**
 * Страница своего профиля: имя, аватар и рассказ о себе, создание поста и свои посты с правкой и удалением.
 */
export class ProfilePage {
  #parent: HTMLElement;
  #router: Router;
  #card!: HTMLElement;
  #editor!: PostEditor;
  #list!: PostList;
  #isDestroyed = false;

  /**
   * @param parent Контейнер страницы.
   * @param router Роутер для перехода на /login.
   */
  constructor(parent: HTMLElement, router: Router) {
    this.#parent = parent;
    this.#router = router;
  }

  /**
   * Рисует профиль из текущей сессии, обновляет его с бэка и загружает свои посты.
   */
  render(): void {
    const profile = user.profile as Profile;
    const main = new AppLayout(this.#parent, this.#router, "profile").render();
    main.insertAdjacentHTML("beforeend", cardTemplate(profile));
    this.#card = main.lastElementChild as HTMLElement;

    this.#editor = new PostEditor(main, {
      onSubmit: (text, post) => this.#save(text, post),
      onDelete: (post) => this.#delete(post),
    });
    this.#editor.render();

    this.#list = new PostList(main, {
      load: (cursor, limit) => api.userPosts(profile.id, cursor, limit),
      messages: MESSAGES,
      onEdit: (post) => this.#editor.edit(post),
      onUnauthorized: () => this.#goToLogin(),
    });
    this.#list.render();

    this.#refreshProfile();
    this.#loadAvatar();
  }

  /**
   * Останавливает подгрузку и игнорирует ответы, пришедшие после ухода со страницы.
   */
  destroy(): void {
    this.#isDestroyed = true;
    this.#list?.destroy();
  }

  #goToLogin(): void {
    user.clear();
    this.#router.navigate("/login");
  }

  async #refreshProfile(): Promise<void> {
    const { status, data } = await api.me();
    if (this.#isDestroyed) {
      return;
    }
    if (status === 401) {
      this.#goToLogin();
      return;
    }
    if (status === 200 && isSession(data)) {
      user.setProfile(data.profile);
      this.#card.insertAdjacentHTML("afterend", cardTemplate(data.profile));
      const card = this.#card.nextElementSibling as HTMLElement;
      card
        .querySelector(".profile-card__avatar")
        ?.replaceWith(
          this.#card.querySelector(".profile-card__avatar") as Element,
        );
      this.#card.remove();
      this.#card = card;
    }
  }

  async #loadAvatar(): Promise<void> {
    const { status, data } = await api.avatars();
    const url = status === 200 ? data?.avatars?.[0]?.url : undefined;
    if (this.#isDestroyed || !url) {
      return;
    }
    const avatar = this.#card.querySelector(".profile-card__avatar");
    avatar?.insertAdjacentHTML(
      "beforeend",
      `<img class="profile-card__avatar-image" src="${escapeHtml(api.mediaUrl(url))}" alt="">`,
    );
    avatar
      ?.querySelector("img")
      ?.addEventListener("error", (event) =>
        (event.target as HTMLElement).remove(),
      );
  }

  #showError(response: ApiResult<unknown>): void {
    if (response.status === 401) {
      this.#goToLogin();
      return;
    }
    if (response.status === 400 && registerFieldError(response)) {
      this.#editor.setFieldError("Сервер не принял этот текст, проверьте его");
      return;
    }
    this.#editor.setError(serverErrorMessage(response));
  }

  async #save(text: string, post: PostData | null): Promise<void> {
    this.#editor.setBusy(true);
    const response = post
      ? await api.updatePost(post.id, text)
      : await api.createPost(text);
    if (this.#isDestroyed) {
      return;
    }
    this.#editor.setBusy(false);

    const saved = response.data;
    const isSaved = post ? response.status === 200 : response.status === 201;
    if (!isSaved || !saved?.id) {
      this.#showError(response);
      return;
    }
    if (post) {
      this.#list.replace(saved);
    } else {
      this.#list.prepend(saved);
    }
    this.#editor.close();
  }

  async #delete(post: PostData): Promise<void> {
    const isConfirmed = await confirmDialog({
      message: "Вы действительно хотите удалить пост?",
      confirm: "Да",
      cancel: "Нет",
    });
    if (!isConfirmed || this.#isDestroyed) {
      return;
    }
    this.#editor.setBusy(true);
    const response = await api.deletePost(post.id);
    if (this.#isDestroyed) {
      return;
    }
    this.#editor.setBusy(false);
    if (response.status !== 204) {
      this.#showError(response);
      return;
    }
    this.#list.remove(post.id);
    this.#editor.close();
  }
}
