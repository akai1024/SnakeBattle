const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1/snakeBattle', { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });
mongoose.Promise = global.Promise;

let db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// 定義schema
/** 
 * mongoose的所有資料型別:
 * String
 * Number
 * Date
 * Buffer
 * Boolean
 * Mixed
 * ObjectId
 * Array
 * Decimal128
 * Map
 * 
*/
let Schema = mongoose.Schema;

// Token 暫時先用cache儲存token減少流程的複雜度
// let TokenModel = mongoose.model('token',
//     new Schema(
//         {
//             playerName: { type: String, required: true, unique: true },
//         },
//         { versionKey: false }
//     )
// );

// 玩家
let PlayerModel = mongoose.model('player',
    new Schema(
        {
            name: { type: String, required: true, unique: true },
            salt: String,
            pwd: String,
            headImg: String
        },
        { versionKey: false }
    )
);

exports.db = db;
// exports.TokenModel = TokenModel;
exports.PlayerModel = PlayerModel;
