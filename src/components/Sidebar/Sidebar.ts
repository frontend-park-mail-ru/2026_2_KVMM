import feedIcon from "./icons/feed.svg";
import feedActiveIcon from "./icons/feed-active.svg";
import profileIcon from "./icons/profile.svg";
import profileActiveIcon from "./icons/profile-active.svg";
import messagesIcon from "./icons/messages.svg";
import messagesActiveIcon from "./icons/messages-active.svg";
import communitiesIcon from "./icons/communities.svg";
import friendsIcon from "./icons/friends.svg";
import friendsActiveIcon from "./icons/friends-active.svg";
import settingsIcon from "./icons/settings.svg";
import { friendRequests } from "../../modules/friendRequests";

/**
 * Раздел меню.
 */
export type SidebarSection =
  "feed" | "profile" | "messages" | "communities" | "friends" | "settings";

interface SidebarItem {
  section: SidebarSection;
  label: string;
  icon: string;
  activeIcon?: string;
  href?: string;
}

const ITEMS: SidebarItem[] = [
  {
    section: "feed",
    label: "Лента",
    icon: feedIcon,
    activeIcon: feedActiveIcon,
    href: "/feed",
  },
  {
    section: "profile",
    label: "Профиль",
    icon: profileIcon,
    activeIcon: profileActiveIcon,
    href: "/profile",
  },
  {
    section: "messages",
    label: "Сообщения",
    icon: messagesIcon,
    activeIcon: messagesActiveIcon,
    href: "/chats",
  },
  { section: "communities", label: "Сообщества", icon: communitiesIcon },
  {
    section: "friends",
    label: "Друзья",
    icon: friendsIcon,
    activeIcon: friendsActiveIcon,
    href: "/friends",
  },
  { section: "settings", label: "Настройки", icon: settingsIcon },
];

const SLOGAN = "Nexly&nbsp;— Люди. Идеи. Ближе.";

function itemTemplate(
  item: SidebarItem,
  active: SidebarSection | null,
): string {
  const isActive = item.section === active;
  const icon = isActive && item.activeIcon ? item.activeIcon : item.icon;
  const labelModifier = isActive ? " sidebar__label_active" : "";
  const badge =
    item.section === "friends"
      ? '<span class="sidebar__badge sidebar__badge_hidden" aria-hidden="true"></span>'
      : "";
  const content = `
    <img class="sidebar__icon" draggable="false" src="${icon}" width="24" height="24" alt="">
    <span class="sidebar__label${labelModifier}">${item.label}</span>
    ${badge}
  `;
  const current = isActive ? ' aria-current="page"' : "";
  const entry = item.href
    ? `<a class="sidebar__item sidebar__item_link" href="${item.href}" data-link draggable="false"${current}>${content}</a>`
    : `<span class="sidebar__item"${current}>${content}</span>`;
  return `<li class="sidebar__entry">${entry}</li>`;
}

function template(active: SidebarSection | null): string {
  return `
    <aside class="sidebar">
      <nav class="sidebar__menu" aria-label="Разделы">
        <ul class="sidebar__list">
          ${ITEMS.map((item) => itemTemplate(item, active)).join("")}
        </ul>
      </nav>
      <p class="sidebar__slogan">${SLOGAN}</p>
    </aside>
  `;
}

const MAX_BADGE = 99;

/**
 * Показывает число заявок на значке у «Друзей» и дублирует его в подписи ссылки для экранных читалок.
 * @param badge Значок.
 * @param count Число входящих заявок.
 */
function showRequests(badge: HTMLElement, count: number): void {
  badge.textContent =
    count === 0 ? "" : count > MAX_BADGE ? `${MAX_BADGE}+` : String(count);
  badge.classList.toggle("sidebar__badge_hidden", count === 0);
  const link = badge.closest(".sidebar__item");
  if (count > 0) {
    link?.setAttribute("aria-label", `Друзья, новых заявок: ${count}`);
  } else {
    link?.removeAttribute("aria-label");
  }
}

/**
 * Боковое меню разделов: лента, профиль, сообщения и друзья — ссылки, остальные разделы пока без перехода. У «Друзей» — значок с числом входящих заявок.
 */
export class Sidebar {
  #parent: HTMLElement;
  #section: SidebarSection | null;

  /**
   * @param parent Контейнер, в который вставляется меню.
   * @param section Активный раздел или null, если страница вне меню.
   */
  constructor(parent: HTMLElement, section: SidebarSection | null) {
    this.#parent = parent;
    this.#section = section;
  }

  /**
   * Вставляет меню в контейнер и подписывает значок заявок на обновления. Подписка снимается сама, когда меню уходит со страницы.
   */
  render(): void {
    this.#parent.insertAdjacentHTML("beforeend", template(this.#section));
    const badge = this.#parent.querySelector<HTMLElement>(".sidebar__badge");
    if (!badge) {
      return;
    }
    showRequests(badge, friendRequests.count);
    const unsubscribe = friendRequests.onChange((count) => {
      if (badge.isConnected) {
        showRequests(badge, count);
      } else {
        unsubscribe();
      }
    });
  }
}
