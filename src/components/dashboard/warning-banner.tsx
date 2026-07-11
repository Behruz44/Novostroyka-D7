import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface WarningBannerProps {
  flag: "OK" | "WARN" | "DANGER" | "UNKNOWN";
  gapPp: number | null;
}

const config: Record<WarningBannerProps["flag"], { bg: string; border: string; text: string; icon: typeof Info }> =
  {
    OK: { bg: "bg-teal/10", border: "border-teal/30", text: "text-teal", icon: Info },
    WARN: { bg: "bg-gold/10", border: "border-gold/30", text: "text-gold", icon: AlertTriangle },
    DANGER: { bg: "bg-danger/10", border: "border-danger/30", text: "text-danger", icon: AlertTriangle },
    UNKNOWN: { bg: "bg-muted", border: "border-border", text: "text-muted-foreground", icon: Info },
  };

const message: Record<WarningBannerProps["flag"], string> = {
  OK: "Проект в норме: расходы соответствуют физическому прогрессу.",
  WARN: "Внимание: расходы опережают готовность более чем на 8 п.п.",
  DANGER: "Критическое расхождение: расходы сильно опережают прогресс.",
  UNKNOWN: "Нет данных для оценки расхождения.",
};

export function WarningBanner({ flag, gapPp }: WarningBannerProps) {
  const { bg, border, text, icon: Icon } = config[flag];
  const gapText =
    gapPp !== null && gapPp !== undefined ? `Текущее расхождение: ${gapPp > 0 ? "+" : ""}${gapPp} п.п.` : "";

  return (
    <div className={cn("flex items-center gap-3 border px-4 py-2.5", bg, border)}>
      <Icon className={cn("h-4 w-4 shrink-0", text)} aria-hidden />
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", text)}>{message[flag]}</p>
        {gapText && <p className="text-xs text-muted-foreground">{gapText}</p>}
      </div>
    </div>
  );
}
