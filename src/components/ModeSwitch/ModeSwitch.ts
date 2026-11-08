import { escapeHtml } from "@nexly/utils";

/**
 * Вариант переключателя: значение и подпись на кнопке.
 */
export interface ModeOption {
  value: string;
  label: string;
}

/**
 * Переключатель из двух вариантов по макету «Войти по: паролю | коду»: подпись сверху и две кнопки, выбранная — с цветной рамкой. Для читалок это группа радиокнопок.
 * @param label Подпись над кнопками.
 * @param options Варианты.
 * @param active Значение выбранного варианта.
 * @param mix Класс элемента родительского блока для отступов, например auth-card__mode.
 * @returns Разметка переключателя.
 */
export function modeSwitchTemplate(
  label: string,
  options: ModeOption[],
  active: string,
  mix: string = "",
): string {
  const buttons = options
    .map(({ value, label: text }) => {
      const isActive = value === active;
      const modifier = isActive ? " mode-switch__option_active" : "";
      return `<button class="mode-switch__option${modifier}" type="button" role="radio" aria-checked="${isActive}" data-mode="${escapeHtml(value)}">${escapeHtml(text)}</button>`;
    })
    .join("");
  return `
    <div class="mode-switch ${mix}" role="radiogroup" aria-label="${escapeHtml(label)}">
      <p class="mode-switch__label" aria-hidden="true">${escapeHtml(label)}</p>
      <div class="mode-switch__options">${buttons}</div>
    </div>
  `;
}

/**
 * Отмечает выбранный вариант без перерисовки переключателя.
 * @param element Элемент переключателя.
 * @param active Значение выбранного варианта.
 */
export function setActiveMode(element: Element, active: string): void {
  element
    .querySelectorAll<HTMLElement>(".mode-switch__option")
    .forEach((option) => {
      const isActive = option.dataset.mode === active;
      option.classList.toggle("mode-switch__option_active", isActive);
      option.setAttribute("aria-checked", String(isActive));
    });
}
