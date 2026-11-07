const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Экранирует строку для вставки в HTML-шаблон.
 * @param value Текст или число из данных бэкенда.
 * @returns Строка без активных HTML-символов.
 */
export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Дата поста: «Сегодня в 18:42», «Вчера в 18:42» или «5 октября в 18:42».
 * @param value Дата в формате ISO.
 * @param now Текущий момент.
 * @returns Дата для показа.
 */
export function formatDate(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS,
  );

  if (days === 0) {
    return `Сегодня в ${time}`;
  }
  if (days === 1) {
    return `Вчера в ${time}`;
  }

  const year =
    date.getFullYear() === now.getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${year} в ${time}`;
}
