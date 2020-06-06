const express = require('express');
const expressWs = require('express-ws');
const bodyParser = require('body-parser');
const md5 = require('js-md5');
const mongoDb = require('./mongoManager');
const wsMsgHandler = require('./wsMessageHandler');

const port = 3000;
const app = express();
const wss = expressWs(app);

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

// 玩家連線到ws的token暫存
let playerTokens = new Map();

// websocket用 /ws 來接受
const wsPath = '/ws';
app.ws(wsPath, (ws, req) => {
    // 從建立連線的url中取得參數(這邊已經被封裝成Object了，可以直接取用)
    let urlQuery = req.query;
    let token = urlQuery.token;
    let playerName = urlQuery.name;
    let saveToken = playerTokens.get(playerName);
    if (!token || !saveToken || token !== saveToken) {
        ws.close();
        ws.terminate();
        return;
    }
    playerTokens.delete(playerName);

    console.log(`New websocket client has opened! token: ${token}`);

    ws.on('message', (requestBody) => {
        console.log(`ws receive request: ${requestBody}`);
        wsMsgHandler.handleMessage(ws, JSON.parse(requestBody));
    });

    ws.on('close', () => {
        console.log('WebSocket was closed');
        wsMsgHandler.removePlayerWsClient(playerName, ws);
    });

    // 加入玩家client對應
    wsMsgHandler.setPlayerWsClient(playerName, ws);
});

// 提供handler所有websocket的客戶端
wsMsgHandler.setWsClients(wss.getWss(wsPath).clients);

// 重新導向SnakeBattle
app.get('/', function (req, res) {
    res.redirect('/SnakeBattle.html');
});

// 玩家取得玩家資料
app.post('/getPlayerInfos', (req, res) => {
    let request = req.body;
    let playerName = request.name;
    let playerPwd = request.pwd;
    if (playerName && playerPwd) {
        mongoDb.PlayerModel.
            findOne().
            where('name').equals(playerName).
            exec((error, playerModel) => {
                if (!error && playerModel) {
                    // 有找到檢查密碼
                    let encryptPwd = getEncryptPwd(playerModel.name, playerModel.salt, playerPwd);
                    if (encryptPwd === playerModel.pwd) {
                        res.send(JSON.stringify(getClientPlayerData(playerModel)));
                    } else {
                        res.send(JSON.stringify(
                            {
                                errMsg: 'wrong password'
                            }
                        ));
                    }
                } else {
                    createPlayer(playerName, playerPwd, res);
                }
            });
    } else {
        res.send(JSON.stringify(
            {
                errMsg: 'empty playerName or password'
            }
        ));
    }
});

function createPlayer(playerName, playerPwd, res) {
    let salt = getRandomString(7);
    let pwd = getEncryptPwd(playerName, salt, playerPwd);
    let headImg = 'head_1.jpg';
    let newPlayer = new mongoDb.PlayerModel({
        name: playerName,
        salt: salt,
        pwd: pwd,
        headImg: headImg
    });
    newPlayer.save((error, playerModel) => {
        if (error) {
            console.log('createPlayerModelResult!', error);
            res.send(JSON.stringify(
                {
                    errMsg: 'create player fail'
                }
            ));
            return;
        }
        res.send(JSON.stringify(getClientPlayerData(playerModel)));
    });
}

function getRandomString(length) {
    return length ? Math.random().toString(36).substring(2, length + 2) : null;
}

function getEncryptPwd(name, salt, pwd) {
    return md5(name + salt + pwd + salt);
}

function getClientPlayerData(playerModel) {
    let wsToken = getRandomString(8);
    let playerName = playerModel.name;
    let headImg = playerModel.headImg;
    playerTokens.set(playerName, wsToken);
    return {
        // 屏蔽需要隱藏的資訊
        name: playerName,
        headImg: headImg,
        token: wsToken
    };
}

app.listen(port, () => console.log(`App listening at http://localhost:${port}`));