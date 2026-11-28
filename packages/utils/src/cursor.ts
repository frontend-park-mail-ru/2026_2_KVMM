/**
 * Положение в списке с курсорной подгрузкой.
 */
export interface CursorState<T extends number | string = number> {
  cursor: T;
  hasMore: boolean;
}

/**
 * Следующий курсор для списка с UUID. Повтор ранее использованного курсора завершает подгрузку.
 * @param current Текущий курсор или пустая строка перед первой страницей.
 * @param page Ответ бэка.
 * @param page.has_more Есть ли ещё элементы.
 * @param page.next_cursor Курсор следующей страницы.
 * @param seen Курсоры уже запрошенных страниц.
 * @returns Новый курсор и признак, есть ли что подгружать.
 */
export function nextCursor(
  current: string,
  {
    has_more: hasMore,
    next_cursor: next,
  }: { has_more: boolean; next_cursor?: string },
  seen: ReadonlySet<string>,
): CursorState<string> {
  if (hasMore && typeof next === "string" && next && !seen.has(next)) {
    return { cursor: next, hasMore: true };
  }
  return { cursor: current, hasMore: false };
}

/**
 * Следующее смещение списка, который отдаётся по смещению (друзья, заявки). Подгрузка продолжается, только если бэк обещает ещё элементы и смещение растёт — иначе список мог бы зациклиться.
 * @param current Текущее смещение, 0 — начало.
 * @param page Ответ бэка.
 * @param page.has_more Есть ли ещё элементы.
 * @param page.next_cursor Смещение следующей страницы.
 * @returns Новое смещение и признак, есть ли что подгружать.
 */
export function nextOffset(
  current: number,
  {
    has_more: hasMore,
    next_cursor: next,
  }: { has_more: boolean; next_cursor?: number },
): CursorState {
  const canContinue =
    hasMore === true &&
    typeof next === "number" &&
    Number.isInteger(next) &&
    next > current;
  return {
    cursor: canContinue ? (next as number) : current,
    hasMore: canContinue,
  };
}
