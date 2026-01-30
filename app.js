App({
  onLaunch: function () {
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
    const customPlan = wx.getStorageSync('custom_plan')
    if (customPlan) {
      this.globalData.currentPlan = customPlan
    }
  },
  globalData: {
    userInfo: null,
    currentPlan: {
      holdTime: 3, // 收缩时间(秒)
      relaxTime: 3, // 放松时间(秒)
      repeats: 10   // 循环次数
    }
  }
})
