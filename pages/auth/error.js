import { useRouter } from 'next/router';
import { Box, Button, Container, Paper, Typography, Alert } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import Head from 'next/head';
import Link from 'next/link';

const theme = createTheme({
  palette: {
    primary: {
      main: '#E60012', // 닌텐도 레드
    },
    secondary: {
      main: '#1F1F1F', // 닌텐도 블랙
    },
  },
});

export default function ErrorPage() {
  const router = useRouter();
  const { error } = router.query;

  // 에러 메시지 매핑
  const errorMessages = {
    Configuration: "서버 설정 오류가 발생했습니다. 관리자에게 문의해주세요.",
    AccessDenied: "접근이 거부되었습니다. 로그인 권한이 없습니다.",
    Verification: "이메일 확인 링크가 만료되었거나 이미 사용되었습니다.",
    OAuthSignin: "OAuth 제공자에 연결하는 중 오류가 발생했습니다.",
    OAuthCallback: "OAuth 제공자에서 응답을 받는 중 오류가 발생했습니다.",
    OAuthCreateAccount: "OAuth 계정을 생성하는 중 오류가 발생했습니다.",
    EmailCreateAccount: "이메일로 계정을 생성하는 중 오류가 발생했습니다.",
    Callback: "콜백 처리 중 오류가 발생했습니다.",
    OAuthAccountNotLinked: "이미 다른 OAuth 서비스로 등록된 이메일입니다.",
    EmailSignin: "이메일 로그인 중 오류가 발생했습니다.",
    CredentialsSignin: "로그인 정보가 맞지 않습니다. 다시 시도해주세요.",
    SessionRequired: "이 페이지는 로그인이 필요합니다.",
    Default: "로그인 중 오류가 발생했습니다."
  };

  const errorMessage = errorMessages[error] || errorMessages.Default;

  // 오류별 문제 해결 방법
  const troubleshootingTips = {
    OAuthCallback: [
      "브라우저의 쿠키를 삭제하고 다시 시도해보세요.",
      "개인 정보 보호 모드나 시크릿 모드가 아닌 일반 브라우저 모드에서 시도해보세요.",
      "다른 구글 계정으로 시도해보세요.",
      "브라우저를 최신 버전으로 업데이트하고 다시 시도해보세요."
    ],
    Default: [
      "잠시 후 다시 시도해보세요.",
      "다른 브라우저나 기기에서 시도해보세요.",
      "문제가 지속되면 관리자에게 문의해주세요."
    ]
  };

  const tips = troubleshootingTips[error] || troubleshootingTips.Default;

  return (
    <ThemeProvider theme={theme}>
      <Head>
        <title>오류 - 닌텐도 게임 가격 모니터</title>
        <meta name="description" content="닌텐도 게임 가격 모니터 오류 페이지" />
      </Head>
      <Container maxWidth="sm" sx={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Paper 
          elevation={3} 
          sx={{ 
            p: 4, 
            width: '100%', 
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <Typography variant="h5" component="h1" gutterBottom sx={{ mb: 2, fontWeight: 'bold', color: 'error.main' }}>
            로그인 오류 발생
          </Typography>
          
          <Alert severity="error" sx={{ width: '100%', mb: 3 }}>
            {errorMessage}
          </Alert>

          <Typography variant="body1" sx={{ mb: 2, fontWeight: 'bold', alignSelf: 'flex-start' }}>
            문제 해결 방법:
          </Typography>
          
          <Box sx={{ mb: 4, width: '100%' }}>
            {tips.map((tip, index) => (
              <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                • {tip}
              </Typography>
            ))}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Button
              variant="outlined"
              onClick={() => router.push('/auth/signin')}
            >
              로그인 페이지로
            </Button>
            
            <Button
              variant="contained"
              color="primary"
              onClick={() => router.push('/')}
            >
              홈으로 돌아가기
            </Button>
          </Box>
          
          <Typography variant="caption" sx={{ mt: 4, color: 'text.secondary' }}>
            오류 코드: {error || 'unknown'}
          </Typography>
        </Paper>
      </Container>
    </ThemeProvider>
  );
} 