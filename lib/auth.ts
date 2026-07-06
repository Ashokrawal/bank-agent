/**
 * lib/auth.ts
 * NextAuth v4 configuration
 * Credentials provider backed by SQLite mock data
 * Demo: demo@novabank.com / demo123
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserByEmail } from "@/lib/db/sqlite";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "NovaBank",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const normalizedEmail = credentials.email.trim().toLowerCase();
          const user = await getUserByEmail(normalizedEmail);
          if (!user) return null;
          // Demo: accept "demo123" for all mock users
          // Production: bcrypt.compare(credentials.password, user.password_hash)
          // admin has a separate password
          const isAdmin = normalizedEmail === "admin@novabank.com";
          const correctPassword = isAdmin ? "NovaBank@Admin2025" : "demo123";
          if (credentials.password !== correctPassword) return null;
          return {
            id: user.id as string,
            email: user.email as string,
            name: user.name as string,
          };
        } catch (err) {
          console.error("Auth error:", err);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  pages: { signIn: "/auth/signin" },
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production",
};
