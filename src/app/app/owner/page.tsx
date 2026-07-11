import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OwnerRedirectPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  const projects = await prisma.project.findMany({
    where: { members: { some: { userId: session.user.id } } },
    select: { id: true },
    orderBy: { name: "asc" },
  });

  if (projects.length === 0) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-bg-alt)",
        }}
      >
        <p style={{ color: "var(--color-navy)", opacity: 0.5 }}>
          У вас нет проектов
        </p>
      </main>
    );
  }

  redirect(`/app/owner/${projects[0].id}`);
}
