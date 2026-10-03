// scripts/upload.js
// 微信小程序 CI 上传脚本（基于 miniprogram-ci，无需手动打开开发者工具）
//
// 用法：
//   1. cd scripts && npm install
//   2. 到微信公众平台「开发管理 → 开发设置 → 上传密钥」下载私钥，
//      重命名为 private.key 放在 scripts/ 目录下
//   3. 修改下方 APPID / VERSION / DESC
//   4. node upload.js
//
// 上传成功后，到公众平台「版本管理」选开发版提交审核即可。

const ci = require('miniprogram-ci')
const path = require('path')

const APPID = 'touristappid' // ← 替换为你的真实小程序 AppID
const PRIVATE_KEY_PATH = path.join(__dirname, 'private.key') // ← 上传密钥文件
const PROJECT_PATH = path.join(__dirname, '..') // 小程序根目录
const VERSION = '1.0.0'
const DESC = '盆底肌训练助手首个版本'

const project = new ci.Project({
  appid: APPID,
  type: 'mini',
  projectPath: PROJECT_PATH,
  privateKeyPath: PRIVATE_KEY_PATH,
  ignores: ['node_modules/**/*', 'scripts/**/*', '**/*.md']
})

ci.upload({
  project,
  version: VERSION,
  desc: DESC,
  setting: {
    es6: true,
    minify: true,
    autoPrefixWXSS: true
  }
}).then((res) => {
  console.log('✅ 上传成功，可到微信公众平台「版本管理」提交审核。')
  console.log(res)
}).catch((err) => {
  console.error('❌ 上传失败：', err)
  process.exit(1)
})
