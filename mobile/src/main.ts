import { FCM } from "@capacitor-community/fcm";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

const PUSH_TOPIC = "ihub_new_opportunities";
const PUSH_ENABLED_KEY = "ihub.push.enabled.v1";
const appUrl = import.meta.env.VITE_IHUB_APP_URL?.trim() ?? "";
const frame = document.querySelector<HTMLIFrameElement>("#ihub-app");
const statusPanel = document.querySelector<HTMLElement>("#status");
const statusMessage = document.querySelector<HTMLElement>("#status-message");

function showStatus(message: string) {
  if (statusMessage) statusMessage.textContent = message;
  statusPanel?.classList.add("visible");
  frame?.classList.add("hidden");
}

function showApp() {
  statusPanel?.classList.remove("visible");
  frame?.classList.remove("hidden");
}

function validAppUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url;
  } catch {
    return null;
  }
}

const target = validAppUrl(appUrl);
if (!frame || !target || !Capacitor.isNativePlatform()) {
  showStatus("Set VITE_IHUB_APP_URL to the deployed HTTPS iHub website before building the Android app.");
} else {
  const sendToApp = (type: string, details: Record<string, unknown> = {}) => {
    frame.contentWindow?.postMessage({ source: "ihub-native", type, ...details }, target.origin);
  };

  const openInApp = (value: unknown) => {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return;
    const destination = new URL(value, target);
    if (destination.origin !== target.origin) return;
    frame.src = destination.toString();
  };

  frame.addEventListener("load", () => {
    showApp();
    sendToApp("push:ready", { enabled: localStorage.getItem(PUSH_ENABLED_KEY) === "true" });
  });

  frame.src = target.toString();

  void PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
    const data = event.notification.data as { url?: unknown } | undefined;
    openInApp(data?.url ?? "/");
  });

  void PushNotifications.addListener("registrationError", () => {
    sendToApp("push:error", { message: "iHub could not register this device for push notifications. Please try again." });
  });

  async function enablePush() {
    const current = await PushNotifications.checkPermissions();
    const permission = current.receive === "granted" ? current : await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") {
      sendToApp("push:denied", { message: "Allow notifications in Android settings to receive iHub alerts." });
      return;
    }

    await PushNotifications.register();
    await FCM.getToken();
    await FCM.subscribeTo({ topic: PUSH_TOPIC });
    localStorage.setItem(PUSH_ENABLED_KEY, "true");
    sendToApp("push:enabled");
  }

  async function disablePush() {
    await FCM.unsubscribeFrom({ topic: PUSH_TOPIC });
    await PushNotifications.unregister();
    localStorage.removeItem(PUSH_ENABLED_KEY);
    sendToApp("push:disabled");
  }

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== frame.contentWindow || event.origin !== target.origin) return;
    if (!event.data || typeof event.data !== "object") return;
    const message = event.data as { source?: string; type?: string };
    if (message.source !== "ihub-web") return;

    if (message.type === "push:hello") {
      sendToApp("push:ready", { enabled: localStorage.getItem(PUSH_ENABLED_KEY) === "true" });
      return;
    }

    if (message.type === "push:enable") {
      void enablePush().catch(() => sendToApp("push:error", { message: "Could not enable push notifications. Check Firebase setup and try again." }));
    } else if (message.type === "push:disable") {
      void disablePush().catch(() => sendToApp("push:error", { message: "Could not turn off push notifications. Please try again." }));
    }
  });

  // Restore the previous opt-in without showing another permission prompt.
  if (localStorage.getItem(PUSH_ENABLED_KEY) === "true") {
    void PushNotifications.checkPermissions().then(async (permission) => {
      if (permission.receive !== "granted") {
        localStorage.removeItem(PUSH_ENABLED_KEY);
        sendToApp("push:disabled");
        return;
      }
      await PushNotifications.register();
      await FCM.getToken();
      await FCM.subscribeTo({ topic: PUSH_TOPIC });
    }).catch(() => {
      localStorage.removeItem(PUSH_ENABLED_KEY);
      sendToApp("push:error", { message: "Push notifications need to be enabled again in Settings." });
    });
  }
}
