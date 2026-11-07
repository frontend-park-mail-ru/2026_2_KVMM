import feedActiveIcon from "./icons/feed-active.svg";
import profileIcon from "./icons/profile.svg";
import messagesIcon from "./icons/messages.svg";
import communitiesIcon from "./icons/communities.svg";
import friendsIcon from "./icons/friends.svg";
import settingsIcon from "./icons/settings.svg";

const ITEMS = [
  { label: "Лента", icon: feedActiveIcon, isActive: true },
  { label: "Профиль", icon: profileIcon },
  { label: "Сообщения", icon: messagesIcon },
  { label: "Сообщества", icon: communitiesIcon },
  { label: "Друзья", icon: friendsIcon },
  { label: "Настройки", icon: settingsIcon },
];

const SLOGAN = "Nexly&nbsp;— Люди. Идеи. Ближе.";

function itemTemplate({ label, icon, isActive }) {
  const current = isActive ? ' aria-current="page"' : "";
  const labelModifier = isActive ? " sidebar__label_active" : "";
  return `
    <li class="sidebar__item"${current}>
      <img class="sidebar__icon" draggable="false" src="${icon}" width="24" height="24" alt="">
      <span class="sidebar__label${labelModifier}">${label}</span>
    </li>
  `;
}

function template() {
  return `
    <aside class="sidebar">
      <nav class="sidebar__menu" aria-label="Разделы">
        <ul class="sidebar__list">
          ${ITEMS.map(itemTemplate).join("")}
        </ul>
      </nav>
      <p class="sidebar__slogan">${SLOGAN}</p>
    </aside>
  `;
}

/**
 * Боковое меню разделов: активна только лента, остальные пункты пока без перехода.
 */
export class Sidebar {
  #parent;

  /**
   * @param {HTMLElement} parent Контейнер, в который вставляется меню.
   */
  constructor(parent) {
    this.#parent = parent;
  }

  /**
   * Вставляет меню в контейнер.
   */
  render() {
    this.#parent.insertAdjacentHTML("beforeend", template());
  }
}
