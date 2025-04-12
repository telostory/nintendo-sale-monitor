import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }) {
      // 세션에 사용자 정보 추가
      session.user.id = token.sub;
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  }
};

export default NextAuth(authOptions); 