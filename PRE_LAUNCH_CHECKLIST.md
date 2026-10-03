# 上架前代码体检报告

- 检查日期：2026-10-03
- 检查范围：全项目源码（pages / utils / app.js / 配置）

## 一、自动检查结果

| 检查项 | 结果 | 说明 |
|---|---|---|
| 隐私接口调用（getUserProfile / chooseLocation / chooseAddress / chooseMedia 等） | ✅ 未检出 | 代码未调用任何会触发隐私授权的接口 |
| 隐私授权弹窗 | ✅ 已接入 | `components/privacy-modal` + `app.js` 监听 `onNeedPrivacyAuthorization`；基于 `wx.getPrivacySetting` 自动弹出 |
| 医疗化敏感词（医疗/治疗/治愈/康复/疾病/处方…） | ✅ 未检出 | pages 目录全量扫描无命中 |
| 用户授权（订阅消息） | ✅ 已实现 | `settings.js` `requestSubscribeMessage` 已接 |
| sitemap.json | ✅ 存在 | 无构建告警 |
| 包体积 | ✅ 预计 < 200KB | 远小于主包 2MB 限制；无大图/音视频（音频需自放） |
| 设计令牌统一（方案 B 浅色） | ✅ 已统一 | app.wxss 注入 CSS 变量，全站引用 |

## 二、提交审核前必做（待整改）

- [ ] **替换 AppID**：`project.config.json` 的 `"appid": "touristappid"` → 真实 AppID；同步改 `scripts/upload.js` 的 `APPID`。
- [ ] **部署隐私协议 H5**：把 `privacy.json` 的 `privacyAgreement.url` 换成公网可访问页面（内容同 `pages/privacy/privacy`）。
- [ ] **提交隐私指引**：公众平台勾选「运动健身记录 / 其他」，**勿勾医疗健康**。
- [ ] **选类目**：运动健身（个人/企业均可），勿选医疗。
- [ ] **自测隐私弹窗**：开发者工具编译后，首次进入应弹出授权弹窗，点「查看协议」可跳转、点「同意」后可正常使用。
- [ ] **上传并提审**：开发者工具上传，或 `node scripts/upload.js`。

## 三、可选（非阻塞）

- [ ] 启用云开发（按 `CLOUD_SETUP.md`）：换设备恢复、真实定时推送。
- [ ] 放入语音音频 `assets/audio/hold.mp3` + `relax.mp3`（README.txt 已说明，缺失时自动降级）。
- [ ] 训练指数复合口径（M0 暂按「当日总分钟」，是否改回「时长×组数」待定）。

> 结论：代码侧已满足上架合规要求，剩余均为需你本人在微信公众平台操作的账号/资质/协议部署动作。
