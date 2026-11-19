// 같이 하기를 내 컴퓨터에서 시험할 때 쓰는 작은 MQTT 중계 서버(웹소켓).
// 실제 게임은 공개 중계 서버를 쓴다. 이것은 인터넷 없이 두 창으로 시험할 때 그 자리를 대신한다.
//
//   npm i aedes ws            (한 번만)
//   node tools/dev/relay.js   (기본 포트 1884)
//   그다음 게임을 두 창에서 연다:  index.html?mq=ws://127.0.0.1:1884
//   (한 창에서 메뉴 → 같이 하기 → 문 열기, 다른 창에서 그 방 코드로 놀러 가기)
const aedes = require('aedes')();
const http = require('http');
const ws = require('ws');
const port = +process.argv[2] || 1884;
const server = http.createServer();
new ws.WebSocketServer({ server }).on('connection', (socket) => aedes.handle(ws.createWebSocketStream(socket)));
server.listen(port, '127.0.0.1', () => console.log('중계 서버가 열렸다: ws://127.0.0.1:' + port));
