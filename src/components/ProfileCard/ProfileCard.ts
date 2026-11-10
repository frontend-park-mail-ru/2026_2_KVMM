import { escapeHtml, formatBirthday } from "@nexly/utils";
import { avatarTemplate, keepAvatar } from "../../modules/avatar";

/**
 * Данные карточки профиля. name = null — имя ещё загружается, avatarPath = null — ещё неизвестно, есть ли аватарка. actions — готовая разметка кнопок справа.
 */
export interface ProfileCardData {
  name: string | null;
  avatarPath: string | null;
  bio?: string;
  birthday?: string;
  actions: string;
}

const LOADING_NAME = "Загружаем имя";

/**
 * Строки под карточкой: «О себе» и дата рождения, только заполненные.
 * @param bio Рассказ о себе.
 * @param birthday Дата рождения в формате ISO.
 * @returns Разметка блока или пустая строка, если показывать нечего.
 */
function detailsTemplate(bio?: string, birthday?: string): string {
  const lines = [
    ["О себе", bio?.trim() ?? ""],
    ["Дата рождения", birthday ? formatBirthday(birthday) : ""],
  ]
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<p class="profile-card__detail">${label}: ${escapeHtml(value)}</p>`,
    );
  return lines.length
    ? `<div class="profile-card__details">${lines.join("")}</div>`
    : "";
}

/**
 * Карточка профиля: аватар, имя, кнопки, «О себе» и дата рождения. Используется и на своей, и на чужой странице.
 * @param data Данные карточки.
 * @param data.name Имя или null, пока оно загружается.
 * @param data.avatarPath Путь к аватарке, пустая строка — её нет, null — ещё неизвестно.
 * @param data.bio Рассказ о себе.
 * @param data.birthday Дата рождения в формате ISO.
 * @param data.actions Разметка кнопок справа.
 * @returns Разметка карточки, данные с бэка экранированы.
 */
export function profileCardTemplate({
  name,
  avatarPath,
  bio,
  birthday,
  actions,
}: ProfileCardData): string {
  const title = name
    ? `<h1 class="profile-card__name" title="${escapeHtml(name)}">${escapeHtml(name)}</h1>`
    : `<h1 class="profile-card__name profile-card__name_loading">${LOADING_NAME}</h1>`;
  return `
    <section class="profile-card">
      <div class="profile-card__main">
        ${avatarTemplate("profile-card", name ?? "", avatarPath)}
        ${title}
        <div class="profile-card__actions">${actions}</div>
      </div>
      ${detailsTemplate(bio, birthday)}
    </section>
  `;
}

/**
 * Заменяет карточку новой разметкой. Уже загруженная аватарка переносится в новую карточку, если картинка та же, поэтому при обновлении имени, кнопок или «О себе» она не мигает.
 * @param card Текущий элемент карточки.
 * @param data Новые данные карточки.
 * @returns Новый элемент карточки.
 */
export function replaceProfileCard(
  card: HTMLElement,
  data: ProfileCardData,
): HTMLElement {
  card.insertAdjacentHTML("afterend", profileCardTemplate(data));
  const next = card.nextElementSibling as HTMLElement;
  keepAvatar(card, next, "profile-card");
  card.remove();
  return next;
}
