/**
 * Разметка логотипа Nexly: большой — знак и надпись под ним, маленький — только знак.
 * @param {string} [mix] Классы элемента родительского блока, например auth-card__logo.
 * @param {"large"|"small"} [size] Размер логотипа.
 * @returns {string} HTML логотипа.
 */
export function logoTemplate(mix = "", size = "large") {
  if (size === "small") {
    return `
      <h1 class="logo ${mix}">
        <img class="logo__icon logo__icon_small" src="/components/Logo/logo-small.svg" width="48" height="48" alt="Nexly">
      </h1>
    `;
  }
  return `
    <h1 class="logo ${mix}">
      <img class="logo__icon" src="/components/Logo/logo.svg" width="82" height="82" alt="">
      <span class="logo__text">Nexly</span>
    </h1>
  `;
}
