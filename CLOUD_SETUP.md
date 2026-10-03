# 云开发接入指南（M4）

本项目已重构为「本地优先 + 云端镜像」架构：在**未配置云环境**时完全使用本地存储，App 行为与重构前一致；配置云环境后，训练记录与设置项会自动同步上云，并在换设备 / 重装后自动恢复。

> 当前 `project.config.json` 的 `appid` 为 `touristappid`（游客模式），**无法使用云开发**。请先替换为自己的小程序 AppID。

---

## 1. 准备工作

1. 注册并登录 [微信公众平台](https://mp.weixin.qq.com)，获取小程序的 **AppID**（设置 → 基本设置 → 账号信息）。
2. 在微信开发者工具中，右键项目根目录 → 「详情」→「本地设置」确认已勾选「使用云开发」（或直接在工具栏点击「云开发」按钮开通）。
3. 开通云开发后，在「云开发控制台 → 环境」中创建一个环境，记下 **环境 ID**（形如 `my-env-1a2b3c`）。

## 2. 替换 AppID 与环境 ID

- `project.config.json`：将 `"appid": "touristappid"` 改为你的真实 AppID。
- `utils/store.js`：将顶部常量
  ```js
  const CLOUD_ENV = '__CLOUD_ENV_ID__'
  ```
  改为你的环境 ID：
  ```js
  const CLOUD_ENV = 'my-env-1a2b3c'
  ```
  > 只要该常量仍包含 `__CLOUD_ENV_ID__` 占位符，所有云能力会自动跳过，App 退化为纯本地模式，绝不报错。

## 3. 创建数据库集合

在「云开发控制台 → 数据库」中新建两个集合：

| 集合名         | 用途                 | 权限建议            |
| -------------- | -------------------- | ------------------- |
| `pf_training`  | 训练记录（按设备隔离）| 仅创建者可读写      |
| `pf_settings`  | 设置项（按设备隔离）  | 仅创建者可读写      |

记录字段（由代码自动写入，无需手动建字段）：
- `pf_training`：`{ deviceId, date, timestamp, rounds, duration }`
- `pf_settings`：`{ deviceId, key, value }`

> 数据通过 `deviceId`（首次启动时本地生成的设备标识）隔离，无需登录即可区分多设备。**跨设备合并**当前未实现：换设备时若本地为空，会从云端拉回该设备曾写入的数据；若多设备同时产生数据，以各设备本地为准。如需按微信用户合并，可后续引入 `getWXContext().OPENID` 维度的集合设计。

## 4. 部署云函数

`cloudfunctions/sendReminder` 用于发送真实的订阅消息提醒（M2 缺失的最后一块）。

1. 在「微信公众平台 → 订阅消息」申请一个**训练提醒**类模板，记下 **模板 ID**。
2. `pages/settings/settings.js` 顶部：
   ```js
   const REMINDER_TEMPLATE_ID = 'YOUR_TEMPLATE_ID'
   ```
   改为你申请的真实模板 ID。
3. 在微信开发者工具中，右键 `cloudfunctions/sendReminder` → **「上传并部署：云端安装依赖」**。
4. （可选）在设置页开启提醒并授权后，点击「**发送测试提醒**」按钮，验证推送是否可达。

> 字段映射：云函数中 `data` 的键名（如 `thing1` / `time2`）需与你申请的模板字段一一对应，请按实际模板调整 `settings.js` 中 `sendTestReminder` 的 `data` 结构。

## 5. 关于「定时」推送

微信云函数**不能自身定时触发**，需要外部触发器：

- **方案 A（推荐，最简）**：用一台服务器或云托管写一个每天定时（cron）的 HTTP 任务，调用 `wx-server-sdk` 或 `cloud.callFunction` 触发 `sendReminder`。
- **方案 B**：使用微信云开发的「定时触发器」（需在 `config.json` 中声明 `triggers`，且通常要求已备案的正式环境）。
- **方案 C（当前已落地）**：用户在设置页开启提醒并完成订阅授权后，由「发送测试提醒」或你自己的业务后端主动调用云函数，立即推送。

无论哪种方案，`sendReminder` 云函数本身都已就绪，openid 通过 `cloud.getWXContext().OPENID` 自动获取，无需前端传递。

## 6. 数据流总览

```
训练完成 → training.js saveRecord → store.addHistory
                                     ├─ 本地 unshift + setStorage（永远成功）
                                     └─ 云端 pf_training.add（best-effort，失败静默降级）

首页 / 统计页读取 → store.getLocal('training_history')  ← 本地优先，最快
App 启动 → store.syncFromCloud()  ← 仅当本地为空且云已配置时，从 pf_training 拉回

设置项读写 → store.getSetting / setSetting
                                     ├─ 本地 setStorage
                                     └─ 云端 pf_settings upsert（best-effort）

真实推送 → settings.sendTestReminder → wx.cloud.callFunction('sendReminder')
                                     → 云函数 cloud.openapi.subscribeMessage.send
```

## 7. 排错

- **云函数调用报 `env` 未找到**：确认 `CLOUD_ENV` 已改为真实环境 ID，且云函数与该环境同属一个账号。
- **数据库权限报错**：将 `pf_training` / `pf_settings` 权限改为「仅创建者可读写」。
- **推送报 `user refuse to accept`**：用户未授权订阅消息，需在设置页重新开启提醒并允许订阅。
- **游客模式（touristappid）下云能力全失效**：这是预期行为，请替换为真实 AppID。
