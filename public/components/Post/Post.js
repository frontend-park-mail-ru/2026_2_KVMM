import { api } from "../../modules/api.js";
import { escapeHtml, formatDate } from "../../modules/utils.js";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "ogg", "mov"];

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
  return `<a class="post__file" href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(fileName(path))}</a>`;
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
          <p class="post__name">${escapeHtml(authorName)}</p>
          <time class="post__date" datetime="${escapeHtml(post.created_at)}">${formatDate(post.created_at)}</time>
        </div>
      </header>
      ${text ? `<p class="post__text">${escapeHtml(text)}</p>` : ""}
      ${visual.map(mediaTemplate).join("")}
      ${files.length ? `<div class="post__files">${files.map(mediaTemplate).join("")}</div>` : ""}
<footer class="post__actions">

  <span class="post__action post__action_likes">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3.16991L9.4973 3.7257C9.62884 3.88268 9.81033 3.97138 10 3.97138C10.1897 3.97138 10.3712 3.88268 10.5027 3.7257L10 3.16991ZM7.60563 16.871C6.19571 15.5942 4.65402 14.3473 3.43097 12.7652C2.23183 11.214 1.39535 9.4041 1.39535 7.05592H0C0 9.90432 1.03302 12.0774 2.38765 13.8296C3.71835 15.5509 5.41467 16.9279 6.74179 18.1298L7.60563 16.871ZM1.39535 7.05592C1.39535 4.75745 2.52593 2.82997 4.06917 2.01961C5.56844 1.23234 7.58294 1.44083 9.4973 3.7257L10.5027 2.61412C8.23116 -0.0969758 5.5945 -0.543798 3.48908 0.561764C1.42764 1.64423 0 4.15775 0 7.05592H1.39535ZM6.74179 18.1298C7.21828 18.5613 7.7298 19.0215 8.24819 19.3694C8.76642 19.7172 9.35777 20 10 20V18.3971C9.712 18.3971 9.37312 18.2681 8.95219 17.9854C8.53144 17.703 8.09496 17.3141 7.60563 16.871L6.74179 18.1298ZM13.2582 18.1298C14.5853 16.9279 16.2817 15.5509 17.6124 13.8296C18.967 12.0774 20 9.90432 20 7.05592H18.6047C18.6047 9.4041 17.7682 11.214 16.569 12.7652C15.346 14.3473 13.8043 15.5941 12.3944 16.871L13.2582 18.1298ZM20 7.05592C20 4.15775 18.5724 1.64423 16.5109 0.561764C14.4055 -0.543798 11.7688 -0.0969758 9.4973 2.61412L10.5027 3.7257C12.417 1.44083 14.4315 1.23234 15.9308 2.01961C17.474 2.82997 18.6047 4.75745 18.6047 7.05592H20ZM12.3944 16.871C11.905 17.3141 11.4686 17.703 11.0478 17.9854C10.6269 18.2681 10.288 18.3971 10 18.3971V20C10.6422 20 11.2336 19.7172 11.7518 19.3694C12.2702 19.0215 12.7817 18.5613 13.2582 18.1298L12.3944 16.871Z" fill="black"/>
    </svg>
    ${escapeHtml(post.likes_count)}
  </span>

  <span class="post__action">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.3269 0C4.99361 0 0.654448 4.00269 0.654448 8.92282C0.683957 10.9464 1.39677 12.7856 2.55353 14.1886L2.54697 14.1801C2.14827 15.8892 1.33775 17.3544 0.235418 18.4945L0.232795 18.4973C0.0885275 18.6563 0 18.8748 0 19.1144C0 19.6028 0.367225 19.9993 0.821011 19.9993C0.879373 19.9993 0.935768 19.9929 0.990852 19.9802L0.985606 19.9809C3.25322 19.5738 5.26378 18.6168 6.96679 17.2406L6.93137 17.2682C7.94583 17.6336 9.11374 17.8449 10.3276 17.8456C15.6608 17.8456 20 13.8422 20 8.92211C20 4.00198 15.6602 0 10.3269 0ZM10.3269 16.0793C10.3171 16.0793 10.3046 16.0793 10.2928 16.0793C9.1321 16.0793 8.02059 15.8524 6.99433 15.4375L7.05925 15.4601C7.02974 15.4524 6.99367 15.446 6.95761 15.4425H6.95433C6.89859 15.4248 6.83498 15.4135 6.76875 15.4107H6.76744C6.71891 15.4142 6.67432 15.422 6.63169 15.434L6.63694 15.4326C6.57136 15.4418 6.51234 15.4573 6.4566 15.4806L6.46185 15.4785C6.41005 15.5061 6.36611 15.5358 6.3248 15.5697L6.32676 15.5683C6.2848 15.5916 6.24939 15.6156 6.21594 15.6425L6.21791 15.6411C5.31886 16.4794 4.25063 17.136 3.07748 17.5424L3.01321 17.5615C3.60077 16.5783 4.03292 15.4234 4.24079 14.1843L4.24866 14.1264C4.25194 14.1045 4.24539 14.084 4.24735 14.0614C4.24866 14.0416 4.24932 14.0189 4.24932 13.9956C4.24932 13.7758 4.17915 13.5736 4.06177 13.4132L4.06308 13.4153C4.05062 13.3991 4.04669 13.3793 4.03292 13.3637C2.97256 12.2272 2.3109 10.6595 2.29385 8.92494V8.9214C2.29385 4.97597 5.89724 1.76562 10.3269 1.76562C14.7566 1.76562 18.3599 4.97597 18.3599 8.9214C18.3599 12.8668 14.7559 16.0779 10.3269 16.0779V16.0793Z" fill="black"/>
    </svg>
    Комментарии
  </span>

  <span class="post__action">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M19.0909 0C19.593 0 20 0.583984 20 1.30435C20 5.20773 18.8461 7.77323 17.3493 9.3195C15.899 10.8178 14.1859 11.3044 13.0303 11.3044H3.10383L7.61248 17.7734C7.96751 18.2828 7.96751 19.1086 7.61248 19.618C7.2575 20.1273 6.68189 20.1273 6.32687 19.618L0.266264 10.9223C-0.0887546 10.4129 -0.0887546 9.58715 0.266264 9.07776L6.32687 0.382035C6.68189 -0.12734 7.2575 -0.12734 7.61248 0.382035C7.96751 0.89141 7.96751 1.71729 7.61248 2.22667L3.10383 8.69567H13.0303C13.8949 8.69567 15.2121 8.31271 16.287 7.20228C17.3155 6.13984 18.1818 4.3575 18.1818 1.30435C18.1818 0.583984 18.5888 0 19.0909 0Z" fill="#030303"/>
    </svg>
    Поделиться
  </span>
  
</footer>
  `;
}

export class Post {
  #parent;
  #post;

  constructor(parent, post) {
    this.#parent = parent;
    this.#post = post;
  }

  render() {
    this.#parent.insertAdjacentHTML("beforeend", template(this.#post));
    const avatarImage = this.#parent.lastElementChild.querySelector(
      ".post__avatar-image",
    );
    avatarImage?.addEventListener("error", () => avatarImage.remove());
  }
}
