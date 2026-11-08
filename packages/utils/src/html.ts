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

/**
 * Полночь того же дня по местному времени — чтобы считать разницу в календарных днях.
 * @param date Дата.
 * @returns Начало дня.
 */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Двузначное число с ведущим нулём для часов и минут.
 * @param value Число.
 * @returns Например, 07.
 */
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

/**
 * Дата рождения: «3 февраля 2001». Берётся календарная часть строки, без перевода в местное время, иначе западнее UTC день съезжал бы на предыдущий.
 * @param value Дата в формате ISO, например 2001-02-03T00:00:00Z.
 * @returns Дата для показа или пустая строка, если формат незнаком.
 */
export function formatBirthday(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return "";
  }
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${Number(day)} ${monthName} ${year}` : "";
}
