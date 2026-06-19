import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

interface NotificationBannerProps {
  notification: {
    type: "success" | "error";
    message: string;
  } | null;
  onClose: () => void;
}

export function NotificationBanner({
  notification,
  onClose,
}: NotificationBannerProps) {
  if (!notification) return null;

  const Icon = notification.type === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div className="fixed bottom-6 right-6 z-[999999] w-full max-w-sm animate-in fade-in slide-in-from-bottom-5 duration-300">
      <Alert
        variant={notification.type === "success" ? "success" : "destructive"}
        className="bg-[#0f0f12]/95 border-[#222227] shadow-2xl backdrop-blur-md pr-10"
      >
        <Icon className="h-4 w-4" />
        <div>
          <AlertTitle className="text-zinc-200 font-bold capitalize text-xs mb-1">
            {notification.type}
          </AlertTitle>
          <AlertDescription className="text-zinc-400 text-xs leading-relaxed">
            {notification.message}
          </AlertDescription>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="absolute top-3.5 right-3.5 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </Alert>
    </div>
  );
}
