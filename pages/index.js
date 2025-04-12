import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend as RechartsLegend, 
  ResponsiveContainer 
} from 'recharts';
import { useSession, signIn, signOut } from "next-auth/react";

// Material-UI 컴포넌트 import
import { 
  Button, 
  TextField, 
  Card, 
  CardContent, 
  Typography, 
  Container,
  AppBar,
  Toolbar,
  IconButton,
  Box,
  Grid,
  Chip,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Switch,
  Snackbar,
  FormControlLabel
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

// Material 아이콘 import
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import LaunchIcon from '@mui/icons-material/Launch';
import TimelineIcon from '@mui/icons-material/Timeline';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudIcon from '@mui/icons-material/Cloud';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';

// 테마 설정
const theme = createTheme({
  palette: {
    primary: {
      main: '#E60012', // 닌텐도 레드
    },
    secondary: {
      main: '#1F1F1F', // 닌텐도 블랙
    },
    success: {
      main: '#38a169',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff', // 명시적으로 하얀색 배경 설정
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
        },
        elevation2: {
          boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1), 0px 1px 2px 0px rgba(0,0,0,0.05)'
        },
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
        }
      }
    }
  }
});

export default function Home() {
  const { data: session, status } = useSession();
  const isAuthLoading = status === "loading";
  const [url, setUrl] = useState('');
  const [games, setGames] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [addGameLoading, setAddGameLoading] = useState(false);
  const [error, setError] = useState('');
  const [debug, setDebug] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);

  // 서버에서 사용자의 게임 목록 가져오기
  const fetchUserGames = async () => {
    if (!session) {
      console.log('로그인되지 않은 상태:', session);
      return;
    }
    
    if (!session.user) {
      console.log('세션에 사용자 정보 없음:', session);
      return;
    }
    
    // userId가 어느 필드에 있는지 확인
    const userId = session.user.id || session.user.sub;
    
    if (!userId) {
      console.error('세션에 사용자 ID가 없습니다:', session.user);
      setSnackbarMessage('로그인 정보가 올바르지 않습니다. 다시 로그인해주세요.');
      setSnackbarOpen(true);
      signOut({ redirect: false }); // 세션이 불완전한 경우 로그아웃 처리
      return;
    }
    
    console.log('사용자 게임 목록 요청 시작. 사용자 ID:', userId);
    console.log('세션 정보:', JSON.stringify(session, null, 2));
    
    try {
      setFetchLoading(true);
      
      const response = await fetch('/api/user-games', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 쿠키 포함하여 요청
      });
      
      console.log('API 응답 상태코드:', response.status);
      
      if (response.status === 401) {
        console.log('사용자 인증 실패 (401)');
        
        // 세션 정보와 응답 헤더 로깅
        console.log('현재 세션:', JSON.stringify(session, null, 2));
        
        const responseClone = response.clone();
        const errorText = await responseClone.text();
        console.log('401 응답 내용:', errorText);
        
        // 인증 오류는 조용히 처리 (사용자가 새로 로그인한 경우 정상적인 상황)
        setSnackbarMessage('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
        setSnackbarOpen(true);
        signOut({ redirect: false }); // 세션이 만료된 경우 로그아웃 처리
        return;
      }
      
      if (!response.ok) {
        console.log('API 오류 응답:', response.status);
        
        const responseClone = response.clone();
        const errorText = await responseClone.text();
        console.log('오류 응답 내용:', errorText);
        
        // 401 이외의 오류는 스낵바로 표시 (입력 폼 에러 대신)
        const errorData = await response.json();
        throw new Error(errorData.message || '서버에서 게임 목록을 가져오는데 실패했습니다.');
      }
      
      const data = await response.json();
      console.log('API 응답 데이터:', JSON.stringify(data, null, 2));
      
      if (data.success && data.data) {
        setGames(data.data);
        console.log('게임 목록 설정 완료:', data.data.length);
        
        // 서버에서 가져온 데이터의 마지막 업데이트 시간 설정
        if (data.data.length > 0) {
          const latestUpdate = Math.max(...data.data.map(game => 
            game.lastUpdated ? new Date(game.lastUpdated).getTime() : 0
          ));
          
          if (latestUpdate > 0) {
            setLastRefreshed(new Date(latestUpdate));
            console.log('마지막 업데이트 시간 설정:', new Date(latestUpdate));
          }
        }
      } else {
        console.log('서버에서 받은 데이터가 유효하지 않습니다:', data);
      }
    } catch (error) {
      console.error('게임 목록 불러오기 오류:', error);
      // 에러 상태를 TextField가 아닌 스낵바에 표시
      setSnackbarMessage(error.message || '게임 목록을 불러오는데 문제가 발생했습니다.');
      setSnackbarOpen(true);
    } finally {
      setFetchLoading(false);
    }
  };

  // 로그인 상태에 따라 게임 목록 로드 방식을 달리함
  useEffect(() => {
    if (session && session.user) {
      // 로그인된 경우: 서버에서 게임 목록 로드
      fetchUserGames();
    } else if (status !== "loading") {
      // 로그인되지 않은 경우: 로컬 스토리지에서 게임 목록 로드
      const savedGames = localStorage.getItem('monitoredGames');
      if (savedGames) {
        try {
          const parsedGames = JSON.parse(savedGames);
          setGames(parsedGames);
          
          // 마지막 새로고침 시간 가져오기
          const lastRefreshTime = localStorage.getItem('lastRefreshed');
          if (lastRefreshTime) {
            setLastRefreshed(new Date(lastRefreshTime));
          }
        } catch (error) {
          console.error('저장된 게임 목록을 불러오는 중 오류 발생:', error);
        }
      }
    }
  }, [session, status]);

  // 게임 목록 저장 방식 변경
  useEffect(() => {
    if (!games.length) return;
    
    if (session && session.user) {
      // 로그인된 경우: 아무 작업도 하지 않음 (서버에 저장은 게임 추가/삭제 시 개별적으로 처리)
      return;
    } else {
      // 로그인되지 않은 경우: 로컬 스토리지에 저장
      localStorage.setItem('monitoredGames', JSON.stringify(games));
    }
  }, [games, session]);

  // MongoDB로 데이터 마이그레이션 및 자동 업데이트 활성화 (이제 필요 없음)
  // 이 기능은 로그인 사용자의 경우 자동으로 처리됨
  const handleMigrateData = async () => {
    if (session && session.user) {
      setSnackbarMessage('이미 로그인되어 있습니다. 게임 목록이 자동으로 동기화됩니다.');
      setSnackbarOpen(true);
      return;
    }

    if (games.length === 0) {
      setSnackbarMessage('마이그레이션할 게임이 없습니다.');
      setSnackbarOpen(true);
      return;
    }
    
    setSnackbarMessage('로그인하면 게임 목록이 자동으로 동기화됩니다.');
    setSnackbarOpen(true);
  };

  // 모든 게임의 최신 가격 정보 가져오기
  const refreshAllGames = async () => {
    if (games.length === 0 || refreshing) return;
    
    setRefreshing(true);
    setError('');
    
    const updatedGames = [...games];
    let hasErrors = false;
    
    // 현재 날짜를 한국 시간(KST)으로 계산 (YYYY-MM-DD 형식)
    const currentDate = new Date();
    const koreaTime = new Date(currentDate.getTime() + (9 * 60 * 60 * 1000));
    const today = koreaTime.toISOString().split('T')[0];
    
    for (let i = 0; i < updatedGames.length; i++) {
      const game = updatedGames[i];
      try {
        const response = await fetch('/api/game-info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: game.url }),
        });

        const data = await response.json();

        if (response.ok) {
          const newPrice = data.price || game.price;
          const priceNumber = parseInt(newPrice.replace(/[^\d]/g, ''));
          
          const priceHistory = game.priceHistory || [];
          
          // 할인 정보 계산
          let discountInfo = null;
          
          // 가격 기록이 있으면 이전 가격과 비교
          if (priceHistory.length > 0) {
            const lastRecord = [...priceHistory].sort((a, b) => 
              new Date(b.date) - new Date(a.date)
            )[0];
            
            const lastPrice = lastRecord.price;
            
            // 현재 가격이 이전 가격보다 낮을 경우 할인 정보 계산
            if (priceNumber < lastPrice) {
              const discountAmount = lastPrice - priceNumber;
              const discountRate = Math.round((discountAmount / lastPrice) * 100);
              
              discountInfo = {
                originalPrice: lastPrice,
                discountAmount: discountAmount,
                discountRate: discountRate,
                formattedDiscount: `-₩${discountAmount.toLocaleString()}`
              };
            }
          }
          
          const todayRecordIndex = priceHistory.findIndex(record => record.date === today);
          
          if (todayRecordIndex >= 0) {
            priceHistory[todayRecordIndex] = { 
              date: today, 
              price: priceNumber, 
              priceFormatted: newPrice,
              discountInfo: discountInfo
            };
          } else {
            priceHistory.push({ 
              date: today, 
              price: priceNumber, 
              priceFormatted: newPrice,
              discountInfo: discountInfo
            });
          }
          
          priceHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
          
          updatedGames[i] = {
            ...game,
            title: data.title || game.title,
            price: newPrice,
            priceHistory: priceHistory,
            discountInfo: discountInfo,
            lastUpdated: new Date().toISOString()
          };
        } else {
          hasErrors = true;
        }
      } catch (error) {
        hasErrors = true;
      }
      
      // 각 요청 사이에 잠시 지연 (서버 부하 방지)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setGames(updatedGames);
    setRefreshing(false);
    
    const updateTime = new Date();
    setLastRefreshed(updateTime);
    localStorage.setItem('lastRefreshed', updateTime.toISOString());
    
    if (hasErrors) {
      setError('일부 게임의 가격 정보를 업데이트하는 데 실패했습니다');
    }
  };

  // 특정 게임만 업데이트
  const refreshGame = async (gameId) => {
    if (refreshing) return;
    
    setRefreshing(true);
    setError('');
    
    const gameIndex = games.findIndex(g => g.id === gameId);
    if (gameIndex === -1) {
      setRefreshing(false);
      return;
    }
    
    const game = games[gameIndex];
    const updatedGames = [...games];
    let hasError = false;
    
    // 현재 날짜를 한국 시간(KST)으로 계산 (YYYY-MM-DD 형식)
    const currentDateTime = new Date();
    const koreaDateTime = new Date(currentDateTime.getTime() + (9 * 60 * 60 * 1000));
    const today = koreaDateTime.toISOString().split('T')[0];
    
    try {
      const response = await fetch('/api/game-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: game.url }),
      });

      const data = await response.json();

      if (response.ok) {
        const newPrice = data.price || game.price;
        const priceNumber = parseInt(newPrice.replace(/[^\d]/g, ''));
        
        const priceHistory = game.priceHistory || [];
        
        // 할인 정보 계산
        let discountInfo = null;
        
        // 가격 기록이 있으면 이전 가격과 비교
        if (priceHistory.length > 0) {
          const lastRecord = [...priceHistory].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
          )[0];
          
          const lastPrice = lastRecord.price;
          
          // 현재 가격이 이전 가격보다 낮을 경우 할인 정보 계산
          if (priceNumber < lastPrice) {
            const discountAmount = lastPrice - priceNumber;
            const discountRate = Math.round((discountAmount / lastPrice) * 100);
            
            discountInfo = {
              originalPrice: lastPrice,
              discountAmount: discountAmount,
              discountRate: discountRate,
              formattedDiscount: `-₩${discountAmount.toLocaleString()}`
            };
          }
        }
        
        const todayRecordIndex = priceHistory.findIndex(record => record.date === today);
        
        if (todayRecordIndex >= 0) {
          priceHistory[todayRecordIndex] = { 
            date: today, 
            price: priceNumber, 
            priceFormatted: newPrice,
            discountInfo: discountInfo
          };
        } else {
          priceHistory.push({ 
            date: today, 
            price: priceNumber, 
            priceFormatted: newPrice,
            discountInfo: discountInfo
          });
        }
        
        priceHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        updatedGames[gameIndex] = {
          ...game,
          title: data.title || game.title,
          price: newPrice,
          priceHistory: priceHistory,
          discountInfo: discountInfo,
          lastUpdated: new Date().toISOString()
        };
      } else {
        hasError = true;
      }
    } catch (error) {
      hasError = true;
    }
    
    setGames(updatedGames);
    setRefreshing(false);
    
    const updateTime = new Date();
    setLastRefreshed(updateTime);
    localStorage.setItem('lastRefreshed', updateTime.toISOString());
    
    if (hasError) {
      setError('게임 가격 정보를 업데이트하는 데 실패했습니다');
    }
  };

  // 페이지 로드 시 자동으로 가격 정보 새로고침 (마지막 새로고침 후 1시간 지난 경우)
  useEffect(() => {
    if (games.length > 0 && !refreshing) {
      const shouldRefresh = !lastRefreshed || 
        (new Date() - new Date(lastRefreshed) > 60 * 60 * 1000); // 1시간
      
      if (shouldRefresh) {
        refreshAllGames();
      }
    }
  }, [games.length]);

  const handleAddGame = async () => {
    if (!url) {
      // 에러 상태를 TextField에 표시하는 대신 스낵바로 표시
      setSnackbarMessage('닌텐도 스토어 URL을 입력해주세요.');
      setSnackbarOpen(true);
      return;
    }
    
    if (!url.includes('nintendo.co.kr') && !url.includes('nintendo.com')) {
      // 에러 상태를 TextField에 표시하는 대신 스낵바로 표시
      setSnackbarMessage('유효한 닌텐도 스토어 URL이 아닙니다. 닌텐도 스토어의 디지털 상품 URL만 입력 가능합니다.');
      setSnackbarOpen(true);
      return;
    }
    
    setAddGameLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/game-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // 게임을 찾을 수 없는 경우 특별 메시지 추가
        if (data.message && data.message.includes('찾을 수 없습니다')) {
          throw new Error('닌텐도 스토어의 디지털 상품 URL만 입력 가능합니다. 물리적 상품이나 존재하지 않는 게임은 추적할 수 없습니다.');
        }
        throw new Error(data.message || '게임 정보를 가져오는데 실패했습니다.');
      }
      
      // 현재 날짜를 한국 시간(KST)으로 계산 (YYYY-MM-DD 형식)
      const currentDate = new Date();
      const koreaTime = new Date(currentDate.getTime() + (9 * 60 * 60 * 1000));
      const today = koreaTime.toISOString().split('T')[0];
      
      const priceNumber = parseInt(data.price.replace(/[^\d]/g, ''));
      
      const newGame = {
        id: Date.now().toString(),
        url,
        title: data.title,
        price: data.price,
        priceHistory: [
          { 
            date: today, 
            price: priceNumber, 
            priceFormatted: data.price 
          }
        ],
        lastUpdated: new Date().toISOString()
      };
      
      if (session && session.user) {
        // 로그인된 경우: 서버에 게임 추가
        await addGameToServer(newGame);
      } else {
        // 로그인되지 않은 경우: 로컬 상태에만 추가
        setGames(prevGames => [newGame, ...prevGames]);
      }
      
      setUrl('');
      setLastRefreshed(new Date());
      
    } catch (error) {
      console.error('게임 추가 오류:', error);
      // 에러 상태를 TextField가 아닌 스낵바에 표시
      setSnackbarMessage(error.message);
      setSnackbarOpen(true);
    } finally {
      setAddGameLoading(false);
    }
  };

  // 서버에 게임 추가
  const addGameToServer = async (gameData) => {
    try {
      const response = await fetch('/api/user-games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gameData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '서버에 게임을 추가하는데 실패했습니다.');
      }
      
      // 서버에서 최신 게임 목록 다시 가져오기
      fetchUserGames();
      
      setSnackbarMessage('게임이 성공적으로 추가되었습니다.');
      setSnackbarOpen(true);
      
    } catch (error) {
      console.error('서버 게임 추가 오류:', error);
      setError(error.message);
    }
  };

  // 게임 삭제 다이얼로그 열기
  const openDeleteDialog = (id) => {
    const gameToDelete = games.find(game => game.id === id);
    if (gameToDelete) {
      setGameToDelete(gameToDelete);
      setDeleteDialogOpen(true);
    }
  };

  // 게임 삭제 다이얼로그 닫기
  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setGameToDelete(null);
  };

  const removeGame = async (id) => {
    if (session && session.user) {
      // 로그인된 경우: 서버에서 게임 삭제
      try {
        const response = await fetch('/api/user-games', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ gameId: id }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || '서버에서 게임을 삭제하는데 실패했습니다.');
        }
        
        // 삭제 성공 후 로컬 상태 업데이트
        const deletedGame = games.find(game => game._id === id || game.id === id);
        const updatedGames = games.filter(game => (game._id !== id && game.id !== id));
        setGames(updatedGames);
        
        // 선택된 게임이 삭제되면 선택 해제
        if (selectedGame && (selectedGame._id === id || selectedGame.id === id)) {
          setSelectedGame(null);
          setChartDialogOpen(false);
        }
        
        // 게임 삭제 완료 메시지
        if (deletedGame) {
          setSnackbarMessage(`"${deletedGame.title}" 게임이 삭제되었습니다.`);
          setSnackbarOpen(true);
        }
        
      } catch (error) {
        console.error('게임 삭제 오류:', error);
        setError(error.message);
      }
    } else {
      // 로그인되지 않은 경우: 로컬 상태에서만 삭제
      const gameToRemove = games.find(game => game.id === id);
      const updatedGames = games.filter(game => game.id !== id);
      setGames(updatedGames);
      
      // 선택된 게임이 삭제되면 선택 해제
      if (selectedGame && selectedGame.id === id) {
        setSelectedGame(null);
        setChartDialogOpen(false);
      }
      
      // 모든 게임이 삭제되었다면 로컬 스토리지에서도 삭제
      if (updatedGames.length === 0) {
        localStorage.removeItem('monitoredGames');
      }
      
      // 게임 삭제 완료 메시지
      if (gameToRemove) {
        setSnackbarMessage(`"${gameToRemove.title}" 게임이 삭제되었습니다.`);
        setSnackbarOpen(true);
      }
    }
    
    closeDeleteDialog();
  };
  
  const clearAllGames = () => {
    setGames([]);
    setSelectedGame(null);
    setChartDialogOpen(false);
    localStorage.removeItem('monitoredGames');
  };
  
  const handleGameSelect = (game) => {
    setSelectedGame(game);
    setChartDialogOpen(true);
  };
  
  const handleCloseChart = () => {
    setChartDialogOpen(false);
  };
  
  // 포맷된 마지막 업데이트 시간
  const formattedLastRefreshed = lastRefreshed 
    ? new Date(lastRefreshed).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '없음';

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md" sx={{ 
        py: { xs: 2, sm: 4 }, 
        px: { xs: 2, sm: 3 },
        overflow: 'hidden'  // 컨테이너 넘치는 요소 방지
      }}>
        <Head>
          <title>닌텐도 게임 가격 모니터</title>
          <meta name="description" content="닌텐도 온라인 스토어 게임 가격을 모니터링하는 앱입니다." />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="icon" href="data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwXsAAMF7AArBewBIwXsAecF7AIvBewCLwXsAecF7AEjBewAKwXsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMF7AADBewAVwXsAmcF7AP/BewD/wXsA/8F7AP/BewCZwXsAFcF7AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwXsAAMF7AGLBewD/wXsA/8F7AP/BewD/wXsAYsF7AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACzbQAAwXsA1MF7AP/BewD/wXsA1LNtAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMF7AJnBewD/wXsA/8F7AJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADBewBVwXsA/8F7AP/BewBVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwXsAMMF7AP/BewD/wXsAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyYMAeMyFAHgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALl0AAC5dAAMuXQAZ7l0AMe5dADxuXQA8bl0AMi5dABpuXQADbl0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACxbQAAuXQAJ7l0ALm5dAD/uXQA/7l0AP+5dAD/uXQAubl0ACexbQAAAAAAAAAAAAAAAAAAAAAAAAAAALZ4AAC2eAALuXQAdb10AP+5dAD/uXQA/7l0AP+5dAD/uXQA/7l0AHW2eAALtngAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtngAFbh6AMa5dAD/uXQA/7l0AP+5dAD/uXQAxrZ4ABUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//wAA/D8AAPgfAADwDwAA4AcAAMADAACAAwAAgAMAAIADAACAAwAAgAEAAMABAADgAwAA8A8AAPw/AAD//wAA" />
          <link rel="apple-touch-icon" href="/favicon.svg" />
        </Head>

        <AppBar 
          position="static" 
          sx={{ 
            backgroundColor: '#E60012', 
            mb: 3,
            borderRadius: 1,
            boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1), 0px 1px 2px 0px rgba(0,0,0,0.05)'
          }}
        >
          <Toolbar sx={{ 
            justifyContent: 'space-between', 
            px: { xs: 1, sm: 2 },
            py: { xs: 0.5, sm: 0 },
            minHeight: { xs: '56px', sm: '64px' }
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <StorefrontIcon sx={{ mr: 1 }} />
              <Typography variant="h6" component="div" sx={{ fontSize: { xs: '0.9rem', sm: '1.25rem' } }}>
                닌텐도 게임 가격 모니터
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
              {/* 로그인 상태에 따라 버튼 표시 */}
              {!isAuthLoading && (
                <>
                  {session ? (
                    <>
                      {/* 로그인한 경우: 사용자 정보 표시 */}
                      <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', mr: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', mr: 1, fontSize: '0.85rem' }}>
                          {session.user.name}
                        </Typography>
                        {session.user.image && (
                          <Box 
                            component="img"
                            src={session.user.image}
                            alt={session.user.name}
                            sx={{ 
                              width: 28, 
                              height: 28, 
                              borderRadius: '50%',
                              border: '1px solid white'
                            }}
                          />
                        )}
                      </Box>
                      <IconButton 
                        color="inherit" 
                        onClick={() => signOut({ callbackUrl: '/' })}
                        title="로그아웃"
                        size="small"
                        sx={{ display: { xs: 'flex', sm: 'none' } }}
                      >
                        <LogoutIcon />
                      </IconButton>
                      <Button 
                        variant="outlined" 
                        color="inherit" 
                        startIcon={<LogoutIcon />}
                        onClick={() => signOut({ callbackUrl: '/' })}
                        size="small"
                        sx={{ 
                          display: { xs: 'none', sm: 'flex' },
                          borderColor: 'rgba(255,255,255,0.5)',
                          '&:hover': { borderColor: 'white' }
                        }}
                      >
                        로그아웃
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* 로그인하지 않은 경우: 로그인 버튼은 제거 (로그인하여 동기화 버튼만 사용) */}
                    </>
                  )}
                </>
              )}
                
              {/* 앱바 내부에서 표시되는 클라우드 버튼 : 로그인하지 않은 경우에만 표시 */}
              {!session && !isAuthLoading && (
                <>
                  {/* 데스크톱에서는 텍스트 버튼, 모바일에서는 아이콘 버튼으로 표시 */}
                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                    <Button 
                      variant="contained" 
                      color="secondary" 
                      startIcon={<CloudUploadIcon />}
                      onClick={signIn}
                      size="small"
                      sx={{ 
                        color: 'white',
                        bgcolor: '#222',
                        '&:hover': { bgcolor: '#444' },
                        '&.Mui-disabled': {
                          color: 'rgba(255, 255, 255, 0.7)',
                        },
                        fontWeight: 'bold',
                        px: 2
                      }}
                    >
                      로그인하여 동기화
                    </Button>
                  </Box>
                  
                  {/* 모바일에서는 아이콘 버튼만 표시 */}
                  <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                    <IconButton 
                      onClick={signIn} 
                      color="inherit"
                      size="small"
                      disabled={migrateLoading}
                      title="로그인하여 동기화"
                      sx={{ ml: 1 }}
                    >
                      {migrateLoading ? (
                        <CircularProgress color="inherit" size={20} />
                      ) : (
                        <CloudUploadIcon />
                      )}
                    </IconButton>
                  </Box>
                </>
              )}
              
              <IconButton 
                color="inherit" 
                onClick={refreshAllGames} 
                disabled={refreshing || games.length === 0}
                title="가격 업데이트"
                size="medium"
              >
                {refreshing ? <CircularProgress size={24} color="inherit" /> : <RefreshIcon />}
              </IconButton>
              <IconButton 
                color="inherit" 
                onClick={() => {
                  if (window.confirm('모든 게임을 삭제하시겠습니까?')) {
                    setGames([]);
                    localStorage.removeItem('monitoredGames');
                  }
                }}
                disabled={games.length === 0}
                title="모두 삭제"
                size="medium"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 4, position: 'relative' }}>
          <form onSubmit={e => { e.preventDefault(); handleAddGame(); }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'flex-start', 
              gap: { xs: 1.5, sm: 2 },
              width: '100%'
            }}>
              <TextField
                label="닌텐도 스토어 게임 URL"
                name="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                error={!!error}
                helperText={error}
                fullWidth
                placeholder="https://store.nintendo.co.kr/games/..."
                sx={{
                  flex: 1,
                  width: '100%',
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                  },
                  // 에러 메시지가 표시될 공간 확보
                  '& .MuiFormHelperText-root': {
                    position: 'absolute',
                    bottom: '-20px'
                  }
                }}
              />
              <Button 
                type="submit" 
                variant="contained" 
                color="primary" 
                disabled={addGameLoading}
                startIcon={addGameLoading ? <CircularProgress size={20} /> : <AddIcon />}
                sx={{ 
                  mt: { xs: 1, sm: 0 },
                  height: { xs: '40px', sm: '56px' },
                  alignSelf: { xs: 'flex-start', sm: 'flex-start' }, // 상단 정렬로 변경
                  width: { xs: '100%', sm: '120px' },
                  boxSizing: 'border-box'
                }}
              >
                게임 추가
              </Button>
            </Box>
          </form>
        </Paper>

        <Box sx={{ width: '100%' }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 2,
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1, sm: 0 },
            width: '100%'
          }}>
            <Typography variant="h5" component="h2" sx={{ 
              fontSize: '1.3rem',
              alignSelf: { xs: 'flex-start', sm: 'center' }
            }}>
              모니터링 중인 게임
            </Typography>
            {lastRefreshed && (
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ 
                  fontSize: '0.75rem',
                  alignSelf: { xs: 'flex-start', sm: 'center' }
                }}
              >
                마지막 업데이트: {formattedLastRefreshed}
              </Typography>
            )}
          </Box>
          
          {games.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="body1" color="text.secondary">
                {session 
                  ? '모니터링 중인 게임이 없습니다. 닌텐도 스토어 URL을 입력하여 게임을 추가해보세요.' 
                  : '모니터링 중인 게임이 없습니다. 로그인하면 어느 기기에서든 게임 목록을 동기화할 수 있습니다.'}
              </Typography>
              {!session ? (
                <Button 
                  variant="contained" 
                  color="primary"
                  startIcon={<LoginIcon />}
                  onClick={() => signIn()}
                  sx={{ mt: 2 }}
                >
                  구글 계정으로 로그인
                </Button>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 3 }}>
                  <Button 
                    variant="contained" 
                    color="primary"
                    startIcon={<LaunchIcon />}
                    onClick={() => window.open('https://store.nintendo.co.kr/', '_blank', 'noopener,noreferrer')}
                    sx={{ 
                      fontWeight: 'bold',
                      px: 3,
                      py: 1
                    }}
                  >
                    닌텐도 스토어 방문하기
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    닌텐도 스토어에서 게임을 찾아 URL을 복사한 후 위에 붙여넣으세요.
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            <Grid 
              container 
              spacing={2} 
              columns={12} 
              direction="column"
              sx={{ width: '100%' }}
            >
              {games.map((game) => (
                <Grid 
                  item 
                  xs={12} 
                  key={game.id}
                >
                  <Paper 
                    elevation={1} 
                    sx={{ 
                      width: '100%',
                      '&:hover': { boxShadow: 3, cursor: 'pointer' },
                      transition: 'box-shadow 0.3s',
                      borderRadius: 1,
                      boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1), 0px 1px 2px 0px rgba(0,0,0,0.05)'
                    }}
                    onClick={() => window.open(game.url, '_blank', 'noopener,noreferrer')}
                  >
                    <Box sx={{ p: { xs: 2, sm: 3 } }}>
                      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, width: '100%' }}>
                        <Box sx={{ flexGrow: 1, width: { xs: '100%', sm: 'calc(100% - 60px)' }, mb: { xs: 2, sm: 0 } }}>
                          <Typography 
                            variant="h6" 
                            component="h3" 
                            sx={{ 
                              fontSize: { xs: '1rem', sm: '1.1rem' }, 
                              fontWeight: 'bold',
                              mb: 1 
                            }}
                          >
                            {game.title}
                          </Typography>
                          <Typography 
                            variant="h5" 
                            color="success.main" 
                            sx={{ 
                              fontWeight: 'bold', 
                              mb: 1,
                              fontSize: { xs: '1.25rem', sm: '1.5rem' }
                            }}
                          >
                            {game.price || '가격 정보 없음'}
                          </Typography>
                          
                          {/* 할인 정보 표시 */}
                          {game.discountInfo && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Chip 
                                size="small" 
                                color="error"
                                label={`${game.discountInfo.discountRate}% 할인`}
                                sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                              />
                              <Typography 
                                variant="body2" 
                                color="error.main"
                                fontWeight="500"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                {game.discountInfo.formattedDiscount}
                              </Typography>
                            </Box>
                          )}
                          
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                            <Chip 
                              size="small" 
                              label={`추가일: ${new Date(game.addedAt).toLocaleDateString()}`}
                              color="default"
                              variant="outlined"
                              sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                            />
                            {game.priceHistory && game.priceHistory.length > 0 && (
                              <Chip 
                                size="small"
                                icon={<TimelineIcon />} 
                                label={`${game.priceHistory.length}개의 가격 기록`}
                                color="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGameSelect(game);
                                }}
                                clickable
                                sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                              />
                            )}
                          </Box>
                        </Box>
                        
                        <Box sx={{ 
                          display: 'flex',
                          flexDirection: 'row',
                          justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                          alignItems: 'center',
                          width: { xs: '100%', sm: '60px' },
                          minWidth: { sm: '60px' },
                          flexShrink: 0,
                          mt: { xs: 1, sm: 0 }
                        }}>
                          <Box sx={{ 
                            display: 'flex', 
                            gap: 1,
                            justifyContent: { xs: 'flex-start', sm: 'flex-end' }
                          }}>
                            <IconButton 
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(game.id);
                              }}
                              size="small"
                              title="삭제"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {/* 닌텐도 스토어 바로가기 버튼 - 게임 목록이 있을 때 */}
        {games.length > 0 && (
          <Box sx={{ 
            width: '100%',
            display: 'flex', 
            justifyContent: 'center',
            mt: 4, 
            mb: 2
          }}>
            <Button 
              variant="outlined" 
              color="primary"
              startIcon={<LaunchIcon />}
              onClick={() => window.open('https://store.nintendo.co.kr/', '_blank', 'noopener,noreferrer')}
              sx={{ 
                borderWidth: 2,
                '&:hover': { borderWidth: 2 }
              }}
            >
              닌텐도 스토어 방문하기
            </Button>
          </Box>
        )}

        {/* 차트 다이얼로그 */}
        <Dialog 
          open={chartDialogOpen} 
          onClose={handleCloseChart}
          maxWidth="lg"
          fullWidth
          sx={{
            '& .MuiDialog-paper': {
              mx: { xs: 1, sm: 2 },
              width: { xs: 'calc(100% - 16px)', sm: '90%', md: '80%', lg: '70%' },
              borderRadius: { xs: 1, sm: 1 },
              maxHeight: { xs: 'calc(100% - 32px)', sm: 'auto' },
              overflow: 'hidden'
            }
          }}
        >
          {selectedGame && (
            <>
              <DialogTitle sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                p: { xs: 1.5, sm: 2 },
                borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
              }}>
                <Typography 
                  variant="h6"
                  sx={{ 
                    fontSize: { xs: '1rem', sm: '1.25rem' },
                    mr: 2
                  }}
                >
                  {selectedGame.title} 가격 추이
                </Typography>
                <IconButton onClick={handleCloseChart} size="small">
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent 
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  overflowX: 'hidden'
                }}
              >
                <Box sx={{ 
                  height: { xs: 200, sm: 300 }, 
                  mb: { xs: 2, sm: 3 }, 
                  width: '100%',
                  maxWidth: '100%'
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={selectedGame.priceHistory.map(record => ({
                        date: record.date,
                        price: record.price,
                        isVirtual: record.isVirtual || false,
                        priceFormatted: record.priceFormatted
                      }))} 
                      margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                        stroke="#666"
                      />
                      <YAxis 
                        tickFormatter={(value) => `₩${value.toLocaleString()}`}
                        stroke="#666"
                        domain={['dataMin - 5000', 'dataMax + 5000']}
                        width={60}
                      />
                      <RechartsTooltip 
                        formatter={(value, name) => [`₩${value.toLocaleString()}`, '가격']}
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        }}
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          padding: '8px'
                        }}
                      />
                      <RechartsLegend />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        name="가격"
                        stroke="#E60012" 
                        strokeWidth={2} 
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          const isVirtual = payload.isVirtual;
                          return (
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={isVirtual ? 3 : 5} 
                              fill={isVirtual ? 'rgba(200, 200, 200, 0.5)' : 'rgba(230, 0, 18, 0.5)'} 
                              stroke={isVirtual ? 'rgba(200, 200, 200, 0.8)' : '#E60012'} 
                              strokeWidth={2}
                            />
                          );
                        }}
                        activeDot={{ r: 8, fill: '#E60012', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography 
                  variant="h6" 
                  gutterBottom
                  sx={{
                    fontSize: { xs: '0.95rem', sm: '1.2rem' }
                  }}
                >
                  가격 기록
                </Typography>
                <Box sx={{ width: '100%', overflow: 'hidden' }}>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      overflow: 'auto',
                      maxHeight: { xs: 200, sm: 300 },
                      width: '100%'
                    }}
                  >
                    <Table size="small" sx={{ tableLayout: 'fixed' }}>
                      <TableHead>
                        <TableRow>
                          <TableCell width="50%" sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>날짜</TableCell>
                          <TableCell width="50%" sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>가격</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedGame.priceHistory
                          .filter(record => !record.isVirtual)
                          .sort((a, b) => new Date(b.date) - new Date(a.date))
                          .map((record, index) => (
                            <TableRow key={index}>
                              <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{record.date}</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', color: 'success.main', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                {record.priceFormatted}
                              </TableCell>
                            </TableRow>
                          ))
                        }
                      </TableBody>
                    </Table>
                  </Paper>
                </Box>
              </DialogContent>
              <DialogActions sx={{ p: { xs: 1, sm: 1.5 } }}>
                <Button 
                  onClick={handleCloseChart} 
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={{ 
                    mx: 'auto',
                    px: { xs: 2, sm: 3 }
                  }}
                >
                  닫기
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* 알림 스낵바 */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={() => setSnackbarOpen(false)}
          message={snackbarMessage}
          action={
            <IconButton
              size="small"
              color="inherit"
              onClick={() => setSnackbarOpen(false)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        />
        
        {/* 게임 삭제 확인 다이얼로그 */}
        <Dialog 
          open={deleteDialogOpen} 
          onClose={closeDeleteDialog}
          sx={{
            '& .MuiDialog-paper': {
              width: { xs: '90%', sm: 'auto' },
              minWidth: { sm: '380px' },
              p: 1
            }
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>게임 삭제 확인</DialogTitle>
          <DialogContent sx={{ pt: 0 }}>
            <Typography>
              {gameToDelete ? `"${gameToDelete.title}" 게임을 모니터링 목록에서 삭제하시겠습니까?` : '이 게임을 모니터링 목록에서 삭제하시겠습니까?'}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2 }}>
            <Button 
              onClick={closeDeleteDialog} 
              color="primary" 
              variant="outlined"
              size="small"
            >
              취소
            </Button>
            <Button 
              onClick={() => gameToDelete && removeGame(gameToDelete.id)} 
              color="error" 
              variant="contained"
              size="small"
              sx={{ ml: 1 }}
            >
              삭제
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
} 