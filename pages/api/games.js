import dbConnect from '../../lib/mongoose';
import Game from '../../models/Game';

export default async function handler(req, res) {
  await dbConnect();

  // 메소드에 따라 적절한 작업 수행
  switch (req.method) {
    case 'GET':
      return getGames(req, res);
    case 'POST':
      return addGame(req, res);
    case 'DELETE':
      return deleteGame(req, res);
    default:
      return res.status(405).json({ success: false, message: '허용되지 않는 메소드입니다.' });
  }
}

// 게임 목록 가져오기
async function getGames(req, res) {
  try {
    // 모든 게임 가져오기
    const games = await Game.find({}).sort({ lastUpdated: -1 });
    
    return res.status(200).json({
      success: true,
      count: games.length,
      data: games
    });
  } catch (error) {
    console.error('Error fetching games:', error);
    return res.status(500).json({ 
      success: false, 
      message: '게임 목록을 가져오는 중 오류가 발생했습니다',
      error: error.message 
    });
  }
}

// 새 게임 추가
async function addGame(req, res) {
  try {
    const { url, title, price, priceHistory } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        message: '게임 URL이 필요합니다' 
      });
    }
    
    // 이미 존재하는 게임인지 확인
    const existingGame = await Game.findOne({ url });
    
    if (existingGame) {
      return res.status(400).json({ 
        success: false, 
        message: '이미 추적 중인 게임입니다' 
      });
    }
    
    // 새 게임 생성
    const game = await Game.create({
      url,
      title: title || '제목 없음',
      price: price || '가격 정보 없음',
      priceHistory: priceHistory || [],
      lastUpdated: new Date()
    });
    
    return res.status(201).json({
      success: true,
      message: '게임이 추가되었습니다',
      data: game
    });
  } catch (error) {
    console.error('Error adding game:', error);
    return res.status(500).json({ 
      success: false, 
      message: '게임을 추가하는 중 오류가 발생했습니다',
      error: error.message 
    });
  }
}

// 게임 삭제
async function deleteGame(req, res) {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: '삭제할 게임 ID가 필요합니다' 
      });
    }
    
    // ID로 게임 찾아서 삭제
    const deletedGame = await Game.findByIdAndDelete(id);
    
    if (!deletedGame) {
      return res.status(404).json({ 
        success: false, 
        message: '해당 ID의 게임을 찾을 수 없습니다' 
      });
    }
    
    return res.status(200).json({
      success: true,
      message: '게임이 삭제되었습니다',
      data: deletedGame
    });
  } catch (error) {
    console.error('Error deleting game:', error);
    return res.status(500).json({ 
      success: false, 
      message: '게임을 삭제하는 중 오류가 발생했습니다',
      error: error.message 
    });
  }
}
