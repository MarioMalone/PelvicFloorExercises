// pages/settings/settings.js
const app = getApp()

Page({
  data: {
    holdTime: 3,
    relaxTime: 3,
    repeats: 10,
    reminderEnabled: false,
    reminderTime: '09:00'
  },

  onShow: function () {
    const plan = wx.getStorageSync('custom_plan') || app.globalData.currentPlan
    const reminderConfig = wx.getStorageSync('reminder_config') || { enabled: false, time: '09:00' }

    this.setData({
      holdTime: plan.holdTime,
      relaxTime: plan.relaxTime,
      repeats: plan.repeats,
      reminderEnabled: reminderConfig.enabled,
      reminderTime: reminderConfig.time
    })
  },

  onReminderToggle: function (e) {
    const enabled = e.detail.value
    this.setData({ reminderEnabled: enabled })

    if (enabled) {
      this.requestSubscription()
    }

    this.saveReminderConfig()
  },

  onReminderTimeChange: function (e) {
    this.setData({ reminderTime: e.detail.value })
    this.saveReminderConfig()
  },

  saveReminderConfig: function () {
    wx.setStorageSync('reminder_config', {
      enabled: this.data.reminderEnabled,
      time: this.data.reminderTime
    })
  },

  requestSubscription: function () {
    // 微信订阅消息模板ID (用户需在后台申请并替换此处)
    const templateId = 'YOUR_TEMPLATE_ID'

    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success(res) {
        if (res[templateId] === 'accept') {
          wx.showToast({ title: '订阅成功', icon: 'success' })
        }
      },
      fail(err) {
        console.error('订阅请求失败', err)
        wx.showModal({
          title: '订阅提示',
          content: '请在设置页手动开启消息权限，以确保提醒能正常送达。',
          showCancel: false
        })
      }
    })
  },

  onHoldTimeChange: function (e) {
    this.setData({ holdTime: e.detail.value })
  },

  onRelaxTimeChange: function (e) {
    this.setData({ relaxTime: e.detail.value })
  },

  onRepeatsChange: function (e) {
    this.setData({ repeats: e.detail.value })
  },

  saveSettings: function () {
    const newPlan = {
      holdTime: parseInt(this.data.holdTime),
      relaxTime: parseInt(this.data.relaxTime),
      repeats: parseInt(this.data.repeats)
    }

    wx.setStorageSync('custom_plan', newPlan)
    app.globalData.currentPlan = newPlan

    wx.showToast({
      title: '设置已保存',
      icon: 'success'
    })
  },

  clearHistory: function () {
    wx.showModal({
      title: '清除记录',
      content: '确定要清除所有训练历史吗？此操作不可恢复。',
      confirmColor: '#E02020',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('training_history')
          wx.showToast({
            title: '已清除',
            icon: 'success'
          })
        }
      }
    })
  }
})