# UE5游戏数据收集API

这是一个用于接收和存储UE5游戏数据的Node.js API服务器。

## 功能
- 接收UE5发送的游戏会话数据
- 存储到MongoDB数据库
- 提供数据查询和管理接口

## API接口
- `POST /api/sessions` - 接收游戏数据
- `GET /api/sessions` - 获取所有会话
- `GET /api/sessions/:id` - 获取特定会话
- `DELETE /api/sessions/:id` - 删除会话

## 部署
部署到Railway平台，支持自动扩展和高可用性。