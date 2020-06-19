const
    FIELD_WIDTH = 25,
    FIELD_HEIGHT = 25,

    FACED_UP = 'up',
    FACED_DOWN = 'down',
    FACED_RIGHT = 'right',
    FACED_LEFT = 'left',

    MAX_PLAYERS = 4,
    TICK_BASE = 300,

    STATUS_ACTIVE = 1,
    STATUS_DEAD = 2
    ;

function createField(roomId) {
    console.log(`BattleField(${roomId}) createField`);
    return {
        roomId: roomId,
        players: new Map(),
        isGaming: false,
        progress: 1
    }
}

// 取得客戶端使用的資料格式
function getClientDatas(battleField) {
    let players = {};
    battleField.players.forEach((value, key) => {
        players[key] = {
            name: key,
            body: value.body,
            faced: value.faced
        };
    });
    return {
        roomId: battleField.roomId,
        players: players,
        food: battleField.food
    };
}

// 加入玩家
function addPlayer(battleField, playerName) {
    if (battleField.isGaming) {
        return;
    }
    let bodyIdx = battleField.players.size;
    battleField.players.set(playerName,
        {
            body: getBody(bodyIdx),
            score: 0,
            faced: FACED_RIGHT,
            nextFaced: FACED_RIGHT,
            status: STATUS_ACTIVE
        }
    );
}

// 取得身體位置
function getBody(bodyIdx) {
    let bodys = [
        [[2, 0], [1, 0], [0, 0]],
        [[2, 3], [1, 3], [0, 3]],
        [[2, 6], [1, 6], [0, 6]],
        [[2, 9], [1, 9], [0, 9]],
    ];
    return bodys[bodyIdx];
}

// 移除玩家
function removePlayer(battleField, playerName) {
    if (battleField.isGaming) {
        return;
    }
    battleField.players.delete(playerName);
}

// 戰場啟動
function start(battleField, updateFrame) {
    if (!updateFrame) {
        console.log('BattleField need an update function to invoke')
        return;
    }
    if (!battleField.isGaming) {
        battleField.isGaming = true;
    }
    setTimeout(tick, getTickTimeGap(battleField), battleField, updateFrame);
}

// 取得tick間隔時間
function getTickTimeGap(battleField) {
    return Math.floor(TICK_BASE / (battleField.progress / 5 + 1));
}

// 每次移動計算
function tick(battleField, updateFrame) {
    console.log(`BattleField(${battleField.roomId}) tick, isGaming: ${battleField.isGaming}`);
    if (!battleField.isGaming) {
        return;
    }

    // 先把所有人的身體加入，等下要用來計算碰撞
    let allBodys = [];
    // 計算每位玩家的下一個頭的位置
    let newHeads = [];
    let isReachFood = false;
    // 移除的尾巴
    let removeTails = [];
    battleField.players.forEach((value, key) => {
        if (value.status === STATUS_DEAD) {
            return;
        }

        let newHead = getPlayerNextHead(battleField, key);
        newHeads.push({
            playerName: key,
            newHead: newHead
        });

        // 新的頭加入
        value.body.unshift(newHead);
        // 判斷是否觸碰到"食物"，得分&增長(不移除尾巴)
        if (newHead[0] === battleField.food[0] && newHead[1] === battleField.food[1]) {
            value.score++;
            isReachFood = true;
        } else {
            // 移除尾巴
            let tail = value.body.pop();
            removeTails.push({
                playerName: key,
                removeTail: tail
            });
        }

        // 加入身體
        allBodys.push(value.body);
    });

    // 判斷是否觸碰到任何人的身體(包括自己)或是邊界，死亡
    let deadPlayers = [];
    for (let head of newHeads) {
        let playerName = head.playerName;
        let newHead = head.newHead;
        for (let body of allBodys) {
            if (
                newHead[0] === body[0] && newHead[1] === body[1]
                ||
                newHead[0] >= FIELD_WIDTH || newHead[0] < 0
                ||
                newHead[1] >= FIELD_HEIGHT || newHead[1] < 0
            ) {
                deadPlayers.push(playerName);
                let player = battleField.players.get(playerName);
                player.status = STATUS_DEAD;
                break;
            }
        }
    }

    // 有人吃到食物
    let newFood = null;
    if (isReachFood) {
        battleField.progress++;
        newFood = createFood(battleField, newHeads);
    }

    // 最後一人死亡時遊戲結束
    let isGameOver = false;
    if (newHeads.length === 1 && deadPlayers.length === 1) {
        battleField.isGaming = false;
        isGameOver = true;
    }

    // 更新frame給客戶端
    updateFrame(battleField.roomId,
        {
            newHeads: newHeads,
            removeTails: removeTails,
            deadPlayers: deadPlayers,
            newFood: newFood,
            battleField: getClientDatas(battleField),
            isGameOver: isGameOver
        }
    );

    // 設定下一個tick
    if (!isGameOver) {
        setTimeout(tick, getTickTimeGap(battleField), battleField, updateFrame);
    }
}

// 產生食物
function createFood(battleField, newHeads) {
    // 把所有格子加入池子
    let foodPool = new Map();
    for (let x = 0; x < FIELD_WIDTH; x++) {
        for (let y = 0; y < FIELD_HEIGHT; y++) {
            // 使用 x-y 當作鍵，等下可以快速移除
            foodPool.set(`${x}-${y}`, [x, y]);
        }
    }

    // 移除所有新的頭
    if (newHeads) {
        for (let head of newHeads) {
            foodPool.delete(`${head.newHead[0]}-${head.newHead[1]}`);
        }
    }
    // 移除每個玩家的身體每一格
    battleField.players.forEach((value, key) => {
        if (value.status === STATUS_DEAD) {
            return;
        }
        for (let body of value.body) {
            foodPool.delete(`${body[0]}-${body[1]}`);
        }
    });

    // 隨機挑一格
    let foods = [];
    for (let food of foodPool) {
        foods.push(food[1]);//food[1]就是value
    }
    battleField.food = foods[Math.floor(Math.random() * foods.length)];
    return battleField.food;
}

// 計算玩家下次的頭位置
function getPlayerNextHead(battleField, playerName) {
    let player = battleField.players.get(playerName);
    if (player && player.status === STATUS_ACTIVE) {
        let head = player.body[0];
        let curHeadX = head[0];
        let curHeadY = head[1];
        switch (player.nextFaced) {
            case FACED_UP: {
                curHeadY--;
                break;
            }
            case FACED_DOWN: {
                curHeadY++;
                break;
            }
            case FACED_RIGHT: {
                curHeadX++;
                break;
            }
            case FACED_LEFT: {
                curHeadX--;
                break;
            }
            default: {
                console.log(`player: ${playerName}'s faced error: ${player.nextFaced}`);
            }
        }
        player.faced = player.nextFaced;
        return [curHeadX, curHeadY];
    }
    return null;
}

// 玩家改變面向
function playerChangeDirection(battleField, playerName, faced) {
    let player = battleField.players.get(playerName);
    if (player) {
        let orgFaced = player.faced;
        // 與當前面向或是反向相同則無效
        if (orgFaced === faced || faced === getOppositeDirection(faced)) {
            return;
        }
        player.nextFaced = faced;
    }
}

// 取得反向
function getOppositeDirection(faced) {
    switch (faced) {
        case FACED_UP: {
            return FACED_DOWN;
        }
        case FACED_DOWN: {
            return FACED_UP;
        }
        case FACED_RIGHT: {
            return FACED_LEFT;
        }
        case FACED_LEFT: {
            return FACED_RIGHT;
        }
        default: {
            console.log(`getOppositeDirection: ${faced} fail...`);
        }
    }
}

exports.MAX_PLAYERS = MAX_PLAYERS;
exports.createField = createField;
exports.addPlayer = addPlayer;
exports.removePlayer = removePlayer;
exports.createFood = createFood;
exports.start = start;
exports.getClientDatas = getClientDatas;
exports.playerChangeDirection = playerChangeDirection;