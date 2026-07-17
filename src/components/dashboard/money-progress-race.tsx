"use client";

import { useState, useEffect, useRef } from "react";

interface MoneyProgressRaceProps {
  progressPct: number;
  moneyPct: number | null;
  gapPp: number | null;
  flag: "OK" | "WARN" | "DANGER" | "UNKNOWN";
  pendingReviewCount: number;
}

const FLAG_COLORS: Record<string, string> = {
  OK: "#0e7a6c",
  WARN: "#b07c1f",
  DANGER: "#c0392b",
  UNKNOWN: "#9ca3af",
};

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function MoneyProgressRace({
  progressPct,
  moneyPct,
  gapPp,
  flag,
  pendingReviewCount,
}: MoneyProgressRaceProps) {
  const [hovered, setHovered] = useState(false);
  const [animProgress, setAnimProgress] = useState(0);
  const [animMoney, setAnimMoney] = useState(0);
  const rafRef = useRef<number>(0);

  const money = moneyPct ?? 0;
  const progress = progressPct;
  const gap = gapPp ?? 0;
  const gapColor = gap > 15 ? "#c0392b" : gap > 8 ? "#b07c1f" : "#0e7a6c";

  useEffect(() => {
    const duration = 700;
    const moneyDelay = 100;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const pT = Math.min(elapsed / duration, 1);
      setAnimProgress(progress * easeOutCubic(pT));
      if (elapsed >= moneyDelay) {
        const mT = Math.min((elapsed - moneyDelay) / duration, 1);
        setAnimMoney(money * easeOutCubic(mT));
      }
      if (elapsed < duration + moneyDelay) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [progress, money]);

  const W = 760;
  const H = 120;
  const PAD = 20;
  const trackW = W - PAD * 2 - 82;
  const trackH = 12;
  const trackGap = 20;
  const GAP_AREA_H = 28;
  const y1 = GAP_AREA_H + 16;
  const y2 = y1 + trackH + trackGap;

  const progressX = PAD + (trackW * animProgress) / 100;
  const moneyX = PAD + (trackW * animMoney) / 100;

  const gapStart = Math.min(progressX, moneyX);
  const gapEnd = Math.max(progressX, moneyX);
  const showGapZone = Math.abs(gap) > 0 && moneyPct !== null && animProgress > 0 && animMoney > 0;
  const displayProgress = Math.round(animProgress);
  const displayMoney = Math.round(animMoney);

  return (
    <div className="premium-surface relative mb-7 overflow-hidden rounded-[22px] px-6 pb-5 pt-6 sm:px-8 sm:pt-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
      <div className="mb-5 flex flex-col gap-5 border-b border-[#e5eae8] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#748590]">
            Финансовый риск
          </p>
          <div className="flex items-end gap-3">
            <span
              className="font-mono text-[40px] font-bold leading-none tracking-[-0.02em]"
              style={{ color: gapPp !== null ? FLAG_COLORS[flag] : "#8c9aa3" }}
            >
              {gapPp === null ? "—" : `${gapPp > 0 ? "+" : ""}${gapPp}`}
            </span>
            <span className="mb-1.5 font-mono text-sm font-semibold text-[#71818b]">п.п.</span>
          </div>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[#627482]">
            Разница между освоением бюджета и фактической готовностью
          </p>
        </div>
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
          style={{
            borderColor: pendingReviewCount > 0 ? "#e8cf94" : "#dce4e1",
            background: pendingReviewCount > 0 ? "#fdf8ea" : "#f3f6f5",
            color: pendingReviewCount > 0 ? "#956515" : "#71818b",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: pendingReviewCount > 0 ? "#b07c1f" : "#8fa19d" }}
          />
          На проверке
          <span className="font-mono font-bold tabular-nums">{pendingReviewCount}</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={`Готовность ${progress}%, деньги ${money}%, расхождение ${gap > 0 ? "+" : ""}${gap} п.п.`}
      >
        <defs>
          <linearGradient id="progressFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0B6659" />
            <stop offset="100%" stopColor="#0E7A6C" />
          </linearGradient>
          <linearGradient id="moneyFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8A611A" />
            <stop offset="100%" stopColor="#B07C1F" />
          </linearGradient>
          <filter id="trackInset" x="-5%" y="-50%" width="110%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.06" />
          </filter>
        </defs>
        {/* Track backgrounds — inset shadow via darker outer + page-bg inner */}
        <rect x={PAD} y={y1} width={trackW} height={trackH} rx={6} fill="#E8E7E4" />
        <rect x={PAD + 1} y={y1 + 1} width={trackW - 2} height={trackH - 2} rx={5} fill="#F5F4F1" />
        <rect x={PAD} y={y2} width={trackW} height={trackH} rx={6} fill="#E8E7E4" />
        <rect x={PAD + 1} y={y2 + 1} width={trackW - 2} height={trackH - 2} rx={5} fill="#F5F4F1" />

        {/* Progress fill (teal) */}
        <rect x={PAD} y={y1} width={Math.max(0, progressX - PAD)} height={trackH} rx={6} fill="url(#progressFill)" style={{ transition: "width 0.05s linear" }} />

        {/* Money fill (gold) */}
        <rect x={PAD} y={y2} width={Math.max(0, moneyX - PAD)} height={trackH} rx={6} fill="url(#moneyFill)" style={{ transition: "width 0.05s linear" }} />

        {/* Gap zone — shaded area between the two markers */}
        {showGapZone && (
          <rect
            x={gapStart}
            y={y1}
            width={Math.max(0, gapEnd - gapStart)}
            height={y2 + trackH - y1}
            fill={gapColor}
            opacity={hovered ? 0.12 : 0.07}
            rx={2}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          />
        )}

        {/* Progress end marker */}
        <circle cx={progressX} cy={y1 + trackH / 2} r={7} fill="#ffffff" stroke="#0E7A6C" strokeWidth={2.5} />

        {/* Money end marker */}
        <circle cx={moneyX} cy={y2 + trackH / 2} r={7} fill="#ffffff" stroke="#B07C1F" strokeWidth={2.5} />
        <circle cx={moneyX} cy={y2 + trackH / 2} r={3} fill="#FBF1DF" stroke="#8A611A" strokeWidth={1} />

        {/* Track labels — right-aligned to avoid overlap with gap bracket */}
        <text x={W - PAD} y={y1 - 8} fontSize={10} fontWeight={700} letterSpacing="0.08em" fill="#627482" fontFamily="Inter, sans-serif" textAnchor="end">
          Готовность
        </text>
        <text x={W - PAD} y={y2 - 8} fontSize={10} fontWeight={700} letterSpacing="0.08em" fill="#627482" fontFamily="Inter, sans-serif" textAnchor="end">
          Деньги
        </text>

        {/* Percentage values in monospace */}
        <text
          x={W - PAD}
          y={y1 + trackH / 2 + 5}
          fontSize={20}
          fontWeight={600}
          fill="#0B6659"
          textAnchor="end"
          fontFamily="'IBM Plex Mono', monospace"
        >
          {displayProgress}%
        </text>
        <text
          x={W - PAD}
          y={y2 + trackH / 2 + 4}
          fontSize={20}
          fontWeight={600}
          fill="#8A611A"
          textAnchor="end"
          fontFamily="'IBM Plex Mono', monospace"
        >
          {moneyPct === null ? "—" : `${displayMoney}%`}
        </text>

        {/* Gap bracket between markers — always reserve space, only show if gap != 0 */}
        {showGapZone ? (
          <g>
            <path
              d={`M ${gapStart} ${y1 - 8} L ${gapStart} ${y1 - 12} L ${gapEnd} ${y1 - 12} L ${gapEnd} ${y1 - 8}`}
              fill="none"
              stroke={gapColor}
              strokeWidth={2}
            />
            <text
              x={(gapStart + gapEnd) / 2}
              y={GAP_AREA_H / 2 + 4}
              fontSize={11}
              fontWeight={700}
              fill={gapColor}
              textAnchor="middle"
              fontFamily="'IBM Plex Mono', monospace"
            >
              {gap > 0 ? "+" : ""}{gap}п.п.
            </text>
          </g>
        ) : (
          /* Invisible placeholder to reserve space when gap=0 */
          <text x={W / 2} y={GAP_AREA_H / 2 + 4} fontSize={10} fill="transparent" fontFamily="'IBM Plex Mono', monospace">
            placeholder
          </text>
        )}
      </svg>

      {/* Bottom row: gap text + pending review badge */}
      <div className="mt-1 flex items-center justify-between border-t border-[#edf1ef] pt-4 text-[11px] text-[#71818b]">
        <span className="font-medium">Шкала исполнения проекта</span>
        <span className="font-mono font-semibold tabular-nums text-[#506773]">0 — 100%</span>
      </div>
    </div>
  );
}
