# Nintendo Sale Monitor

닌텐도 게임 스토어의 가격을 모니터링하고 변동 사항을 추적하는 웹 앱입니다.

## 배포 트리거용 변경사항
- 분할 화면 기능 롤백 (2023.04.12)

## 기능

- 닌텐도 온라인 스토어 게임 URL 입력
- 게임 이름과 가격 표시
- 여러 게임 동시 모니터링

## 시작하기

### 설치

```bash
npm install
```

### 개발 서버 시작

```bash
npm run dev
```

### 빌드

```bash
npm run build
```

### 프로덕션 서버 시작

```bash
npm run start
```

## 사용 방법

1. 닌텐도 온라인 스토어에서 게임 페이지 URL을 복사합니다.
2. 애플리케이션에서 URL을 입력하고 '추가' 버튼을 클릭합니다.
3. 게임 정보가 하단에 표시됩니다.

## 개발 환경

- Next.js
- React
- Axios
- Cheerio (웹 스크래핑)
- Tailwind CSS 