// 靜態定義
const WS_PATH = '/ws';
const HEAD_IMG_FILE = 'avatar';
const
	// 聊天 0
	C_PUBLIC_CHAT = 1001,
	S_PUBLIC_CHAT = 2001,

	// 房間操作 1
	C_JOIN_ROOM = 1101,
	S_JOIN_ROOM = 2101,
	C_GET_ROOMS = 1102,
	S_GET_ROOMS = 2102,
	S_UPDATE_ROOM_PLAYER = 2103,
	C_START_BATTLE = 1104,
	S_START_BATTLE = 2104,

	// 戰場操作 2
	C_CHANGE_DIRECTION = 1201,
	S_UPDATE_FRAME = 2201
	;

const
	BLOCK_WIDTH = 20,
	FIELD_WIDTH = 25,
	FIELD_HEIGHT = 25,

	FACED_UP = 'up',
	FACED_DOWN = 'down',
	FACED_RIGHT = 'right',
	FACED_LEFT = 'left'
	;
const
	FIELD_COLOR = "#d6d6d6",
	TEAM_1_COLOR = "#5a5a5a",
	TEAM_1_HEAD_COLOR = "#5a5a5a",
	TEAM_2_COLOR = "#5a5a5a",
	TEAM_2_HEAD_COLOR = "#5a5a5a",
	TEAM_3_COLOR = "#5a5a5a",
	TEAM_3_HEAD_COLOR = "#5a5a5a",
	TEAM_4_COLOR = "#5a5a5a",
	TEAM_4_HEAD_COLOR = "#5a5a5a"
	;

var vue = new Vue({
	el: '#snakeBattle',
	vuetify: new Vuetify({
		theme: {
			dark: true,
		},
	}),

	data: {
		// 系統資料
		dialog: {
			enable: false,
			title: '',
			content: '',
		},
		isLogin: false,
		webSocket: null,
		fieldCtx: null,

		loginName: '',
		loginPwd: '',

		// 聊天資料
		chatMsgs: [],
		chatMsg: '',

		// 玩家資料
		player: {
			name: 'unknown',
		},

		// 房間資料
		rooms: [],
		isInRoom: false,
		room: null,

		// 戰場資料
		isStartBattle: false,

	},

	created() {
		let loginName = sessionStorage.getItem('loginName');
		let loginPwd = sessionStorage.getItem('loginPwd');
		if (loginName && loginPwd) {
			this.loginName = loginName;
			this.loginPwd = loginPwd;
			this.getPlayerInfos();
		}

		// 鍵盤事件
		window.addEventListener('keydown', this.keyPressEvt);
		window.addEventListener('keypress', this.keyPressEvt);
	},

	mounted() {

	},

	beforeDestroy() {
		window.removeEventListener('keydown', this.keyPressEvt);
		window.removeEventListener('keypress', this.keyPressEvt);
	},

	updated() {
		// 每次更新把訊息捲到最底下 不會用這個方式，先暫時把最新訊息放在最前面
		// this.$vuetify.goTo(this.$refs.chatMsgList,
		// 	{
		// 		duration: 300,
		// 		offset:0,
		// 		easing: 'easeOutQuint'
		// 	}
		// );

		// 每次更新時判斷如果在遊戲房內，設定畫布的參考資訊
		if (this.isInRoom) {
			if (!this.isFieldCreated) {
				let canvas = this.$refs.snakeField;
				canvas.width = FIELD_WIDTH * BLOCK_WIDTH;
				canvas.height = FIELD_HEIGHT * BLOCK_WIDTH;
				this.fieldCanvas = canvas;
				this.fieldCtx = canvas.getContext('2d');
				this.drawField();

				console.log('create canvas success');
				this.isFieldCreated = true;
			}
		} else {
			if (this.isFieldCreated) {
				this.fieldCanvas = null;
				this.fieldCtx = null;

				console.log('destroy canvas success');
				this.isFieldCreated = false;
			}
		}
	},

	computed: {

	},

	methods: {

		postData(path, data, callback) {
			let url = 'http://' + window.location.host + path;
			let requestBody = data ? JSON.stringify(data) : '{}';
			console.log('url:' + url + 'requestBody: ' + requestBody);
			// Default options are marked with *
			return fetch(url, {
				body: requestBody, // must match 'Content-Type' header
				// cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
				// credentials: 'same-origin', // include, same-origin, *omit
				headers: {
					// 'user-agent': 'Mozilla/4.0 MDN Example',
					'content-type': 'application/json'
				},
				method: 'POST', // *GET, POST, PUT, DELETE, etc.
				// mode: 'cors', // no-cors, cors, *same-origin
				// redirect: 'follow', // manual, *follow, error
				// referrer: 'no-referrer', // *client, no-referrer
			})
				.then(response => (response) ? response.json() : "empty response")// 輸出成 json
				.then(response => callback(response))
				;
		},

		// 鍵盤事件
		keyPressEvt(e) {
			if (this.isStartBattle) {
				let keyCode = e.keyCode;
				// right
				if (keyCode == 39) {
					this.changeFaced(FACED_RIGHT);
				}
				// left
				else if (keyCode == 37) {
					this.changeFaced(FACED_LEFT);
				}
				// up
				else if (keyCode == 38) {
					this.changeFaced(FACED_UP);
				}
				// down
				else if (keyCode == 40) {
					this.changeFaced(FACED_DOWN);
				}
			}
		},

		showDialog(title, content = '') {
			this.dialog.enable = true;
			this.dialog.title = title;
			this.dialog.content = content;
		},

		getPlayerInfos() {
			if (!this.loginName || !this.loginPwd) {
				return;
			}
			console.log('getPlayerInfos...');
			this.postData('/getPlayerInfos', { name: this.loginName, pwd: this.loginPwd }, this.getPlayerInfoResult);
		},

		getPlayerInfoResult(response) {
			console.log('getPlayerInfoResult:', response);
			if (this.loginName === response.name) {
				// response是server的player結構
				this.player.name = response.name;
				this.player.headImg = response.headImg;

				// 寫入session暫存
				sessionStorage.setItem('loginName', this.loginName);
				sessionStorage.setItem('loginPwd', this.loginPwd);

				// 連線到webSocket
				this.connectWebSocket(response.token, this.handleWebSocketMessage);
			} else {
				this.showDialog('Error', response.errMsg);
			}
		},

		// 建立webSocket連線
		connectWebSocket(token, handleMessage) {
			let url = `ws://${window.location.host}${WS_PATH}?token=${token}&name=${this.loginName}`;
			let webSocket = new WebSocket(url);

			webSocket.onopen = (event) => {
				console.log('connect to websocket server...', event);
				this.isLogin = true;
				this.getRooms();
			};

			webSocket.onclose = (event) => {
				console.log('close from websocket server...', event);
				this.isLogin = false;
				this.rooms = [];
				this.isInRoom = false;
				this.room = null;
			};

			webSocket.onerror = (event) => {
				console.log('error!', event);
			};

			webSocket.onmessage = (event) => {
				let message = event.data;
				console.log('receive message ', message);
				handleMessage(JSON.parse(message));
			};

			this.webSocket = webSocket;
		},

		handleWebSocketMessage(message) {
			let msgCode = message.code;
			let msgData = message.data;
			switch (msgCode) {
				case S_PUBLIC_CHAT: {
					this.receiveChatMessage(msgData);
					break;
				}
				case S_GET_ROOMS: {
					this.getRoomsResult(msgData);
					break;
				}
				case S_JOIN_ROOM: {
					this.joinRoomResult(msgData);
					break;
				}
				case S_UPDATE_ROOM_PLAYER: {
					this.updateRoomPlayers(msgData);
					break;
				}
				case S_START_BATTLE: {
					this.startBattleResult(msgData);
					break;
				}
				case S_UPDATE_FRAME: {
					this.receiveUpdateFrame(msgData);
					break;
				}

				default: {
					console.log('undefined msgCode ', msgCode);
					break;
				}
			}
		},

		sendWebSocketMessage(msgCode, msgData) {
			console.log('sendWebSocketMessage ', msgCode, msgData);
			this.webSocket.send(JSON.stringify(
				{
					code: msgCode,
					data: msgData
				}
			));
		},

		getHeadImg(headImg) {
			let img = '';
			if (this.player) {
				if (headImg) {
					img = `${HEAD_IMG_FILE}/${headImg}`;
				} else {
					img = `${HEAD_IMG_FILE}/${this.player.headImg}`;
				}
			}
			return img;
		},

		getRooms() {
			this.sendWebSocketMessage(C_GET_ROOMS, {});
		},

		getRoomsResult(msgData) {
			if (!msgData) {
				return;
			}
			// server直接整理成客戶端的格式
			this.rooms = msgData;
		},

		isRoomHost() {
			return this.room && this.room.hostName === this.loginName;
		},

		joinRoom(roomId) {
			let id = roomId ? roomId : 0;
			this.sendWebSocketMessage(C_JOIN_ROOM,
				{
					roomId: id,
					playerName: this.player.name
				}
			);
		},

		leaveRoom() {
			this.sendWebSocketMessage(C_JOIN_ROOM,
				{
					roomId: this.room.id,
					playerName: this.player.name,
					isLeave: true
				}
			);
		},

		joinRoomResult(msgData) {
			if (msgData.isSuccess) {
				if (msgData.isLeave) {
					// 離開房間
					this.room = null;
					this.isInRoom = false;
					this.isStartBattle = false;
				} else {
					// 取得房間資訊
					let roomData = msgData.room;
					if (roomData) {
						this.room = roomData;
						this.isInRoom = true;
					}
				}
			}
		},

		updateRoomPlayers(msgData) {
			if (this.isInRoom) {
				this.room.players = msgData.players;
				this.room.hostName = msgData.hostName;
			}
		},

		sendChatMessage() {
			if (!this.chatMsg) {
				return;
			}
			this.sendWebSocketMessage(C_PUBLIC_CHAT,
				{
					speaker: this.loginName,
					headImg: this.player.headImg,
					content: this.chatMsg
				}
			);
			this.chatMsg = '';
		},

		receiveChatMessage(msgData) {
			if (msgData) {
				msgData.date = new Date().toString();
				this.chatMsgs.unshift(msgData);
				if (this.chatMsgs.length > 200) {
					this.chatMsgs.splice(this.chatMsg.length - 1, 1);
				}
				console.log(`msgSize:${this.chatMsgs.length}`);
			}
		},

		startBattle() {
			if (this.isInRoom && this.isRoomHost()) {
				this.sendWebSocketMessage(C_START_BATTLE,
					{
						playerName: this.player.name
					}
				);
			}
		},

		startBattleResult(msgData) {
			// 把場地清空
			this.drawField();
			
			if (msgData.isStart) {
				this.isStartBattle = true;
				console.log('Battle Start!!!');

				let battleField = msgData.battleField;
				// 畫出每一條蛇
				for (let playerName in battleField.players) {
					let player = battleField.players[playerName];
					for (let block of player.body) {
						this.drawBlock(block[0], block[1], TEAM_1_COLOR);// 先用第一隊測試顏色
					}
				}
				// 畫出食物
				let food = battleField.food;
				if (food) {
					this.drawBlock(food[0], food[1], TEAM_1_COLOR);// 先用第一隊測試顏色
				}
			}
		},

		drawField() {
			let canvas = this.fieldCanvas;
			let ctx = this.fieldCtx;
			// 畫滿背景
			ctx.fillStyle = FIELD_COLOR;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		},

		drawBlock(x, y, color) {
			let context = this.fieldCtx;
			context.fillStyle = color;
			context.fillRect(x * BLOCK_WIDTH, y * BLOCK_WIDTH, BLOCK_WIDTH, BLOCK_WIDTH);
		},

		changeFaced(faced) {
			this.sendWebSocketMessage(C_CHANGE_DIRECTION,
				{
					playerName: this.player.name,
					faced: faced
				}
			);
		},

		receiveUpdateFrame(msgData) {
			// 畫上新的頭
			let newHeads = msgData.newHeads;
			for (let head of newHeads) {
				let playerName = head.playerName;
				let newHead = head.newHead;
				this.drawBlock(newHead[0], newHead[1], TEAM_1_COLOR);// 先用第一隊測試顏色
			}

			// 移除尾巴
			let removeTails = msgData.removeTails;
			for (let tail of removeTails) {
				let playerName = tail.playerName;
				let removeTail = tail.removeTail;
				// 畫上場地的顏色
				this.drawBlock(removeTail[0], removeTail[1], FIELD_COLOR);
			}

			// 畫新的食物
			let newFood = msgData.newFood;
			if (newFood) {
				this.drawBlock(newFood[0], newFood[1], TEAM_1_COLOR);// 先用第一隊測試顏色
			}

			// 遊戲結束
			if (msgData.isGameOver) {
				this.isStartBattle = false;
			}
		},

	},
});
