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

    this.animState = {
      particles: [],
      ripples: [],
      burstProgress: 0,
      burstActive: false,
      burstColor: COLOR_PREPARE,
      currentColor: COLOR_PREPARE,
      targetColor: COLOR_PREPARE,
      colorTransitionStart: 0,
      colorTransitionDur: 800
    }
    this.initParticles(35)

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
      this.setTargetColor(COLOR_HOLD)
      this.triggerBurst(COLOR_HOLD)
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
      this.setTargetColor(COLOR_RELAX)
      this.triggerBurst(COLOR_RELAX)
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
        this.setTargetColor(COLOR_HOLD)
        this.triggerBurst(COLOR_HOLD)
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

  // 用 canvas 绘制 Apple Watch「正念呼吸花瓣 (Breathe)」几何绽放与呼吸律动
  drawRing: function (p, color, e) {
    const ctx = this.ctx
    const cx = this.cw / 2
    const cy = this.ch / 2
    ctx.clearRect(0, 0, this.cw, this.ch)

    if (!this.animState) return

    const renderColor = this.updateColor() || color
    const isHold = this.phase === 'hold'
    const isPrep = this.phase === 'prepare'

    // 1. 背景微光环境浮尘
    this.drawBgParticles(ctx, cx, cy, e)

    // 2. 状态切换时的柔和光波 (Ripple)
    this.drawRipples(ctx, cx, cy, Math.min(cx, cy) - 20)

    // 3. 计算 Apple Breathe 花瓣的扩展度 (bloom 0.0 ~ 1.0)
    // 盆底肌训练生理直觉：
    // - 收紧（Hold）：花瓣向中心聚拢收敛、收缩凝聚力（1.0 -> 0.25）
    // - 放松（Relax）：花瓣舒展展开、绽放释放压力（0.25 -> 1.0）
    let bloom = 0.5
    if (isPrep) {
      // 准备阶段：花瓣从半开平滑就位到盛开准备状态，准备开始第一次收紧
      const ease = 1 - Math.cos((p * Math.PI) / 2)
      bloom = 0.4 + ease * 0.6
    } else if (isHold) {
      // 收紧阶段：花瓣从盛开向中心有力聚拢收敛 (1.0 -> 0.25)
      // 使用平滑 cubic 减速曲线，模拟肌肉平稳收紧凝聚
      bloom = 1.0 - (1 - Math.pow(1 - p, 2.2)) * 0.75
    } else {
      // 放松阶段：花瓣从紧束舒缓绽放展开 (0.25 -> 1.0)
      // 模拟肌肉完全释放放松
      bloom = 0.25 + (1 - Math.pow(1 - p, 2.5)) * 0.75
    }

    // 呼吸微颤 (微小次级脉动，让花朵在静态时也有生命感)
    const microPulse = Math.sin(e / 450) * 0.025
    bloom = Math.max(0.15, Math.min(1.05, bloom + microPulse))

    // 4. 绘制 Apple Watch 经典 7 片几何花瓣
    this.drawAppleBreathePetals(ctx, cx, cy, bloom, renderColor, e)

    // 5. 绘制 Apple 风格的外层精密进度刻度轨 (Precision Gauge)
    this.drawApplePrecisionGauge(ctx, cx, cy, p, renderColor)

    // 6. 环绕能量微粒 (在花瓣外侧伴舞)
    this.drawOrbitParticles(ctx, cx, cy, Math.min(cx, cy) - 24, isHold, renderColor)
  },

  // Apple Watch 经典花瓣结构绘制
  drawAppleBreathePetals: function (ctx, cx, cy, bloom, color, e) {
    const numPetals = 7 // 7片对称经典 Apple Breathe 构型
    // 花瓣半径根据绽放度动态变化
    const maxRadius = Math.min(cx, cy) * 0.44
    const minRadius = Math.min(cx, cy) * 0.22
    const petalRadius = minRadius + (maxRadius - minRadius) * bloom

    // 花瓣中心距离圆心的偏移量
    const maxOffset = petalRadius * 0.78
    const minOffset = petalRadius * 0.25
    const centerOffset = minOffset + (maxOffset - minOffset) * bloom

    // 伴随绽放的自旋角度（Apple Breathe 的经典优雅旋转）
    const rotation = (bloom * 0.65) + (e / 12000)

    ctx.save()

    // 中心微光氛围柔光
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, petalRadius * 1.5)
    coreGrad.addColorStop(0, this.hexA(color, 0.25 * bloom))
    coreGrad.addColorStop(0.6, this.hexA(color, 0.08 * bloom))
    coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = coreGrad
    ctx.beginPath()
    ctx.arc(cx, cy, petalRadius * 1.6, 0, Math.PI * 2)
    ctx.fill()

    // 绘制 7 个相互叠错的几何半透明花瓣
    // Apple 风格采用多层高亮与柔和半透明叠加
    for (let i = 0; i < numPetals; i++) {
      const angle = (i * 2 * Math.PI) / numPetals + rotation
      const petalCenterX = cx + Math.cos(angle) * centerOffset
      const petalCenterY = cy + Math.sin(angle) * centerOffset

      ctx.save()
      ctx.beginPath()
      ctx.arc(petalCenterX, petalCenterY, petalRadius, 0, Math.PI * 2)

      // 每个花瓣自身拥有径向通透渐变
      const petalGrad = ctx.createRadialGradient(
        petalCenterX, petalCenterY, 0,
        petalCenterX, petalCenterY, petalRadius
      )
      petalGrad.addColorStop(0, this.hexA(color, 0.45))
      petalGrad.addColorStop(0.55, this.hexA(color, 0.30))
      petalGrad.addColorStop(0.88, this.hexA(color, 0.12))
      petalGrad.addColorStop(1, this.hexA(color, 0.0))

      ctx.fillStyle = petalGrad
      ctx.fill()

      // 花瓣轻薄边缘线，勾勒出 Apple 标志性的重叠几何相交轮廓
      ctx.strokeStyle = this.hexA('#ffffff', 0.28 + bloom * 0.2)
      ctx.lineWidth = 1.2
      ctx.stroke()

      ctx.restore()
    }

    // 中心纯白柔光核，让整体更加晶莹剔透
    ctx.beginPath()
    ctx.arc(cx, cy, petalRadius * 0.42 * bloom + 10, 0, Math.PI * 2)
    const innerLight = ctx.createRadialGradient(cx, cy, 0, cx, cy, petalRadius * 0.45 * bloom + 10)
    innerLight.addColorStop(0, 'rgba(255, 255, 255, 0.65)')
    innerLight.addColorStop(0.4, this.hexA(color, 0.25))
    innerLight.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = innerLight
    ctx.fill()

    ctx.restore()
  },

  // Apple 极简精密进度外环 (外刻度点阵与柔和发光圆弧)
  drawApplePrecisionGauge: function (ctx, cx, cy, p, color) {
    const R = Math.min(cx, cy) - 18
    ctx.save()

    // 1. 底层极简隐性轨道
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.035)'
    ctx.lineWidth = 6
    ctx.stroke()

    // 2. 60 个细微刻度点（Apple 表盘风格小刻度）
    const totalTicks = 60
    for (let i = 0; i < totalTicks; i++) {
      const angle = (i * 2 * Math.PI) / totalTicks - Math.PI / 2
      const isPast = (i / totalTicks) <= p
      const tickDist = R + 7
      const tx = cx + Math.cos(angle) * tickDist
      const ty = cy + Math.sin(angle) * tickDist

      ctx.beginPath()
      ctx.arc(tx, ty, isPast ? 1.4 : 0.9, 0, Math.PI * 2)
      ctx.fillStyle = isPast ? this.hexA(color, 0.65) : 'rgba(0, 0, 0, 0.08)'
      ctx.fill()
    }

    // 3. 动态流动进度弧（细线高精度）
    if (p > 0) {
      const start = -Math.PI / 2
      const end = start + p * Math.PI * 2

      ctx.beginPath()
      ctx.arc(cx, cy, R, start, end)
      ctx.strokeStyle = color
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.shadowColor = color
      ctx.shadowBlur = 10
      ctx.stroke()

      // 进度前端的高亮流光点
      const headX = cx + Math.cos(end) * R
      const headY = cy + Math.sin(end) * R
      ctx.beginPath()
      ctx.arc(headX, headY, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = 8
      ctx.fill()
    }

    ctx.restore()
  },

  drawOrbitParticles: function(ctx, cx, cy, R, isHold, color) {
    const state = this.animState
    if (!state.particles) return
    const activeCount = isHold ? state.particles.length : Math.floor(state.particles.length / 3)
    
    ctx.save()
    ctx.fillStyle = color
    for (let i = 0; i < activeCount; i++) {
      const p = state.particles[i]
      p.angle += p.speed * (isHold ? 1.5 : 0.5)
      
      const x = cx + (R + p.offset) * Math.cos(p.angle)
      const y = cy + (R + p.offset) * Math.sin(p.angle)
      
      ctx.globalAlpha = p.opacity
      ctx.beginPath()
      ctx.arc(x, y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  },

  drawBgParticles: function(ctx, cx, cy, e) {
    if (!this.animState.bgParticles) {
      this.animState.bgParticles = []
      for(let i=0; i<20; i++) {
         this.animState.bgParticles.push({
           x: Math.random() * this.cw,
           y: Math.random() * this.ch,
           speedY: -Math.random() * 0.3 - 0.1,
           size: Math.random() * 1.5 + 0.5,
           opacity: Math.random() * 0.3 + 0.1
         })
      }
    }
    
    ctx.save()
    ctx.fillStyle = this.currentRenderColor || COLOR_PREPARE
    this.animState.bgParticles.forEach(p => {
       p.y += p.speedY
       if (p.y < 0) p.y = this.ch
       
       const drift = Math.sin(e / 1000 + p.x) * 0.2
       p.x += drift
       
       ctx.globalAlpha = p.opacity
       ctx.beginPath()
       ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
       ctx.fill()
    })
    ctx.restore()
  },

  drawRipples: function(ctx, cx, cy, R) {
    const state = this.animState
    for (let i = state.ripples.length - 1; i >= 0; i--) {
      const r = state.ripples[i]
      r.progress += 0.015
      if (r.progress >= 1) {
        state.ripples.splice(i, 1)
        continue
      }
      const rp = r.progress
      const easeOut = 1 - Math.pow(1 - rp, 3)
      ctx.beginPath()
      ctx.arc(cx, cy, R + easeOut * 80, 0, Math.PI * 2)
      ctx.strokeStyle = this.hexA(r.color, (1 - easeOut) * 0.3)
      ctx.lineWidth = 1
      ctx.stroke()
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

  initParticles: function(count) {
    this.animState.particles = []
    for(let i=0; i<count; i++) {
      this.animState.particles.push({
        angle: Math.random() * Math.PI * 2,
        speed: (Math.random() * 0.02 + 0.005) * (Math.random()>0.5?1:-1),
        offset: (Math.random() - 0.5) * 45,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2
      })
    }
  },
  
  triggerBurst: function(color) {
    this.animState.burstActive = true
    this.animState.burstProgress = 0
    this.animState.burstColor = color
    this.animState.ripples.push({ progress: 0, color: color })
  },
  
  interpolateColor: function(c1, c2, p) {
    if (p >= 1) return c2
    if (p <= 0) return c1
    const h1 = parseInt(c1.slice(1), 16)
    const h2 = parseInt(c2.slice(1), 16)
    const r1 = (h1 >> 16) & 255, g1 = (h1 >> 8) & 255, b1 = h1 & 255
    const r2 = (h2 >> 16) & 255, g2 = (h2 >> 8) & 255, b2 = h2 & 255
    const r = Math.round(r1 + (r2 - r1) * p)
    const g = Math.round(g1 + (g2 - g1) * p)
    const b = Math.round(b1 + (b2 - b1) * p)
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  },
  
  updateColor: function() {
    const now = Date.now()
    const state = this.animState
    if (state.currentColor !== state.targetColor) {
      const elapsed = now - state.colorTransitionStart
      const p = Math.min(elapsed / state.colorTransitionDur, 1)
      const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p
      this.currentRenderColor = this.interpolateColor(state.currentColor, state.targetColor, ease)
      if (p >= 1) state.currentColor = state.targetColor
    } else {
      this.currentRenderColor = state.currentColor
    }
    return this.currentRenderColor
  },
  
  setTargetColor: function(color) {
    if (this.animState.targetColor !== color) {
      this.animState.currentColor = this.currentRenderColor || this.animState.targetColor
      this.animState.targetColor = color
      this.animState.colorTransitionStart = Date.now()
    }
  },

  onUnload: function () {
    if (this.raf !== -2 && this.canvas) this.canvas.cancelAnimationFrame(this.raf)
    if (this.holdAudio) this.holdAudio.destroy()
    if (this.relaxAudio) this.relaxAudio.destroy()
  }
})
