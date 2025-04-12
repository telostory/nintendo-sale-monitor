import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      console.log("==== SIGNIN CALLBACK TRIGGERED ====");
      console.log("User:", user);
      console.log("Account:", account);
      console.log("Profile:", profile);
      return true;
    },
    async session({ session, token }) {
      // 세션에 사용자 정보 추가
      console.log("==== SESSION CALLBACK TRIGGERED ====");
      console.log("Token:", token);
      console.log("Original session:", session);
      
      if (token && token.sub) {
        session.user.id = token.sub;
        console.log("User ID added to session:", token.sub);
      } else {
        console.error("토큰에 sub 필드가 없습니다:", token);
      }
      
      console.log("Updated session:", session);
      return session;
    },
    async redirect({ url, baseUrl }) {
      // 리다이렉트 URL 처리
      console.log("==== REDIRECT CALLBACK TRIGGERED ====");
      console.log("URL:", url);
      console.log("BaseUrl:", baseUrl);
      
      // 더 상세한 리다이렉트 로직
      if (url.startsWith(baseUrl)) {
        console.log(`리다이렉트: ${url} (같은 도메인)`);
        return url;
      }
      // 외부 URL에 대한 리다이렉트 처리
      if (url.startsWith("http")) {
        console.log(`리다이렉트: ${baseUrl} (외부 URL 차단)`);
      }
      console.log(`기본 리다이렉트: ${baseUrl}`);
      return baseUrl;
    },
    async jwt({ token, user, account, profile }) {
      console.log("==== JWT CALLBACK TRIGGERED ====");
      console.log("Token before update:", token);
      console.log("User info:", user);
      
      if (user) {
        // 최초 로그인 시 user 객체가 전달됨
        token.userId = user.id;
        console.log("User ID added to token:", user.id);
      }
      
      if (account) {
        token.accessToken = account.access_token;
        console.log("Access token added to JWT");
      }
      
      console.log("Updated token:", token);
      return token;
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'  // 오류 페이지 추가
  },
  // 더 안전한 JWT 설정
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30일
  },
  // 디버그 모드를 항상 활성화
  debug: true,
  logger: {
    error(code, metadata) {
      console.error(`Auth 오류: ${code}`, metadata);
    },
    warn(code) {
      console.warn(`Auth 경고: ${code}`);
    },
    debug(code, metadata) {
      console.log(`Auth 디버그: ${code}`, metadata);
    }
  },
};

export default NextAuth(authOptions); 