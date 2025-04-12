import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

// 디버깅을 위한 여러 axios 인스턴스 생성
// 1. SSL 인증서 검증을 비활성화한 인스턴스
const axiosWithoutSSL = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  }),
  timeout: 20000 // 타임아웃 20초로 늘림
});

// 2. 기본 인스턴스 (SSL 검증 활성화)
const axiosWithSSL = axios.create({
  timeout: 20000 // 타임아웃 20초로 늘림
});

// 디버깅용 샘플 응답 (실제 API 호출이 실패할 경우 사용)
const DEBUG_MODE = false;
const SAMPLE_RESPONSE = {
  title: "샘플 게임 타이틀",
  price: "₩64,800"
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '지원되지 않는 메소드입니다' });
  }

  const { url } = req.body;
  
  console.log('게임 정보 요청 URL:', url);
  
  if (!url) {
    return res.status(400).json({ message: 'URL이 제공되지 않았습니다' });
  }
  
  if (!(url.includes('nintendo.co.kr') || url.includes('nintendo.com'))) {
    return res.status(400).json({ message: '유효한 닌텐도 스토어 URL이 필요합니다' });
  }

  // 요청 헤더 공통 설정
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://store.nintendo.co.kr/',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };

  // 디버그 모드가 활성화된 경우 샘플 응답 반환
  if (DEBUG_MODE) {
    console.log('디버그 모드: 샘플 응답 반환');
    return res.status(200).json(SAMPLE_RESPONSE);
  }

  try {
    // URL에서 제품 ID 추출 시도
    let productId = '';
    // 패턴: /숫자 (URL 마지막 부분) 또는 "p=" 쿼리 파라미터 값
    let match = url.match(/\/(\d+)(?:\/|$)/);
    if (match && match[1]) {
      productId = match[1];
      console.log('URL 경로에서 추출된 제품 ID:', productId);
    } else {
      // p= 쿼리 파라미터에서 추출 시도
      const pMatch = url.match(/[?&]p=(\d+)/);
      if (pMatch && pMatch[1]) {
        productId = pMatch[1];
        console.log('쿼리 파라미터에서 추출된 제품 ID:', productId);
      } else {
        console.log('제품 ID를 추출할 수 없음:', url);
      }
    }

    let gameInfo = {};
    let apiSuccess = false;

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
          
          // 데이터 구조를 확인하고 적절한 필드 선택
          const title = apiResponse.data.name || apiResponse.data.title;
          
          // 가격 정보 추출 시도
          let price = '';
          if (apiResponse.data.price) {
            price = apiResponse.data.price;
          } else if (apiResponse.data.formattedPrice) {
            price = apiResponse.data.formattedPrice;
          } else if (apiResponse.data.priceRange && apiResponse.data.priceRange.minimumPrice) {
            price = apiResponse.data.priceRange.minimumPrice.finalPrice.formatted;
          }
          
          // 가격에 원화 기호가 없으면 추가
          if (price && !price.includes('₩') && !price.includes('₩')) {
            price = `₩${price}`;
          }
          
          if (title && price) {
            gameInfo = { title, price };
            console.log('API로 성공적으로 게임 정보 가져옴:', gameInfo);
            apiSuccess = true;
            return res.status(200).json(gameInfo);
          } else {
            console.log('API 응답에 제목 또는 가격이 없음:', title, price);
          }
        }
      } catch (apiError) {
        console.error('API 오류, HTML 파싱으로 대체:', apiError.message);
        // API 호출 실패시 HTML 파싱으로 대체
      }
    }

    // API가 실패했거나 제품 ID가 없는 경우 HTML 파싱 시도
    if (!apiSuccess) {
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
        
        // 가격 추출 시도 1: 정규식으로 HTML에서 가격 패턴 찾기
        const htmlText = response.data;
        const pricePattern = /₩[0-9,]+/g;
        const priceMatches = htmlText.match(pricePattern);
        
        if (priceMatches && priceMatches.length > 0) {
          // 첫 번째로 발견된 가격 사용
          price = priceMatches[0].trim();
          console.log('정규식으로 찾은 모든 가격:', priceMatches);
        } else {
          console.log('정규식으로 가격을 찾지 못함');
          
          // 가격 추출 시도 2: 선택자로 가격 요소 찾기
          const priceSelectors = [
            '.product-price .price',
            '.js-product-offer-price',
            '.price-sales-standard',
            '.price',
            '.current-price',
            '[itemprop="price"]'
          ];
          
          // 여러 선택자를 시도
          for (const selector of priceSelectors) {
            const priceElem = $(selector).first();
            if (priceElem.length > 0) {
              price = priceElem.text().trim();
              console.log(`선택자 ${selector}로 찾은 가격:`, price);
              break;
            }
          }
          
          // 가격에서 숫자 부분 추출
          if (price) {
            // 한국 가격에는 '₩' 기호가 있으므로 그걸로 시작하는 패턴 찾기
            const priceMatch = price.match(/₩[0-9,]+/);
            if (priceMatch) {
              price = priceMatch[0];
              console.log('가격에서 숫자 부분 추출:', price);
            }
          }
        }
        
        // 가격 추출 시도 3: 메타 태그에서 가격 찾기
        if (!price) {
          const metaPrice = $('meta[property="product:price:amount"]').attr('content');
          if (metaPrice) {
            price = `₩${Number(metaPrice).toLocaleString()}`;
            console.log('메타 태그에서 찾은 가격:', price);
          }
        }
        
        // 가격 추출 시도 4: script 태그의 JSON 데이터에서 가격 찾기
        if (!price) {
          $('script').each((i, script) => {
            const content = $(script).html();
            if (content && content.includes('"price"') && content.includes('"name"')) {
              try {
                // JSON 객체를 찾아서 파싱
                const jsonStr = content.trim();
                const matches = jsonStr.match(/\{.*?"price".*?\}/g);
                if (matches) {
                  for (const match of matches) {
                    try {
                      const json = JSON.parse(match);
                      if (json.price) {
                        price = `₩${Number(json.price).toLocaleString()}`;
                        console.log('스크립트 태그에서 찾은 가격:', price);
                        break;
                      }
                    } catch (e) {
                      // JSON 파싱 오류 무시
                    }
                  }
                }
              } catch (e) {
                console.log('스크립트 내용에서 JSON 파싱 실패');
              }
            }
          });
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
      
      // 가격이 없지만 제목이 있는 경우, 임시 샘플 가격 설정 (디버깅용)
      if (!price && title && DEBUG_MODE) {
        price = '₩64,800';
        console.log('가격이 없어서 임시 가격 설정 (디버그 모드):', price);
      }
      
      if (!title || !price) {
        return res.status(404).json({ 
          message: '게임 정보를 찾을 수 없습니다. 닌텐도 스토어의 디지털 게임 URL만 지원합니다.',
          productId: productId || 'ID를 추출할 수 없음',
          foundTitle: title || '제목 없음',
          foundPrice: price || '가격 없음'
        });
      }

      return res.status(200).json({ title, price });
    }
  } catch (error) {
    console.error('게임 정보 가져오기 오류:', error);
    console.error('오류 세부 정보:', error.message);
    
    if (error.response) {
      // 서버 응답이 있는 경우
      console.error('오류 상태코드:', error.response.status);
      console.error('오류 헤더:', error.response.headers);
      // 응답 데이터가 너무 크면 일부만 로깅
      const responseData = error.response.data;
      if (typeof responseData === 'string') {
        console.error('오류 데이터 (일부):', responseData.substring(0, 500) + '...');
      } else {
        console.error('오류 데이터:', responseData);
      }
    } else if (error.request) {
      // 요청은 보냈으나 응답이 없는 경우
      console.error('응답 없음:', error.request);
    }
    
    // 디버그 모드에서는 샘플 데이터 반환
    if (DEBUG_MODE) {
      console.log('디버그 모드: 오류 발생 시 샘플 응답 반환');
      return res.status(200).json(SAMPLE_RESPONSE);
    }
    
    return res.status(500).json({ 
      message: '게임 정보를 가져오는 중 오류가 발생했습니다: ' + error.message,
      errorDetails: error.code || error.name
    });
  }
} 