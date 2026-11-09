/**
 * Обёртка экранов входа и регистрации: фон с декоративными пятнами и карточка по центру.
 * @param content Разметка карточки.
 * @returns HTML страницы.
 */
export function authLayoutTemplate(content: string): string {
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
