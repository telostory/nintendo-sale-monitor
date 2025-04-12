import { getServerSession } from 'next-auth';
import { getSession } from 'next-auth/react';
import { authOptions } from './auth/[...nextauth]';
import dbConnect from '../../lib/mongoose';
import Game from '../../models/Game';

export default async function handler(req, res) {
  // 디버깅을 위한 요청 정보 로깅
  console.log(`==== API 요청: ${req.method} /api/user-games ====`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Cookies:', JSON.stringify(req.cookies, null, 2));
  
  // 두 가지 방법으로 세션 확인 - getServerSession과 getSession 비교
  const serverSession = await getServerSession(req, res, authOptions);
  console.log('getServerSession 결과:', JSON.stringify(serverSession, null, 2));
  
  const clientSession = await getSession({ req });
  console.log('getSession 결과:', JSON.stringify(clientSession, null, 2));
  
  // 서버 세션 우선 사용, 없으면 클라이언트 세션 사용
  const session = serverSession || clientSession;
  console.log('최종 사용 세션:', JSON.stringify(session, null, 2));
  
  if (!session) {
    console.error('세션이 없음: 인증되지 않은 요청');
    return res.status(401).json({ success: false, message: '인증되지 않은 요청입니다. 로그인이 필요합니다.' });
  }
  
  if (!session.user) {
    console.error('세션에 사용자 정보 없음');
    return res.status(401).json({ success: false, message: '세션에 사용자 정보가 없습니다. 다시 로그인해주세요.' });
  }
  
  // userId가 sub 또는 id 중 어느 쪽에 있는지 확인
  let userId;
  if (session.user.id) {
    userId = session.user.id;
    console.log('session.user.id에서 사용자 ID 사용:', userId);
  } else if (session.user.sub) {
    userId = session.user.sub;
    console.log('session.user.sub에서 사용자 ID 사용:', userId);
  } else {
    console.error('세션에 사용자 ID가 없음:', session.user);
    return res.status(401).json({ success: false, message: '사용자 식별 정보가 누락되었습니다. 다시 로그인해주세요.' });
  }
  
  console.log('인증된 사용자 ID:', userId);
  
  // 2. 데이터베이스 연결
  try {
    await dbConnect();
    console.log('데이터베이스 연결 성공');
  } catch (dbError) {
    console.error('데이터베이스 연결 실패:', dbError);
    return res.status(500).json({
      success: false,
      message: '데이터베이스 연결 오류가 발생했습니다.',
      error: dbError.message
    });
  }
  
  // 3. HTTP 메서드에 따라 처리
  switch (req.method) {
    case 'GET':
      // 사용자의 게임 목록 조회
      try {
        console.log(`사용자 ${userId}의 게임 목록 조회 시작`);
        const games = await Game.find({ userId }).sort({ createdAt: -1 }); // 최신순 정렬
        console.log(`게임 목록 조회 결과: ${games.length}개 항목`);
        return res.status(200).json({
          success: true, 
          data: games
        });
      } catch (error) {
        console.error('게임 목록 조회 오류:', error);
        return res.status(500).json({ 
          success: false, 
          message: '게임 목록을 불러오는 중 오류가 발생했습니다.'
        });
      }
      
    case 'POST':
      // 새 게임 추가
      try {
        // URL과 필수 필드 검증
        const { url, title, price } = req.body;
        console.log('POST 요청 받음:', JSON.stringify(req.body, null, 2));
        
        if (!url || !title || !price) {
          return res.status(400).json({ 
            success: false, 
            message: '게임 URL, 제목, 가격은 필수 항목입니다.' 
          });
        }
        
        // URL 완전히 정규화 (쿼리 파라미터, 트레일링 슬래시, 프로토콜 등 처리)
        let cleanUrl = url.split('?')[0].replace(/\/$/, '');
        
        // URL에서 'https://' 부분을 표준화
        if (cleanUrl.startsWith('http://')) {
          cleanUrl = cleanUrl.replace('http://', 'https://');
        } else if (!cleanUrl.startsWith('https://')) {
          cleanUrl = 'https://' + cleanUrl;
        }
        
        console.log('정규화된 URL:', cleanUrl);
        
        try {
          // 중복 게임 확인 - 철저한 확인을 위해 userId와 cleanUrl 두 가지로 검색
          console.log(`중복 게임 확인: userId=${userId}, cleanUrl=${cleanUrl}`);
          const existingGame = await Game.findOne({ 
            userId, 
            url: cleanUrl 
          });
          
          if (existingGame) {
            console.log('이미 존재하는 게임 찾음:', existingGame._id, existingGame.title);
            return res.status(200).json({
              success: true,
              message: '이미 등록된 게임입니다.',
              data: existingGame
            });
          }
          
          // 도메인만 추출하여 추가 검색 (닌텐도 스토어 도메인이 변경되는 경우)
          const urlObj = new URL(cleanUrl);
          const domain = urlObj.hostname;
          const pathWithoutParams = urlObj.pathname;
          console.log(`URL 파싱 결과 - 도메인: ${domain}, 경로: ${pathWithoutParams}`);
          
          // 제품 ID를 URL에서 추출 (닌텐도 URL 형식: store.nintendo.co.kr/games/PRODUCT_ID)
          const pathParts = pathWithoutParams.split('/');
          const productId = pathParts[pathParts.length - 1];
          
          if (productId && productId.length > 0) {
            console.log(`추출된 제품 ID: ${productId}`);
            
            // 이 제품 ID를 포함하는 다른 URL도 검색
            const gamesWithSameProductId = await Game.find({
              userId,
              url: { $regex: productId }
            });
            
            if (gamesWithSameProductId.length > 0) {
              console.log('제품 ID로 게임 찾음:', gamesWithSameProductId[0]._id, gamesWithSameProductId[0].title);
              return res.status(200).json({
                success: true,
                message: '이미 등록된 게임입니다 (다른 URL 형식으로 등록됨).',
                data: gamesWithSameProductId[0]
              });
            }
          }
          
          console.log('새 게임 등록 진행: 중복 게임 없음');
          
          // 새 게임 생성
          const newGame = new Game({
            userId,
            url: cleanUrl,
            title,
            price,
            priceHistory: req.body.priceHistory || [],
            lastUpdated: new Date()
          });
          
          // 게임 저장
          const savedGame = await newGame.save();
          console.log('새 게임 추가 성공:', savedGame._id);
          
          // 성공 응답
          return res.status(201).json({
            success: true,
            message: '게임이 성공적으로 추가되었습니다.',
            data: savedGame
          });
          
        } catch (dbError) {
          // 중복 키 오류 특별 처리
          if (dbError.name === 'MongoServerError' && dbError.code === 11000) {
            console.log('MongoDB 중복 키 오류:', dbError);
            
            // 오류 정보에서 중복된 필드 확인
            const keyPattern = dbError.keyPattern || {};
            const keyValue = dbError.keyValue || {};
            
            console.log('중복 키 패턴:', keyPattern);
            console.log('중복 키 값:', keyValue);
            
            // 다시 한번 확인 (레이스 컨디션 대응)
            const existingGame = await Game.findOne({
              userId,
              url: cleanUrl
            });
            
            if (existingGame) {
              console.log('중복 게임 재확인 성공:', existingGame._id, existingGame.title);
              return res.status(200).json({
                success: true,
                message: '이미 등록된 게임입니다.',
                data: existingGame
              });
            }
            
            // 도메인과 경로로 더 넓게 검색
            try {
              const urlObj = new URL(cleanUrl);
              const domain = urlObj.hostname;
              const path = urlObj.pathname;
              
              // 유사한 URL 패턴 검색
              const similarGames = await Game.find({
                userId,
                url: { $regex: path.split('/').pop() }
              });
              
              if (similarGames.length > 0) {
                console.log('유사 URL로 게임 찾음:', similarGames[0]._id, similarGames[0].title);
                return res.status(200).json({
                  success: true,
                  message: '유사한 URL로 이미 등록된 게임입니다.',
                  data: similarGames[0]
                });
              }
            } catch (parseError) {
              console.error('URL 파싱 오류:', parseError);
            }
            
            // 명확한 오류 정보 반환
            return res.status(400).json({
              success: false,
              message: '이미 등록된 게임입니다.',
              error: 'duplicate_key',
              details: {
                keyPattern,
                keyValue
              }
            });
          }
          
          // 그 외 DB 오류
          console.error('DB 오류:', dbError);
          return res.status(500).json({
            success: false,
            message: '데이터베이스 오류가 발생했습니다.',
            error: dbError.message
          });
        }
        
      } catch (error) {
        console.error('게임 추가 처리 오류:', error);
        return res.status(500).json({
          success: false,
          message: '게임을 추가하는 중 오류가 발생했습니다.',
          error: error.message
        });
      }
      
    // DB 일관성 검사 및 복구 기능 추가
    case 'PUT':
      if (req.body.action === 'validate') {
        try {
          console.log('DB 일관성 검사 요청');
          
          // 사용자의 모든 게임 가져오기
          const userGames = await Game.find({ userId });
          console.log(`사용자 게임 수: ${userGames.length}`);
          
          // URL별로 그룹화하여 중복 확인
          const urlMap = new Map();
          const duplicates = [];
          
          userGames.forEach(game => {
            const cleanUrl = game.url.split('?')[0].replace(/\/$/, '');
            if (urlMap.has(cleanUrl)) {
              duplicates.push({ 
                original: urlMap.get(cleanUrl), 
                duplicate: game 
              });
            } else {
              urlMap.set(cleanUrl, game);
            }
          });
          
          // 중복 항목 처리 결과 반환
          return res.status(200).json({
            success: true,
            message: '데이터베이스 일관성 검사 완료',
            data: {
              totalGames: userGames.length,
              uniqueUrls: urlMap.size,
              duplicates: duplicates.length
            }
          });
        } catch (error) {
          console.error('DB 일관성 검사 오류:', error);
          return res.status(500).json({
            success: false,
            message: '데이터베이스 일관성 검사 중 오류가 발생했습니다.',
            error: error.message
          });
        }
      }
      
      return res.status(400).json({ 
        success: false, 
        message: '지원되지 않는 액션입니다.' 
      });
      
    case 'DELETE':
      // 게임 삭제
      try {
        const { gameId } = req.body;
        
        if (!gameId) {
          return res.status(400).json({ 
            success: false, 
            message: '삭제할 게임 ID가 필요합니다.' 
          });
        }
        
        // 해당 사용자의 게임인지 확인 후 삭제
        const deletedGame = await Game.findOneAndDelete({ 
          _id: gameId, 
          userId: userId 
        });
        
        if (!deletedGame) {
          return res.status(404).json({ 
            success: false, 
            message: '게임을 찾을 수 없거나 삭제 권한이 없습니다.' 
          });
        }
        
        return res.status(200).json({
          success: true,
          message: '게임이 삭제되었습니다.',
          data: { gameId: deletedGame._id }
        });
      } catch (error) {
        console.error('게임 삭제 오류:', error);
        return res.status(500).json({ 
          success: false, 
          message: '게임을 삭제하는 중 오류가 발생했습니다.'
        });
      }
      
    default:
      return res.status(405).json({ success: false, message: '허용되지 않는 메서드입니다.' });
  }
} 