import { api } from "../../modules/api";
import type { ApiResult } from "../../modules/api";
import type { Router, RouteParams } from "@nexly/router";
import { user } from "../../modules/user";
import { people } from "../../modules/people";
import { findRelation } from "../../modules/relations";
import { findChatPerson, openChat } from "../../modules/chats";
import { friendRequests } from "../../modules/friendRequests";
import type { RelationStatus } from "../../modules/relations";
import { displayName } from "../../modules/profileName";
import { serverErrorMessage } from "../../modules/errors";
import { escapeHtml } from "@nexly/utils";
import { AppLayout } from "../../components/AppLayout/AppLayout";
import { PostList } from "../../components/PostList/PostList";
import { confirmDialog } from "../../components/Dialog/Dialog";
import {
  bindAvatarFallback,
  profileCardTemplate,
} from "../../components/ProfileCard/ProfileCard";

const MESSAGES = {
  loading: "Загружаем страницу пользователя",
  empty: "Этот пользователь еще ничего не написал",
  end: "Нет более старых постов",
  error: "Произошла ошибка, обновите страницу",
};

const UNKNOWN_NAME = "Пользователь";
const RELATION_ERROR = "Не удалось узнать, друзья ли вы";

function button(action: string, label: string, modifier: string = ""): string {
  return `<button class="button button_pill${modifier}" type="button" data-action="${action}">${label}</button>`;
}

const ACTIONS: Record<RelationStatus, string> = {
  none: button("add", "Добавить в друзья"),
  sent: button("cancel", "Отменить заявку", " button_alert"),
  incoming:
    button("accept", "Принять заявку", " button_filled") +
    button("decline", "Отклонить заявку", " button_alert"),
  friend: button("remove", "Удалить из друзей", " button_alert"),
};

const WRITE_BUTTON = button("write", "Написать");

const NEXT_RELATION: Record<string, RelationStatus> = {
  add: "sent",
  cancel: "none",
  accept: "friend",
  decline: "none",
  remove: "none",
};

/**
 * Страница другого пользователя /profile/:id: имя, аватар, кнопки дружбы и его посты.
 */
export class UserPage {
  #parent: HTMLElement;
  #router: Router;
  #profileId: number;
  #card!: HTMLElement;
  #list!: PostList;
  #name: string | null = null;
  #avatarPath = "";
  #relation: RelationStatus | null = null;
  #error = "";
  #isPostsLoaded = false;
  #isRelationLoaded = false;
  #isChatsChecked = false;
  #isDestroyed = false;

  /**
   * @param parent Контейнер страницы.
   * @param router Роутер для перехода на /login.
   * @param params Параметры пути, id — профиль пользователя.
   */
  constructor(parent: HTMLElement, router: Router, params: RouteParams) {
    this.#parent = parent;
    this.#router = router;
    this.#profileId = Number(params.id);
  }

  /**
   * Рисует карточку с известным из ленты, списков или чатов именем, затем загружает посты и связь с пользователем. Если имя неизвестно, ищет человека среди участников своих чатов.
   */
  render(): void {
    const known = people.get(this.#profileId);
    this.#name = known?.name ?? null;
    this.#avatarPath = known?.avatarUrl ?? "";
    this.#isChatsChecked = Boolean(known);

    const main = new AppLayout(this.#parent, this.#router, null).render();
    main.insertAdjacentHTML("beforeend", "<section></section>");
    this.#card = main.lastElementChild as HTMLElement;
    this.#renderCard();
    main.addEventListener("click", (event) => {
      const target = (event.target as Element).closest<HTMLElement>(
        ".profile-card [data-action]",
      );
      if (target?.dataset.action) {
        this.#act(target.dataset.action);
      }
    });

    this.#list = new PostList(main, {
      load: async (cursor, limit) => {
        const response = await api.userPosts(this.#profileId, cursor, limit);
        const author = response.data?.posts?.[0]?.author;
        this.#isPostsLoaded = true;
        this.#learn(author?.name ?? "", author?.avatar_urls ?? "");
        return response;
      },
      messages: MESSAGES,
      onUnauthorized: () => this.#goToLogin(),
    });
    this.#list.render();
    this.#loadRelation();
    if (!this.#isChatsChecked) {
      this.#loadFromChats();
    }
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

  #renderCard(): void {
    const actions =
      (this.#relation ? ACTIONS[this.#relation] : "") + WRITE_BUTTON;
    const error = `<p class="profile-card__error" role="alert">${escapeHtml(this.#error)}</p>`;
    this.#card.insertAdjacentHTML(
      "afterend",
      profileCardTemplate({
        name: this.#name,
        avatarUrl: this.#avatarPath ? api.mediaUrl(this.#avatarPath) : "",
        actions: actions + error,
      }),
    );
    const card = this.#card.nextElementSibling as HTMLElement;
    this.#card.remove();
    this.#card = card;
    bindAvatarFallback(card);
  }

  #learn(name: string, avatarPath: string, isExact: boolean = false): void {
    if (this.#isDestroyed) {
      return;
    }
    if (name && (isExact || !this.#name || this.#name === UNKNOWN_NAME)) {
      this.#name = name;
      this.#avatarPath =
        (isExact && avatarPath) || this.#avatarPath || avatarPath;
      people.remember(this.#profileId, {
        name,
        avatarUrl: this.#avatarPath,
      });
    } else if (
      !this.#name &&
      this.#isPostsLoaded &&
      this.#isRelationLoaded &&
      this.#isChatsChecked
    ) {
      this.#name = UNKNOWN_NAME;
    }
    this.#renderCard();
  }

  async #loadFromChats(): Promise<void> {
    const person = await findChatPerson(this.#profileId);
    if (this.#isDestroyed) {
      return;
    }
    this.#isChatsChecked = true;
    this.#learn(
      person ? displayName(person) : "",
      person?.avatar_urls ?? "",
      true,
    );
  }

  async #loadRelation(): Promise<void> {
    const me = user.profile?.id ?? 0;
    const result = await findRelation(this.#profileId, me);
    if (this.#isDestroyed) {
      return;
    }
    if (result.status === 401) {
      this.#goToLogin();
      return;
    }
    this.#isRelationLoaded = true;
    this.#relation = result.status === 200 ? result.relation : null;
    this.#error = result.status === 200 ? "" : RELATION_ERROR;
    const profile = result.profile;
    this.#learn(
      profile ? displayName(profile) : "",
      profile?.avatar_urls ?? "",
      true,
    );
  }

  #send(action: string): Promise<ApiResult<unknown>> {
    if (action === "add") {
      return api.addFriend(this.#profileId);
    }
    if (action === "accept") {
      return api.acceptFriend(this.#profileId);
    }
    return api.removeFriend(this.#profileId);
  }

  async #write(): Promise<void> {
    this.#setButtonsDisabled(true);
    const response = await openChat(this.#profileId);
    if (this.#isDestroyed) {
      return;
    }
    if (response.status === 401) {
      this.#goToLogin();
      return;
    }
    if (response.data?.id) {
      this.#router.navigate(`/chats/${response.data.id}`);
      return;
    }
    this.#error = serverErrorMessage(response);
    this.#renderCard();
  }

  #setButtonsDisabled(isDisabled: boolean): void {
    this.#card
      .querySelectorAll("button")
      .forEach((element) => (element.disabled = isDisabled));
  }

  async #act(action: string): Promise<void> {
    if (action === "write") {
      this.#write();
      return;
    }
    if (!(action in NEXT_RELATION)) {
      return;
    }
    if (action === "remove") {
      const isConfirmed = await confirmDialog({
        message: `Удалить ${this.#name ?? UNKNOWN_NAME} из друзей?`,
        confirm: "Да",
        cancel: "Нет",
      });
      if (!isConfirmed || this.#isDestroyed) {
        return;
      }
    }
    this.#setButtonsDisabled(true);
    const response = await this.#send(action);
    if (this.#isDestroyed) {
      return;
    }
    if (response.status === 401) {
      this.#goToLogin();
      return;
    }
    if (action === "accept" || action === "decline") {
      friendRequests.refresh();
    }
    if (response.status === 409 || response.status === 404) {
      await this.#loadRelation();
      return;
    }
    const isDone = response.status === 200 || response.status === 201;
    this.#error = isDone ? "" : serverErrorMessage(response);
    if (isDone) {
      this.#relation = NEXT_RELATION[action];
    }
    this.#renderCard();
  }
}
