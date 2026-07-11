import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      phone: string;
      role: string;
      projectIds: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: string;
    projectIds: string[];
  }
}
