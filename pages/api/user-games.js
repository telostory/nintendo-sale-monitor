import { getSession } from 'next-auth/react';
import dbConnect from '../../lib/mongoose';
import Game from '../../models/Game';

export default async function handler(req, res) {
  // 1. 사용자 인증 확인
  const session = await getSession({ req });
  
  if (!session || !session.user) {
    return res.status(401).json({ success: false, message: '인증되지 않은 요청입니다. 로그인이 필요합니다.' });
  }
  
  const userId = session.user.id; // 사용자 고유 ID
  
  // 2. 데이터베이스 연결
  await dbConnect();
  
  // 3. HTTP 메서드에 따라 처리
  switch (req.method) {
    case 'GET':
      // 사용자의 게임 목록 조회
      try {
        const games = await Game.find({ userId }).sort({ createdAt: -1 }); // 최신순 정렬
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