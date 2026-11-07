/**
 * Что известно о человеке без отдельного запроса: имя для показа и путь к аватарке.
 */
export interface KnownPerson {
  name: string;
  avatarUrl: string;
}

const known = new Map<number, KnownPerson>();

/**
 * Имена и аватарки людей, встреченных в ленте и списках друзей. Нужны, чтобы страница человека сразу показала имя: отдельной ручки чужого профиля у бэка нет.
 */
export const people = {
  remember: (id: number, person: KnownPerson): void => {
    if (id > 0 && person.name) {
      known.set(id, person);
    }
  },
  get: (id: number): KnownPerson | null => known.get(id) ?? null,
};
