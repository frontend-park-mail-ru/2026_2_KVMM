import { api } from "../../modules/api";
import type { ApiResult } from "../../modules/api";
import type { Router, RouteParams } from "@nexly/router";
import { user } from "../../modules/user";
import { people } from "../../modules/people";
import { findRelation } from "../../modules/relations";
import { openChat } from "../../modules/chats";
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
const MISSING_NAME = "Пользователь не найден";
const RELATION_ERROR = "Не удалось узнать, друзья ли вы";

/**
 * Кнопка-пилюля действия на карточке человека.
 * @param action Значение data-action.
 * @param label Подпись.
 * @param modifier Дополнительный модификатор кнопки с пробелом впереди.
 * @returns Разметка кнопки.
 */
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
 * Страница другого пользователя /profile/:id: имя, аватар, «О себе», дата рождения, кнопки дружбы и его посты.
 */
export class UserPage {
  #parent: HTMLElement;
  #router: Router;
  #profileId: number;
  #card!: HTMLElement;
  #list!: PostList;
  #name: string | null = null;
  #avatarPath = "";
  #bio = "";
  #birthday = "";
  #relation: RelationStatus | null = null;
  #error = "";
  #isPostsLoaded = false;
  #isRelationLoaded = false;
  #isProfileLoaded = false;
  #isMissing = false;
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
   * Рисует карточку с известным из ленты, списков или чатов именем, затем загружает профиль, посты и связь с пользователем.
   */
  render(): void {
    const known = people.get(this.#profileId);
    this.#name = known?.name ?? null;
    this.#avatarPath = known?.avatarUrl ?? "";

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
    this.#loadProfile();
    this.#loadRelation();
  }

  /**
   * Останавливает подгрузку и игнорирует ответы, пришедшие после ухода со страницы.
   */
  destroy(): void {
    this.#isDestroyed = true;
    this.#list?.destroy();
  }

  /**
   * Забывает пользователя и ведёт на вход: сессия кончилась.
   */
  #goToLogin(): void {
    user.clear();
    this.#router.navigate("/login");
  }

  /**
   * Перерисовывает карточку человека: имя, аватар, «О себе», дату рождения, кнопки по связи, «Написать» и ошибку. У несуществующего профиля кнопок нет.
   */
  #renderCard(): void {
    const buttons =
      (this.#relation ? ACTIONS[this.#relation] : "") + WRITE_BUTTON;
    const error = `<p class="profile-card__error" role="alert">${escapeHtml(this.#error)}</p>`;
    this.#card.insertAdjacentHTML(
      "afterend",
      profileCardTemplate({
        name: this.#name,
        avatarUrl: this.#avatarPath ? api.mediaUrl(this.#avatarPath) : "",
        bio: this.#bio,
        birthday: this.#birthday,
        actions: this.#isMissing ? "" : buttons + error,
      }),
    );
    const card = this.#card.nextElementSibling as HTMLElement;
    this.#card.remove();
    this.#card = card;
    bindAvatarFallback(card);
  }

  /**
   * Учитывает имя из очередного источника. Точный источник (профиль, связи) заменяет имя из постов, где бэк пишет «Фамилия Имя». «Пользователь» ставится, только когда проверены все источники.
   * @param name Имя или пустая строка.
   * @param avatarPath Путь к аватарке или пустая строка.
   * @param isExact Источник с именем в правильном порядке.
   */
  #learn(name: string, avatarPath: string, isExact: boolean = false): void {
    if (this.#isDestroyed || this.#isMissing) {
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
      this.#isProfileLoaded
    ) {
      this.#name = UNKNOWN_NAME;
    }
    this.#renderCard();
  }

  /**
   * Загружает профиль: имя, «О себе» и дату рождения. Аватарок в ответе нет — они остаются из постов и списков. 404 — такого пользователя нет.
   */
  async #loadProfile(): Promise<void> {
    const { status, data } = await api.profileById(this.#profileId);
    if (this.#isDestroyed) {
      return;
    }
    this.#isProfileLoaded = true;
    if (status === 404) {
      this.#isMissing = true;
      this.#name = MISSING_NAME;
      this.#renderCard();
      return;
    }
    const profile = status === 200 ? data : null;
    this.#bio = profile?.bio ?? "";
    this.#birthday = profile?.birthday ?? "";
    this.#learn(profile ? displayName(profile) : "", "", true);
  }

  /**
   * Узнаёт, кто вы друг другу, и берёт имя из списка связей.
   */
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

  /**
   * Запрос к бэку для кнопки дружбы. Отклонение, отмена и удаление — один и тот же запрос.
   * @param action Действие кнопки.
   * @returns Ответ бэка.
   */
  #send(action: string): Promise<ApiResult<unknown>> {
    if (action === "add") {
      return api.addFriend(this.#profileId);
    }
    if (action === "accept") {
      return api.acceptFriend(this.#profileId);
    }
    return api.removeFriend(this.#profileId);
  }

  /**
   * Открывает чат с человеком и переходит в диалог.
   */
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

  /**
   * Блокирует кнопки карточки, пока идёт запрос.
   * @param isDisabled Заблокировать ли.
   */
  #setButtonsDisabled(isDisabled: boolean): void {
    this.#card
      .querySelectorAll("button")
      .forEach((element) => (element.disabled = isDisabled));
  }

  /**
   * Нажатие кнопки на карточке. Удаление из друзей — после подтверждения. 409 и 404 значат, что связь уже поменялась, — тогда она загружается заново.
   * @param action Действие кнопки.
   */
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
