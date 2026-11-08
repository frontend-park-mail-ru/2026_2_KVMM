import { ChatSocket } from "@nexly/chat-socket";
import { user } from "./user";

export type {
  ChatEvent,
  ChatSocketState,
  ChatSocketStatus,
  SendResult,
} from "@nexly/chat-socket";

/**
 * Единственный на вкладку клиент чатов Nexly.
 */
export const chatSocket = new ChatSocket({
  path: "/api/chats/ws",
  lockName: "nexly-chat-socket",
  channelName: "nexly-chat",
  getCsrf: () => user.csrfToken,
  getMyId: () => user.profile?.id ?? 0,
});
