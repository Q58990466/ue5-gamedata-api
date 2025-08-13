require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const PORT = Number(process.env.PORT || 4000);
const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.DB_NAME || 'experiment_system';
const COLLECTION = process.env.COLLECTION || 'experiments';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
const LINK_SECRET = process.env.EXTERNAL_LINK_SECRET || '';

if (!MONGODB_URI) {
	console.error('环境变量 MONGODB_URI 未配置');
	process.exit(1);
}

const app = express();

// CORS 配置：默认允许所有；或基于白名单
if (CORS_ORIGINS.length === 1 && CORS_ORIGINS[0] === '*') {
	app.use(cors());
} else {
	app.use(cors({ origin: (origin, cb) => {
		if (!origin) return cb(null, true);
		const allowed = CORS_ORIGINS.includes(origin);
		cb(allowed ? null : new Error('Not allowed by CORS'), allowed);
	}}));
}

app.use(express.json());

let mongoClient;
let collection;

async function initMongo() {
	mongoClient = new MongoClient(MONGODB_URI, { maxPoolSize: 10 });
	await mongoClient.connect();
	const db = mongoClient.db(DB_NAME);
	collection = db.collection(COLLECTION);
	console.log(`MongoDB 已连接 db=${DB_NAME} coll=${COLLECTION}`);
}

function pickFirstDefined(...values) {
	for (const v of values) {
		if (v !== undefined && v !== null && String(v).trim() !== '') return v;
	}
	return undefined;
}

function normalize(doc) {
	if (!doc) return null;
	return {
		_id: doc._id,
		sessionId: pickFirstDefined(doc.sessionId, doc.SessionId),
		userId: pickFirstDefined(doc.userId, doc.UserId),
		sessionName: doc.sessionName,
		smilePercentage: pickFirstDefined(doc.smilePercentage, doc.SmilePercentage),
		neutralPercentage: pickFirstDefined(doc.neutralPercentage, doc.NeutralPercentage),
		surprisedPercentage: pickFirstDefined(doc.surprisedPercentage, doc.SurprisedPercentage),
		totalExpressionCount: pickFirstDefined(doc.totalExpressionCount, doc.TotalExpressionCount),
		chatMessages: Array.isArray(doc.chatMessages) ? doc.chatMessages : [],
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
		startTime: doc.startTime,
		endTime: doc.endTime,
		metadata: doc.metadata,
		source: doc.source,
		serverInfo: doc.serverInfo || undefined
	};
}

app.get('/health', (req, res) => res.json({ ok: true }));

function tryDecodeToken(token) {
	if (!token || !LINK_SECRET) return null;
	try {
		const payload = jwt.verify(token, LINK_SECRET);
		return payload || null;
	} catch (e) {
		return null;
	}
}

// GET /api/experiments/external/:id
// 支持两种方式：
// 1) 明文 id 路由参数（MVP）
// 2) Authorization: Bearer <token>，token 里包含 sessionId/userId 等（可选增强）
app.get('/api/experiments/external/:id', async (req, res) => {
	let id = decodeURIComponent(req.params.id || '').trim();

	// 若带签名 token，则优先用 token 中的 sessionId
	const auth = req.headers.authorization || '';
	const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
	const decoded = tryDecodeToken(token);
	if (decoded?.sessionId) {
		id = String(decoded.sessionId);
	}

	if (!id) return res.status(400).json({ success: false, message: '缺少 id' });

	const or = [
		{ sessionId: id },
		{ SessionId: id },
		{ externalId: id },
		{ externalID: id }
	];
	if (ObjectId.isValid(id)) {
		or.push({ _id: new ObjectId(id) });
	}

	try {
		const doc = await collection.findOne({ $or: or });
		if (!doc) return res.status(404).json({ success: false, message: '未找到实验' });
		return res.json({ success: true, data: normalize(doc) });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, message: '服务器错误' });
	}
});

// 用于生成外链 token（仅测试用；生产应在上游平台生成）
// POST /api/links/sign  body: { sessionId, userId?, expSec? }
app.post('/api/links/sign', (req, res) => {
	if (!LINK_SECRET) return res.status(400).json({ message: '未配置 EXTERNAL_LINK_SECRET' });
	const { sessionId, userId, expSec = 300 } = req.body || {};
	if (!sessionId) return res.status(400).json({ message: '缺少 sessionId' });
	const token = jwt.sign({ sessionId, userId }, LINK_SECRET, { expiresIn: Number(expSec) });
	return res.json({ token, expiresIn: Number(expSec) });
});

initMongo()
	.then(() => {
		app.listen(PORT, () => console.log(`API 服务已启动 http://localhost:${PORT}`));
	})
	.catch((err) => {
		console.error('启动失败', err);
		process.exit(1);
	}); 