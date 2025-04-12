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
  FormControlLabel,
  Avatar
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
import SyncIcon from '@mui/icons-material/Sync';

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
    try {
      if (!session) {
        console.log('로그인되지 않은 상태:', session);
        return;
      }
      
      if (!session.user) {
        console.log('세션에 사용자 정보 없음:', session);
        return;
      }
      
      console.log('fetchUserGames 시작 - 현재 세션:', session.user.email);
      setFetchLoading(true);
      
      // API 요청
      const response = await fetch('/api/user-games', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        },
        credentials: 'include',
      });
      
      console.log('API 응답 상태코드:', response.status);
      
      if (response.status === 401) {
        console.log('사용자 인증 실패 (401)');
        const errorData = await response.json();
        console.error('인증 오류:', errorData);
        setError('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API 오류:', errorData);
        throw new Error(errorData.message || '서버에서 게임 목록을 가져오는데 실패했습니다.');
      }
      
      // 응답 데이터 파싱
      const responseClone = response.clone();
      let data;
      
      try {
        data = await response.json();
      } catch (parseError) {
        const text = await responseClone.text();
        console.error('JSON 파싱 오류:', parseError, text);
        throw new Error('서버 응답을 처리할 수 없습니다.');
      }
      
      console.log('API 응답 데이터:', data);
      
      if (!data.success) {
        throw new Error(data.message || '서버에서 게임 목록을 불러오는데 실패했습니다.');
      }
      
      if (!Array.isArray(data.data)) {
        console.error('서버에서 받은 게임 데이터가 배열이 아닙니다:', data.data);
        throw new Error('게임 목록 형식이 잘못되었습니다.');
      }
      
      // 받은 게임 목록을 상태에 설정
      console.log(`가져온 게임 수: ${data.data.length}`);
      
      // 기존 게임 목록과 병합하지 않고, DB에서 가져온 데이터로 상태를 완전히 교체
      setGames(data.data);
      
      // 마지막 업데이트 시간 설정
      if (data.data.length > 0) {
        const latestUpdate = Math.max(...data.data.map(game => 
          game.lastUpdated ? new Date(game.lastUpdated).getTime() : 0
        ));
        
        if (latestUpdate > 0) {
          setLastRefreshed(new Date(latestUpdate));
        }
      }
      
      // 디버깅: 특정 URL이 있는지 로그
      console.log('특정 URL이 있는지 확인:', 
        data.data.some(game => game.url.includes('70010000027621'))
      );
      
      // 결과 성공 메시지
      if (data.data.length === 0) {
        setSnackbarMessage('등록된 게임이 없습니다.');
      } else {
        setSnackbarMessage(`${data.data.length}개의 게임을 불러왔습니다.`);
      }
      setSnackbarOpen(true);
      
    } catch (error) {
      console.error('게임 목록 불러오기 오류:', error);
      setError(error.message);
    } finally {
      setFetchLoading(false);
    }
  };

  // fetchUserGames가 세션 변경될 때마다 호출되도록 수정
  useEffect(() => {
    if (status === "loading") {
      console.log('세션 로딩 중...');
      return;
    }
    
    console.log('세션 상태 변경:', status, session?.user?.email);
    
    if (session && session.user) {
      console.log('로그인 확인됨, DB에서 게임 목록 가져오기 시작');
      fetchUserGames();
    } else {
      console.log('로그인되지 않음, 로컬 스토리지에서 게임 목록 로드');
      const savedGames = localStorage.getItem('monitoredGames');
      if (savedGames) {
        try {
          const parsedGames = JSON.parse(savedGames);
          setGames(parsedGames);
          console.log('로컬 스토리지에서 게임 목록 로드 완료:', parsedGames.length);
          
          const lastRefreshTime = localStorage.getItem('lastRefreshed');
          if (lastRefreshTime) {
            setLastRefreshed(new Date(lastRefreshTime));
          }
        } catch (error) {
          console.error('저장된 게임 목록 파싱 오류:', error);
          localStorage.removeItem('monitoredGames');
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
                discountFormatted: `-₩${discountAmount.toLocaleString()}`
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
              discountFormatted: `-₩${discountAmount.toLocaleString()}`
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

  // 게임 추가 처리 함수
  const handleAddGame = async () => {
    if (addGameLoading) return; // 이미 처리 중이면 중복 요청 방지
    
    setAddGameLoading(true);
    setError('');
    
    try {
      // URL 입력 확인
      if (!url.trim()) {
        setError('닌텐도 스토어 게임 URL을 입력해주세요.');
        setAddGameLoading(false);
        return;
      }
      
      // URL 정리 - 쿼리 파라미터만 제거
      const cleanUrl = url.trim().split('?')[0];
      console.log('정리된 URL:', cleanUrl);
      
      // 로그인하지 않은 경우: 로컬 목록에서 중복 확인
      if (!session) {
        const isDuplicate = games.some(game => game.url.split('?')[0] === cleanUrl);
        if (isDuplicate) {
          setError('이미 등록된 게임입니다.');
          setAddGameLoading(false);
          return;
        }
      }
      
      // 게임 정보 가져오기
      const response = await fetch('/api/game-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: cleanUrl }),
      });
      
      const responseClone = response.clone();
      let data;
      
      try {
        data = await response.json();
        console.log('게임 정보 응답:', data);
      } catch (jsonError) {
        const text = await responseClone.text();
        console.error('JSON 파싱 오류:', text);
        throw new Error('서버 응답을 처리할 수 없습니다.');
      }
      
      if (!response.ok) {
        throw new Error(data.message || '게임 정보를 가져오는데 실패했습니다.');
      }
      
      // 현재 날짜를 한국 시간(KST)으로 계산 (YYYY-MM-DD 형식)
      const currentDate = new Date();
      const koreaTime = new Date(currentDate.getTime() + (9 * 60 * 60 * 1000));
      const today = koreaTime.toISOString().split('T')[0];
      
      // 가격에서 숫자만 추출
      const priceText = data.price;
      const priceNumber = parseInt(priceText.replace(/[^\d]/g, ''));
      
      if (isNaN(priceNumber)) {
        throw new Error('가격 정보를 올바르게 추출할 수 없습니다.');
      }
      
      // 서버에 저장할 가격 기록 객체 생성
      const priceRecord = {
        date: today,
        price: priceNumber,
        priceFormatted: priceText
      };
      
      const newGame = {
        url: cleanUrl,
        title: data.title,
        price: priceText,                 // price 필드 사용 - 서버 모델과 일치
        priceHistory: [priceRecord],
        lastUpdated: new Date().toISOString()
      };
      
      console.log('저장할 게임 데이터:', JSON.stringify(newGame, null, 2));
      
      if (session && session.user) {
        // 로그인된 경우: 서버에 게임 추가
        console.log('로그인 상태로 서버에 게임 추가');
        
        const serverResponse = await fetch('/api/user-games', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // 쿠키 포함
          body: JSON.stringify(newGame),
        });
        
        const serverResponseClone = serverResponse.clone();
        let serverData;
        
        try {
          serverData = await serverResponse.json();
          console.log('서버 저장 응답:', serverData);
        } catch (jsonError) {
          const text = await serverResponseClone.text();
          console.error('서버 응답 파싱 오류:', text);
          throw new Error('서버 응답을 처리할 수 없습니다.');
        }
        
        if (!serverResponse.ok) {
          // 중복 키 오류 처리
          if (serverData.error === 'duplicate_key') {
            console.log('중복된 게임 - 이미 등록된 게임으로 간주');
            setError('이미 등록된 게임입니다. 새로고침 후 확인하세요.');
            
            // DB 동기화를 위해 게임 목록 다시 불러오기
            await fetchUserGames();
            setUrl('');
            setAddGameLoading(false);
            return;
          }
          
          throw new Error(serverData.message || '서버에 게임을 저장하는데 실패했습니다.');
        }
        
        // 성공 응답에서 저장된 게임 정보 가져오기
        if (serverData.success && serverData.data) {
          // 서버에서 반환한 데이터로 게임 상태 업데이트
          setGames(prevGames => {
            // 중복 방지를 위해 이미 있는 게임이면 제거 후 추가
            const existingIndex = prevGames.findIndex(
              g => g._id === serverData.data._id || g.url === serverData.data.url
            );
            
            if (existingIndex >= 0) {
              // 기존 게임 업데이트
              const updatedGames = [...prevGames];
              updatedGames[existingIndex] = serverData.data;
              return updatedGames;
            } else {
              // 새 게임 추가
              return [serverData.data, ...prevGames];
            }
          });
          
          // 전체 목록도 새로고침 (혹시 놓친 게임이 있을 수 있으므로)
          setTimeout(() => {
            fetchUserGames();
          }, 1000);
        } else {
          // 서버 응답에 데이터가 없는 경우 - 게임 목록 전체 새로고침
          console.log('서버 응답에 데이터가 없어 게임 목록 새로고침');
          await fetchUserGames();
        }
        
      } else {
        // 로그인되지 않은 경우: 로컬 스토리지에만 추가
        console.log('비로그인 상태로 로컬 스토리지에 게임 추가');
        
        const gameWithId = {
          ...newGame,
          id: Date.now().toString() // 로컬 스토리지용 임시 ID
        };
        
        setGames(prevGames => [gameWithId, ...prevGames]);
        
        // 로컬 스토리지 업데이트
        const updatedGames = [gameWithId, ...games];
        localStorage.setItem('monitoredGames', JSON.stringify(updatedGames));
      }
      
      // 입력 필드 초기화
      setUrl('');
      setSnackbarMessage('게임이 추가되었습니다.');
      setSnackbarOpen(true);
      
    } catch (error) {
      console.error('게임 추가 오류:', error);
      setError(error.message || '게임을 추가하는 중 오류가 발생했습니다.');
    } finally {
      setAddGameLoading(false);
    }
  };

  // 게임 삭제 다이얼로그 열기
  const handleDeleteDialogOpen = (game) => {
    if (game) {
      setGameToDelete(game);
      setDeleteDialogOpen(true);
    }
  };

  // 게임 삭제 다이얼로그 닫기
  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setGameToDelete(null);
  };

  const removeGame = async (game) => {
    if (!game) {
      console.error('삭제할 게임 정보가 없습니다.');
      return;
    }
    
    // 게임 ID 확인 (MongoDB ID 또는 클라이언트 ID)
    const gameId = game._id || game.id;
    const gameUrl = game.url;
    
    console.log('게임 삭제 요청:', { gameId, gameUrl, title: game.title });
    
    if (session && session.user) {
      // 로그인된 경우: 서버에서 게임 삭제
      try {
        const response = await fetch('/api/user-games', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ gameId: gameId || gameUrl }),
          credentials: 'include',
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
          throw new Error(responseData.message || '서버에서 게임을 삭제하는데 실패했습니다.');
        }
        
        console.log('서버 삭제 응답:', responseData);
        
        // 삭제 성공 후 로컬 상태 업데이트
        setGames(prev => prev.filter(g => 
          g._id !== gameId && 
          g.id !== gameId && 
          g.url !== gameUrl
        ));
        
        // 선택된 게임이 삭제되면 선택 해제
        if (selectedGame && (
          selectedGame._id === gameId || 
          selectedGame.id === gameId || 
          selectedGame.url === gameUrl
        )) {
          setSelectedGame(null);
          setChartDialogOpen(false);
        }
        
        // 게임 삭제 완료 메시지
        setSnackbarMessage(`"${game.title}" 게임이 삭제되었습니다.`);
        setSnackbarOpen(true);
        
        // DB 상태와 UI 동기화를 위해 전체 목록 새로고침
        setTimeout(fetchUserGames, 500);
        
      } catch (error) {
        console.error('게임 삭제 오류:', error);
        setError(error.message);
        setSnackbarMessage(`게임 삭제 중 오류: ${error.message}`);
        setSnackbarOpen(true);
      }
    } else {
      // 로그인되지 않은 경우: 로컬 상태에서만 삭제
      setGames(prev => prev.filter(g => g.id !== gameId && g.url !== gameUrl));
      
      // 선택된 게임이 삭제되면 선택 해제
      if (selectedGame && (selectedGame.id === gameId || selectedGame.url === gameUrl)) {
        setSelectedGame(null);
        setChartDialogOpen(false);
      }
      
      // 로컬 스토리지 업데이트
      const updatedGames = games.filter(g => g.id !== gameId && g.url !== gameUrl);
      if (updatedGames.length === 0) {
        localStorage.removeItem('monitoredGames');
      } else {
        localStorage.setItem('monitoredGames', JSON.stringify(updatedGames));
      }
      
      // 게임 삭제 완료 메시지
      setSnackbarMessage(`"${game.title}" 게임이 삭제되었습니다.`);
      setSnackbarOpen(true);
    }
    
    closeDeleteDialog();
  };
  
  const clearAllGames = () => {
    setGames([]);
    setSelectedGame(null);
    setChartDialogOpen(false);
    localStorage.removeItem('monitoredGames');
  };
  
  const handleShowChart = (game) => {
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

  // 날짜 형식 포맷팅 (YYYY.MM.DD)
  const formatDate = (dateString) => {
    try {
      if (!dateString) return '날짜 없음';
      
      const date = new Date(dateString);
      
      // 유효한 날짜인지 확인
      if (isNaN(date.getTime())) {
        console.error('유효하지 않은 날짜:', dateString);
        return '날짜 오류';
      }
      
      // YYYY.MM.DD 형식으로 변환
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}.${month}.${day}`;
    } catch (error) {
      console.error('날짜 포맷팅 오류:', error, dateString);
      return '날짜 오류';
    }
  };

  // 게임 카드를 렌더링하는 부분
  const renderGameCard = (game) => {
    const lastPrice = game.priceHistory && game.priceHistory.length > 0 
      ? game.priceHistory[game.priceHistory.length - 1] 
      : null;
    
    // 구매일(첫 기록일) 표시
    const firstDate = game.priceHistory && game.priceHistory.length > 0 
      ? formatDate(game.priceHistory[0].date) 
      : '날짜 없음';
    
    // 할인 정보 있는 경우 표시
    const hasDiscount = lastPrice && lastPrice.discountInfo;
    
    return (
      <Paper key={game._id || game.id} sx={{ 
        mb: 2, 
        p: 2,
        position: 'relative'
      }}>
        <IconButton 
          color="error" 
          onClick={() => handleDeleteDialogOpen(game)}
          sx={{ 
            position: 'absolute', 
            top: 8, 
            right: 8,
            p: 0.5
          }}
        >
          <DeleteIcon />
        </IconButton>
        
        <Typography variant="h6" component="h3" sx={{ 
          fontSize: { xs: '0.95rem', sm: '1.1rem' },
          mb: 1,
          pr: 4
        }}>
          {game.title}
        </Typography>
        
        <Typography 
          variant="h5" 
          component="p" 
          color="primary"
          sx={{ 
            fontWeight: 'bold',
            color: '#2e7d32',
            fontSize: { xs: '1.3rem', sm: '1.5rem' },
            my: 1
          }}
        >
          {lastPrice ? lastPrice.priceFormatted : game.price}
        </Typography>
        
        {hasDiscount && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip 
              label={`-${lastPrice.discountInfo.discountRate}%`} 
              color="error" 
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
            <Typography color="error" variant="body2" sx={{ fontWeight: 'bold' }}>
              {lastPrice.discountInfo.discountFormatted}
            </Typography>
          </Box>
        )}
        
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mt: 1
        }}>
          <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            추가일: {firstDate}
          </Typography>
          <Button 
            size="small" 
            variant="outlined" 
            color="primary"
            onClick={() => handleShowChart(game)}
            startIcon={<TimelineIcon />}
            sx={{ ml: 'auto', fontSize: '0.7rem', py: 0.5 }}
          >
            가격 기록 보기
          </Button>
        </Box>
      </Paper>
    );
  };

  // DB 일관성 검사 및 복구 함수
  const validateDatabase = async () => {
    if (!session || !session.user) {
      setSnackbarMessage('로그인 후 사용할 수 있는 기능입니다.');
      setSnackbarOpen(true);
      return;
    }
    
    try {
      setFetchLoading(true);
      
      const response = await fetch('/api/user-games', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action: 'validate' }),
      });
      
      if (!response.ok) {
        throw new Error('데이터베이스 일관성 검사 중 오류가 발생했습니다.');
      }
      
      const data = await response.json();
      
      setSnackbarMessage(`DB 검사 완료: 총 ${data.data.totalGames}개 게임, ${data.data.duplicates}개 중복 항목 발견`);
      setSnackbarOpen(true);
      
      // 게임 목록 새로고침
      await fetchUserGames();
      
    } catch (error) {
      console.error('DB 일관성 검사 오류:', error);
      setError(error.message);
    } finally {
      setFetchLoading(false);
    }
  };

  // DB 일관성 복구 버튼 추가
  const forceSyncDatabase = async () => {
    if (!session || !session.user) {
      setSnackbarMessage('로그인 후 사용할 수 있는 기능입니다.');
      setSnackbarOpen(true);
      return;
    }
    
    try {
      setFetchLoading(true);
      
      // DB에서 최신 데이터 다시 가져오기
      const response = await fetch('/api/user-games', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('서버 연결 오류. 다시 시도해주세요.');
      }
      
      const data = await response.json();
      
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('데이터 형식 오류. 관리자에게 문의하세요.');
      }
      
      // 상태 업데이트
      setGames(data.data);
      setSnackbarMessage(`DB 동기화 완료: ${data.data.length}개 게임 로드됨`);
      setSnackbarOpen(true);
      
    } catch (error) {
      console.error('DB 동기화 오류:', error);
      setError(error.message);
    } finally {
      setFetchLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md" sx={{ 
        py: { xs: 2, sm: 4 }, 
        px: { xs: 2, sm: 3 },
        overflow: 'hidden'  // 컨테이너 넘치는 요소 방지
      }}>
        <Head>
          <title>닌텐도 게임 가격 모니터</title>
          <meta name="description" content="닌텐도 스토어 게임 가격을 모니터링하는 앱입니다." />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
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
            display: 'flex', 
            justifyContent: 'space-between',
            minHeight: { xs: '56px', sm: '64px' },
            padding: { xs: '0 16px', sm: '0 24px' }
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography 
                variant="h6" 
                component="div" 
                sx={{ 
                  fontWeight: 'bold', 
                  fontSize: { xs: '1rem', sm: '1.2rem' },
                  whiteSpace: 'nowrap'
                }}
              >
                닌텐도 게임 가격 모니터
              </Typography>
              
              {session && (
                <Chip
                  label={session.user.name || session.user.email}
                  color="default"
                  size="small"
                  avatar={<Avatar src={session.user.image} />}
                  sx={{ ml: 1, display: { xs: 'none', sm: 'flex' } }}
                />
              )}
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {session ? (
                // 로그인 상태
                <>
                  {/* 모바일 상태 버튼 */}
                  <Box sx={{ display: { xs: 'flex', sm: 'none' } }}>
                    <IconButton
                      size="small"
                      onClick={forceSyncDatabase}
                      sx={{ color: 'white', p: 0.8 }}
                      title="DB 동기화"
                    >
                      <SyncIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  
                  {/* 데스크톱 상태 버튼 */}
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={forceSyncDatabase}
                    startIcon={<SyncIcon />}
                    sx={{ 
                      display: { xs: 'none', sm: 'flex' }, 
                      borderColor: 'rgba(255,255,255,0.5)'
                    }}
                  >
                    DB 동기화
                  </Button>
                  
                  {/* 로그아웃 버튼 */}
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => signOut({ redirect: false })}
                    startIcon={<LogoutIcon />}
                    sx={{ 
                      display: { xs: 'none', sm: 'flex' }, 
                      borderColor: 'rgba(255,255,255,0.5)'
                    }}
                  >
                    로그아웃
                  </Button>
                  
                  <IconButton
                    size="small"
                    onClick={() => signOut({ redirect: false })}
                    sx={{ 
                      color: 'white', 
                      p: 0.8,
                      display: { xs: 'flex', sm: 'none' }
                    }}
                  >
                    <LogoutIcon fontSize="small" />
                  </IconButton>
                </>
              ) : (
                // 비로그인 상태
                <>
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => signIn('google')}
                    startIcon={<LoginIcon />}
                    sx={{ 
                      borderColor: 'rgba(255,255,255,0.5)',
                      display: { xs: 'none', sm: 'flex' }
                    }}
                  >
                    로그인
                  </Button>
                  
                  <IconButton
                    size="small"
                    onClick={() => signIn('google')}
                    sx={{ 
                      color: 'white', 
                      p: 0.8,
                      display: { xs: 'flex', sm: 'none' }
                    }}
                  >
                    <LoginIcon fontSize="small" />
                  </IconButton>
                </>
              )}
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
                  key={game._id || game.id}
                >
                  {renderGameCard(game)}
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
              onClick={() => gameToDelete && removeGame(gameToDelete)} 
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