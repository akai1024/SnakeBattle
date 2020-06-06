// 靜態定義
const WS_PATH = '/ws';
const HEAD_IMG_FILE = 'avatar';
const C_PUBLIC_CHAT = 1001,
	S_PUBLIC_CHAT = 2001,
	C_JOIN_ROOM = 1101,
	S_JOIN_ROOM = 2101,
	C_GET_ROOMS = 1102,
	S_GET_ROOMS = 2102,
	S_UPDATE_ROOM_PLAYER = 2103
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


	},

	created() {
		let loginName = sessionStorage.getItem('loginName');
		let loginPwd = sessionStorage.getItem('loginPwd');
		if (loginName && loginPwd) {
			this.loginName = loginName;
			this.loginPwd = loginPwd;
			this.getPlayerInfos();
		}
	},

	mounted() {

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
			console.log('getRooms');
			this.sendWebSocketMessage(C_GET_ROOMS, {});
		},

		getRoomsResult(msgData) {
			if (!msgData) {
				return;
			}
			let roomList = [];
			for (room of msgData) {
				roomList.push(
					{
						id: room.id,
						title: room.title,
						playerSize: room.playerSize
					}
				);
			}
			this.rooms = roomList;
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
		}

	},
});
