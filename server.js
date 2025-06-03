const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// MongoDB配置
const MONGO_URI = "mongodb+srv://1602548618:FSso2pXJyZvLkLMR@cluster0.ik7sy3n.mongodb.net/?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true";
const DATABASE_NAME = "gamedata";

let db;
let client;

// 连接MongoDB
async function connectMongoDB() {
    if (db) return db;
    
    try {
        console.log('🔄 正在连接MongoDB...');
        client = new MongoClient(MONGO_URI);
        await client.connect();
        console.log('✅ 成功连接到MongoDB Atlas!');
        db = client.db(DATABASE_NAME);
        return db;
    } catch (error) {
        console.error('❌ MongoDB连接失败:', error.message);
        throw error;
    }
}

// 根路由
app.get('/', (req, res) => {
    res.json({
        message: '🎮 UE5游戏数据API服务器',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// 数据库状态检查接口
app.get('/api/db-status', async (req, res) => {
    try {
        const database = await connectMongoDB();
        await database.admin().ping();
        
        const collections = await database.listCollections().toArray();
        const sessionsCount = await database.collection('sessions').countDocuments();
        
        res.json({
            status: 'connected',
            database: DATABASE_NAME,
            collections: collections.map(c => c.name),
            sessionsCount: sessionsCount,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// 获取所有数据
app.get('/api/sessions', async (req, res) => {
    try {
        const database = await connectMongoDB();
        const sessions = await database.collection('sessions').find({}).toArray();
        
        res.json({
            success: true,
            count: sessions.length,
            data: sessions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 接收游戏数据
app.post('/api/sessions', async (req, res) => {
    try {
        const database = await connectMongoDB();
        const gameData = req.body;
        
        // 添加时间戳
        gameData.createdAt = new Date();
        
        const result = await database.collection('sessions').insertOne(gameData);
        
        res.json({
            success: true,
            message: '数据保存成功',
            insertedId: result.insertedId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Vercel 导出
module.exports = app;