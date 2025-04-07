export default function handler(req, res) {
  // HTML 응답 생성
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>MongoDB 마이그레이션 테스트</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        line-height: 1.6;
      }
      h1 {
        color: #E60012;
      }
      button {
        background-color: #E60012;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        margin-top: 10px;
      }
      button:hover {
        background-color: #c5000f;
      }
      pre {
        background-color: #f5f5f5;
        padding: 15px;
        border-radius: 4px;
        overflow-x: auto;
      }
      .success {
        color: green;
        font-weight: bold;
      }
      .error {
        color: red;
        font-weight: bold;
      }
      #result {
        margin-top: 20px;
      }
    </style>
  </head>
  <body>
    <h1>닌텐도 게임 데이터 MongoDB 마이그레이션</h1>
    <p>이 페이지는 브라우저의 localStorage에 저장된 게임 데이터를 MongoDB로 마이그레이션합니다.</p>
    
    <div>
      <h2>로컬 스토리지 게임 데이터</h2>
      <pre id="localData">데이터 로딩 중...</pre>
      
      <button id="migrateBtn">MongoDB로 마이그레이션</button>
      
      <div id="result"></div>
    </div>
    
    <script>
      // 페이지 로드 시 로컬 스토리지 데이터 표시
      document.addEventListener('DOMContentLoaded', () => {
        const localDataEl = document.getElementById('localData');
        const resultEl = document.getElementById('result');
        const migrateBtn = document.getElementById('migrateBtn');
        
        // 로컬 스토리지에서 게임 데이터 로드
        const gamesData = localStorage.getItem('monitoredGames');
        
        if (gamesData) {
          try {
            const games = JSON.parse(gamesData);
            localDataEl.textContent = JSON.stringify(games, null, 2);
            
            // 마이그레이션 버튼 이벤트 핸들러
            migrateBtn.addEventListener('click', async () => {
              migrateBtn.disabled = true;
              migrateBtn.textContent = '마이그레이션 중...';
              resultEl.innerHTML = '<p>MongoDB로 데이터 마이그레이션 중...</p>';
              
              try {
                const response = await fetch('/api/migrate-to-db', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ games }),
                });
                
                const result = await response.json();
                
                if (result.success) {
                  resultEl.innerHTML = \`
                    <p class="success">마이그레이션 성공!</p>
                    <pre>\${JSON.stringify(result, null, 2)}</pre>
                  \`;
                } else {
                  resultEl.innerHTML = \`
                    <p class="error">마이그레이션 실패</p>
                    <pre>\${JSON.stringify(result, null, 2)}</pre>
                  \`;
                }
              } catch (error) {
                resultEl.innerHTML = \`
                  <p class="error">오류 발생: \${error.message}</p>
                \`;
              } finally {
                migrateBtn.disabled = false;
                migrateBtn.textContent = 'MongoDB로 마이그레이션';
              }
            });
            
          } catch (error) {
            localDataEl.textContent = '로컬 스토리지 데이터 파싱 오류: ' + error.message;
          }
        } else {
          localDataEl.textContent = '로컬 스토리지에 저장된 게임 데이터가 없습니다.';
          migrateBtn.disabled = true;
        }
      });
    </script>
  </body>
  </html>
  `;

  // HTTP 응답 헤더 설정
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
