import { api } from "../../modules/api.js";
import { escapeHtml, formatDate } from "../../modules/utils.js";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "ogg", "mov"];
const SHOW_MORE = "Читать еще";

function fileName(path) {
  return path.split("/").pop();
}

function mediaKind(path) {
  const extension = fileName(path).split(".").pop().toLowerCase();
  if (IMAGE_EXTENSIONS.includes(extension)) {
    return "image";
  }
  if (VIDEO_EXTENSIONS.includes(extension)) {
    return "video";
  }
  return "file";
}

function avatarTemplate({ profile_name: name, nickname, image_url: imageUrl }) {
  const letter = [...(name || nickname || "?")][0].toUpperCase();
  const image = imageUrl
    ? `<img class="post__avatar-image" src="${escapeHtml(api.mediaUrl(imageUrl))}" alt="">`
    : "";
  return `<div class="post__avatar">${escapeHtml(letter)}${image}</div>`;
}

function mediaTemplate(path) {
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

function template(post) {
  const { author, post_text: text, media_urls: media = [] } = post;
  const authorName = `${author.profile_name} ${author.surname}`;
  const visual = media.filter((path) => mediaKind(path) !== "file");
  const files = media.filter((path) => mediaKind(path) === "file");

  return `
    <article class="post">
      <header class="post__header">
        ${avatarTemplate(author)}
        <div class="post__author">
          <p class="post__name" title="${escapeHtml(authorName)}">${escapeHtml(authorName)}</p>
          <time class="post__date" datetime="${escapeHtml(post.created_at)}">${formatDate(post.created_at)}</time>
        </div>
      </header>
      ${text ? `<p class="post__text post__text_collapsed">${escapeHtml(text)}</p>` : ""}
      ${visual.map(mediaTemplate).join("")}
      ${files.length ? `<div class="post__files">${files.map(mediaTemplate).join("")}</div>` : ""}
      <footer class="post__actions">
        <span class="post__action">
          <img class="post__action-icon" draggable="false" src="/components/Post/icons/like.svg" width="20" height="20" alt="Нравится">
          ${escapeHtml(post.likes_count)}
        </span>
        <span class="post__action">
          <img class="post__action-icon" draggable="false" src="/components/Post/icons/comment.svg" width="20" height="20" alt="">
          Комментарии
        </span>
        <span class="post__action">
          <img class="post__action-icon" draggable="false" src="/components/Post/icons/share.svg" width="20" height="20" alt="">
          Поделиться
        </span>
      </footer>
    </article>
  `;
}

/**
 * Карточка поста ленты. Все данные с бэкенда экранируются.
 */
export class Post {
  #parent;
  #post;

  /**
   * @param {HTMLElement} parent Список постов.
   * @param {object} post Пост из ответа GET /api/posts.
   */
  constructor(parent, post) {
    this.#parent = parent;
    this.#post = post;
  }

  /**
   * Добавляет карточку в конец списка и сворачивает длинный текст.
   */
  render() {
    this.#parent.insertAdjacentHTML("beforeend", template(this.#post));
    const element = this.#parent.lastElementChild;
    const avatarImage = element.querySelector(".post__avatar-image");
    avatarImage?.addEventListener("error", () => avatarImage.remove());

    const text = element.querySelector(".post__text");
    if (text && text.scrollHeight > text.clientHeight) {
      this.#addShowMore(text);
    }
  }

  #addShowMore(text) {
    text.insertAdjacentHTML(
      "afterend",
      `<button class="post__more" type="button">${SHOW_MORE}</button>`,
    );
    const button = text.nextElementSibling;
    button.addEventListener("click", () => {
      text.classList.remove("post__text_collapsed");
      button.remove();
    });
  }
}
