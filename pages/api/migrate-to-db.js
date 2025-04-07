import dbConnect from '../../lib/mongoose';
import Game from '../../models/Game';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '허용되지 않는 메소드입니다.' });
  }

  try {
    await dbConnect();
    
    const { games } = req.body;
    
    if (!games || !Array.isArray(games) || games.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: '유효한 게임 데이터가 제공되지 않았습니다.' 
      });
    }
    
    const results = {
      totalGames: games.length,
      insertedGames: 0,
      updatedGames: 0,
      errorGames: 0,
      errors: []
    };
    
    // 각 게임을 처리
    for (const gameData of games) {
      try {
        // URL이 없는 게임은 건너뜀
        if (!gameData.url) {
          results.errorGames++;
          results.errors.push({ game: gameData, error: 'URL이 없습니다.' });
          continue;
        }
        
        // 중복 게임 확인
        const existingGame = await Game.findOne({ url: gameData.url });
        
        if (existingGame) {
          // 기존 게임을 업데이트
          existingGame.title = gameData.title || existingGame.title;
          existingGame.price = gameData.price || existingGame.price;
          
          // 가격 기록 병합
          if (gameData.priceHistory && gameData.priceHistory.length > 0) {
            // 기존 가격 기록의 날짜 목록 생성
            const existingDates = existingGame.priceHistory.map(record => record.date);
            
            // 새로운 가격 기록 추가
            for (const priceRecord of gameData.priceHistory) {
              if (!existingDates.includes(priceRecord.date)) {
                existingGame.priceHistory.push(priceRecord);
              }
            }
            
            // 날짜순으로 정렬
            existingGame.priceHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
          }
          
          // 마지막 업데이트 시간 갱신
          existingGame.lastUpdated = new Date();
          
          await existingGame.save();
          results.updatedGames++;
        } else {
          // 새 게임 추가
          await Game.create({
            url: gameData.url,
            title: gameData.title,
            price: gameData.price,
            priceHistory: gameData.priceHistory || [],
            lastUpdated: new Date()
          });
          results.insertedGames++;
        }
      } catch (error) {
        results.errorGames++;
        results.errors.push({ 
          game: { url: gameData.url, title: gameData.title }, 
          error: error.message 
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: '게임 데이터 마이그레이션 완료',
      ...results
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ 
      success: false, 
      message: '데이터 마이그레이션 중 오류가 발생했습니다',
      error: error.message 
    });
  }
}
