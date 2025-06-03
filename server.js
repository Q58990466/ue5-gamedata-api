const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// MongoDB配置
const MONGO_URI = "mongodb+srv://1602548618:FSso2pXJyZvLkLMR@cluster0.ik7sy3n.mongodb.net/?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true";
const DATABASE_NAME = "gamedata";

let db;
let client;

// 连接MongoDB并测试
async function testMongoDB() {
    try {
        console.log('🔄 正在连接MongoDB...');
        client = new MongoClient(MONGO_URI);
        await client.connect();
        
        console.log('✅ 成功连接到MongoDB Atlas!');
        
        db = client.db(DATABASE_NAME);
        
        // 测试数据库操作
        const collections = await db.listCollections().toArray();
        console.log('📋 数据库中的集合:', collections.map(c => c.name));
        
        // 测试sessions集合
        const sessionsCollection = db.collection('sessions');
        const count = await sessionsCollection.countDocuments();
        console.log(`📊 sessions集合中有 ${count} 条记录`);
        
        // 获取一条示例数据
        if (count > 0) {
            const sample = await sessionsCollection.findOne();
            console.log('📄 示例数据:', JSON.stringify(sample, null, 2));
        }
        
        return true;
    } catch (error) {
        console.error('❌ MongoDB连接失败:', error.message);
        return false;
    }
}

// 根路由
app.get('/', (req, res) => {
    res.json({
        message: '🎮 UE5游戏数据API服务器',
        database: db ? 'Connected' : 'Disconnected',
        timestamp: new Date().toISOString()
    });
});

// 数据库状态检查接口
app.get('/api/db-status', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({
                status: 'disconnected',
                message: '数据库未连接'
            });
        }
        
        // 测试数据库连接
        await db.admin().ping();
        
        // 获取集合信息
        const collections = await db.listCollections().toArray();
        const sessionsCount = await db.collection('sessions').countDocuments();
        
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
        if (!db) {
            return res.status(500).json({ error: '数据库未连接' });
        }
        
        const sessions = await db.collection('sessions').find({}).toArray();
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

// 启动服务器
async function startServer() {
    const connected = await testMongoDB();
    
    app.listen(PORT, () => {
        console.log(`🚀 服务器运行在端口 ${PORT}`);
        console.log(`📡 测试地址:`);
        console.log(`   http://localhost:${PORT} - 服务器信息`);
        console.log(`   http://localhost:${PORT}/api/db-status - 数据库状态`);
        console.log(`   http://localhost:${PORT}/api/sessions - 查看所有数据`);
        
        if (!connected) {
            console.log('⚠️  数据库连接失败，但服务器仍在运行');
        }
    });
}

startServer().catch(console.error);