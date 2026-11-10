import type * as React from "react";
import { useTheme } from "next-themes";
import {
  type ExternalToast,
  Toaster as Sonner,
  type ToasterProps,
  toast as sonnerToast,
} from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

export const TOAST_DURATION_MS = 4000;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={TOAST_DURATION_MS}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

type Show = (message: React.ReactNode, options?: ExternalToast) => string | number;

// Sonner pauses a toast while the pointer rests on it, and our toasts appear right where
// people just tapped. Dismiss on a fixed timer so every toast leaves on its own.
function autoDismiss(show: Show): Show {
  return (message, options) => {
    const duration = options?.duration ?? TOAST_DURATION_MS;
    const id = show(message, { ...options, duration });
    if (Number.isFinite(duration)) setTimeout(() => sonnerToast.dismiss(id), duration);
    return id;
  };
}

const toast = {
  message: autoDismiss(sonnerToast),
  success: autoDismiss(sonnerToast.success),
  info: autoDismiss(sonnerToast.info),
  warning: autoDismiss(sonnerToast.warning),
  error: autoDismiss(sonnerToast.error),
  dismiss: sonnerToast.dismiss,
};

export { Toaster, toast };
