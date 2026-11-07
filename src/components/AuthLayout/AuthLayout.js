/**
 * Обёртка экранов входа и регистрации: фон с декоративными пятнами и карточка по центру.
 * @param {string} content Разметка карточки.
 * @returns {string} HTML страницы.
 */
export function authLayoutTemplate(content) {
  return `
    <main class="auth-layout">
      <div class="auth-layout__backdrop" aria-hidden="true">
        <div class="auth-layout__blob auth-layout__blob_top"></div>
        <div class="auth-layout__blob auth-layout__blob_bottom"></div>
      </div>
      ${content}
    </main>
  `;
}
