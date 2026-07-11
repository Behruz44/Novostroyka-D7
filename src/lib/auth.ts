import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expectedHash = parts[2];
  const hashBuf = scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHash, "hex");
  if (hashBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(hashBuf, expectedBuf);
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        phone: { label: "Телефон", type: "text" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { phone: credentials.phone },
          select: {
            id: true,
            phone: true,
            name: true,
            role: true,
            passwordHash: true,
          },
        });

        if (!user || !verifyPassword(credentials.password, user.passwordHash)) {
          return null;
        }

        return {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as unknown as { role: string }).role;

        const memberships = await prisma.projectMember.findMany({
          where: { userId: user.id },
          select: { projectId: true },
        });
        token.projectIds = memberships.map((m) => m.projectId);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.projectIds = token.projectIds as string[];
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export default NextAuth(authOptions);
