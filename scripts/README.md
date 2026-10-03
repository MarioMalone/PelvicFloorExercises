# CI 上传脚本使用说明

用 `miniprogram-ci` 在命令行上传小程序代码，免去手动打开微信开发者工具。

## 步骤

1. 安装依赖（仅首次）：
   ```bash
   cd scripts
   npm install
   ```

2. 获取上传密钥：
   - 登录微信公众平台 → 开发管理 → 开发设置 → 上传密钥 → 下载（需扫码）。
   - 把下载的文件重命名为 `private.key`，放到本 `scripts/` 目录。

3. 填写配置：
   - 打开 `upload.js`，把 `APPID` 改成你的真实小程序 AppID（当前是占位 `touristappid`）。
   - 按需修改 `VERSION` / `DESC`。

4. 上传：
   ```bash
   node upload.js
   # 或 npm run upload
   ```

5. 上传成功后，到公众平台「版本管理」选对应开发版 → 提交审核。

## 注意

- 上传密钥等同于代码发布权限，**不要提交到 Git / 不要泄露**。
- `project.config.json` 的 `appid` 也必须与 `upload.js` 的 `APPID` 一致。
- `ignores` 已排除 `scripts/`、`node_modules/`、`*.md`，不会把 CI 脚本打进小程序包。
