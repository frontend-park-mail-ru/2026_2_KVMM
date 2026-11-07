import { api, isSession } from "../../modules/api";
import type {
  ApiResult,
  Avatar,
  Post as PostData,
  Profile,
} from "../../modules/api";
import type { Router } from "../../modules/router";
import { user } from "../../modules/user";
import { registerFieldError, serverErrorMessage } from "../../modules/errors";
import { escapeHtml } from "../../modules/utils";
import { signupDraft } from "../../modules/signupDraft";
import { AppLayout } from "../../components/AppLayout/AppLayout";
import { PostList } from "../../components/PostList/PostList";
import { PostEditor } from "../../components/PostEditor/PostEditor";
import { ProfileEditor } from "../../components/ProfileEditor/ProfileEditor";
import type { ProfileChanges } from "../../components/ProfileEditor/ProfileEditor";
import { confirmDialog } from "../../components/Dialog/Dialog";

const MESSAGES = {
  loading: "Загружаем вашу страницу",
  empty: "Напишите свой первый пост",
  end: "Нет более старых постов",
  error: "Произошла ошибка, обновите страницу",
};

const PROFILE_PATH = "/profile";
const EMAIL_CODE_PATH = "/profile/code";
const PHONE_TAKEN = "Этот номер уже используется";
const EMAIL_TAKEN = "Этот email уже занят";

function displayName(profile: Profile): string {
  const name = [profile.profile_name, profile.surname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || profile.nickname;
}

function cardTemplate(profile: Profile, avatarUrl: string): string {
  const name = displayName(profile);
  const letter = [...name][0]?.toUpperCase() ?? "?";
  const bio = profile.bio?.trim();
  const image = avatarUrl
    ? `<img class="profile-card__avatar-image" src="${escapeHtml(avatarUrl)}" alt="">`
    : "";
  return `
    <section class="profile-card">
      <div class="profile-card__main">
        <div class="profile-card__avatar">${escapeHtml(letter)}${image}</div>
        <h1 class="profile-card__name" title="${escapeHtml(name)}">${escapeHtml(name)}</h1>
        <button class="profile-card__edit button button_pill" type="button" data-action="edit-profile">Редактировать профиль</button>
      </div>
      ${bio ? `<p class="profile-card__bio">О себе: ${escapeHtml(bio)}</p>` : ""}
    </section>
  `;
}

/**
 * Страница своего профиля: карточка с именем, аватаром и рассказом о себе, редактирование профиля, создание поста и свои посты с правкой и удалением.
 */
export class ProfilePage {
  #parent: HTMLElement;
  #router: Router;
  #card!: HTMLElement;
  #profileEditor!: ProfileEditor;
  #editor!: PostEditor;
  #list!: PostList;
  #avatarUrl = "";
  #isDestroyed = false;

  /**
   * @param parent Контейнер страницы.
   * @param router Роутер для перехода на /login и на экран кода email.
   */
  constructor(parent: HTMLElement, router: Router) {
    this.#parent = parent;
    this.#router = router;
  }

  /**
   * Рисует профиль из текущей сессии, обновляет его с бэка и загружает свои посты. Если вернулись с экрана кода из-за занятого email, сразу открывает форму с ошибкой.
   */
  render(): void {
    const profile = user.profile as Profile;
    const main = new AppLayout(this.#parent, this.#router, "profile").render();
    main.insertAdjacentHTML("beforeend", cardTemplate(profile, ""));
    this.#card = main.lastElementChild as HTMLElement;
    main.addEventListener("click", (event) => {
      if ((event.target as Element).closest('[data-action="edit-profile"]')) {
        this.#openProfileEditor();
      }
    });

    this.#profileEditor = new ProfileEditor(main, {
      onSubmit: (changes) => this.#saveProfile(changes),
      onCancel: () => this.#closeProfileEditor(),
    });
    this.#profileEditor.render();

    this.#editor = new PostEditor(main, {
      onSubmit: (text, post) => this.#save(text, post),
      onDelete: (post) => this.#delete(post),
    });
    this.#editor.render();

    this.#list = new PostList(main, {
      load: (cursor, limit) => api.userPosts(profile.id, cursor, limit),
      messages: MESSAGES,
      onEdit: (post) => this.#editPost(post),
      onUnauthorized: () => this.#goToLogin(),
    });
    this.#list.render();

    this.#showEmailError();
    this.#refreshProfile();
    this.#loadAvatar();
  }

  /**
   * Останавливает подгрузку и игнорирует ответы, пришедшие после ухода со страницы.
   */
  destroy(): void {
    this.#isDestroyed = true;
    this.#list?.destroy();
    this.#profileEditor?.destroy();
  }

  #goToLogin(): void {
    user.clear();
    this.#router.navigate("/login");
  }

  #renderCard(profile: Profile): void {
    this.#card.insertAdjacentHTML(
      "afterend",
      cardTemplate(profile, this.#avatarUrl),
    );
    const card = this.#card.nextElementSibling as HTMLElement;
    this.#card.remove();
    this.#card = card;
    card
      .querySelector(".profile-card__avatar-image")
      ?.addEventListener("error", (event) =>
        (event.target as HTMLElement).remove(),
      );
  }

  #applyProfile(profile: Profile): void {
    user.setProfile(profile);
    this.#renderCard(profile);
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
      this.#applyProfile(data.profile);
      if (this.#profileEditor.isOpen) {
        this.#profileEditor.commit(data.profile);
      }
    }
  }

  async #loadAvatar(): Promise<void> {
    const { status, data } = await api.avatars();
    const url = status === 200 ? data?.avatars?.[0]?.url : undefined;
    if (this.#isDestroyed || !url) {
      return;
    }
    this.#avatarUrl = api.mediaUrl(url);
    this.#renderCard(user.profile as Profile);
  }

  #openProfileEditor(): void {
    if (this.#profileEditor.isOpen) {
      return;
    }
    this.#editor.close();
    this.#editor.hide(true);
    this.#profileEditor.open(user.profile as Profile, this.#avatarUrl);
  }

  #closeProfileEditor(): void {
    this.#profileEditor.close();
    this.#editor.hide(false);
  }

  #showEmailError(): void {
    const email = signupDraft.pendingEmail();
    if (email?.back !== PROFILE_PATH) {
      return;
    }
    const error = signupDraft.takeFieldError();
    signupDraft.clearPendingEmail();
    if (!error) {
      return;
    }
    this.#openProfileEditor();
    this.#profileEditor.setValue("email", email.email);
    this.#profileEditor.setFieldError(error.field, error.message);
  }

  #editPost(post: PostData): void {
    if (this.#profileEditor.isOpen) {
      this.#closeProfileEditor();
    }
    this.#editor.edit(post);
  }

  #showProfileError(response: ApiResult<unknown>, field?: string): void {
    if (response.status === 401) {
      this.#goToLogin();
      return;
    }
    const fieldError = response.status === 400 && registerFieldError(response);
    if (fieldError) {
      this.#profileEditor.setFieldError(fieldError.field, fieldError.message);
      return;
    }
    if (field && response.status === 409) {
      this.#profileEditor.setFieldError(
        field,
        field === "email" ? EMAIL_TAKEN : PHONE_TAKEN,
      );
      return;
    }
    this.#profileEditor.setError(serverErrorMessage(response));
  }

  async #saveProfile(changes: ProfileChanges): Promise<void> {
    this.#profileEditor.setBusy(true);
    const isSaved =
      (await this.#saveFields(changes)) &&
      (await this.#saveAvatar(changes)) &&
      (await this.#sendEmailCode(changes));
    if (this.#isDestroyed) {
      return;
    }
    this.#profileEditor.setBusy(false);
    if (isSaved && changes.email === null) {
      this.#closeProfileEditor();
    }
  }

  async #saveFields({ fields }: ProfileChanges): Promise<boolean> {
    if (Object.keys(fields).length === 0) {
      return true;
    }
    const response = await api.updateProfile(fields);
    if (this.#isDestroyed) {
      return false;
    }
    if (response.status === 200 && response.data?.id) {
      this.#applyProfile(response.data);
      this.#profileEditor.commit(response.data);
      return true;
    }
    this.#showProfileError(response, "phone_number");
    return false;
  }

  async #uploadAvatar(file: File): Promise<ApiResult<Avatar>> {
    const response = await api.uploadAvatar(file);
    if (response.status !== 409 || response.data?.code !== "avatar_limit") {
      return response;
    }
    const { data } = await api.avatars();
    const oldest = data?.avatars?.at(-1);
    if (!oldest || (await api.deleteAvatar(oldest.id)).status !== 204) {
      return response;
    }
    return api.uploadAvatar(file);
  }

  async #saveAvatar({ avatar }: ProfileChanges): Promise<boolean> {
    if (!avatar) {
      return true;
    }
    const response = await this.#uploadAvatar(avatar);
    if (this.#isDestroyed) {
      return false;
    }
    if (response.status === 201 && response.data?.url) {
      this.#avatarUrl = api.mediaUrl(response.data.url);
      this.#renderCard(user.profile as Profile);
      this.#profileEditor.setAvatar(this.#avatarUrl);
      return true;
    }
    if (response.status === 400 || response.status === 409) {
      this.#profileEditor.setFieldError("avatar", serverErrorMessage(response));
      return false;
    }
    this.#showProfileError(response);
    return false;
  }

  async #sendEmailCode({ email }: ProfileChanges): Promise<boolean> {
    if (email === null) {
      return true;
    }
    const response = await api.requestEmailChange(email);
    if (this.#isDestroyed) {
      return false;
    }
    if (response.status === 200) {
      signupDraft.setPendingEmail(email, {
        next: PROFILE_PATH,
        back: PROFILE_PATH,
        skip: "Отменить",
      });
      this.#router.navigate(EMAIL_CODE_PATH);
      return true;
    }
    this.#showProfileError(response, "email");
    return false;
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
