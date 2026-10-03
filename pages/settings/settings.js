// pages/settings/settings.js
const app = getApp()
const store = require('../../utils/store.js')

// 微信订阅消息模板 ID：需在微信公众平台申请「训练提醒」模板后填入此处
// 真实定时推送还需配套云函数（见 REFACTOR_PLAN.md M2/M4），本开关仅负责获取授权 + 本地配置
const REMINDER_TEMPLATE_ID = 'YOUR_TEMPLATE_ID'

Page({
  data: {
    holdTime: 3,
    relaxTime: 3,
    repeats: 10,
    presets: [],
    selectedPreset: '',
    voiceEnabled: false,
    reminderEnabled: false,
    reminderTime: '09:00',
    saveSuccess: false,
    isHoldTimeChanging: false,
    isRelaxTimeChanging: false,
    isRepeatsChanging: false
  },

  onShow: function () {
    const plan = store.getLocal('custom_plan', app.globalData.currentPlan)
    const reminderConfig = store.getLocal('reminder_config', { enabled: false, time: '09:00' })
    const voiceConfig = store.getLocal('voice_config', { enabled: false })

    // 反推当前选中的预设（若与某预设完全一致则高亮）
    const matched = (app.globalData.presets || []).find(p =>
      p.holdTime === plan.holdTime && p.relaxTime === plan.relaxTime && p.repeats === plan.repeats)

    this.setData({
      holdTime: plan.holdTime,
      relaxTime: plan.relaxTime,
      repeats: plan.repeats,
      presets: app.globalData.presets || [],
      selectedPreset: matched ? matched.key : '',
      voiceEnabled: voiceConfig.enabled,
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
    store.setSetting('reminder_config', {
      enabled: this.data.reminderEnabled,
      time: this.data.reminderTime
    })
  },

  requestSubscription: function () {
    // 微信订阅消息模板ID（在文件顶部 REMINDER_TEMPLATE_ID 常量中配置）
    const templateId = REMINDER_TEMPLATE_ID

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
    this.setData({ holdTime: e.detail.value, isHoldTimeChanging: false })
  },

  onHoldTimeChanging: function () {
    this.setData({ isHoldTimeChanging: true })
  },

  onRelaxTimeChange: function (e) {
    this.setData({ relaxTime: e.detail.value, isRelaxTimeChanging: false })
  },

  onRelaxTimeChanging: function () {
    this.setData({ isRelaxTimeChanging: true })
  },

  onRepeatsChange: function (e) {
    this.setData({ repeats: e.detail.value, isRepeatsChanging: false })
  },

  onRepeatsChanging: function () {
    this.setData({ isRepeatsChanging: true })
  },

  // 选择预设方案：一键套用并保存
  onPresetTap: function (e) {
    const key = e.currentTarget.dataset.key
    const preset = (this.data.presets || []).find(p => p.key === key)
    if (!preset) return

    this.setData({
      holdTime: preset.holdTime,
      relaxTime: preset.relaxTime,
      repeats: preset.repeats,
      selectedPreset: preset.key
    })
    this.saveSettings()
  },

  // 语音引导开关
  onVoiceToggle: function (e) {
    const enabled = e.detail.value
    this.setData({ voiceEnabled: enabled })
    this.saveVoiceConfig()
  },

  saveVoiceConfig: function () {
    store.setSetting('voice_config', { enabled: this.data.voiceEnabled })
  },

  saveSettings: function () {
    const newPlan = {
      holdTime: parseInt(this.data.holdTime),
      relaxTime: parseInt(this.data.relaxTime),
      repeats: parseInt(this.data.repeats)
    }

    store.setSetting('custom_plan', newPlan)
    app.globalData.currentPlan = newPlan

    this.setData({ saveSuccess: true })
    setTimeout(() => {
      this.setData({ saveSuccess: false })
    }, 1500)

    wx.showToast({
      title: '设置已保存',
      icon: 'success'
    })
  },

  goPrivacy: function () {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },

  clearHistory: function () {
    wx.showModal({
      title: '清除记录',
      content: '确定要清除所有训练历史吗？此操作不可恢复。',
      confirmColor: '#E02020',
      success: (res) => {
        if (res.confirm) {
          store.clearHistory()
          wx.showToast({
            title: '已清除',
            icon: 'success'
          })
        }
      }
    })
  },

  // 发送测试提醒：验证真实订阅消息推送（需已配置云环境 + 模板 ID + 已授权）
  sendTestReminder: function () {
    if (!store.isCloudConfigured()) {
      wx.showModal({
        title: '未启用云开发',
        content: '请先按 CLOUD_SETUP.md 配置云环境、部署 sendReminder 云函数并填入模板 ID 后，才能体验真实推送。',
        showCancel: false
      })
      return
    }
    if (REMINDER_TEMPLATE_ID === 'YOUR_TEMPLATE_ID') {
      wx.showToast({ title: '请先配置模板 ID', icon: 'none' })
      return
    }
    wx.cloud.callFunction({
      name: 'sendReminder',
      data: {
        templateId: REMINDER_TEMPLATE_ID,
        page: 'pages/index/index',
        // 字段名需与你申请的订阅消息模板一致；此处为示例（事项 + 时间）
        data: {
          thing1: { value: '盆底肌训练时间到啦' },
          time2: { value: this.data.reminderTime + ':00' }
        }
      },
      success: (res) => {
        if (res.result && res.result.success) {
          wx.showToast({ title: '已推送', icon: 'success' })
        } else {
          wx.showToast({ title: '推送失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '调用失败', icon: 'none' })
      }
    })
  }
})