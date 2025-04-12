import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

// 디버깅을 위한 여러 axios 인스턴스 생성
// 1. SSL 인증서 검증을 비활성화한 인스턴스
const axiosWithoutSSL = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  }),
  timeout: 10000 // 타임아웃 10초로 설정
});

// 2. 기본 인스턴스 (SSL 검증 활성화)
const axiosWithSSL = axios.create({
  timeout: 10000 // 타임아웃 10초로 설정
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '지원되지 않는 메소드입니다' });
  }

  const { url } = req.body;
  
  console.log('게임 정보 요청 URL:', url);
  
  if (!url) {
    return res.status(400).json({ message: 'URL이 제공되지 않았습니다' });
  }
  
  if (!(url.includes('nintendo.com') || url.includes('nintendo.co.kr'))) {
    return res.status(400).json({ message: '유효한 닌텐도 스토어 URL이 필요합니다' });
  }

  // 요청 헤더 공통 설정
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://store.nintendo.co.kr/',
  };

  try {
    // URL에서 제품 ID 추출 시도
    let productId = '';
    // 패턴: /숫자 (URL 마지막 부분)
    const match = url.match(/\/(\d+)(?:\/|$)/);
    if (match && match[1]) {
      productId = match[1];
      console.log('추출된 제품 ID:', productId);
    } else {
      console.log('제품 ID를 추출할 수 없음:', url);
    }

    let gameInfo = {};

    // 제품 ID가 있으면 닌텐도 API로 직접 시도
    if (productId) {
      try {
        const apiUrl = `https://store.nintendo.co.kr/api/item/${productId}`;
        console.log('API URL 시도:', apiUrl);
        
        // 먼저 SSL 검증 활성화된 인스턴스로 시도
        let apiResponse;
        try {
          console.log('SSL 검증 활성화로 API 요청 시도');
          apiResponse = await axiosWithSSL.get(apiUrl, { headers });
        } catch (sslError) {
          console.log('SSL 활성화 요청 실패, SSL 검증 비활성화로 재시도:', sslError.message);
          // SSL 오류 시 SSL 검증 비활성화 인스턴스로 재시도
          apiResponse = await axiosWithoutSSL.get(apiUrl, { headers });
        }
        
        // API 응답에서 필요한 데이터 추출
        if (apiResponse.data) {
          console.log('API 응답 데이터:', JSON.stringify(apiResponse.data).substring(0, 1000));
          gameInfo.title = apiResponse.data.name || apiResponse.data.title;
          gameInfo.price = apiResponse.data.price || apiResponse.data.formattedPrice || '';
          
          if (gameInfo.title) {
            console.log('API로 성공적으로 게임 정보 가져옴:', gameInfo);
            return res.status(200).json(gameInfo);
          } else {
            console.log('API 응답은 받았으나 제목이 없음');
          }
        }
      } catch (apiError) {
        console.error('API 오류, HTML 파싱으로 대체:', apiError.message);
        // API 호출 실패시 HTML 파싱으로 대체
      }
    }

    console.log('HTML 파싱으로 게임 정보 가져오기 시도');
    
    // 먼저 SSL 검증 활성화된 인스턴스로 시도
    let response;
    try {
      console.log('SSL 검증 활성화로 HTML 요청 시도');
      response = await axiosWithSSL.get(url, { headers });
    } catch (sslError) {
      console.log('SSL 활성화 요청 실패, SSL 검증 비활성화로 재시도:', sslError.message);
      // SSL 오류 시 SSL 검증 비활성화 인스턴스로 재시도
      response = await axiosWithoutSSL.get(url, { headers });
    }
    
    const $ = cheerio.load(response.data);
    
    let title = '';
    let price = '';
    
    // 한국 닌텐도 스토어인 경우
    if (url.includes('nintendo.co.kr')) {
      // 디버깅 용: HTML 구조 출력
      console.log('HTML 구조 일부:', response.data.substring(0, 500) + '...(생략)...');

      // 게임 이름 추출 시도 (여러 가능한 선택자)
      title = $('.product-name h1').text().trim() || 
              $('.pdp-title').text().trim() || 
              $('.product-detail-hero h1').text().trim() ||
              $('.item-name').text().trim() ||
              $('h1').text().trim();
      
      console.log('찾은 제목 요소:', title);
      
      // HTML 콘텐츠 전체에서 가격 패턴 찾기
      const htmlText = response.data;
      const pricePattern = /₩[0-9,]+/g;
      const priceMatches = htmlText.match(pricePattern);
      
      if (priceMatches && priceMatches.length > 0) {
        // 첫 번째로 발견된 가격 사용
        price = priceMatches[0].trim();
        console.log('정규식으로 찾은 모든 가격:', priceMatches);
      } else {
        console.log('정규식으로 가격을 찾지 못함');
        // 기존 방식으로 가격 찾기 시도
        const priceElement = $('.product-price .price').first() || 
                           $('.js-product-offer-price').first() || 
                           $('.price-sales-standard').first() ||
                           $('.price').first() ||
                           $('.current-price').first();
        
        if (priceElement) {
          price = priceElement.text().trim();
          console.log('선택자로 찾은 가격 텍스트:', price);
          
          // 만약 여전히 여러 가격이 합쳐져 있다면, 첫 번째 가격만 추출
          if (price && price.includes('₩')) {
            const prices = price.match(/₩[0-9,]+/g);
            if (prices && prices.length > 0) {
              price = prices[0]; // 첫 번째 가격만 사용
              console.log('첫 번째 가격으로 정제:', price);
            }
          }
        } else {
          console.log('가격 요소를 찾지 못함');
        }
      }
    } else {
      // 다른 닌텐도 스토어(미국 등)
      title = $('h1').text().trim();
      price = $('.price-sales-price').text().trim() || 
              $('.active-price').text().trim() || 
              $('.price').text().trim();
    }
    
    console.log('최종 추출 결과:');
    console.log('URL:', url);
    console.log('제품 ID:', productId || 'ID를 추출할 수 없음');
    console.log('추출된 제목:', title || '제목 없음');
    console.log('추출된 가격:', price || '가격 없음');
    
    if (!title || !price) {
      return res.status(404).json({ 
        message: '게임 정보를 찾을 수 없습니다. 닌텐도 스토어의 디지털 게임 URL만 지원합니다.',
        productId: productId || 'ID를 추출할 수 없음',
        foundTitle: title || '제목 없음',
        foundPrice: price || '가격 없음'
      });
    }

    return res.status(200).json({ title, price });
  } catch (error) {
    console.error('게임 정보 가져오기 오류:', error);
    console.error('오류 세부 정보:', error.message);
    
    if (error.response) {
      // 서버 응답이 있는 경우
      console.error('오류 상태코드:', error.response.status);
      console.error('오류 헤더:', error.response.headers);
      console.error('오류 데이터:', error.response.data);
    } else if (error.request) {
      // 요청은 보냈으나 응답이 없는 경우
      console.error('응답 없음:', error.request);
    }
    
    return res.status(500).json({ 
      message: '게임 정보를 가져오는 중 오류가 발생했습니다: ' + error.message,
      errorDetails: error.code || error.name
    });
  }
} 