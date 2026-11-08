import { escapeHtml } from "@nexly/utils";

/**
 * Данные карточки профиля. name = null — имя ещё загружается. actions — готовая разметка кнопок справа.
 */
export interface ProfileCardData {
  name: string | null;
  avatarUrl: string;
  bio?: string;
  actions: string;
}

const LOADING_NAME = "Загружаем имя";

/**
 * Карточка профиля: аватар, имя, кнопки и «О себе». Используется и на своей, и на чужой странице.
 * @param data Данные карточки.
 * @param data.name Имя или null, пока оно загружается.
 * @param data.avatarUrl Адрес аватарки или пустая строка.
 * @param data.bio Рассказ о себе.
 * @param data.actions Разметка кнопок справа.
 * @returns Разметка карточки, данные с бэка экранированы.
 */
export function profileCardTemplate({
  name,
  avatarUrl,
  bio,
  actions,
}: ProfileCardData): string {
  const letter = name ? ([...name][0]?.toUpperCase() ?? "?") : "";
  const image = avatarUrl
    ? `<img class="profile-card__avatar-image" src="${escapeHtml(avatarUrl)}" alt="">`
    : "";
  const title = name
    ? `<h1 class="profile-card__name" title="${escapeHtml(name)}">${escapeHtml(name)}</h1>`
    : `<h1 class="profile-card__name profile-card__name_loading">${LOADING_NAME}</h1>`;
  const about = bio?.trim();
  return `
    <section class="profile-card">
      <div class="profile-card__main">
        <div class="profile-card__avatar">${escapeHtml(letter)}${image}</div>
        ${title}
        <div class="profile-card__actions">${actions}</div>
      </div>
      ${about ? `<p class="profile-card__bio">О себе: ${escapeHtml(about)}</p>` : ""}
    </section>
  `;
}

/**
 * Убирает картинку аватара, если она не загрузилась, — остаётся буква.
 * @param card Элемент карточки.
 */
export function bindAvatarFallback(card: Element): void {
  const image = card.querySelector(".profile-card__avatar-image");
  image?.addEventListener("error", () => image.remove());
}
