import { useEffect, useState } from "react";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";

type NativeMessage = {
  source?: string;
  type?: string;
  enabled?: boolean;
  message?: string;
};

export function PushNotificationControl() {
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window.parent === window) return;

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window.parent || !event.data || typeof event.data !== "object") return;
      const message = event.data as NativeMessage;
      if (message.source !== "ihub-native") return;

      switch (message.type) {
        case "push:ready":
          setNativeAvailable(true);
          setEnabled(message.enabled === true);
          setPending(false);
          break;
        case "push:enabled":
          setEnabled(true);
          setPending(false);
          setError(null);
          break;
        case "push:disabled":
          setEnabled(false);
          setPending(false);
          setError(null);
          break;
        case "push:open": {
          const path = (message as NativeMessage & { url?: unknown }).url;
          if (typeof path === "string" && path.startsWith("/") && !path.startsWith("//")) {
            window.location.assign(path);
          }
          break;
        }
        case "push:denied":
        case "push:error":
          setPending(false);
          setError(message.message ?? "Push notification settings could not be updated.");
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    window.parent.postMessage({ source: "ihub-web", type: "push:hello" }, "*");
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const onChange = (checked: boolean) => {
    if (!nativeAvailable || pending) return;
    setPending(true);
    setError(null);
    window.parent.postMessage({ source: "ihub-web", type: checked ? "push:enable" : "push:disable" }, "*");
  };

  return (
    <Card className="card-elevated space-y-4 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          {enabled ? <Bell className="h-5 w-5" aria-hidden /> : <BellOff className="h-5 w-5" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">New opportunity notifications</h2>
          <p className="text-xs text-muted-foreground">
            Get a push notification whenever a new verified opportunity is added to iHub.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onChange}
          disabled={!nativeAvailable || pending}
          aria-label="Enable new opportunity push notifications"
        />
      </div>
      {!nativeAvailable && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Push alerts are available in the iHub Android app. Install the Android app to turn them on for this device.
        </p>
      )}
      {nativeAvailable && (
        <p className="text-xs text-muted-foreground">
          {pending ? "Updating notification settings…" : enabled ? "Notifications are ON for this device." : "Notifications are OFF."}
        </p>
      )}
      {error && <p className="text-xs text-destructive" role="status">{error}</p>}
    </Card>
  );
}
