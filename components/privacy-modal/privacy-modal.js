// components/privacy-modal/privacy-modal.js
const app = getApp()

Component({
  data: {
    visible: false,
    name: '隐私保护指引'
  },

  lifetimes: {
    attached: function () {
      // 仅在已配置隐私协议且用户尚未同意时弹出
      if (typeof wx.getPrivacySetting !== 'function') return
      wx.getPrivacySetting({
        success: (res) => {
          if (res.needAuthorization && !wx.getStorageSync('privacy_authorized')) {
            this.setData({
              visible: true,
              name: res.privacyContractName || '隐私保护指引'
            })
          }
        }
      })
    }
  },

  methods: {
    onView: function () {
      wx.navigateTo({ url: '/pages/privacy/privacy' })
    },

    onAgree: function () {
      // 记录本地同意，并完成微信隐私授权流程
      wx.setStorageSync('privacy_authorized', true)

      if (typeof wx.requirePrivacyAuthorize === 'function') {
        wx.requirePrivacyAuthorize({
          success: () => {},
          fail: () => {}
        })
      } else if (app.globalData && app.globalData.privacyResolve) {
        app.globalData.privacyResolve()
      }

      this.setData({ visible: false })
    }
  }
})
