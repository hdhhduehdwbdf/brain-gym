# 脑力健身房 🧠

一个本地优先的轻量认知训练站点：5 个小测试 + 对话框智能推荐 + 成绩总览，前端零框架、后端零依赖，手机浏览器体验优先。

> 所有界面与交互为原创设计；内容参考公开的认知训练方法（舒尔特方格、数字广度、4-7-8 呼吸、记忆宫殿、结构化表达练习），仅供自我训练，不构成医疗建议。

## 功能总览

| 模块 | 说明 |
|---|---|
| 🏠 大厅首页 | 打卡连击条、14 天热度图、对话框需求匹配推荐、训练宫格入口 |
| 🎯 舒尔特方格 | 5×5 / 6×6 / 7×7，正序 / 倒序 / 变色干扰三模式，点错统计、成绩评级、结算弹窗 |
| 🔢 数字广度 | 倒背 / 正背，记忆时长可调（1.2s / 3s / 5s），数字键盘作答，答错自动降档 |
| 🫁 4-7-8 呼吸 | 动画圆球引导，助眠 / 平衡 / 方盒三种节奏，轮次进度点 |
| 🏛️ 记忆宫殿 | 布置路线 → 闭眼回忆 → 核对加固三步流程，次日复习提醒 |
| 🎤 表达高压舱 | 10 秒准备倒计时、60 秒结构表达（结论→依据→动作）、可选录音回听、三维自评 |
| 🚦 Go / No-Go | 绿点快按、红点忍住，冲动抑制（Commission Error）直接刻度 |
| 🎨 Stroop 色词 | 字义与颜色冲突，干扰抑制能力测量 |
| ⚡ 反应速度 | 简单反应时（Donders 范式），状态警觉度快速体检 |
| 🧩 Corsi 方块 | 空间工作记忆跨度 |
| ➰ 连线测试 TMT | 视觉搜索 + 认知灵活性 |
| 🔁 N-back | 工作记忆动态负荷 |
| 🔄 心理旋转 | 空间想象与图像旋转 |
| ✏️ 符号译码 SDMT | 加工速度（注意/运动） |
| 🎭 DRM 误记忆 | 记忆准确性与误报率 |
| ⏳ 延迟折扣 | 冲动/拖延倾向的自我评估 |
| 📈 成绩总览 | 每日目标环、连击天数、最近 7 天打卡、全部 15 项最佳、活动流水 |

## 技术架构

```
纯静态前端（HTML/CSS/JS，无构建步骤）
        │  fetch /api/*
        ▼
Node 内置 http 模块（server/server.js，零 npm 依赖）
        │  读写
        ▼
server/data/db.json（单文件 JSON 存储，原子写入）
```

- **本地优先**：所有数据先写 localStorage（离线可用、界面即时响应），再通过发件箱（outbox）异步同步到服务器，网络恢复自动补发。
- **多设备一致**：页面加载时从服务器拉取状态，按时间戳/更优值合并；首次使用自动把旧本地数据迁移上服务器。
- **服务器不可达**：静默降级为纯本地模式（`document.documentElement.dataset.sync` 标记 `on/off`），功能不受影响。

## 快速开始

环境要求：Node.js ≥ 18（无需 npm install）

```bash
node server/server.js
```

打开 `http://localhost:8787` 即可。同一局域网的手机访问 `http://<电脑IP>:8787`。

自定义端口：

```bash
PORT=9000 node server/server.js
```

## 项目结构

```
brain-gym/
├── index.html              # 大厅首页（对话框推荐 + 宫格）
├── progress.html           # 成绩总览
├── assets/
│   ├── style.css           # 共享设计系统（深色主题、组件样式、动画）
│   ├── app.js              # BT 公共库：存储、活动流水、连击、成绩摘要
│   └── sync.js             # 前后端同步层：发件箱、合并、迁移、离线降级
├── tests/
│   ├── schulte.html        # 舒尔特方格
│   ├── digit.html          # 数字广度
│   ├── breathing.html      # 4-7-8 呼吸
│   ├── palace.html         # 记忆宫殿
│   └── pressure.html       # 表达高压舱
├── server/
│   ├── server.js           # HTTP 服务 + API + 静态文件
│   └── data/db.json        # 运行时自动生成的数据文件（不入库）
└── .claude/launch.json     # 本地预览配置
```

## API 文档

所有接口均为 JSON；`date` 字段格式 `YYYY-MM-DD`，缺省为当天。

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET /api/health` | 健康检查 → `{ok, now}` |
| `GET /api/state` | 全量状态 → `{activity, scores, updatedAt}` |
| `POST /api/activity` | 记一次练习流水，body: `{testId, extra?}` |
| `POST /api/scores/schulte` | body: `{mode: asc\|desc\|color, sec, date?}`，自动保留各模式最佳 |
| `POST /api/scores/digit` | body: `{len, date?}`，自动保留每日最大位数 |
| `POST /api/scores/breathing` | body: `{cycles, preset, date?}` |
| `POST /api/scores/palace` | body: `{correct, total, pct?, date?}` |
| `POST /api/scores/pressure` | body: `{q?, pack?, duration, speed?, struct?, content?, rating, date?}` |
| `POST /api/migrate` | 一次性迁移旧本地数据 `{activity[], scores{}}` |
| `POST /api/reset` | 清空全部数据 |

非法载荷返回 `400`；服务端口 `8787`，静态文件与 API 同源。

## 数据与隐私

- 所有训练数据仅存在于你自己的服务器文件（`server/data/db.json`）与浏览器本地，无任何第三方上报。
- 清空浏览器缓存或删除 db.json 即完全删除数据。
