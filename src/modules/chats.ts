import { api } from "./api";
import { chatSocket } from "./chatSocket";
import type { ApiResult, Chat, ChatParticipant, ShortProfile } from "./api";
import { nextCursor } from "@nexly/utils";
import { people } from "./people";
import { displayName } from "./profileName";

const MAX_PAGES = 10;

/**
 * Участник чата в виде короткого профиля, как в списках друзей: аватарка — строкой, а не списком.
 * @param participant Участник из ответа бэка.
 * @returns Короткий профиль.
 */
function toShortProfile(participant: ChatParticipant): ShortProfile {
  return { ...participant, avatar_urls: participant.avatar_urls?.[0] ?? "" };
}

/**
 * Запоминает участников чата в кеше людей: тогда страница человека, открытая из чата, сразу знает его имя и аватарку.
 * @param chat Чат с участниками.
 */
function rememberParticipants(chat: Chat): void {
  chat.participants?.forEach((participant) => {
    const person = toShortProfile(participant);
    people.remember(person.id, {
      name: displayName(person),
      avatarUrl: person.avatar_urls || people.get(person.id)?.avatarUrl || "",
    });
  });
}

/**
 * Собеседник в личном чате. В чате с собой — сам пользователь.
 * @param chat Чат.
 * @param myId id текущего пользователя.
 * @returns Короткий профиль собеседника или null, если бэк не прислал участников.
 */
export function chatPartner(chat: Chat, myId: number): ShortProfile | null {
  const participants = chat.participants ?? [];
  const partner =
    participants.find((person) => person.id !== myId) ?? participants[0];
  return partner ? toShortProfile(partner) : null;
}

/**
 * Имя и аватарка собеседника. Аватарка — из чата, а если её там нет, из встреченных раньше постов и списков.
 * @param person Собеседник.
 * @returns Имя для показа и путь к аватарке или пустая строка.
 */
export function partnerView(person: ShortProfile | null): {
  name: string;
  avatarPath: string;
} {
  if (!person) {
    return { name: "Пользователь", avatarPath: "" };
  }
  const known = people.get(person.id);
  return {
    name: displayName(person),
    avatarPath: person.avatar_urls || known?.avatarUrl || "",
  };
}

/**
 * Время последней активности чата: последнее сообщение или создание.
 * @param chat Чат.
 * @returns Момент в миллисекундах.
 */
export function chatActivity(chat: Chat): number {
  return new Date(chat.last_message?.created_at ?? chat.created_at).getTime();
}

/**
 * Загружает все чаты (до 10 страниц) и сортирует по последней активности. Бэк отдаёт чаты по дате создания, а показывать нужно по последнему сообщению.
 * @returns Чаты, свежие сначала, или ошибка первой неудачной страницы.
 */
export async function loadAllChats(): Promise<ApiResult<Chat[]>> {
  const chats = new Map<number, Chat>();
  let cursor = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { status, data } = await api.chats(cursor);
    if (status !== 200 || !data?.chats) {
      return { status, data: null };
    }
    data.chats.forEach((chat) => {
      chats.set(chat.id, chat);
      rememberParticipants(chat);
    });
    const next = nextCursor(cursor, data);
    if (!next.hasMore) {
      break;
    }
    cursor = next.cursor;
  }
  const list = [...chats.values()].sort(
    (a, b) => chatActivity(b) - chatActivity(a),
  );
  return { status: 200, data: list };
}

/**
 * Создаёт личный чат с человеком (или возвращает существующий) и просит сокет подписаться на него: бэк подписывает только при подключении.
 * @param profileId Собеседник.
 * @returns Ответ бэка с чатом.
 */
export async function openChat(profileId: number): Promise<ApiResult<Chat>> {
  const response = await api.createChat(profileId);
  if ((response.status === 200 || response.status === 201) && response.data) {
    rememberParticipants(response.data);
    chatSocket.refresh([response.data.id]);
  }
  return response;
}
