import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import mongoose from 'mongoose';
import Game from '../../models/Game';
import clientPromise from '../../lib/mongodb';
import dbConnect from '../../lib/mongoose';

// MongoDB 연결 초기화
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  
  const client = await clientPromise;
  return mongoose.connect(process.env.MONGODB_URI);
};

// SSL 인증서 검증을 비활성화하는 axios 인스턴스 생성
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});

// 닌텐도 스토어에서 게임 정보 가져오기
async function fetchGameInfo(url) {
  try {
    // URL에서 제품 ID 추출 시도
    let productId = '';
    const match = url.match(/\/(\d+)(?:\/|$)/);
    if (match && match[1]) {
      productId = match[1];
    }

    let gameInfo = {};

    // 제품 ID가 있으면 닌텐도 API로 직접 시도
    if (productId) {
      try {
        const apiUrl = `https://store.nintendo.co.kr/api/item/${productId}`;
        const apiResponse = await axiosInstance.get(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            'Referer': 'https://store.nintendo.co.kr/',
          }
        });
        
        // API 응답에서 필요한 데이터 추출
        if (apiResponse.data) {
          gameInfo.title = apiResponse.data.name || apiResponse.data.title;
          gameInfo.price = apiResponse.data.price || apiResponse.data.formattedPrice || '';
          
          if (gameInfo.title) {
            return gameInfo;
          }
        }
      } catch (apiError) {
        console.log('API 오류, HTML 파싱으로 대체: ', apiError.message);
        // API 호출 실패시 HTML 파싱으로 대체
      }
    }

    // 브라우저처럼 보이는 User-Agent 설정
    const response = await axiosInstance.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://store.nintendo.co.kr/',
      }
    });
    
    const $ = cheerio.load(response.data);
    
    let title = '';
    let price = '';
    
    // 한국 닌텐도 스토어인 경우
    if (url.includes('nintendo.co.kr')) {
      // 게임 이름 추출 시도 (여러 가능한 선택자)
      title = $('.product-name h1').text().trim() || 
              $('.pdp-title').text().trim() || 
              $('.product-detail-hero h1').text().trim() ||
              $('.item-name').text().trim() ||
              $('h1').text().trim();
      
      // HTML 콘텐츠 전체에서 가격 패턴 찾기
      const htmlText = response.data;
      const pricePattern = /₩[0-9,]+/g;
      const priceMatches = htmlText.match(pricePattern);
      
      if (priceMatches && priceMatches.length > 0) {
        // 첫 번째로 발견된 가격 사용
        price = priceMatches[0].trim();
      } else {
        // 기존 방식으로 가격 찾기 시도
        const priceElement = $('.product-price .price').first() || 
                           $('.js-product-offer-price').first() || 
                           $('.price-sales-standard').first() ||
                           $('.price').first() ||
                           $('.current-price').first();
        
        if (priceElement) {
          price = priceElement.text().trim();
          
          // 만약 여전히 여러 가격이 합쳐져 있다면, 첫 번째 가격만 추출
          if (price && price.includes('₩')) {
            const prices = price.match(/₩[0-9,]+/g);
            if (prices && prices.length > 0) {
              price = prices[0]; // 첫 번째 가격만 사용
            }
          }
        }
      }
    } else {
      // 다른 닌텐도 스토어(미국 등)
      title = $('h1').text().trim();
      price = $('.price-sales-price').text().trim() || 
              $('.active-price').text().trim() || 
              $('.price').text().trim();
    }
    
    if (!title && !price) {
      throw new Error('게임 정보를 찾을 수 없습니다');
    }

    return { title, price };
  } catch (error) {
    console.error('Error fetching game info:', error.message);
    throw error;
  }
}

// 게임 가격 업데이트 함수
async function updateGamePrices() {
  try {
    // 모든 게임 가져오기
    const games = await Game.find({});
    const results = {
      totalGames: games.length,
      updatedGames: 0,
      failedGames: 0,
      errors: []
    };
    
    // 현재 날짜를 한국 시간(KST)으로 계산 (YYYY-MM-DD 형식)
    const currentDate = new Date();
    const koreaTime = new Date(currentDate.getTime() + (9 * 60 * 60 * 1000));
    const today = koreaTime.toISOString().split('T')[0];
    
    // 각 게임 업데이트
    for (const game of games) {
      try {
        // 닌텐도 스토어에서 최신 가격 정보 가져오기
        const gameInfo = await fetchGameInfo(game.url);
        const newPrice = gameInfo.price;
        const priceNumber = parseInt(newPrice.replace(/[^\d]/g, ''));
        
        // 가격 기록에 추가 또는 업데이트
        let discountInfo = null;
        
        // 가격 기록이 있으면 이전 가격과 비교
        if (game.priceHistory && game.priceHistory.length > 0) {
          // 가격 기록에서 마지막 가격 찾기 (가장 최근 날짜)
          const lastRecord = [...game.priceHistory].sort((a, b) => 
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
        
        // 오늘 날짜의 기록이 있는지 확인
        const todayRecordIndex = game.priceHistory.findIndex(record => record.date === today);
        
        if (todayRecordIndex >= 0) {
          // 오늘 기록이 이미 있으면 업데이트
          game.priceHistory[todayRecordIndex] = { 
            date: today, 
            price: priceNumber, 
            priceFormatted: newPrice,
            discountInfo: discountInfo
          };
        } else {
          // 오늘 기록이 없으면 새로 추가
          game.priceHistory.push({ 
            date: today, 
            price: priceNumber, 
            priceFormatted: newPrice,
            discountInfo: discountInfo
          });
        }
        
        // 게임 정보 업데이트
        game.title = gameInfo.title || game.title;
        game.price = newPrice;
        game.discountInfo = discountInfo;
        game.lastUpdated = new Date();
        
        // MongoDB에 저장
        await game.save();
        
        results.updatedGames++;
        
        // 각 요청 사이에 짧은 지연 추가 (서버 부하 방지)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        results.failedGames++;
        results.errors.push({
          gameUrl: game.url,
          error: error.message
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error updating game prices:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // API 키 검증 (보안을 위해)
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.CRON_API_KEY) {
    return res.status(401).json({ success: false, message: '인증되지 않은 요청입니다.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '허용되지 않는 메소드입니다.' });
  }

  try {
    await dbConnect();
    
    // 모든 게임 목록 조회
    const games = await Game.find({});
    
    if (games.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: '업데이트할 게임이 없습니다.',
        updated: 0,
        total: 0
      });
    }
    
    // 현재 날짜를 한국 시간(KST)으로 계산 (YYYY-MM-DD 형식)
    const currentDate = new Date();
    const koreaTime = new Date(currentDate.getTime() + (9 * 60 * 60 * 1000));
    const today = koreaTime.toISOString().split('T')[0];
    
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // 각 게임의 가격 정보 가져오기
    for (const game of games) {
      try {
        const response = await fetch(`${process.env.NEXTAUTH_URL}/api/game-info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: game.url }),
        });

        if (!response.ok) {
          errorCount++;
          errors.push({ url: game.url, error: `API 응답 오류: ${response.status}` });
          continue;
        }

        const data = await response.json();
        const newPrice = data.price || game.price;
        const priceNumber = parseInt(newPrice.replace(/[^\d]/g, ''));
        
        // 가격 기록 배열 준비
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
        
        // 오늘 날짜의 기록이 있는지 확인
        const todayRecordIndex = priceHistory.findIndex(record => record.date === today);
        
        if (todayRecordIndex >= 0) {
          // 오늘 날짜의 기록 업데이트
          priceHistory[todayRecordIndex] = { 
            date: today, 
            price: priceNumber, 
            priceFormatted: newPrice,
            discountInfo: discountInfo
          };
        } else {
          // 새 기록 추가
          priceHistory.push({ 
            date: today, 
            price: priceNumber, 
            priceFormatted: newPrice,
            discountInfo: discountInfo
          });
        }
        
        // 날짜순으로 정렬
        priceHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 게임 정보 업데이트
        game.price = newPrice;
        game.priceHistory = priceHistory;
        game.lastUpdated = new Date();
        game.discountInfo = discountInfo;
        
        await game.save();
        updatedCount++;
        
        // 업데이트 간 잠시 대기 (서버 부하 방지)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Game update error (${game.url}):`, error);
        errorCount++;
        errors.push({ url: game.url, error: error.message });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: '게임 가격 업데이트 완료',
      updated: updatedCount,
      errors: errorCount,
      total: games.length,
      errorDetails: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('Price update error:', error);
    return res.status(500).json({ 
      success: false, 
      message: '가격 업데이트 중 오류가 발생했습니다',
      error: error.message 
    });
  }
}
