import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import axios from 'axios';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          // Call backend API to create/update user
          const response = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`,
            {
              idToken: account.id_token,
            }
          );

          if (response.data.success) {
            // Store the access token in the session
            (user as any).accessToken = response.data.data.accessToken;
            (user as any).refreshToken = response.data.data.refreshToken;
            (user as any).backendUserId = response.data.data.user.id;
            return true;
          }
        } catch (error) {
          console.error('Failed to authenticate with backend:', error);
          return false;
        }
      }
      return true;
    },
    async session({ session, token, user }) {
      // Include custom data in the session
      if (token) {
        session.accessToken = token.accessToken as string;
        session.user.id = token.backendUserId as string;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          accessToken: (user as any).accessToken,
          refreshToken: (user as any).refreshToken,
          backendUserId: (user as any).backendUserId,
        };
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

// Extend the types
declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    backendUserId?: string;
  }
}