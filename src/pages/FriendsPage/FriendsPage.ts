import { api } from "../../modules/api";
import type {
  ApiResult,
  RelationshipsResponse,
  ShortProfile,
} from "../../modules/api";
import type { Router } from "@nexly/router";
import { user } from "../../modules/user";
import { serverErrorMessage } from "../../modules/errors";
import { displayName } from "../../modules/profileName";
import { AppLayout } from "../../components/AppLayout/AppLayout";
import { PeopleSection } from "../../components/PeopleSection/PeopleSection";
import type { PeoplePage } from "../../components/PeopleSection/PeopleSection";
import { confirmDialog } from "../../components/Dialog/Dialog";

const MESSAGES = {
  loading: "Загружаем список друзей",
  error: "Произошла ошибка, обновите страницу",
  noFriends: "У вас пока нет друзей, найдите их среди возможных знакомых",
  alone: "У вас пока нет друзей",
};

const REQUEST_EXISTS = "Заявка этому человеку уже есть";

function relationshipsPage(
  response: ApiResult<RelationshipsResponse>,
  keep: (master: number) => boolean = () => true,
): ApiResult<PeoplePage> {
  const { status, data } = response;
  if (status !== 200 || !data?.relationships) {
    return { status, data: data as null };
  }
  return {
    status,
    data: {
      people: data.relationships
        .filter((relationship) => keep(relationship.profile_id_master))
        .map((relationship) => relationship.profile),
      has_more: data.has_more,
      next_cursor: data.next_cursor,
    },
  };
}

/**
 * Страница друзей: входящие и отправленные заявки, возможные знакомые и список друзей. Заявку можно принять или отклонить, человека — добавить, друга — удалить.
 */
export class FriendsPage {
  #parent: HTMLElement;
  #router: Router;
  #status!: HTMLElement;
  #incoming!: PeopleSection;
  #sent!: PeopleSection;
  #suggestions!: PeopleSection;
  #friends!: PeopleSection;
  #isLoaded = false;
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
   * Рисует пустые секции и загружает первые страницы всех списков.
   */
  render(): void {
    const main = new AppLayout(this.#parent, this.#router, "friends").render();
    main.insertAdjacentHTML(
      "beforeend",
      `<p class="friends-status">${MESSAGES.loading}</p>`,
    );
    this.#status = main.lastElementChild as HTMLElement;
    const me = (user.profile as { id: number }).id;
    const onAction = (action: string, person: ShortProfile) =>
      this.#act(action, person);

    this.#incoming = new PeopleSection(main, {
      title: "Заявки в друзья",
      actions: [
        { name: "decline", label: "Отклонить", kind: "danger" },
        { name: "accept", label: "Принять", kind: "primary" },
      ],
      load: async (cursor) =>
        relationshipsPage(await api.incomingRequests(cursor)),
      onAction,
    });
    this.#sent = new PeopleSection(main, {
      title: "Отправленные заявки",
      actions: [{ name: "cancel", label: "Отменить", kind: "danger" }],
      load: async (cursor) =>
        relationshipsPage(
          await api.pendingRelationships(cursor),
          (master) => master === me,
        ),
      onAction,
    });
    this.#suggestions = new PeopleSection(main, {
      title: "Возможно вы их знаете",
      actions: [{ name: "add", label: "Добавить", kind: "primary" }],
      load: async (cursor) => {
        const { status, data } = await api.suggestions(cursor);
        if (status !== 200 || !data?.profiles) {
          return { status, data: data as null };
        }
        return {
          status,
          data: {
            people: data.profiles.map(({ profile }) => profile),
            has_more: data.has_more,
            next_cursor: data.next_cursor,
          },
        };
      },
      onAction,
    });
    this.#friends = new PeopleSection(main, {
      title: "Ваши друзья",
      actions: [{ name: "remove", label: "Удалить", kind: "danger" }],
      load: async (cursor) => relationshipsPage(await api.friends(cursor)),
      onAction,
    });
    [this.#incoming, this.#sent, this.#suggestions, this.#friends].forEach(
      (section) => section.render(),
    );
    this.#loadAll();
  }

  /**
   * Игнорирует ответы, пришедшие после ухода со страницы.
   */
  destroy(): void {
    this.#isDestroyed = true;
  }

  #goToLogin(): void {
    user.clear();
    this.#router.navigate("/login");
  }

  async #loadAll(): Promise<void> {
    const statuses = await Promise.all([
      this.#incoming.load(),
      this.#sent.loadAll(),
      this.#suggestions.load(),
      this.#friends.load(),
    ]);
    if (this.#isDestroyed) {
      return;
    }
    if (statuses.includes(401)) {
      this.#goToLogin();
      return;
    }
    if (statuses.some((status) => status !== 200)) {
      this.#status.textContent = MESSAGES.error;
      return;
    }
    this.#isLoaded = true;
    this.#updateStatus();
  }

  #updateStatus(): void {
    if (!this.#isLoaded) {
      return;
    }
    let message = "";
    if (this.#friends.count === 0) {
      message =
        this.#suggestions.count > 0 ? MESSAGES.noFriends : MESSAGES.alone;
    }
    this.#status.textContent = message;
  }

  #act(action: string, person: ShortProfile): void {
    if (action === "accept") {
      this.#run(
        this.#incoming,
        person,
        () => api.acceptFriend(person.id),
        () => this.#friends.prepend(person),
      );
    } else if (action === "decline") {
      this.#run(this.#incoming, person, () => api.removeFriend(person.id));
    } else if (action === "cancel") {
      this.#run(this.#sent, person, () => api.removeFriend(person.id));
    } else if (action === "add") {
      this.#run(
        this.#suggestions,
        person,
        () => api.addFriend(person.id),
        () => this.#sent.prepend(person),
      );
    } else if (action === "remove") {
      this.#removeFriend(person);
    }
  }

  async #removeFriend(person: ShortProfile): Promise<void> {
    const isConfirmed = await confirmDialog({
      message: `Удалить ${displayName(person)} из друзей?`,
      confirm: "Да",
      cancel: "Нет",
    });
    if (isConfirmed && !this.#isDestroyed) {
      this.#run(this.#friends, person, () => api.removeFriend(person.id));
    }
  }

  async #run(
    section: PeopleSection,
    person: ShortProfile,
    send: () => Promise<ApiResult<unknown>>,
    onDone?: () => void,
  ): Promise<void> {
    section.setError("");
    section.setBusy(person.id, true);
    const response = await send();
    if (this.#isDestroyed) {
      return;
    }
    section.setBusy(person.id, false);
    if (response.status === 401) {
      this.#goToLogin();
      return;
    }
    if (response.status !== 200 && response.status !== 201) {
      section.setError(
        response.status === 409 ? REQUEST_EXISTS : serverErrorMessage(response),
      );
      return;
    }
    section.remove(person.id);
    onDone?.();
    this.#updateStatus();
  }
}
