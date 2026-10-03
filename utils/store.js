// utils/store.js
// 统一数据存储层（M4 云化）
// 设计原则：本地优先（离线/无云环境时完全可用），云端镜像（配置云环境后自动同步）。
// 未配置 CLOUD_ENV 时，本模块退化为纯本地存储，App 行为与 M3 完全一致，绝不报错。

// TODO(M4): 将下方占位符替换为你自己的云开发环境 ID（在微信开发者工具「云开发」控制台查看）
const CLOUD_ENV = '__CLOUD_ENV_ID__'

const COLL_TRAINING = 'pf_training'   // 训练记录集合
const COLL_SETTINGS = 'pf_settings'   // 设置项集合（key-value）

let _cloudReady = false
let _deviceId = null

// 是否已正确配置云环境（占位符未替换 / 无 wx.cloud 时返回 false）
function isCloudConfigured() {
  return typeof wx !== 'undefined' &&
    wx.cloud &&
    typeof wx.cloud.database === 'function' &&
    CLOUD_ENV &&
    CLOUD_ENV.indexOf('__CLOUD_ENV_ID__') === -1
}

// 幂等初始化云环境；失败静默降级为本地
function ensureCloud() {
  if (_cloudReady) return true
  if (!isCloudConfigured()) return false
  try {
    wx.cloud.init({ env: CLOUD_ENV, traceUser: true })
    _cloudReady = true
  } catch (e) {
    _cloudReady = false
  }
  return _cloudReady
}

// 设备标识：用于云端数据隔离（无需登录即可区分不同设备）
function deviceId() {
  if (_deviceId) return _deviceId
  let id = wx.getStorageSync('pf_device_id')
  if (!id) {
    id = 'd_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
    wx.setStorageSync('pf_device_id', id)
  }
  _deviceId = id
  return id
}

// ---------- 同步本地读写（启动期 / 无需云的读取，保持原同步语义） ----------
function getLocal(key, def) {
  const v = wx.getStorageSync(key)
  return (v === '' || v === undefined || v === null) ? def : v
}

function setLocal(key, val) {
  wx.setStorageSync(key, val)
}

// ---------- 训练记录 ----------
// 读取：本地为准（快速、可靠）
function getHistory() {
  return getLocal('training_history', [])
}

// 写入：本地优先 + 云端镜像（best-effort，失败不影响本地）
function addHistory(record) {
  const history = getLocal('training_history', [])
  history.unshift(record)
  setLocal('training_history', history)

  if (ensureCloud()) {
    try {
      wx.cloud.database().collection(COLL_TRAINING).add({
        data: Object.assign({ deviceId: deviceId() }, record)
      })
    } catch (e) {
      // 云端写入失败不影响本地，静默降级
    }
  }
  return Promise.resolve()
}

// 清空：本地 + 云端
function clearHistory() {
  setLocal('training_history', [])
  if (ensureCloud()) {
    try {
      wx.cloud.database().collection(COLL_TRAINING)
        .where({ deviceId: deviceId() })
        .remove({})
    } catch (e) {}
  }
  return Promise.resolve()
}

// 从云端恢复：仅当本地为空且云已配置（换设备 / 重装后拉回历史）
function syncFromCloud() {
  return new Promise(function (resolve) {
    if (!ensureCloud()) return resolve(false)
    const local = getLocal('training_history', [])
    if (local.length > 0) return resolve(false) // 本地有数据则不覆盖

    try {
      wx.cloud.database().collection(COLL_TRAINING)
        .where({ deviceId: deviceId() })
        .orderBy('timestamp', 'desc')
        .limit(1000)
        .get({
          success: function (res) {
            if (res.data && res.data.length) {
              const list = res.data
                .map(function (d) {
                  return { date: d.date, timestamp: d.timestamp, rounds: d.rounds, duration: d.duration }
                })
                .sort(function (a, b) { return b.timestamp - a.timestamp })
              setLocal('training_history', list)
              resolve(true)
            } else {
              resolve(false)
            }
          },
          fail: function () { resolve(false) }
        })
    } catch (e) {
      resolve(false)
    }
  })
}

// ---------- 设置项（key-value） ----------
// 读取：本地为准
function getSetting(key, def) {
  return getLocal(key, def)
}

// 写入：本地 + 云端镜像（best-effort）
function setSetting(key, val) {
  setLocal(key, val)
  if (ensureCloud()) {
    try {
      const db = wx.cloud.database()
      db.collection(COLL_SETTINGS)
        .where({ deviceId: deviceId(), key: key })
        .get({
          success: function (res) {
            if (res.data && res.data.length) {
              db.collection(COLL_SETTINGS).doc(res.data[0]._id).update({ data: { value: val } })
            } else {
              db.collection(COLL_SETTINGS).add({ data: { deviceId: deviceId(), key: key, value: val } })
            }
          },
          fail: function () {
            db.collection(COLL_SETTINGS).add({ data: { deviceId: deviceId(), key: key, value: val } })
          }
        })
    } catch (e) {}
  }
  return Promise.resolve()
}

module.exports = {
  CLOUD_ENV: CLOUD_ENV,
  isCloudConfigured: isCloudConfigured,
  ensureCloud: ensureCloud,
  getLocal: getLocal,
  setLocal: setLocal,
  getHistory: getHistory,
  addHistory: addHistory,
  clearHistory: clearHistory,
  syncFromCloud: syncFromCloud,
  getSetting: getSetting,
  setSetting: setSetting
}
