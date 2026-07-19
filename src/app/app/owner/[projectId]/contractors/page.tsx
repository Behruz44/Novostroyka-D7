"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { HardHat, Phone, Wallet, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Contractor {
  id: string;
  name: string;
  specialty: string;
  phone: string | null;
  createdAt: string;
}

interface ContractorPerformance {
  contractorId: string;
  contractorName: string;
  specialty: string;
  assignedStages: number;
  doneStages: number;
  lateStages: number;
  totalPaidMinor: string;
}

function formatMoney(minorStr: string): string {
  const n = BigInt(minorStr);
  const rubles = n / 100n;
  return rubles.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function OwnerContractorsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [performance, setPerformance] = useState<Record<string, ContractorPerformance>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", specialty: "", phone: "" });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/contractors?projectId=${projectId}`),
        fetch(`/api/projects/${projectId}/contractor-performance`),
      ]);
      if (cRes.ok) {
        const cd = await cRes.json();
        setContractors(cd.contractors || []);
      }
      if (pRes.ok) {
        const pd = await pRes.json();
        const map: Record<string, ContractorPerformance> = {};
        for (const p of pd.contractors || []) {
          map[p.contractorId] = p;
        }
        setPerformance(map);
      }
    } catch (err) {
      console.error("contractors fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleSubmit() {
    if (!form.name.trim() || !form.specialty.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: form.name,
          specialty: form.specialty,
          phone: form.phone || undefined,
        }),
      });
      if (res.ok) {
        setForm({ name: "", specialty: "", phone: "" });
        fetchAll();
      }
    } catch (err) {
      console.error("create contractor failed", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="border-b border-[#dce3e1] bg-white px-5 py-4 shadow-[var(--shadow-sm)] sm:px-7">
        <h1 className="text-[22px] font-semibold tracking-[-0.04em] text-[#102a40]">Подрядчики</h1>
      </header>

      <main className="premium-page flex-1 overflow-y-auto px-4 pb-14 pt-6 sm:px-6 lg:px-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : (
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
            {/* Left: Add contractor form */}
            <section className="premium-surface rounded-[18px] p-5">
              <h2 className="mb-5 flex items-center gap-2 text-[18px] font-semibold tracking-[-0.03em] text-[#102a40]">
                <span className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[#d5e7e3] bg-[#effaf7] text-[#096157] shadow-[inset_0_1px_0_white]">
                  <HardHat className="h-4 w-4" aria-hidden />
                </span>
                Добавить подрядчика
              </h2>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
              >
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#748590]">
                    Имя / название
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="ООО Стройсервис"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#748590]">
                    Специализация
                  </label>
                  <input
                    type="text"
                    value={form.specialty}
                    onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                    placeholder="Бетонные работы"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#748590]">
                    Телефон (необязательно)
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+998 90 123 45 67"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>

                <Button type="submit" variant="teal" className="w-full" disabled={saving}>
                  {saving ? "Сохранение..." : "Сохранить подрядчика"}
                </Button>
              </form>
            </section>

            {/* Right: Contractor list with performance */}
            <section>
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#748590]">
                Список подрядчиков
              </h2>
              {contractors.length === 0 ? (
                <div className="premium-surface rounded-[18px] px-6 py-12 text-center text-sm text-[#71818b]">
                  Подрядчиков пока нет
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {contractors.map((c) => {
                    const perf = performance[c.id];
                    return (
                      <div
                        key={c.id}
                        className="premium-surface premium-surface-interactive rounded-[14px] p-4"
                      >
                        <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#16324a]">
                          {c.name}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#71818b]">{c.specialty}</p>
                        {c.phone && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#506773]">
                            <Phone className="h-3 w-3" aria-hidden />
                            {c.phone}
                          </p>
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e8edeb] pt-3 text-[12px]">
                          <div className="flex items-center gap-1.5 text-[#71818b]">
                            <HardHat className="h-3.5 w-3.5" aria-hidden />
                            Этапов: <span className="font-mono font-semibold text-[#16324a]">{perf?.assignedStages ?? 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#71818b]">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#0E7A6C]" aria-hidden />
                            Готово: <span className="font-mono font-semibold text-[#0E7A6C]">{perf?.doneStages ?? 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#71818b]">
                            <AlertTriangle className="h-3.5 w-3.5 text-[#DC2626]" aria-hidden />
                            Опозданий: <span className="font-mono font-semibold text-[#DC2626]">{perf?.lateStages ?? 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#71818b]">
                            <Wallet className="h-3.5 w-3.5" aria-hidden />
                            Оплачено: <span className="font-mono font-semibold text-[#16324a]">{formatMoney(perf?.totalPaidMinor ?? "0")}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}
