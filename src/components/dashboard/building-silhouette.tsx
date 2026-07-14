"use client";

import { useState } from "react";

interface FloorData {
  floor: number;
  progressPct: number;
}

interface BuildingSilhouetteProps {
  floors: FloorData[];
}

export function BuildingSilhouette({ floors }: BuildingSilhouetteProps) {
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);

  if (floors.length === 0) {
    return (
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "1.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          textAlign: "center",
          color: "#16324a",
          opacity: 0.5,
          fontSize: "0.875rem",
        }}
      >
        Нет данных по этажам
      </div>
    );
  }

  const sorted = [...floors].sort((a, b) => a.floor - b.floor);
  const floor0 = sorted.find((f) => f.floor === 0);
  const upperFloors = sorted.filter((f) => f.floor !== 0);
  const maxFloor = upperFloors.length > 0 ? Math.max(...upperFloors.map((f) => f.floor)) : 0;

  const BLOCK_H = 32;
  const BLOCK_GAP = 3;
  const FLOOR0_H = 20;
  const ROOF_H = 16;

  const totalBlocks = upperFloors.length;
  const totalH = ROOF_H + totalBlocks * (BLOCK_H + BLOCK_GAP) + FLOOR0_H + BLOCK_GAP;
  const W = 280;
  const PAD_X = 20;
  const PAD_Y = 12;

  const baseW = W - PAD_X * 2;
  const floorW = baseW * 0.72;
  const floor0W = baseW * 0.88;
  const floorX = PAD_X + (baseW - floorW) / 2;
  const floor0X = PAD_X + (baseW - floor0W) / 2;

  const labelX = floorX + floorW + 8;

  let currentY = PAD_Y;

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
      <h2
        style={{
          fontSize: "1rem",
          color: "#16324a",
          marginBottom: "0.75rem",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Этажи
      </h2>
      <svg
        viewBox={`0 0 ${W} ${totalH + PAD_Y * 2}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Прогресс по этажам"
      >
        {/* Roof — simple flat cap with slight angle */}
        {upperFloors.length > 0 && (
          <g>
            <polygon
              points={`${floorX - 4},${currentY + ROOF_H} ${floorX + floorW + 4},${currentY + ROOF_H} ${floorX + floorW - 6},${currentY} ${floorX + 6},${currentY}`}
              fill="#e5e7eb"
              stroke="#d1d5db"
              strokeWidth={1}
            />
          </g>
        )}
        {currentY += ROOF_H}

        {/* Upper floors — stacked top (highest floor) to bottom */}
        {[...upperFloors].reverse().map((f) => {
          const fillH = (BLOCK_H * f.progressPct) / 100;
          const blockY = currentY;
          currentY += BLOCK_H + BLOCK_GAP;
          const isHovered = hoveredFloor === f.floor;

          return (
            <g
              key={f.floor}
              onMouseEnter={() => setHoveredFloor(f.floor)}
              onMouseLeave={() => setHoveredFloor(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Outline */}
              <rect
                x={floorX}
                y={blockY}
                width={floorW}
                height={BLOCK_H}
                rx={2}
                fill="#f3f4f6"
                stroke={isHovered ? "#0e7a6c" : "#d1d5db"}
                strokeWidth={isHovered ? 2 : 1}
              />
              {/* Fill — bottom to top like thermometer */}
              <rect
                x={floorX}
                y={blockY + BLOCK_H - fillH}
                width={floorW}
                height={fillH}
                rx={2}
                fill="#0e7a6c"
                opacity={0.85}
              />
              {/* Floor label inside */}
              <text
                x={floorX + 8}
                y={blockY + BLOCK_H / 2 + 4}
                fontSize={11}
                fill={f.progressPct > 50 ? "#fff" : "#16324a"}
                opacity={f.progressPct > 50 ? 0.95 : 0.7}
                fontFamily="Inter, sans-serif"
                fontWeight={500}
              >
                {f.floor} эт.
              </text>
              {/* Percentage to the right */}
              <text
                x={labelX}
                y={blockY + BLOCK_H / 2 + 4}
                fontSize={12}
                fontWeight={600}
                fill={isHovered ? "#0e7a6c" : "#16324a"}
                fontFamily="'IBM Plex Mono', monospace"
              >
                {f.progressPct}%
              </text>
            </g>
          );
        })}

        {/* Floor 0 — foundation slab (wider, shorter) */}
        {floor0 && (() => {
          const fillH = (FLOOR0_H * floor0.progressPct) / 100;
          const blockY = currentY;
          const isHovered = hoveredFloor === 0;

          return (
            <g
              onMouseEnter={() => setHoveredFloor(0)}
              onMouseLeave={() => setHoveredFloor(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={floor0X}
                y={blockY}
                width={floor0W}
                height={FLOOR0_H}
                rx={2}
                fill="#f3f4f6"
                stroke={isHovered ? "#0e7a6c" : "#d1d5db"}
                strokeWidth={isHovered ? 2 : 1}
              />
              <rect
                x={floor0X}
                y={blockY + FLOOR0_H - fillH}
                width={floor0W}
                height={fillH}
                rx={2}
                fill="#0e7a6c"
                opacity={0.85}
              />
              <text
                x={floor0X + 8}
                y={blockY + FLOOR0_H / 2 + 4}
                fontSize={10}
                fill={floor0.progressPct > 50 ? "#fff" : "#16324a"}
                opacity={floor0.progressPct > 50 ? 0.95 : 0.7}
                fontFamily="Inter, sans-serif"
                fontWeight={500}
              >
                Общее
              </text>
              <text
                x={floor0X + floor0W + 8}
                y={blockY + FLOOR0_H / 2 + 4}
                fontSize={12}
                fontWeight={600}
                fill={isHovered ? "#0e7a6c" : "#16324a"}
                fontFamily="'IBM Plex Mono', monospace"
              >
                {floor0.progressPct}%
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
