const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 支持环境变量的MongoDB连接
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DATABASE_NAME = "gamedata";

let db;

async function connectDB() {
    if (db) return db;
    
    try {
        console.log('🔄 连接MongoDB...');
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DATABASE_NAME);
        console.log('✅ MongoDB连接成功！');
        return db;
    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
        throw error;
    }
}

// 根路由
app.get('/', (req, res) => {
    res.json({
        message: '🎮 UE5游戏数据API服务器',
        database: MONGO_URI.includes('localhost') ? '本地MongoDB' : 'MongoDB Atlas',
        status: 'running',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// 数据库状态
app.get('/api/db-status', async (req, res) => {
    try {
        const database = await connectDB();
        const count = await database.collection('sessions').countDocuments();
        
        res.json({
            status: 'connected',
            database: MONGO_URI.includes('localhost') ? '本地MongoDB' : 'MongoDB Atlas',
            sessionsCount: count,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 接收UE5数据
app.post('/api/sessions', async (req, res) => {
    try {
        const database = await connectDB();
        const gameData = req.body;
        
        gameData.createdAt = new Date();
        gameData.source = 'UE5';
        gameData.serverInfo = {
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString()
        };
        
        const result = await database.collection('sessions').insertOne(gameData);
        
        console.log('📝 收到UE5数据:', gameData.sessionId);
        
        res.json({
            success: true,
            message: '数据保存成功',
            id: result.insertedId,
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        console.error('❌ 保存数据失败:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// 查看所有数据
app.get('/api/sessions', async (req, res) => {
    try {
        const database = await connectDB();
        const sessions = await database.collection('sessions').find({}).sort({ createdAt: -1 }).toArray();
        
        res.json({
            success: true,
            count: sessions.length,
            data: sessions
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 启动服务器
async function start() {
    try {
        await connectDB();
        
        app.listen(PORT, () => {
            console.log(`🚀 API服务器启动成功！`);
            console.log(`📡 端口: ${PORT}`);
            console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
            console.log(`💾 数据库: ${MONGO_URI.includes('localhost') ? '本地MongoDB' : 'MongoDB Atlas'}`);
        });
    } catch (error) {
        console.error('❌ 启动失败:', error.message);
    }
}

start();