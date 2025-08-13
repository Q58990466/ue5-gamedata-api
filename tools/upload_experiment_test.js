#!/usr/bin/env node
/* 省略原注释，新增：
  支持签名外链：
    - 方式1：本地拼 JWT（不实现，避免泄露密钥）
    - 方式2：调用后端 /api/links/sign 生成 token（推荐）
  使用：
    node tools/upload_experiment_test.js --session xxx --sign 1 --api_base http://192.168.0.17:4000 --frontend_base http://192.168.0.17:3000
*/

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function ensureFetch() {
  if (typeof fetch === 'function') return fetch;
  try { return require('node-fetch'); } catch (e) { console.error('缺少 fetch，请 npm i node-fetch'); process.exit(1); }
}

function getArg(name, defVal) {
  const idx = process.argv.findIndex(a => a === `--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env[name.toUpperCase()] || defVal;
}

function isoNow() { return new Date().toISOString(); }

function buildMoreDetailUrl({ sessionId, apiBase, frontendBase, token }) {
  const base = (frontendBase || 'http://localhost:3000').replace(/\/$/, '');
  const api = (apiBase || 'http://localhost:4000');
  const u = new URL(base + '/simple-experiment/index.html');
  if (sessionId) u.searchParams.set('sessionId', sessionId);
  u.searchParams.set('api', api);
  if (token) u.searchParams.set('token', token);
  return u.toString();
}

async function login(fetchFn, apiBase, phone, password) {
  const url = `${apiBase}/api/auth/login`;
  const res = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  if (!res.ok) throw new Error(`登录失败 HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.token) throw new Error('登录响应无 token');
  return json.token;
}

async function findStudent(fetchFn, apiBase, token, phone, studentId) {
  const url = `${apiBase}/api/users?role=student&q=${encodeURIComponent(phone || studentId || '')}`;
  const res = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`查询学生失败 HTTP ${res.status}`);
  const list = await res.json();
  if (Array.isArray(list)) { return list.find(u => (phone && u.phone === phone) || (studentId && u.studentId === studentId)) || null; }
  return null;
}

async function createStudent(fetchFn, apiBase, token, payload) {
  const url = `${apiBase}/api/users`;
  const res = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`创建学生失败 HTTP ${res.status}`);
  return await res.json();
}

async function uploadScore(fetchFn, apiBase, token, userId, body) {
  const url = `${apiBase}/api/scores/user/${encodeURIComponent(userId)}`;
  const res = await fetchFn(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`上传成绩失败 HTTP ${res.status}`);
  return await res.json();
}

async function signToken(fetchFn, apiBase, sessionId) {
  const url = `${apiBase}/api/links/sign`;
  const res = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, expSec: Number(getArg('expSec', '300')) }) });
  if (!res.ok) throw new Error(`签名失败 HTTP ${res.status}`);
  const json = await res.json();
  return json?.token;
}

(async () => {
  const fetchFn = await ensureFetch();

  const API_BASE = (getArg('api_base', 'http://localhost:4000')).replace(/\/$/, '');
  const FRONTEND_BASE = getArg('frontend_base', 'http://localhost:3000');
  const ADMIN_PHONE = getArg('admin_phone', '13800000000');
  const ADMIN_PASSWORD = getArg('admin_password', 'admin123');

  const COURSE = getArg('course', 'DEMO-EXP');
  const SESSION = getArg('session', '').trim();
  const MODULE = getArg('module', '001');
  const SCORE = Number(getArg('score', '88'));
  const MAX_SCORE = Number(getArg('maxScore', '100'));
  const USE_SIGN = Boolean(Number(getArg('sign', '0')));

  const STUDENT_NAME = getArg('student_name', '张三');
  const STUDENT_PHONE = getArg('student_phone', '13700000001');
  const STUDENT_ID = getArg('student_id', 'A101');
  const CLASS_NAME = getArg('class_name', '演示一班');

  if (!SESSION) { console.error('缺少 --session <SESSION_ID>'); process.exit(1); }

  console.log(`[1/5] 登录 ${API_BASE} ...`);
  const token = await login(fetchFn, API_BASE, ADMIN_PHONE, ADMIN_PASSWORD);
  console.log('  -> 登录成功');

  console.log(`[2/5] 查找/创建学生 ${STUDENT_NAME} (${STUDENT_PHONE}/${STUDENT_ID}) ...`);
  let student = await findStudent(fetchFn, API_BASE, token, STUDENT_PHONE, STUDENT_ID);
  if (!student) {
    student = await createStudent(fetchFn, API_BASE, token, { name: STUDENT_NAME, phone: STUDENT_PHONE, studentId: STUDENT_ID, className: CLASS_NAME, role: 'student', password: '111111' });
    console.log('  -> 学生已创建:', student?.id || student?._id || student?.phone);
  } else { console.log('  -> 已存在学生:', student?.id || student?._id || student?.phone); }

  let linkToken = null;
  if (USE_SIGN) {
    console.log(`[3/5] 生成签名 token (有效期 ${getArg('expSec', '300')}s) ...`);
    linkToken = await signToken(fetchFn, API_BASE, SESSION);
    console.log('  -> token 生成成功');
  }

  const moreDetail = buildMoreDetailUrl({ sessionId: USE_SIGN ? '' : SESSION, apiBase: API_BASE, frontendBase: FRONTEND_BASE, token: linkToken });
  const payload = { courseId: COURSE, moduleScores: [{ moduleId: MODULE, score: SCORE, maxScore: MAX_SCORE, completedAt: isoNow(), moreDetail }] };

  console.log(`[4/5] 上传模块成绩 course=${COURSE} module=${MODULE} score=${SCORE} ...`);
  const up = await uploadScore(fetchFn, API_BASE, token, (student.id || student._id), payload);

  console.log('[5/5] 成功，返回聚合后的当前成绩:');
  console.log(JSON.stringify(up, null, 2));
  console.log('\n外链:');
  console.log(moreDetail);
})(); 