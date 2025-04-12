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
  const [url, setUrl] = useState('');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debug, setDebug] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [migrateLoading, setMigrateLoading] = useState(false);

  // 페이지 로드 시 로컬 스토리지에서 저장된 게임 목록 불러오기
  useEffect(() => {
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
  }, []);

  // 게임 목록이 변경될 때마다 로컬 스토리지에 저장
  useEffect(() => {
    if (games.length > 0) {
      localStorage.setItem('monitoredGames', JSON.stringify(games));
    }
  }, [games]);

  // MongoDB로 데이터 마이그레이션 및 자동 업데이트 활성화
  const handleMigrateData = async () => {
    if (games.length === 0) {
      setSnackbarMessage('마이그레이션할 게임이 없습니다.');
      setSnackbarOpen(true);
      return;
    }
    
    setMigrateLoading(true);
    
    try {
      const response = await fetch('/api/migrate-to-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ games }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        const totalGames = result.totalGames || 0;
        const insertedGames = result.insertedGames || 0;
        const updatedGames = result.updatedGames || 0;
        
        setSnackbarMessage(`성공! ${totalGames}개의 게임이 매일 자정(00:00)에 자동으로 가격이 업데이트됩니다. (${insertedGames}개 추가, ${updatedGames}개 업데이트)`);
        setSnackbarOpen(true);
      } else {
        setSnackbarMessage(`마이그레이션 실패: ${result.message || '알 수 없는 오류'}`);
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('마이그레이션 오류:', error);
      setSnackbarMessage(`마이그레이션 오류: ${error.message}`);
      setSnackbarOpen(true);
    } finally {
      setMigrateLoading(false);
    }
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

  const fetchGameInfo = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDebug('');

    if (!url.includes('nintendo.co.kr') && !url.includes('nintendo.com')) {
      setError('유효한 닌텐도 스토어 URL을 입력해주세요');
      setLoading(false);
      return;
    }

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
        throw new Error(data.message || '게임 정보를 가져오는 중 오류가 발생했습니다');
      }

      // 중복 추가 방지 (같은 URL이 이미 존재하는지 확인)
      const isDuplicate = games.some(game => game.url === url);
      if (isDuplicate) {
        setError('이미 모니터링 중인 게임입니다');
        setLoading(false);
        return;
      }

      // 가격을 숫자로 변환 (₩64,800 -> 64800)
      const priceNumber = parseInt(data.price.replace(/[^\d]/g, ''));
      const today = new Date().toISOString().split('T')[0];
      
      const newGame = {
        id: Date.now(),
        url,
        title: data.title || '제목 없음',
        price: data.price || '가격 정보 없음',
        priceHistory: [
          { date: today, price: priceNumber, priceFormatted: data.price }
        ],
        addedAt: new Date().toISOString(),
      };

      setGames([...games, newGame]);
      setUrl('');
      setDebug(JSON.stringify(data, null, 2));
    } catch (error) {
      setError(error.message);
      console.error('오류 상세:', error.toString());
      setDebug('오류 상세: ' + error.toString());
    } finally {
      setLoading(false);
    }
  };

  const removeGame = (id) => {
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
          <meta name="description" content="닌텐도 게임 가격을 모니터링하고 가격 변동을 추적하는 도구입니다." />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
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
              {/* 데스크톱에서는 텍스트 버튼, 모바일에서는 아이콘 버튼으로 표시 */}
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Button 
                  variant="contained" 
                  color="secondary" 
                  startIcon={<CloudUploadIcon />}
                  onClick={handleMigrateData}
                  disabled={migrateLoading}
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
                  size="small"
                >
                  {migrateLoading ? '처리 중...' : '매일 가격 업데이트'}
                </Button>
              </Box>
              
              {/* 모바일에서는 아이콘만 표시 */}
              <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                <IconButton
                  color="inherit"
                  onClick={handleMigrateData}
                  disabled={migrateLoading}
                  title="매일 가격 업데이트"
                  sx={{ 
                    bgcolor: '#222',
                    color: 'white',
                    '&:hover': { bgcolor: '#444' },
                    '&.Mui-disabled': { bgcolor: 'rgba(31, 31, 31, 0.7)' },
                    p: 0.8,
                    borderRadius: '50%',
                    boxShadow: 1
                  }}
                  size="small"
                >
                  {migrateLoading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon fontSize="small" />}
                </IconButton>
              </Box>
              
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
          <Typography variant="h5" component="h1" gutterBottom sx={{ fontSize: { xs: '1.2rem', sm: '1.4rem' } }}>
            닌텐도 게임 가격 모니터
          </Typography>
          <form onSubmit={fetchGameInfo}>
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
                  }
                }}
              />
              <Button 
                type="submit" 
                variant="contained" 
                color="primary" 
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                sx={{ 
                  mt: { xs: 1, sm: 0 },
                  height: { xs: '40px', sm: '56px' },
                  alignSelf: { xs: 'flex-start', sm: 'center' },
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
            <Paper 
              elevation={1} 
              sx={{ 
                p: 3, 
                textAlign: 'center', 
                borderRadius: 1,
                boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1), 0px 1px 2px 0px rgba(0,0,0,0.05)'
              }}
            >
              <Typography color="text.secondary" sx={{ fontSize: '1rem' }}>
                아직 모니터링 중인 게임이 없습니다.
              </Typography>
            </Paper>
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
                      '&:hover': { boxShadow: 3 },
                      transition: 'box-shadow 0.3s',
                      borderRadius: 1,
                      boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1), 0px 1px 2px 0px rgba(0,0,0,0.05)'
                    }}
                  >
                    <Box sx={{ p: { xs: 2, sm: 3 } }}>
                      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, width: '100%' }}>
                        <Box sx={{ flexGrow: 1, width: { xs: '100%', sm: 'calc(100% - 140px)' }, mb: { xs: 2, sm: 0 } }}>
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
                          width: { xs: '100%', sm: '140px' },
                          minWidth: { sm: '140px' },
                          flexShrink: 0,
                          mt: { xs: 1, sm: 0 }
                        }}>
                          <Box sx={{ 
                            display: 'flex', 
                            gap: 1,
                            justifyContent: { xs: 'flex-start', sm: 'flex-end' }
                          }}>
                            <IconButton 
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGameSelect(game);
                              }}
                              size="small"
                              title="가격 추이 보기"
                            >
                              <TimelineIcon />
                            </IconButton>
                            <IconButton 
                              component="a"
                              href={game.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              color="primary"
                              size="small"
                              title="스토어에서 보기"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <LaunchIcon />
                            </IconButton>
                            <IconButton 
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                refreshGame(game.id);
                              }}
                              size="small"
                              disabled={refreshing}
                              title="가격 갱신"
                            >
                              <RefreshIcon />
                            </IconButton>
                            <IconButton 
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeGame(game.id);
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
          autoHideDuration={6000}
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
      </Container>
    </ThemeProvider>
  );
} 