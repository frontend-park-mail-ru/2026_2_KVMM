import { escapeHtml } from "@nexly/utils";
import { api } from "./api";

const IMAGE_SUFFIX = "__avatar-image";

/**
 * Круглая аватарка в любом блоке. Если есть картинка, буква под ней скрыта: пока картинка грузится, круг просто пустой, и буква не сменяется картинкой. Буква видна, только если картинки нет или она не загрузилась.
 * @param block БЭМ-блок, в котором рисуется аватарка: элементы __avatar и __avatar-image.
 * @param name Имя для буквы.
 * @param avatarPath Путь к картинке на бэке, пустая строка — картинки нет, null — ещё неизвестно, есть ли она.
 * @returns Разметка аватарки.
 */
export function avatarTemplate(
  block: string,
  name: string,
  avatarPath: string | null,
): string {
  const letter =
    avatarPath === null ? "" : ([...name.trim()][0]?.toUpperCase() ?? "");
  const image = avatarPath
    ? `<img class="${block}${IMAGE_SUFFIX}" src="${escapeHtml(api.mediaUrl(avatarPath))}" alt="">`
    : "";
  const modifier = avatarPath ? ` ${block}__avatar_image` : "";
  return `<span class="${block}__avatar${modifier}">${escapeHtml(letter)}${image}</span>`;
}

/**
 * БЭМ-блок аватарки, к которой относится картинка.
 * @param target Элемент, на котором случилось событие.
 * @returns Имя блока или null, если это не картинка аватарки.
 */
function avatarBlock(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLImageElement)) {
    return null;
  }
  const name = target.classList[0] ?? "";
  return name.endsWith(IMAGE_SUFFIX)
    ? name.slice(0, -IMAGE_SUFFIX.length)
    : null;
}

/**
 * Следит за картинками всех аватарок на странице: сломанную убирает и показывает букву. Событие ошибки загрузки не всплывает, поэтому слушается на фазе перехвата.
 */
export function watchAvatars(): void {
  document.addEventListener(
    "error",
    (event) => {
      const block = avatarBlock(event.target);
      if (block) {
        const image = event.target as HTMLElement;
        image.parentElement?.classList.remove(`${block}__avatar_image`);
        image.remove();
      }
    },
    true,
  );
}

/**
 * Переносит уже загруженную аватарку из старой разметки в новую, если картинка та же: при перерисовке карточки она не мигает и не грузится заново.
 * @param from Старый элемент с аватаркой.
 * @param to Новый элемент с аватаркой.
 * @param block БЭМ-блок аватарки.
 */
export function keepAvatar(from: Element, to: Element, block: string): void {
  const selector = `.${block}__avatar`;
  const previous = from.querySelector(selector);
  const next = to.querySelector(selector);
  const previousImage = previous?.querySelector("img")?.getAttribute("src");
  const nextImage = next?.querySelector("img")?.getAttribute("src");
  if (previous && next && previousImage && previousImage === nextImage) {
    next.replaceWith(previous);
  }
}
