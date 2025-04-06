import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

// SSL 인증서 검증을 비활성화하는 axios 인스턴스 생성
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '지원되지 않는 메소드입니다' });
  }

  const { url } = req.body;
  
  if (!url || !(url.includes('nintendo.com') || url.includes('nintendo.co.kr'))) {
    return res.status(400).json({ message: '유효한 닌텐도 스토어 URL이 필요합니다' });
  }

  try {
    // URL에서 제품 ID 추출 시도
    let productId = '';
    // 패턴: /숫자 (URL 마지막 부분)
    const match = url.match(/\/(\d+)(?:\/|$)/);
    if (match && match[1]) {
      productId = match[1];
    }

    let gameInfo = {};

    // 제품 ID가 있으면 닌텐도 API로 직접 시도
    if (productId) {
      try {
        const apiUrl = `https://store.nintendo.co.kr/api/item/${productId}`;
        console.log('API URL 시도:', apiUrl);
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
            return res.status(200).json(gameInfo);
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
      // 디버깅 용: HTML 구조 출력
      console.log('HTML 구조 일부:', response.data.substring(0, 1000));

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
        console.log('정규식으로 찾은 모든 가격:', priceMatches);
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
    
    console.log('URL:', url);
    console.log('제품 ID:', productId);
    console.log('추출된 제목:', title);
    console.log('추출된 가격:', price);
    
    if (!title && !price) {
      return res.status(404).json({ 
        message: '게임 정보를 찾을 수 없습니다',
        productId: productId || 'ID를 추출할 수 없음'
      });
    }

    return res.status(200).json({ title, price });
  } catch (error) {
    console.error('Error fetching game info:', error.message);
    return res.status(500).json({ message: '게임 정보를 가져오는 중 오류가 발생했습니다: ' + error.message });
  }
} 