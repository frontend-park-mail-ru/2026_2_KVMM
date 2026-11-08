import { network } from "../../modules/network";

const TEXT = "Нет подключения к интернету. Показываем сохранённые данные";

/**
 * Плашка внизу экрана, пока нет связи с сервером. Живёт всё время работы приложения, поверх любых страниц.
 * @param parent Куда вставить плашку.
 */
export function renderOfflineBanner(parent: HTMLElement): void {
  parent.insertAdjacentHTML(
    "beforeend",
    `<p class="offline-banner" role="status" aria-live="polite">${TEXT}</p>`,
  );
  const banner = parent.lastElementChild as HTMLElement;
  const update = (isOffline: boolean) =>
    banner.classList.toggle("offline-banner_visible", isOffline);
  update(network.isOffline);
  network.onChange(update);
}
