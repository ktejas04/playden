import { MonitorIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import type { ComponentProps } from "react";

type Device = "phone" | "tablet" | "computer";

/** What this device looks like to the user: touch-first and small is a phone, touch-first and wide a tablet. */
function currentDevice(): Device {
  if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) {
    return "computer";
  }
  return Math.min(window.screen.width, window.screen.height) < 600 ? "phone" : "tablet";
}

const ICONS = { phone: SmartphoneIcon, tablet: TabletIcon, computer: MonitorIcon } as const;

/** An icon of the device in use, e.g. for the "Device" theme choice (follow this device). */
export function DeviceIcon(props: ComponentProps<typeof MonitorIcon>) {
  const Icon = ICONS[currentDevice()];
  return <Icon {...props} />;
}
