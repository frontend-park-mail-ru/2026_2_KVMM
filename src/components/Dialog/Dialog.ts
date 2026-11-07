/**
 * Тексты окна подтверждения: вопрос и подписи кнопок. Это статичная разметка, данные пользователя сюда не попадают.
 */
export interface ConfirmOptions {
  message: string;
  confirm: string;
  cancel: string;
}

function template({ message, confirm, cancel }: ConfirmOptions): string {
  return `
    <div class="dialog">
      <div class="dialog__window" role="alertdialog" aria-modal="true" aria-label="${message}">
        <p class="dialog__text">${message}</p>
        <div class="dialog__actions">
          <button class="button button_neutral button_small dialog__button" type="button" data-answer="no">${cancel}</button>
          <button class="button button_danger button_small dialog__button" type="button" data-answer="yes">${confirm}</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Показывает окно подтверждения поверх страницы. Escape и клик мимо окна означают «нет».
 * @param options Вопрос и подписи кнопок.
 * @returns true, если пользователь подтвердил.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  const previousFocus = document.activeElement as HTMLElement | null;
  document.body.insertAdjacentHTML("beforeend", template(options));
  const overlay = document.body.lastElementChild as HTMLElement;
  const cancel = overlay.querySelector(
    '[data-answer="no"]',
  ) as HTMLButtonElement;
  cancel.focus();

  return new Promise((resolve) => {
    const close = (answer: boolean): void => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      previousFocus?.focus();
      resolve(answer);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        close(false);
      }
    };
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", (event) => {
      const target = event.target as Element;
      const button = target.closest<HTMLElement>("[data-answer]");
      if (button) {
        close(button.dataset.answer === "yes");
      } else if (target === overlay) {
        close(false);
      }
    });
  });
}
