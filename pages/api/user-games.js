import { getSession } from 'next-auth/react';
import dbConnect from '../../lib/mongoose';
import Game from '../../models/Game';

export default async function handler(req, res) {
  // 디버깅을 위한 요청 정보 로깅
  console.log(`==== API 요청: ${req.method} /api/user-games ====`);
  console.log('Headers:', req.headers);
  console.log('Cookies:', req.cookies);
  
  // 1. 사용자 인증 확인
  const session = await getSession({ req });
  console.log('세션 정보:', session);
  
  if (!session) {
    console.error('세션이 없음: 인증되지 않은 요청');
    return res.status(401).json({ success: false, message: '인증되지 않은 요청입니다. 로그인이 필요합니다.' });
  }
  
  if (!session.user) {
    console.error('세션에 사용자 정보 없음');
    return res.status(401).json({ success: false, message: '세션에 사용자 정보가 없습니다. 다시 로그인해주세요.' });
  }
  
  if (!session.user.id) {
    console.error('세션에 사용자 ID 없음:', session.user);
    return res.status(401).json({ success: false, message: '사용자 식별 정보가 누락되었습니다. 다시 로그인해주세요.' });
  }
  
  const userId = session.user.id; // 사용자 고유 ID
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
        
        if (!url) {
          return res.status(400).json({ 
            success: false, 
            message: '게임 URL은 필수 항목입니다.' 
          });
        }
        
        // 해당 사용자가 이미 같은 URL의 게임을 추가했는지 확인
        const existingGame = await Game.findOne({ url, userId });
        
        if (existingGame) {
          // 게임이 이미 있으면 업데이트
          existingGame.title = title || existingGame.title;
          existingGame.price = price || existingGame.price;
          
          // 가격 기록이 있으면 업데이트
          if (priceHistory && priceHistory.length > 0) {
            // 기존 가격 기록의 날짜 목록 생성
            const existingDates = existingGame.priceHistory.map(record => record.date);
            
            // 새로운 가격 기록 추가
            for (const priceRecord of priceHistory) {
              if (!existingDates.includes(priceRecord.date)) {
                existingGame.priceHistory.push(priceRecord);
              }
            }
            
            // 날짜순으로 정렬
            existingGame.priceHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
          }
          
          existingGame.lastUpdated = new Date();
          await existingGame.save();
          
          return res.status(200).json({
            success: true,
            message: '게임 정보가 업데이트되었습니다.',
            data: existingGame
          });
        } else {
          // 새 게임 추가
          const newGame = await Game.create({
            url,
            title,
            price,
            priceHistory: priceHistory || [],
            userId,
            lastUpdated: new Date()
          });
          
          return res.status(201).json({
            success: true,
            message: '새 게임이 추가되었습니다.',
            data: newGame
          });
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