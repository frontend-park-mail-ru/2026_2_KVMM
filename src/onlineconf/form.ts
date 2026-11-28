export const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Возвращает обязательный элемент панели OnlineConf.
 * @param root Контейнер панели или формы.
 * @param selector CSS-селектор элемента.
 * @returns Найденный элемент.
 */
export function element<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) {
    throw new Error("Поле OnlineConf не найдено: " + selector);
  }
  return node;
}

/**
 * Показывает сообщение и скрывает блок, когда оно пустое.
 * @param target Элемент сообщения.
 * @param message Текст сообщения.
 */
export function showMessage(target: HTMLElement, message: string): void {
  if (target.textContent !== message) {
    target.textContent = message;
  }
  target.hidden = !message;
}
