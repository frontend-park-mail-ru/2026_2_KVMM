import { api } from "./api";
import type { ApiResult, RelationshipsResponse, ShortProfile } from "./api";
import { nextOffset } from "@nexly/utils";

/**
 * Связь текущего пользователя с человеком: нет связи, входящая заявка, отправленная заявка или дружба.
 */
export type RelationStatus = "none" | "incoming" | "sent" | "friend";

/**
 * Результат поиска связи: HTTP-статус (не 200 — связь неизвестна), сама связь и краткий профиль человека, если он нашёлся в списках.
 */
export interface RelationResult {
  status: number;
  relation: RelationStatus;
  profile?: ShortProfile;
}

/**
 * Ищет человека в списке связей, проходя страницы по смещению.
 * @param load Загрузка страницы списка по смещению.
 * @param profileUid UUID человека.
 * @returns Статус последнего запроса и найденная связь, если есть.
 */
async function scan(
  load: (cursor: number) => Promise<ApiResult<RelationshipsResponse>>,
  profileUid: string,
): Promise<{
  status: number;
  found?: RelationshipsResponse["relationships"][number];
}> {
  let cursor = 0;
  for (;;) {
    const { status, data } = await load(cursor);
    if (status !== 200 || !data?.relationships) {
      return { status };
    }
    const found = data.relationships.find(
      (relationship) => relationship.profile.uid === profileUid,
    );
    const next = nextOffset(cursor, data);
    if (found || !next.hasMore) {
      return { status, found };
    }
    cursor = next.cursor;
  }
}

/**
 * Собирает UUID отправителей входящих заявок. Общий список заявок смешивает оба направления.
 * @returns Статус и UUID отправителей.
 */
export async function loadIncomingUids(): Promise<{
  status: number;
  uids: Set<string>;
}> {
  const uids = new Set<string>();
  let cursor = 0;
  for (;;) {
    const { status, data } = await api.incomingRequests(cursor);
    if (status !== 200 || !data?.relationships) {
      return { status, uids };
    }
    data.relationships.forEach(({ profile }) => uids.add(profile.uid));
    const next = nextOffset(cursor, data);
    if (!next.hasMore) {
      return { status, uids };
    }
    cursor = next.cursor;
  }
}

/**
 * Ищет связь в списках друзей и заявок. Для направления заявки проверяет список входящих.
 * @param profileUid UUID человека.
 * @returns Статус ответа, связь и краткий профиль человека.
 */
export async function findRelation(profileUid: string): Promise<RelationResult> {
  const [friends, pending] = await Promise.all([
    scan(api.friends, profileUid),
    scan(api.pendingRelationships, profileUid),
  ]);
  const status = friends.status !== 200 ? friends.status : pending.status;
  if (status !== 200) {
    return { status, relation: "none" };
  }
  if (friends.found) {
    return { status, relation: "friend", profile: friends.found.profile };
  }
  if (pending.found) {
    const incoming = await scan(api.incomingRequests, profileUid);
    return {
      status: incoming.status,
      relation: incoming.found ? "incoming" : "sent",
      profile: pending.found.profile,
    };
  }
  return { status, relation: "none" };
}
