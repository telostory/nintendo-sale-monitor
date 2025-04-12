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
        const { url, title, price, priceHistory } = req.body;
        
        if (!url || !title || !price) {
          return res.status(400).json({ 
            success: false, 
            message: '게임 URL, 제목, 가격은 필수 항목입니다.' 
          });
        }
        
        // URL 정리 (쿼리 파라미터 제거)
        const cleanUrl = url.split('?')[0];
        
        // MongoDB 모델을 직접 사용하여 게임 추가
        try {
          // 기존 게임 찾기
          const existingGame = await Game.findOne({ 
            userId: userId, 
            url: cleanUrl 
          });
          
          if (existingGame) {
            // 이미 있는 게임이면 업데이트
            console.log('기존 게임 업데이트:', existingGame._id);
            
            // 가격 이력이 있으면 추가
            if (priceHistory && priceHistory.length > 0) {
              // 기존 날짜 목록 확인
              const existingDates = existingGame.priceHistory.map(record => record.date);
              
              // 새 가격 기록 중 중복되지 않은 것만 추가
              for (const record of priceHistory) {
                if (!existingDates.includes(record.date)) {
                  existingGame.priceHistory.push(record);
                }
              }
              
              // 날짜순 정렬
              existingGame.priceHistory.sort((a, b) => 
                new Date(a.date) - new Date(b.date)
              );
            }
            
            // 필드 업데이트
            existingGame.title = title;
            existingGame.price = price;
            existingGame.lastUpdated = new Date();
            
            // 저장
            await existingGame.save();
            
            return res.status(200).json({
              success: true,
              message: '게임 정보가 업데이트되었습니다.',
              data: existingGame
            });
            
          } else {
            // 새 게임 추가
            console.log('새 게임 추가:', cleanUrl);
            
            const newGame = new Game({
              userId,
              url: cleanUrl,
              title,
              price,
              priceHistory: priceHistory || [],
              lastUpdated: new Date()
            });
            
            const savedGame = await newGame.save();
            
            return res.status(201).json({
              success: true,
              message: '새 게임이 추가되었습니다.',
              data: savedGame
            });
          }
        } catch (error) {
          // MongoDB 중복 키 오류 처리
          if (error.code === 11000) {
            console.error('MongoDB 중복 키 오류:', error);
            
            // 다시 한번 이 URL의 게임이 있는지 확인
            const existingGame = await Game.findOne({ 
              userId: userId, 
              url: cleanUrl 
            });
            
            if (existingGame) {
              return res.status(200).json({
                success: true,
                message: '이미 존재하는 게임입니다.',
                data: existingGame
              });
            } else {
              return res.status(400).json({
                success: false,
                message: '중복된 게임을 추가할 수 없습니다.',
                error: error.message
              });
            }
          }
          
          // 그 외 다른 오류
          throw error;
        }
      } catch (error) {
        console.error('게임 추가 오류:', error);
        return res.status(500).json({ 
          success: false, 
          message: '게임을 추가하는 중 오류가 발생했습니다.', 
          error: error.message 
        });
      }
      
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