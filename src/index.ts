import "./index.scss";
import { api, isSession } from "./modules/api";
import { user } from "./modules/user";
import { chatSocket } from "./modules/chatSocket";
import { Router } from "./modules/router";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { SignupPage } from "./pages/SignupPage/SignupPage";
import { FeedPage } from "./pages/FeedPage/FeedPage";
import { ProfilePage } from "./pages/ProfilePage/ProfilePage";
import { EmailCodePage } from "./pages/EmailCodePage/EmailCodePage";
import { FriendsPage } from "./pages/FriendsPage/FriendsPage";
import { UserPage } from "./pages/UserPage/UserPage";
import { SIGNUP_STEPS, signupDraft } from "./modules/signupDraft";
import type { Route } from "./modules/router";

const signupRoutes = Object.fromEntries(
  SIGNUP_STEPS.map((path, index) => [
    path,
    { page: SignupPage, auth: index > 0 },
  ]),
);

function emailCodeRoute(back: string): Route {
  return {
    page: EmailCodePage,
    auth: true,
    redirect: () => (signupDraft.pendingEmail()?.back === back ? null : back),
  };
}

const routes: Record<string, Route> = {
  "/login": { page: LoginPage, auth: false },
  ...signupRoutes,
  "/signup/code": emailCodeRoute(SIGNUP_STEPS[1]),
  "/feed": { page: FeedPage, auth: true },
  "/profile": { page: ProfilePage, auth: true },
  "/profile/code": emailCodeRoute("/profile"),
  "/friends": { page: FriendsPage, auth: true },
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
);

user.onChange(() => {
  if (user.isAuthorized) {
    chatSocket.start();
  } else {
    chatSocket.stop();
  }
});

const { status, data } = await api.me();
if (status === 200 && isSession(data)) {
  user.set(data);
}

router.start();
