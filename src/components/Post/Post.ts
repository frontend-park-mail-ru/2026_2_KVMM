import { api } from "../../modules/api";
import type { Post as PostData } from "../../modules/api";
import { escapeHtml, formatDate } from "@nexly/utils";
import likeIcon from "./icons/like.svg";
import commentIcon from "./icons/comment.svg";
import shareIcon from "./icons/share.svg";
import editIcon from "./icons/edit.svg";
import { user } from "../../modules/user";
import { people } from "../../modules/people";
import { avatarTemplate } from "../../modules/avatar";

/**
 * Настройки карточки: onEdit включает карандаш у постов текущего пользователя.
 */
export interface PostOptions {
  onEdit?: (post: PostData) => void;
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "ogg", "mov"];
const SHOW_MORE = "Читать еще";

/**
 * Имя файла из пути вложения.
 * @param path Путь к файлу на бэке.
 * @returns Последняя часть пути.
 */
function fileName(path: string): string {
  return path.split("/").pop() ?? "";
}

/**
 * Вид вложения по расширению: картинка и видео показываются в посте, остальное — ссылкой на файл.
 * @param path Путь к файлу.
 * @returns image, video или file.
 */
function mediaKind(path: string): "image" | "video" | "file" {
  const extension = (fileName(path).split(".").pop() ?? "").toLowerCase();
  if (IMAGE_EXTENSIONS.includes(extension)) {
    return "image";
  }
  if (VIDEO_EXTENSIONS.includes(extension)) {
    return "video";
  }
  return "file";
}

/**
 * Вложение поста: картинка, видео с управлением или ссылка на файл, которая открывается в новой вкладке.
 * @param path Путь к файлу на бэке.
 * @returns Разметка вложения.
 */
function mediaTemplate(path: string): string {
  const url = escapeHtml(api.mediaUrl(path));
  const kind = mediaKind(path);

  if (kind === "image") {
    return `<img class="post__media" src="${url}" alt="Изображение к посту" loading="lazy">`;
  }
  if (kind === "video") {
    return `<video class="post__media" src="${url}" controls preload="metadata"></video>`;
  }
  const name = escapeHtml(fileName(path));
  return `<a class="post__file" href="${url}" title="${name}" target="_blank" rel="noopener noreferrer"><span class="post__file-name">${name}</span></a>`;
}

/**
 * Адрес страницы автора: своя — /profile, чужая — /profile/id. У постов сообществ ссылки нет.
 * @param post Пост.
 * @returns Путь или пустая строка.
 */
function authorPath(post: PostData): string {
  const id = post.author_profile_id;
  if (!id) {
    return "";
  }
  return id === user.profile?.id ? "/profile" : `/profile/${id}`;
}

/**
 * Разметка поста: автор со ссылкой на его страницу, дата, карандаш для своих постов, текст, вложения и кнопки реакций. Данные бэка экранируются.
 * @param post Пост.
 * @param canEdit Показывать ли карандаш правки.
 * @returns Разметка поста.
 */
function template(post: PostData, canEdit: boolean): string {
  const { author, post_text: text, media_urls: media = [] } = post;
  const authorName = author.name;
  const visual = media.filter((path) => mediaKind(path) !== "file");
  const files = media.filter((path) => mediaKind(path) === "file");
  const path = authorPath(post);
  const authorBlock = `
    ${avatarTemplate("post", author.name, author.avatar_urls ?? "")}
    <div class="post__author">
      <p class="post__name" title="${escapeHtml(authorName)}">${escapeHtml(authorName)}</p>
      <time class="post__date" datetime="${escapeHtml(post.created_at)}">${formatDate(post.created_at)}</time>
    </div>
  `;
  const profile = path
    ? `<a class="post__profile" href="${path}" data-link draggable="false">${authorBlock}</a>`
    : `<div class="post__profile">${authorBlock}</div>`;

  return `
    <article class="post">
      <header class="post__header">
        ${profile}
        ${canEdit ? `<button class="post__edit" type="button" aria-label="Редактировать пост"><img class="post__edit-icon" draggable="false" src="${editIcon}" width="20" height="48" alt=""></button>` : ""}
      </header>
      ${text ? `<p class="post__text post__text_collapsed">${escapeHtml(text)}</p>` : ""}
      ${visual.map(mediaTemplate).join("")}
      ${files.length ? `<div class="post__files">${files.map(mediaTemplate).join("")}</div>` : ""}
      <footer class="post__actions">
        <span class="post__action">
          <img class="post__action-icon" draggable="false" src="${likeIcon}" width="20" height="20" alt="Нравится">
          ${escapeHtml(post.likes_count)}
        </span>
        <span class="post__action">
          <img class="post__action-icon" draggable="false" src="${commentIcon}" width="20" height="20" alt="">
          Комментарии
        </span>
        <span class="post__action">
          <img class="post__action-icon" draggable="false" src="${shareIcon}" width="20" height="20" alt="">
          Поделиться
        </span>
      </footer>
    </article>
  `;
}

/**
 * Карточка поста. Все данные с бэкенда экранируются.
 */
export class Post {
  #parent: HTMLElement;
  #post: PostData;
  #options: PostOptions;
  #element: HTMLElement | null = null;

  /**
   * @param parent Список постов.
   * @param post Пост из ответа бэка.
   * @param options Обработчик правки своих постов.
   */
  constructor(parent: HTMLElement, post: PostData, options: PostOptions = {}) {
    this.#parent = parent;
    this.#post = post;
    this.#options = options;
    if (post.author_profile_id) {
      people.remember(post.author_profile_id, {
        name: post.author.name,
        avatarUrl: post.author.avatar_urls ?? "",
      });
    }
  }

  /**
   * Добавляет карточку в список и сворачивает длинный текст.
   * @param position Куда вставить: в конец или в начало списка.
   */
  render(position: "beforeend" | "afterbegin" = "beforeend"): void {
    this.#parent.insertAdjacentHTML(position, this.#markup());
    const element = (
      position === "beforeend"
        ? this.#parent.lastElementChild
        : this.#parent.firstElementChild
    ) as HTMLElement;
    this.#bind(element);
  }

  /**
   * Перерисовывает карточку на месте после изменения поста.
   * @param post Пост из ответа бэка.
   */
  update(post: PostData): void {
    this.#post = post;
    if (!this.#element) {
      return;
    }
    this.#element.insertAdjacentHTML("afterend", this.#markup());
    const element = this.#element.nextElementSibling as HTMLElement;
    this.#element.remove();
    this.#bind(element);
  }

  /**
   * Убирает карточку из списка.
   */
  remove(): void {
    this.#element?.remove();
    this.#element = null;
  }

  /**
   * Разметка этого поста. Карандаш есть только у своих постов и только там, где правка разрешена.
   * @returns Разметка поста.
   */
  #markup(): string {
    const isOwn =
      user.profile !== null && this.#post.author_profile_id === user.profile.id;
    return template(this.#post, Boolean(this.#options.onEdit) && isOwn);
  }

  /**
   * Подключает отрисованный пост: карандаш и «Читать еще», если текст не поместился.
   * @param element Элемент поста.
   */
  #bind(element: HTMLElement): void {
    this.#element = element;
    element
      .querySelector(".post__edit")
      ?.addEventListener("click", () => this.#options.onEdit?.(this.#post));

    const text = element.querySelector<HTMLElement>(".post__text");
    if (text && text.scrollHeight > text.clientHeight) {
      this.#addShowMore(text);
    }
  }

  /**
   * Добавляет под обрезанный текст кнопку «Читать еще», которая раскрывает его целиком.
   * @param text Элемент текста поста.
   */
  #addShowMore(text: HTMLElement): void {
    text.insertAdjacentHTML(
      "afterend",
      `<button class="post__more" type="button">${SHOW_MORE}</button>`,
    );
    const button = text.nextElementSibling as HTMLElement;
    button.addEventListener("click", () => {
      text.classList.remove("post__text_collapsed");
      button.remove();
    });
  }
}
