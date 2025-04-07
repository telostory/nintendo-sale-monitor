import mongoose from 'mongoose';
import clientPromise from '../../lib/mongodb';
import dbConnect from '../../lib/mongoose';

export default async function handler(req, res) {
  try {
    // 환경 변수 확인
    if (!process.env.MONGODB_URI) {
      return res.status(500).json({ 
        success: false, 
        message: 'MONGODB_URI 환경 변수가 설정되지 않았습니다.' 
      });
    }

    // MongoDB 클라이언트 연결 테스트
    const client = await clientPromise;
    const isConnected = !!client && !!client.topology && client.topology.isConnected();

    // Mongoose 연결 테스트
    await dbConnect();
    const mongooseConnected = mongoose.connection.readyState === 1;

    return res.status(200).json({
      success: true,
      message: 'MongoDB 연결 테스트 성공',
      connection: {
        mongodb: isConnected ? '연결됨' : '연결 안됨',
        mongoose: mongooseConnected ? '연결됨' : '연결 안됨',
        uri: process.env.MONGODB_URI.substring(0, 20) + '...' // URI의 일부만 표시 (보안상)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('MongoDB 연결 테스트 실패:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'MongoDB 연결 테스트 실패',
      error: error.message 
    });
  }
}
