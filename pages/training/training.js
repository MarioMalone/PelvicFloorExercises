// pages/training/training.js
const app = getApp()
const store = require('../../utils/store.js')

const COLOR_HOLD = '#D65D56'   // 莫兰迪红（收紧）
const COLOR_RELAX = '#4A90E2'  // 莫兰迪蓝（放松）
const COLOR_PREPARE = '#9AA7B2' // 准备（中性灰蓝）

Page({
  data: {
    currentTime: 3,
    isHolding: true,
    isPreparing: true,
    prepareTime: 3,
    currentRound: 1,
    totalRounds: 10,
    holdTime: 3,
    relaxTime: 3
  },

  onLoad: function () {
    const plan = app.globalData.currentPlan
    this.setData({
      holdTime: plan.holdTime,
      relaxTime: plan.relaxTime,
      totalRounds: plan.repeats,
      currentTime: plan.holdTime,
      isPreparing: true,
      prepareTime: 3
    })

    // 语音引导：开启时预加载「收」「放」提示音（资源缺失时静默降级）
    const voiceConfig = store.getLocal('voice_config', { enabled: false })
    if (voiceConfig.enabled) {
      this.holdAudio = wx.createInnerAudioContext()
      this.holdAudio.src = 'assets/audio/hold.mp3'
      this.holdAudio.onError(() => {})
      this.relaxAudio = wx.createInnerAudioContext()
      this.relaxAudio.src = 'assets/audio/relax.mp3'
      this.relaxAudio.onError(() => {})
    }
  },

  onReady: function () {
    const self = this
    const query = wx.createSelectorQuery().in(this)
    query.select('#ring')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        let dpr = 2
        try {
          dpr = (wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio) || 2
        } catch (e) {}
        const w = res[0].width
        const h = res[0].height
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
        self.canvas = canvas
        self.ctx = ctx
        self.cw = w
        self.ch = h
        self.startLoop()
      })
  },

  startLoop: function () {
    this.phase = 'prepare'
    this.phaseStart = Date.now()
    this.prepareTotal = 3000
    this._lastRemain = -1
    this._lastCurrent = -1
    this.raf = -1

    const self = this
    this.loop = function () {
      self.tick()
      if (self.canvas && self.raf !== -2) {
        self.raf = self.canvas.requestAnimationFrame(self.loop)
      }
    }
    this.raf = this.canvas.requestAnimationFrame(this.loop)
  },

  tick: function () {
    if (!this.ctx) return
    const now = Date.now()

    if (this.phase === 'prepare') {
      const e = now - this.phaseStart
      const p = Math.min(e / this.prepareTotal, 1)
      const remain = Math.max(1, Math.ceil((this.prepareTotal - e) / 1000))
      if (remain !== this._lastRemain) {
        this._lastRemain = remain
        this.setData({ prepareTime: remain })
      }
      this.drawRing(p, COLOR_PREPARE, e)
      if (e >= this.prepareTotal) this.enterStage('hold')
      return
    }

    const dur = (this.phase === 'hold' ? this.data.holdTime : this.data.relaxTime) * 1000
    const e = now - this.phaseStart
    const p = Math.min(e / dur, 1)
    const remain = Math.max(0, Math.ceil((dur - e) / 1000))
    if (remain !== this._lastCurrent) {
      this._lastCurrent = remain
      this.setData({ currentTime: remain })
    }
    const color = this.phase === 'hold' ? COLOR_HOLD : COLOR_RELAX
    this.drawRing(p, color, e)

    if (e >= dur) this.switchStage()
  },

  enterStage: function (stage) {
    const plan = app.globalData.currentPlan
    if (stage === 'hold') {
      this.phase = 'hold'
      this.phaseStart = Date.now()
      this._lastCurrent = -1
      this.setData({
        isPreparing: false,
        isHolding: true,
        currentTime: plan.holdTime,
        currentRound: 1
      })
      this.playCue('hold')
      wx.vibrateShort()
    }
  },

  switchStage: function () {
    const plan = app.globalData.currentPlan
    if (this.phase === 'hold') {
      // 切换到放松
      this.phase = 'relax'
      this.phaseStart = Date.now()
      this._lastCurrent = -1
      this.setData({ isHolding: false, currentTime: plan.relaxTime })
      this.playCue('relax')
      wx.vibrateShort()
    } else {
      // 切换到下一轮收缩
      const nextRound = this.data.currentRound + 1
      if (nextRound > this.data.totalRounds) {
        this.finishTraining()
      } else {
        this.phase = 'hold'
        this.phaseStart = Date.now()
        this._lastCurrent = -1
        this.setData({
          isHolding: true,
          currentTime: plan.holdTime,
          currentRound: nextRound
        })
        this.playCue('hold')
        wx.vibrateShort()
      }
    }
  },

  // 用 canvas 绘制平滑进度环（按真实时间戳连续推进，不再每秒跳变）
  drawRing: function (p, color, e) {
    const ctx = this.ctx
    const cx = this.cw / 2
    const cy = this.ch / 2
    const R = Math.min(cx, cy) - 18
    ctx.clearRect(0, 0, this.cw, this.ch)

    // 背景轨道
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.07)'
    ctx.lineWidth = 14
    ctx.stroke()

    // 呼吸光晕（随时间的轻微脉动，让圆环有生命感）
    const breathe = Math.sin(e / 350)
    ctx.beginPath()
    ctx.arc(cx, cy, R + breathe * 5, 0, Math.PI * 2)
    ctx.strokeStyle = this.hexA(color, 0.12)
    ctx.lineWidth = 2
    ctx.stroke()

    // 进度弧（从顶部 -90° 顺时针填充）
    if (p > 0) {
      ctx.save()
      ctx.beginPath()
      const start = -Math.PI / 2
      ctx.arc(cx, cy, R, start, start + p * Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth = 14
      ctx.lineCap = 'round'
      ctx.shadowColor = color
      ctx.shadowBlur = 16
      ctx.stroke()
      ctx.restore()
    }
  },

  hexA: function (hex, a) {
    const n = parseInt(hex.slice(1), 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
  },

  playCue: function (type) {
    const audio = type === 'hold' ? this.holdAudio : this.relaxAudio
    if (!audio) return
    try {
      audio.stop()
      audio.play()
    } catch (e) {}
  },

  finishTraining: function () {
    if (this.raf !== -2 && this.canvas) this.canvas.cancelAnimationFrame(this.raf)
    this.raf = -2
    if (this.ctx) this.drawRing(1, COLOR_HOLD, 0)
    this.saveRecord()
    wx.showToast({
      title: '训练完成！',
      icon: 'success',
      duration: 2000,
      success: () => {
        setTimeout(() => {
          wx.navigateBack()
        }, 2000)
      }
    })
  },

  saveRecord: function () {
    const plan = app.globalData.currentPlan
    const duration = (plan.holdTime + plan.relaxTime) * this.data.totalRounds
    const now = new Date()
    const dateStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0')
    store.addHistory({
      date: dateStr,
      timestamp: now.getTime(),
      rounds: this.data.totalRounds,
      duration: duration
    })
  },

  cancelTraining: function () {
    wx.showModal({
      title: '停止训练',
      content: '确定要结束本次训练吗？',
      success: (res) => {
        if (res.confirm) {
          if (this.raf !== -2 && this.canvas) this.canvas.cancelAnimationFrame(this.raf)
          this.raf = -2
          wx.navigateBack()
        }
      }
    })
  },

  onUnload: function () {
    if (this.raf !== -2 && this.canvas) this.canvas.cancelAnimationFrame(this.raf)
    if (this.holdAudio) this.holdAudio.destroy()
    if (this.relaxAudio) this.relaxAudio.destroy()
  }
})
