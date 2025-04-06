import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

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
  TableRow
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

// Chart.js 컴포넌트 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

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

  // 모든 게임의 최신 가격 정보 가져오기
  const refreshAllGames = async () => {
    if (games.length === 0 || refreshing) return;
    
    setRefreshing(true);
    setError('');
    
    const updatedGames = [...games];
    let hasErrors = false;
    
    // 현재 날짜 (YYYY-MM-DD 형식)
    const today = new Date().toISOString().split('T')[0];
    
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
    
    const now = new Date();
    setLastRefreshed(now);
    localStorage.setItem('lastRefreshed', now.toISOString());
    
    if (hasErrors) {
      setError('일부 게임의 가격 정보를 업데이트하는 데 실패했습니다');
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
  
  // 가격 그래프 데이터 생성
  const getChartData = (game) => {
    if (!game || !game.priceHistory || game.priceHistory.length < 1) {
      return {
        labels: [],
        datasets: []
      };
    }
    
    // 정렬된 가격 히스토리를 사용
    const sortedHistory = [...game.priceHistory].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
    
    // 시각적 표현을 위해 필요한 경우 가상의 이전 데이터 포인트 추가
    let chartData = [...sortedHistory];
    
    // 데이터 포인트가 하나뿐이면, 가상의 이전 데이터 포인트 추가
    if (chartData.length === 1) {
      const currentPoint = chartData[0];
      const currentDate = new Date(currentPoint.date);
      
      // 3일 전 날짜 계산
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 3);
      
      // 같은 가격의 가상 데이터 포인트 추가
      const virtualPoint = {
        date: previousDate.toISOString().split('T')[0],
        price: currentPoint.price,
        priceFormatted: currentPoint.priceFormatted,
        isVirtual: true  // 가상 데이터 표시
      };
      
      chartData.unshift(virtualPoint);
    }
    
    return {
      labels: chartData.map(record => {
        // YYYY-MM-DD 형식을 MM-DD 형식으로 변환
        const date = new Date(record.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      datasets: [
        {
          label: '가격 (원)',
          data: chartData.map(record => record.price),
          borderColor: theme.palette.primary.main,
          backgroundColor: 'rgba(230, 0, 18, 0.1)',
          tension: 0.1,
          pointBackgroundColor: chartData.map(record => 
            record.isVirtual ? 'rgba(200, 200, 200, 0.5)' : 'rgba(230, 0, 18, 0.5)'
          ),
          pointBorderColor: chartData.map(record => 
            record.isVirtual ? 'rgba(200, 200, 200, 0.8)' : theme.palette.primary.main
          ),
          pointRadius: chartData.map(record => record.isVirtual ? 3 : 5),
        }
      ]
    };
  };
  
  // 차트 옵션
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '가격 변동 추이',
        color: theme.palette.text.primary,
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const price = context.raw;
            return `₩${price.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: function(value) {
            return `₩${value.toLocaleString()}`;
          }
        }
      }
    }
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
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Head>
          <title>닌텐도 게임 가격 모니터</title>
          <meta name="description" content="닌텐도 스토어 게임 가격 모니터링 도구" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="apple-touch-icon" href="/favicon.svg" />
        </Head>

        <AppBar position="static" color="primary" sx={{ mb: 4, borderRadius: 1 }}>
          <Toolbar>
            <StorefrontIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              닌텐도 게임 가격 모니터
            </Typography>
            {games.length > 0 && (
              <>
                <Button 
                  variant="contained" 
                  color="secondary"
                  onClick={refreshAllGames}
                  disabled={refreshing}
                  startIcon={<RefreshIcon />}
                  sx={{ mr: 1, fontWeight: 'bold' }}
                >
                  {refreshing ? '업데이트 중...' : '가격 업데이트'}
                </Button>
                <Button 
                  variant="outlined" 
                  color="inherit"
                  onClick={clearAllGames}
                  startIcon={<DeleteIcon />}
                  size="small"
                >
                  모두 삭제
                </Button>
              </>
            )}
          </Toolbar>
        </AppBar>

        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <form onSubmit={fetchGameInfo}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs>
                <TextField
                  fullWidth
                  variant="outlined"
                  label="닌텐도 스토어 게임 URL"
                  placeholder="https://store.nintendo.co.kr/70010000046397"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  size="medium"
                  sx={{ 
                    minWidth: '100%',
                    '& .MuiOutlinedInput-root': {
                      fontSize: '0.95rem'
                    },
                    '& .MuiInputBase-input': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }
                  }}
                  inputProps={{
                    style: { paddingRight: '14px' }
                  }}
                />
              </Grid>
              <Grid item>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                >
                  {loading ? '로딩 중' : '추가'}
                </Button>
              </Grid>
            </Grid>
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </form>
        </Paper>

        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" component="h2">
              모니터링 중인 게임
            </Typography>
            {lastRefreshed && (
              <Typography variant="caption" color="text.secondary">
                마지막 업데이트: {formattedLastRefreshed}
              </Typography>
            )}
          </Box>
          
          {games.length === 0 ? (
            <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">아직 모니터링 중인 게임이 없습니다.</Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {games.map((game) => (
                <Grid item xs={12} key={game.id}>
                  <Card 
                    elevation={2} 
                    sx={{ 
                      '&:hover': { boxShadow: 6 },
                      transition: 'box-shadow 0.3s'
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Grid container alignItems="center" spacing={2}>
                        <Grid item xs>
                          <Typography variant="h6" gutterBottom>
                            {game.title || '제목 없음'}
                          </Typography>
                          <Typography 
                            variant="h5" 
                            color="success.main" 
                            sx={{ fontWeight: 'bold', mb: 1 }}
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
                                sx={{ fontWeight: 'bold' }}
                              />
                              <Typography 
                                variant="body2" 
                                color="error.main"
                                fontWeight="500"
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
                            />
                            {game.priceHistory && game.priceHistory.length > 0 && (
                              <Chip 
                                size="small"
                                icon={<TimelineIcon />} 
                                label={`${game.priceHistory.length}개의 가격 기록`}
                                color="primary"
                                onClick={() => handleGameSelect(game)}
                                clickable
                              />
                            )}
                          </Box>
                        </Grid>
                        <Grid item>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton 
                              color="primary"
                              onClick={() => handleGameSelect(game)}
                              size="small"
                              title="가격 추이 보기"
                            >
                              <TimelineIcon />
                            </IconButton>
                            <IconButton 
                              href={game.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              color="primary"
                              size="small"
                              title="스토어에서 보기"
                            >
                              <LaunchIcon />
                            </IconButton>
                            <IconButton 
                              color="error"
                              onClick={() => removeGame(game.id)}
                              size="small"
                              title="삭제"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {/* 차트 다이얼로그 */}
        <Dialog 
          open={chartDialogOpen} 
          onClose={handleCloseChart}
          maxWidth="md"
          fullWidth
        >
          {selectedGame && (
            <>
              <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  {selectedGame.title} 가격 추이
                </Typography>
                <IconButton onClick={handleCloseChart} size="small">
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent dividers>
                <Box sx={{ height: 300, mb: 3 }}>
                  <Line data={getChartData(selectedGame)} options={chartOptions} />
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  가격 기록
                </Typography>
                <Paper variant="outlined" sx={{ overflow: 'auto' }}>
                  <Box sx={{ minWidth: 400 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>날짜</TableCell>
                          <TableCell>가격</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedGame.priceHistory
                          .filter(record => !record.isVirtual)
                          .sort((a, b) => new Date(b.date) - new Date(a.date))
                          .map((record, index) => (
                            <TableRow key={index}>
                              <TableCell>{record.date}</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                {record.priceFormatted}
                              </TableCell>
                            </TableRow>
                          ))
                        }
                      </TableBody>
                    </Table>
                  </Box>
                </Paper>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseChart} color="primary">
                  닫기
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Container>
    </ThemeProvider>
  );
} 