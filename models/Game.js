import mongoose from 'mongoose';

// Mongoose 스키마 정의
const priceHistorySchema = new mongoose.Schema({
  date: { type: String, required: true },      // 날짜 (YYYY-MM-DD 형식)
  price: { type: Number, required: true },     // 가격 (숫자)
  priceFormatted: { type: String, required: true }, // 포맷된 가격 (예: ₩45,000)
  discountInfo: {
    originalPrice: { type: Number },           // 원래 가격
    discountAmount: { type: Number },          // 할인 금액
    discountRate: { type: Number },            // 할인율 (%)
    formattedDiscount: { type: String }        // 포맷된 할인 금액 (예: -₩5,000)
  }
}, { _id: false });

const gameSchema = new mongoose.Schema({
  url: { type: String, required: true },              // 게임 URL
  title: { type: String, required: true },            // 게임 제목
  price: { type: String, required: true },            // 현재 가격 (포맷된 문자열)
  priceHistory: [priceHistorySchema],                 // 가격 변동 내역
  lastUpdated: { type: Date, default: Date.now },     // 마지막 업데이트 시간
  userId: { type: String, required: true }            // 사용자 ID (로그인한 사용자 구분용)
}, { timestamps: true });

// 사용자별 URL 조합으로 유니크 인덱스 생성 (같은 사용자가 같은 게임을 중복 등록 방지)
gameSchema.index({ url: 1, userId: 1 }, { unique: true });

// 모델 생성 (이미 존재하는 경우 재사용)
export default mongoose.models.Game || mongoose.model('Game', gameSchema);
