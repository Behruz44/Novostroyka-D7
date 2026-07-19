"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

interface FloorData {
  floor: number;
  progressPct: number;
}

interface StageScheduleData {
  id: string;
  name: string;
  floor: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  scheduleStatus: "ON_TRACK" | "AT_RISK" | "LATE" | "NO_PLAN";
  dependencyWarning?: boolean;
  dependencyStageName?: string | null;
}

interface Contractor {
  id: string;
  name: string;
}

interface BuildingSilhouetteProps {
  floors: FloorData[];
  stages?: StageScheduleData[];
}

const SCHEDULE_COLORS: Record<string, string> = {
  ON_TRACK: "#0E7A6C",
  AT_RISK: "#D4A017",
  LATE: "#DC2626",
  NO_PLAN: "#9CA3AF",
};

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function BuildingSilhouette({ floors, stages = [] }: BuildingSilhouetteProps) {
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);
  const [animValues, setAnimValues] = useState<Record<number, number>>({});
  const [editingFloor, setEditingFloor] = useState<number | null>(null);
  const [editForms, setEditForms] = useState<Record<string, { start: string; end: string; contractorId: string; dependsOnStageId: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const rafRef = useRef<number>(0);
  const params = useParams();
  const projectId = params?.projectId as string | undefined;

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/contractors?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => setContractors(data.contractors || []))
      .catch((err) => console.error("failed to fetch contractors", err));
  }, [projectId]);

  const sorted = [...floors].sort((a, b) => a.floor - b.floor);
  const floor0 = sorted.find((f) => f.floor === 0);
  const upperFloors = sorted.filter((f) => f.floor !== 0);
  const maxFloor = upperFloors.length > 0 ? Math.max(...upperFloors.map((f) => f.floor)) : 0;

  const stagesByFloor = new Map<number, StageScheduleData[]>();
  for (const s of stages) {
    const arr = stagesByFloor.get(s.floor) ?? [];
    arr.push(s);
    stagesByFloor.set(s.floor, arr);
  }

  function getFloorScheduleStatus(floor: number): string | null {
    const floorStages = stagesByFloor.get(floor);
    if (!floorStages || floorStages.length === 0) return null;
    const priority: Record<string, number> = { LATE: 3, AT_RISK: 2, ON_TRACK: 1, NO_PLAN: 0 };
    let worst = "NO_PLAN";
    for (const s of floorStages) {
      if (priority[s.scheduleStatus] > priority[worst]) {
        worst = s.scheduleStatus;
      }
    }
    return worst;
  }

  useEffect(() => {
    const allFloors = sorted;
    const stagger = 80;
    const duration = 400;
    const start = performance.now();

    const initial: Record<number, number> = {};
    allFloors.forEach((f) => { initial[f.floor] = 0; });
    setAnimValues(initial);

    function tick(now: number) {
      const elapsed = now - start;
      const next: Record<number, number> = {};
      let allDone = true;
      allFloors.forEach((f, idx) => {
        const delay = idx * stagger;
        const t = Math.max(0, Math.min((elapsed - delay) / duration, 1));
        next[f.floor] = f.progressPct * easeOutCubic(t);
        if (t < 1) allDone = false;
      });
      setAnimValues(next);
      if (!allDone) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floors.length]);

  function openEditPanel(floor: number) {
    const floorStages = stagesByFloor.get(floor);
    if (!floorStages) return;
    const forms: Record<string, { start: string; end: string; contractorId: string; dependsOnStageId: string }> = {};
    for (const s of floorStages) {
      forms[s.id] = {
        start: toDateInputValue(s.plannedStart),
        end: toDateInputValue(s.plannedEnd),
        contractorId: "",
        dependsOnStageId: "",
      };
    }
    setEditForms(forms);
    setEditingFloor(floor);

    // Pre-fill current contractorId and dependsOnStageId per stage (not carried by the stages prop)
    for (const s of floorStages) {
      fetch(`/api/stages/${s.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setEditForms((prev) => ({
              ...prev,
              [s.id]: {
                ...prev[s.id],
                contractorId: data.contractorId ?? "",
                dependsOnStageId: data.dependsOnStageId ?? "",
              },
            }));
          }
        })
        .catch((err) => console.error("failed to fetch stage details", err));
    }
  }

  async function saveStageDates(stageId: string) {
    const formData = editForms[stageId];
    if (!formData) return;
    setSaving(stageId);
    try {
      const res = await fetch(`/api/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedStart: formData.start || null,
          plannedEnd: formData.end || null,
          contractorId: formData.contractorId || null,
          dependsOnStageId: formData.dependsOnStageId || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEditForms((prev) => ({
          ...prev,
          [stageId]: {
            start: toDateInputValue(updated.plannedStart),
            end: toDateInputValue(updated.plannedEnd),
            contractorId: updated.contractorId ?? "",
            dependsOnStageId: updated.dependsOnStageId ?? "",
          },
        }));
      }
    } catch (err) {
      console.error("Failed to save stage dates", err);
    } finally {
      setSaving(null);
    }
  }

  if (sorted.length === 0) {
    return (
      <div className="premium-surface rounded-[20px] px-6 py-12 text-center text-sm text-[#71818b]">
        Нет данных по этажам
      </div>
    );
  }

  const BLOCK_H = 38;
  const BLOCK_GAP = 4;
  const FLOOR0_H = 24;
  const ROOF_H = 18;

  const totalBlocks = upperFloors.length;
  const totalH = ROOF_H + totalBlocks * (BLOCK_H + BLOCK_GAP) + FLOOR0_H + BLOCK_GAP;
  const W = 360;
  const PAD_X = 32;
  const PAD_Y = 18;

  const baseW = W - PAD_X * 2;
  const floorW = baseW * 0.7;
  const floor0W = baseW * 0.86;
  const floorX = PAD_X + (baseW - floorW) / 2;
  const floor0X = PAD_X + (baseW - floor0W) / 2;

  const labelX = floorX + floorW + 8;

  let currentY = PAD_Y;

  return (
    <div className="premium-surface relative overflow-hidden rounded-[22px] px-6 pb-6 pt-6 sm:px-8">
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[#effaf7] blur-3xl" />
      <div className="relative mb-4 flex items-end justify-between border-b border-[#e5eae8] pb-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#748590]">Архитектура объекта</p>
          <h2 className="text-xl font-semibold tracking-[-0.035em] text-[#102a40]">Готовность по этажам</h2>
        </div>
        <span className="rounded-full border border-[#d9e6e2] bg-[#effaf7] px-3 py-1 font-mono text-[10px] font-semibold text-[#096157]">
          {maxFloor > 0 ? `${maxFloor} эт.` : "Общее"}
        </span>
      </div>

      {/* Schedule legend */}
      <div className="mb-4 flex flex-wrap gap-3 text-[10px] font-medium text-[#748590]">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SCHEDULE_COLORS.ON_TRACK }} />В графике</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SCHEDULE_COLORS.AT_RISK }} />Риск</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SCHEDULE_COLORS.LATE }} />Опоздание</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SCHEDULE_COLORS.NO_PLAN }} />Нет плана</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${totalH + PAD_Y * 2}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Прогресс по этажам"
      >
        <defs>
          <linearGradient id="buildingProgress" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#9ED0C4" />
            <stop offset="100%" stopColor="#0E7A6C" />
          </linearGradient>
          <linearGradient id="buildingShell" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8faf9" />
            <stop offset="100%" stopColor="#e7edeb" />
          </linearGradient>
          <filter id="buildingShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#0F1721" floodOpacity="0.05" />
          </filter>
        </defs>
        {/* Roof — simple flat cap with slight angle */}
        {upperFloors.length > 0 && (
          <g>
            <polygon
              points={`${floorX - 4},${currentY + ROOF_H} ${floorX + floorW + 4},${currentY + ROOF_H} ${floorX + floorW - 6},${currentY} ${floorX + 6},${currentY}`}
              fill="#d8e1df"
              stroke="#aebfbb"
              strokeWidth={1.2}
              filter="url(#buildingShadow)"
            />
          </g>
        )}
        {currentY += ROOF_H}

        {/* Upper floors — stacked top (highest floor) to bottom */}
        {[...upperFloors].reverse().map((f) => {
          const animPct = animValues[f.floor] ?? 0;
          const fillH = (BLOCK_H * animPct) / 100;
          const blockY = currentY;
          currentY += BLOCK_H + BLOCK_GAP;
          const isHovered = hoveredFloor === f.floor;
          const scheduleStatus = getFloorScheduleStatus(f.floor);

          return (
            <g
              key={f.floor}
              onMouseEnter={() => setHoveredFloor(f.floor)}
              onMouseLeave={() => setHoveredFloor(null)}
              onClick={() => openEditPanel(f.floor)}
              style={{ cursor: "pointer" }}
            >
              {/* Outline — border 1px solid navy-100, radius 8px */}
              <rect
                x={floorX}
                y={blockY}
                width={floorW}
                height={BLOCK_H}
                rx={8}
                fill="url(#buildingShell)"
                stroke={isHovered ? "#0E7A6C" : "#C4D0DC"}
                strokeWidth={1}
                filter="url(#buildingShadow)"
              />
              {/* Fill — bottom to top like thermometer */}
              <rect
                x={floorX}
                y={blockY + BLOCK_H - fillH}
                width={floorW}
                height={fillH}
                rx={8}
                fill="url(#buildingProgress)"
                opacity={0.96}
              />
              {/* Window/floor lines at 25%/50%/75% */}
              <line x1={floorX} y1={blockY + BLOCK_H * 0.25} x2={floorX + floorW} y2={blockY + BLOCK_H * 0.25} stroke="#C4D0DC" strokeWidth={1} opacity={0.4} />
              <line x1={floorX} y1={blockY + BLOCK_H * 0.5} x2={floorX + floorW} y2={blockY + BLOCK_H * 0.5} stroke="#C4D0DC" strokeWidth={1} opacity={0.4} />
              <line x1={floorX} y1={blockY + BLOCK_H * 0.75} x2={floorX + floorW} y2={blockY + BLOCK_H * 0.75} stroke="#C4D0DC" strokeWidth={1} opacity={0.4} />
              {/* Floor label inside */}
              <text
                x={floorX + 8}
                y={blockY + BLOCK_H / 2 + 4}
                fontSize={11}
                fill={animPct > 50 ? "#fff" : "#24465f"}
                opacity={0.96}
                fontFamily="Inter, sans-serif"
                fontWeight={700}
              >
                {f.floor} эт.
              </text>
              {/* Schedule status dot */}
              {scheduleStatus && (
                <circle
                  cx={floorX + floorW - 10}
                  cy={blockY + 8}
                  r={3.5}
                  fill={SCHEDULE_COLORS[scheduleStatus]}
                  opacity={0.9}
                />
              )}
              {/* Percentage to the right */}
              <text
                x={labelX}
                y={blockY + BLOCK_H / 2 + 4}
                fontSize={13}
                fontWeight={700}
                fill={isHovered ? "#0e7a6c" : "#24465f"}
                fontFamily="'IBM Plex Mono', monospace"
              >
                {Math.round(animPct)}%
              </text>
            </g>
          );
        })}

        {/* Floor 0 — foundation slab (wider, shorter) */}
        {floor0 && (() => {
          const animPct0 = animValues[0] ?? 0;
          const fillH = (FLOOR0_H * animPct0) / 100;
          const blockY = currentY;
          const isHovered = hoveredFloor === 0;
          const scheduleStatus = getFloorScheduleStatus(0);

          return (
            <g
              onMouseEnter={() => setHoveredFloor(0)}
              onMouseLeave={() => setHoveredFloor(null)}
              onClick={() => openEditPanel(0)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={floor0X}
                y={blockY}
                width={floor0W}
                height={FLOOR0_H}
                rx={8}
                fill="url(#buildingShell)"
                stroke={isHovered ? "#0E7A6C" : "#C4D0DC"}
                strokeWidth={1}
                filter="url(#buildingShadow)"
              />
              <rect
                x={floor0X}
                y={blockY + FLOOR0_H - fillH}
                width={floor0W}
                height={fillH}
                rx={8}
                fill="url(#buildingProgress)"
                opacity={0.96}
              />
              <line x1={floor0X} y1={blockY + FLOOR0_H * 0.25} x2={floor0X + floor0W} y2={blockY + FLOOR0_H * 0.25} stroke="#C4D0DC" strokeWidth={1} opacity={0.4} />
              <line x1={floor0X} y1={blockY + FLOOR0_H * 0.5} x2={floor0X + floor0W} y2={blockY + FLOOR0_H * 0.5} stroke="#C4D0DC" strokeWidth={1} opacity={0.4} />
              <line x1={floor0X} y1={blockY + FLOOR0_H * 0.75} x2={floor0X + floor0W} y2={blockY + FLOOR0_H * 0.75} stroke="#C4D0DC" strokeWidth={1} opacity={0.4} />
              <text
                x={floor0X + 8}
                y={blockY + FLOOR0_H / 2 + 4}
                fontSize={10}
                fill={animPct0 > 50 ? "#fff" : "#24465f"}
                opacity={0.96}
                fontFamily="Inter, sans-serif"
                fontWeight={700}
              >
                Общее
              </text>
              {scheduleStatus && (
                <circle
                  cx={floor0X + floor0W - 10}
                  cy={blockY + 8}
                  r={3.5}
                  fill={SCHEDULE_COLORS[scheduleStatus]}
                  opacity={0.9}
                />
              )}
              <text
                x={floor0X + floor0W + 8}
                y={blockY + FLOOR0_H / 2 + 4}
                fontSize={13}
                fontWeight={700}
                fill={isHovered ? "#0e7a6c" : "#24465f"}
                fontFamily="'IBM Plex Mono', monospace"
              >
                {Math.round(animPct0)}%
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Inline edit panel for planned dates */}
      {editingFloor !== null && stagesByFloor.get(editingFloor) && (
        <div className="mt-4 rounded-[14px] border border-[#e5eae8] bg-[#f8faf9] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#102a40]">
              Плановые даты — {editingFloor === 0 ? "Общее" : `${editingFloor} эт.`}
            </h3>
            <button
              onClick={() => setEditingFloor(null)}
              className="text-xs font-medium text-[#71818b] hover:text-[#102a40]"
            >
              Закрыть
            </button>
          </div>
          <div className="space-y-3">
            {stagesByFloor.get(editingFloor)!.map((stage) => (
              <div key={stage.id} className="rounded-[10px] border border-[#e5eae8] bg-white p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: SCHEDULE_COLORS[stage.scheduleStatus] }}
                  />
                  <span className="text-sm font-medium text-[#24465f]">{stage.name}</span>
                  {stage.dependencyWarning && stage.dependencyStageName && (
                    <span
                      title={`Ждёт завершения: ${stage.dependencyStageName}`}
                      className="ml-1 cursor-help text-sm text-[#d97706]"
                    >
                      ⚠
                    </span>
                  )}
                </div>
                <div className="mb-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#748590]">Подрядчик</span>
                    <select
                      value={editForms[stage.id]?.contractorId ?? ""}
                      onChange={(e) =>
                        setEditForms((prev) => ({
                          ...prev,
                          [stage.id]: {
                            start: prev[stage.id]?.start ?? "",
                            end: prev[stage.id]?.end ?? "",
                            contractorId: e.target.value,
                            dependsOnStageId: prev[stage.id]?.dependsOnStageId ?? "",
                          },
                        }))
                      }
                      className="rounded-md border border-[#d4dcd9] bg-white px-2.5 py-1.5 text-sm text-[#24465f] outline-none focus:border-[#0E7A6C]"
                    >
                      <option value="">— Без подрядчика —</option>
                      {contractors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mb-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#748590]">Зависит от этапа</span>
                    <select
                      value={editForms[stage.id]?.dependsOnStageId ?? ""}
                      onChange={(e) =>
                        setEditForms((prev) => ({
                          ...prev,
                          [stage.id]: {
                            start: prev[stage.id]?.start ?? "",
                            end: prev[stage.id]?.end ?? "",
                            contractorId: prev[stage.id]?.contractorId ?? "",
                            dependsOnStageId: e.target.value,
                          },
                        }))
                      }
                      className="rounded-md border border-[#d4dcd9] bg-white px-2.5 py-1.5 text-sm text-[#24465f] outline-none focus:border-[#0E7A6C]"
                    >
                      <option value="">— Нет зависимости —</option>
                      {stages.filter((s) => s.id !== stage.id).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#748590]">Начало</span>
                    <input
                      type="date"
                      value={editForms[stage.id]?.start ?? ""}
                      onChange={(e) =>
                        setEditForms((prev) => ({
                          ...prev,
                          [stage.id]: {
                            start: e.target.value,
                            end: prev[stage.id]?.end ?? "",
                            contractorId: prev[stage.id]?.contractorId ?? "",
                            dependsOnStageId: prev[stage.id]?.dependsOnStageId ?? "",
                          },
                        }))
                      }
                      className="rounded-md border border-[#d4dcd9] bg-white px-2.5 py-1.5 text-sm text-[#24465f] outline-none focus:border-[#0E7A6C]"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#748590]">Окончание</span>
                    <input
                      type="date"
                      value={editForms[stage.id]?.end ?? ""}
                      onChange={(e) =>
                        setEditForms((prev) => ({
                          ...prev,
                          [stage.id]: {
                            start: prev[stage.id]?.start ?? "",
                            end: e.target.value,
                            contractorId: prev[stage.id]?.contractorId ?? "",
                            dependsOnStageId: prev[stage.id]?.dependsOnStageId ?? "",
                          },
                        }))
                      }
                      className="rounded-md border border-[#d4dcd9] bg-white px-2.5 py-1.5 text-sm text-[#24465f] outline-none focus:border-[#0E7A6C]"
                    />
                  </label>
                </div>
                <button
                  onClick={() => saveStageDates(stage.id)}
                  disabled={saving === stage.id}
                  className="mt-2.5 rounded-md bg-[#0E7A6C] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0a6358] disabled:opacity-50"
                >
                  {saving === stage.id ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
