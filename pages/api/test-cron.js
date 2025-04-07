export default function handler(req, res) {
  // HTML 응답 생성
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Vercel Cron Jobs 테스트</title>
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
      h1, h2 {
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
      .card {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
      }
      .card-title {
        margin-top: 0;
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
      }
      #result {
        margin-top: 20px;
      }
    </style>
  </head>
  <body>
    <h1>Vercel Cron Jobs 테스트</h1>
    <p>이 페이지에서는 Vercel Cron Jobs 설정을 확인하고 수동으로 실행할 수 있습니다.</p>
    
    <div class="card">
      <h3 class="card-title">현재 Cron 설정</h3>
      <p><strong>경로:</strong> /api/update-prices</p>
      <p><strong>스케줄:</strong> 0 15 * * * (매일 15:00 UTC, 한국시간 00:00)</p>
      <p><strong>설명:</strong> 모든 게임의 가격을 자동으로 체크하고 데이터베이스에 저장합니다.</p>
    </div>
    
    <div class="card">
      <h3 class="card-title">수동 실행</h3>
      <p>가격 업데이트 API를 수동으로 실행합니다. 이 작업은 몇 분 정도 소요될 수 있습니다.</p>
      <button id="runCronBtn">가격 업데이트 실행</button>
      <div id="result"></div>
    </div>
    
    <div class="card">
      <h3 class="card-title">데이터베이스 게임 목록</h3>
      <p>현재 MongoDB에 저장된 게임 목록을 확인합니다.</p>
      <button id="getGamesBtn">게임 목록 가져오기</button>
      <div id="gamesList"></div>
    </div>
    
    <script>
      document.addEventListener('DOMContentLoaded', () => {
        const resultEl = document.getElementById('result');
        const gamesListEl = document.getElementById('gamesList');
        const runCronBtn = document.getElementById('runCronBtn');
        const getGamesBtn = document.getElementById('getGamesBtn');
        
        // 가격 업데이트 실행 버튼
        runCronBtn.addEventListener('click', async () => {
          runCronBtn.disabled = true;
          runCronBtn.textContent = '실행 중...';
          resultEl.innerHTML = '<p>가격 업데이트 작업 실행 중...</p>';
          
          try {
            const response = await fetch('/api/update-prices');
            
            if (!response.ok) {
              throw new Error(\`HTTP 오류: \${response.status}\`);
            }
            
            const result = await response.json();
            
            resultEl.innerHTML = \`
              <p class="success">작업 완료!</p>
              <pre>\${JSON.stringify(result, null, 2)}</pre>
            \`;
          } catch (error) {
            resultEl.innerHTML = \`
              <p class="error">오류 발생: \${error.message}</p>
            \`;
          } finally {
            runCronBtn.disabled = false;
            runCronBtn.textContent = '가격 업데이트 실행';
          }
        });
        
        // 게임 목록 가져오기 버튼
        getGamesBtn.addEventListener('click', async () => {
          getGamesBtn.disabled = true;
          getGamesBtn.textContent = '불러오는 중...';
          gamesListEl.innerHTML = '<p>MongoDB에서 게임 목록을 불러오는 중...</p>';
          
          try {
            const response = await fetch('/api/games');
            
            if (!response.ok) {
              throw new Error(\`HTTP 오류: \${response.status}\`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data.length > 0) {
              let gamesHtml = '<h4>총 ' + result.data.length + '개의 게임이 저장되어 있습니다.</h4>';
              
              gamesHtml += '<table style="width:100%; border-collapse: collapse;">';
              gamesHtml += '<tr style="background-color: #f2f2f2;"><th style="text-align:left; padding: 8px; border: 1px solid #ddd;">제목</th><th style="text-align:left; padding: 8px; border: 1px solid #ddd;">현재 가격</th><th style="text-align:left; padding: 8px; border: 1px solid #ddd;">가격 기록</th></tr>';
              
              result.data.forEach(game => {
                gamesHtml += \`
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">\${game.title}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">\${game.price}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">\${game.priceHistory ? game.priceHistory.length : 0}개</td>
                  </tr>
                \`;
              });
              
              gamesHtml += '</table>';
              gamesListEl.innerHTML = gamesHtml;
            } else {
              gamesListEl.innerHTML = '<p>저장된 게임이 없습니다.</p>';
            }
          } catch (error) {
            gamesListEl.innerHTML = \`
              <p class="error">오류 발생: \${error.message}</p>
            \`;
          } finally {
            getGamesBtn.disabled = false;
            getGamesBtn.textContent = '게임 목록 가져오기';
          }
        });
      });
    </script>
  </body>
  </html>
  `;

  // HTTP 응답 헤더 설정
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
