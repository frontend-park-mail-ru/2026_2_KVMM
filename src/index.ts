import "./index.scss";
import { api, isSession } from "./modules/api";
import { user } from "./modules/user";
import { chatSocket } from "./modules/chatSocket";
import { friendRequests } from "./modules/friendRequests";
import { network } from "./modules/network";
import { renderOfflineBanner } from "./components/OfflineBanner/OfflineBanner";
import { Router } from "@nexly/router";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { SignupPage } from "./pages/SignupPage/SignupPage";
import { FeedPage } from "./pages/FeedPage/FeedPage";
import { ProfilePage } from "./pages/ProfilePage/ProfilePage";
import { EmailCodePage } from "./pages/EmailCodePage/EmailCodePage";
import { FriendsPage } from "./pages/FriendsPage/FriendsPage";
import { UserPage } from "./pages/UserPage/UserPage";
import { ChatsPage } from "./pages/ChatsPage/ChatsPage";
import { ConversationPage } from "./pages/ConversationPage/ConversationPage";
import { SIGNUP_STEPS, signupDraft } from "./modules/signupDraft";
import type { Route } from "@nexly/router";

const signupRoutes = Object.fromEntries(
  SIGNUP_STEPS.map((path, index) => [
    path,
    { page: SignupPage, auth: index > 0 },
  ]),
);

/**
 * Маршрут экрана кода из письма. Экран доступен, только если код уже отправлен с той страницы, куда с него возвращаются, иначе — переход туда.
 * @param back Страница, с которой отправили код: вход, шаг регистрации или профиль.
 * @param auth Нужна ли авторизация: для входа по коду — нет.
 * @returns Маршрут для роутера.
 */
function emailCodeRoute(back: string, auth: boolean = true): Route {
  return {
    page: EmailCodePage,
    auth,
    redirect: () => (signupDraft.pendingEmail()?.back === back ? null : back),
  };
}

const routes: Record<string, Route> = {
  "/login": { page: LoginPage, auth: false },
  "/login/code": emailCodeRoute("/login", false),
  ...signupRoutes,
  "/signup/code": emailCodeRoute(SIGNUP_STEPS[1]),
  "/feed": { page: FeedPage, auth: true },
  "/profile": { page: ProfilePage, auth: true },
  "/profile/code": emailCodeRoute("/profile"),
  "/friends": { page: FriendsPage, auth: true },
  "/chats": { page: ChatsPage, auth: true },
  "/chats/:id": { page: ConversationPage, auth: true },
  "/profile/:id": {
    page: UserPage,
    auth: true,
    redirect: (_path, { id }) =>
      Number(id) === user.profile?.id ? "/profile" : null,
  },
};

const router = new Router(
  document.getElementById("root") as HTMLElement,
  routes,
  {
    isAuthorized: () => user.isAuthorized,
    guestHome: "/login",
    userHome: "/feed",
  },
);

user.onChange(() => {
  if (user.isAuthorized) {
    chatSocket.start();
    friendRequests.start();
  } else {
    chatSocket.stop();
    friendRequests.stop();
    network.clearSaved();
  }
});

renderOfflineBanner(document.body);
if (SERVICE_WORKER) {
  network.registerWorker();
}

const { status, data } = await api.me();
if (status === 200 && isSession(data)) {
  user.set(data);
}

router.start();
