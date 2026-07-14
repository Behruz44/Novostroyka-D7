"use client";

import { useSession, signOut, SessionProvider } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogOut, User, Phone, Shield } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Администратор",
  OWNER: "Заказчик",
  FOREMAN: "Прораб",
};

function AccountContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center bg-secondary">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-border bg-panel px-5 py-3">
        <h1 className="text-base font-semibold text-foreground">Аккаунт</h1>
      </header>

      <main className="flex-1 overflow-y-auto bg-secondary p-4 lg:p-5">
        <div className="mx-auto max-w-md">
          <div className="rounded-lg border border-border bg-panel p-6">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal text-xl font-bold text-white">
                {session.user.name?.charAt(0) ?? "?"}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {session.user.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {ROLE_LABELS[session.user.role] ?? session.user.role}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-md border border-border bg-secondary px-4 py-3">
                <User className="h-4 w-4 text-muted-foreground" aria-hidden />
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Имя
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {session.user.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-md border border-border bg-secondary px-4 py-3">
                <Phone className="h-4 w-4 text-muted-foreground" aria-hidden />
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Телефон
                  </p>
                  <p className="font-mono text-sm font-medium text-foreground">
                    {session.user.phone}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-md border border-border bg-secondary px-4 py-3">
                <Shield className="h-4 w-4 text-muted-foreground" aria-hidden />
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Роль
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {ROLE_LABELS[session.user.role] ?? session.user.role}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/20"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Выйти
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AccountPage() {
  return (
    <SessionProvider>
      <AccountContent />
    </SessionProvider>
  );
}
