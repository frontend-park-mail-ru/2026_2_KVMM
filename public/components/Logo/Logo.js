/**
 * Разметка логотипа Nexly: знак и надпись под ним.
 * @param {string} [mix] Классы элемента родительского блока, например auth-card__logo.
 * @returns {string} HTML логотипа.
 */
export function logoTemplate(mix = "") {
  return `
    <h1 class="logo ${mix}">
      <img class="logo__icon" src="/components/Logo/logo.svg" width="82" height="82" alt="">
      <span class="logo__text">Nexly</span>
    </h1>
  `;
}
