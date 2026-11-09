import { escapeHtml } from "@nexly/utils";
import { api } from "./api";

/**
 * Круглая аватарка в любом блоке: первая буква имени и картинка поверх, если она есть. Если картинка не загрузится, её убирают обработчиком ошибки, и остаётся буква.
 * @param block БЭМ-блок, в котором рисуется аватарка: элементы __avatar и __avatar-image.
 * @param name Имя для буквы.
 * @param avatarPath Путь к картинке на бэке или пустая строка.
 * @returns Разметка аватарки.
 */
export function avatarTemplate(
  block: string,
  name: string,
  avatarPath: string,
): string {
  const letter = [...name.trim()][0]?.toUpperCase() ?? "?";
  const image = avatarPath
    ? `<img class="${block}__avatar-image" src="${escapeHtml(api.mediaUrl(avatarPath))}" alt="">`
    : "";
  return `<span class="${block}__avatar">${escapeHtml(letter)}${image}</span>`;
}
