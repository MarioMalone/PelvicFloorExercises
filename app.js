App({
  onLaunch: function () {
    // 云开发初始化（未配置 CLOUD_ENV 时自动跳过，App 仍可用本地存储）
    const store = require('./utils/store.js')
    store.ensureCloud()
    // 换设备 / 重装后，从云端恢复历史（仅当本地为空时）
    store.syncFromCloud()

    // 检查更新
    const updateManager = wx.getUpdateManager()
    updateManager.onCheckForUpdate(function (res) {
      if (res.hasUpdate) {
        updateManager.onUpdateReady(function () {
          wx.showModal({
            title: '更新提示',
            content: '新版本已经准备好，是否重启应用？',
            success: function (res) {
              if (res.confirm) {
                updateManager.applyUpdate()
              }
            }
          })
        })
      }
    })
    // 初始化训练计划：优先使用用户设置，否则使用默认值
    const customPlan = store.getLocal('custom_plan')
    if (customPlan) {
      this.globalData.currentPlan = customPlan
    }

    // 隐私授权：注册监听（当调用隐私接口时由微信触发，弹窗组件在用户同意后 resolve）
    if (typeof wx.onNeedPrivacyAuthorization === 'function') {
      wx.onNeedPrivacyAuthorization((resolve) => {
        this.globalData.privacyResolve = resolve
      })
    }
  },
  globalData: {
    userInfo: null,
    currentPlan: {
      holdTime: 3, // 收缩时间(秒)
      relaxTime: 3, // 放松时间(秒)
      repeats: 10   // 循环次数
    },
    // 预设方案（与 PRD 3.2 对应）：初学者 / 进阶者 / 专家级
    presets: [
      { key: 'beginner', name: '初学者', desc: '轻松起步', holdTime: 3, relaxTime: 3, repeats: 10 },
      { key: 'intermediate', name: '进阶者', desc: '稳步提升', holdTime: 5, relaxTime: 5, repeats: 15 },
      { key: 'expert', name: '专家级', desc: '强力挑战', holdTime: 8, relaxTime: 8, repeats: 20 }
    ]
  }
})
