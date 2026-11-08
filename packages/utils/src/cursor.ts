/**
 * Положение в списке с курсорной подгрузкой.
 */
export interface CursorState {
  cursor: number;
  hasMore: boolean;
}

/**
 * Следующий курсор списка. Подгрузка продолжается, только если бэк обещает ещё элементы и курсор уходит строго к более старым — иначе список мог бы зациклиться.
 * @param current Текущий курсор, 0 — самое начало.
 * @param page Ответ бэка.
 * @param page.has_more Есть ли ещё элементы.
 * @param page.next_cursor Курсор следующей страницы.
 * @returns Новый курсор и признак, есть ли что подгружать.
 */
export function nextCursor(
  current: number,
  {
    has_more: hasMore,
    next_cursor: next,
  }: { has_more: boolean; next_cursor?: number },
): CursorState {
  const isForward =
    typeof next === "number" &&
    Number.isInteger(next) &&
    next > 0 &&
    (current === 0 || next < current);
  const canContinue = hasMore === true && isForward;
  return {
    cursor: canContinue ? (next as number) : current,
    hasMore: canContinue,
  };
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
