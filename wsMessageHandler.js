// 所有的 websocket client
let wsClients = null;
// 所有玩家的 websocket client
let playerWsClients = new Map();
// 房間資訊
let rooms = {};
// 玩家對應房間資訊
let playerRoomMap = new Map();

const
    C_PUBLIC_CHAT = 1001,
    S_PUBLIC_CHAT = 2001,
    C_JOIN_ROOM = 1101,
    S_JOIN_ROOM = 2101,
    C_GET_ROOMS = 1102,
    S_GET_ROOMS = 2102,
    S_UPDATE_ROOM_PLAYER = 2103
    ;

function setWsClients(clients) {
    wsClients = clients;
}

function setPlayerWsClient(playerName, client) {
    playerWsClients.set(playerName, client);
}

function removePlayerWsClient(playerName, client) {
    if (playerRoomMap.has(playerName)) {
        let roomId = playerRoomMap.get(playerName);
        // 這裡不提供client，因為有webSocket可能無法執行後續的操作
        removeClientFromRoom(roomId, playerName);
    }
    playerWsClients.delete(playerName);
}

function handleMessage(ws, msg) {
    let msgCode = msg.code;
    let msgData = msg.data;
    switch (msgCode) {
        case C_PUBLIC_CHAT: {
            // 直接廣給全部的人
            broadcastToAll(S_PUBLIC_CHAT, msgData);
            break;
        }
        case C_JOIN_ROOM: {
            if (msgData.isLeave) {
                removeClientFromRoom(msgData.roomId, msgData.playerName, ws);
            } else {
                addClientToRoom(msgData.roomId, msgData.playerName, ws);
            }
            break;
        }
        case C_GET_ROOMS: {
            sendMessage(ws, S_GET_ROOMS, getRoomsData());
            break;
        }

        default: {
            console.log('undefined msgCode ', msgCode);
        }
    }
}

function broadcastToAll(msgCode, msgData) {
    if (!wsClients) {
        return;
    }
    let msgString = JSON.stringify(
        {
            code: msgCode,
            data: msgData
        }
    );
    wsClients.forEach((client) => {
        client.send(msgString);
    });
}

function sendMessage(ws, msgCode, msgData) {
    if (ws) {
        ws.send(JSON.stringify(
            {
                code: msgCode,
                data: msgData
            }
        ));
    }
}

function getRandomString(length) {
    return length ? Math.random().toString(36).substring(2, length + 2) : null;
}

function getRoomName(roomId) {
    return `r_${roomId}`;
}

// 添加client到房間
function addClientToRoom(roomId, playerName, client) {
    if (playerRoomMap.has(playerName)) {
        return;
    }
    // 若無房號當作創建房間請求
    let id = roomId ? roomId : getRandomString(16);
    let roomName = getRoomName(id);
    let room = rooms[roomName];
    if (!room) {
        room = {};
        room.id = id;
        room.hostName = playerName;
        rooms[roomName] = room;
        isNewRoom = true;
    }
    let clients = room.clients;
    if (!clients) {
        clients = new Map();
        room.clients = clients;
    }
    clients.set(playerName, client);
    playerRoomMap.set(playerName, id);
    console.log(`addClientToRoom ${id} / ${playerName} / ${clients.size}`);

    // 房間內玩家資訊
    let players = [];
    clients.forEach((value, key) => {
        players.push({ name: key });
    });

    // 回傳成功與房間資訊
    sendMessage(client, S_JOIN_ROOM,
        {
            isSuccess: true,
            room: {
                id: id,
                hostName: room.hostName,
                players: players
            }
        }
    );

    // 更新玩家列表到房間內的其他玩家
    broadcastToRoom(id, S_UPDATE_ROOM_PLAYER, { players: players, hostName: room.hostName }, playerName);
    // 廣播給所有人房間列表
    broadcastToAll(S_GET_ROOMS, getRoomsData());
}

// 從房間移除玩家client
function removeClientFromRoom(roomId, playerName, client) {
    if (!playerRoomMap.has(playerName)) {
        return;
    }

    let roomName = getRoomName(roomId);
    let room = rooms[roomName];
    let result = false;
    let clientSize = 0;
    if (room && room.clients) {
        result = room.clients.delete(playerName);
        clientSize = room.clients.size;
        // 房間沒人了
        if (!clientSize) {
            rooms[roomName] = null;
        } else {
            // 檢查是否是房主離開，是的話將房主交給最前面一位玩家
            if (room.hostName === playerName) {
                let keyIterator = room.clients.keys();
                room.hostName = keyIterator.next().value;
            }
        }
    }
    playerRoomMap.delete(playerName);
    console.log(`removeClientFromRoom ${roomId} / ${playerName} / ${clientSize} / ${result}`);

    // 成功離開的話回傳離開資訊
    if (result && client) {
        // 回傳離開成功
        sendMessage(client, S_JOIN_ROOM,
            {
                isSuccess: true,
                isLeave: true
            }
        );
        // 廣播給所有人房間列表
        broadcastToAll(S_GET_ROOMS, getRoomsData());
    }

    // 如果房間內還有人，更新給其他人玩家列表
    if (clientSize) {
        // 房間內玩家資訊
        let players = [];
        room.clients.forEach((value, key) => {
            players.push({ name: key });
        });
        broadcastToRoom(room.id, S_UPDATE_ROOM_PLAYER, { players: players, hostName: room.hostName }, playerName);
    }
    return result;
}

// 廣播房間訊息
function broadcastToRoom(roomId, msgCode, msgData, ...exceptPlayerNames) {
    let room = rooms[getRoomName(roomId)];
    if (room && room.clients) {
        room.clients.forEach((value, key) => {
            // 排除名單
            if (exceptPlayerNames && exceptPlayerNames.includes(key)) {
                return;
            }
            // value就是wsClient
            value.send(JSON.stringify(
                {
                    code: msgCode,
                    data: msgData
                }
            ));
        });
    }
}

// 取得所有房間訊息
function getRooms() {
    return rooms;
}
// 取得提供給client的房間資訊
function getRoomsData() {
    let roomsData = [];
    if (rooms) {
        for (roomName in rooms) {
            let room = rooms[roomName];
            if (!room) {
                continue;
            }

            let playerSize = room.clients ? room.clients.size : 0;
            roomsData.push(
                {
                    id: room.id,
                    title: roomName,
                    playerSize: playerSize
                }
            );
        }
    }
    return roomsData;
}

exports.setWsClients = setWsClients;
exports.setPlayerWsClient = setPlayerWsClient;
exports.removePlayerWsClient = removePlayerWsClient;
exports.handleMessage = handleMessage;

exports.addClientToRoom = addClientToRoom;
exports.removeClientFromRoom = removeClientFromRoom;
exports.broadcastToRoom = broadcastToRoom;
exports.getRooms = getRooms;