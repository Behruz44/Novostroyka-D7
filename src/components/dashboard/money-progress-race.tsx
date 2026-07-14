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

  const W = 600;
  const H = 130;
  const PAD = 16;
  const trackW = W - PAD * 2 - 60;
  const trackH = 18;
  const trackGap = 14;
  const GAP_AREA_H = 22;
  const y1 = GAP_AREA_H + 12;
  const y2 = y1 + trackH + trackGap;

  const progressX = PAD + (trackW * animProgress) / 100;
  const moneyX = PAD + (trackW * animMoney) / 100;

  const gapStart = Math.min(progressX, moneyX);
  const gapEnd = Math.max(progressX, moneyX);
  const showGapZone = Math.abs(gap) > 0 && moneyPct !== null && animProgress > 0 && animMoney > 0;
  const displayProgress = Math.round(animProgress);
  const displayMoney = Math.round(animMoney);

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "12px",
        padding: "1.25rem 1.5rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        marginBottom: "1.5rem",
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={`Готовность ${progress}%, деньги ${money}%, расхождение ${gap > 0 ? "+" : ""}${gap} п.п.`}
      >
        {/* Track backgrounds */}
        <rect x={PAD} y={y1} width={trackW} height={trackH} rx={4} fill="#f3f4f6" />
        <rect x={PAD} y={y2} width={trackW} height={trackH} rx={4} fill="#f3f4f6" />

        {/* Progress fill (teal) */}
        <rect x={PAD} y={y1} width={Math.max(0, progressX - PAD)} height={trackH} rx={4} fill="#0e7a6c" style={{ transition: "width 0.05s linear" }} />

        {/* Money fill (gold) */}
        <rect x={PAD} y={y2} width={Math.max(0, moneyX - PAD)} height={trackH} rx={4} fill="#b07c1f" style={{ transition: "width 0.05s linear" }} />

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

        {/* Progress end marker (flag) */}
        <line x1={progressX} y1={y1 - 3} x2={progressX} y2={y1 + trackH + 3} stroke="#0e7a6c" strokeWidth={2} />
        <polygon
          points={`${progressX + 2},${y1 - 3} ${progressX + 14},${y1 + 1} ${progressX + 2},${y1 + 5}`}
          fill="#0e7a6c"
        />

        {/* Money end marker (coin circle) */}
        <line x1={moneyX} y1={y2 - 3} x2={moneyX} y2={y2 + trackH + 3} stroke="#b07c1f" strokeWidth={2} />
        <circle cx={moneyX + 8} cy={y2 + trackH / 2} r={6} fill="#b07c1f" />
        <circle cx={moneyX + 8} cy={y2 + trackH / 2} r={3.5} fill="none" stroke="#fff" strokeWidth={1} />

        {/* Track labels — right-aligned to avoid overlap with gap bracket */}
        <text x={W - PAD} y={y1 - 6} fontSize={11} fill="#16324a" opacity={0.7} fontFamily="Inter, sans-serif" textAnchor="end">
          Готовность
        </text>
        <text x={W - PAD} y={y2 - 6} fontSize={11} fill="#16324a" opacity={0.7} fontFamily="Inter, sans-serif" textAnchor="end">
          Деньги
        </text>

        {/* Percentage values in monospace */}
        <text
          x={W - PAD}
          y={y1 + trackH / 2 + 4}
          fontSize={14}
          fontWeight={600}
          fill="#0e7a6c"
          textAnchor="end"
          fontFamily="'IBM Plex Mono', monospace"
        >
          {displayProgress}%
        </text>
        <text
          x={W - PAD}
          y={y2 + trackH / 2 + 4}
          fontSize={14}
          fontWeight={600}
          fill="#b07c1f"
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
              strokeWidth={1.5}
            />
            <text
              x={(gapStart + gapEnd) / 2}
              y={GAP_AREA_H / 2 + 4}
              fontSize={10}
              fontWeight={600}
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "0.5rem",
        }}
      >
        <span
          style={{
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: gapPp !== null ? FLAG_COLORS[flag] : "#9ca3af",
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {gapPp === null
            ? "Расхождение: —"
            : `Расхождение: ${gapPp > 0 ? "+" : ""}${gapPp}п.п.`}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            background: pendingReviewCount > 0 ? "rgba(176,124,31,0.1)" : "#f3f4f6",
            color: pendingReviewCount > 0 ? "#b07c1f" : "#9ca3af",
            borderRadius: "999px",
            padding: "0.25rem 0.75rem",
            fontSize: "0.75rem",
            fontWeight: 500,
          }}
        >
          На проверке:{" "}
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
            {pendingReviewCount}
          </span>
        </span>
      </div>
    </div>
  );
}
