import { useState } from 'react';
import { signIn } from "next-auth/react";
import { Box, Button, Container, Paper, Typography } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import Head from 'next/head';
import GoogleIcon from '@mui/icons-material/Google';
import { useRouter } from 'next/router';

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

export default function SignIn() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { callbackUrl } = router.query;

  const handleSignIn = async (provider) => {
    setLoading(true);
    await signIn(provider, { 
      callbackUrl: callbackUrl || '/' 
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <Head>
        <title>로그인 - 닌텐도 게임 가격 모니터</title>
        <meta name="description" content="닌텐도 게임 가격 모니터 로그인 페이지" />
      </Head>
      <Container maxWidth="xs" sx={{ 
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
          <Typography variant="h5" component="h1" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
            닌텐도 게임 가격 모니터
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, textAlign: 'center' }}>
            게임 가격 추적을 위해 로그인해주세요
          </Typography>
          
          <Button
            variant="contained"
            color="error"
            startIcon={<GoogleIcon />}
            onClick={() => handleSignIn('google')}
            disabled={loading}
            fullWidth
            sx={{ 
              py: 1.2,
              mb: 2,
              fontWeight: 'bold',
              borderRadius: 1.5
            }}
          >
            Google로 로그인
          </Button>
          
          <Button
            variant="outlined"
            onClick={() => router.push('/')}
            sx={{ mt: 2 }}
          >
            돌아가기
          </Button>
        </Paper>
      </Container>
    </ThemeProvider>
  );
} 