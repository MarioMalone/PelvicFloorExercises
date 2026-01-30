// pages/stats/stats.js
Page({
  data: {
    history: [],
    summary: {
      totalDays: 0,
      totalTime: 0,
      totalRounds: 0
    },
    chartData: []
  },

  onShow: function () {
    this.loadStats()
  },

  loadStats: function () {
    const history = wx.getStorageSync('training_history') || []

    // 计算统计数据
    const summary = this.calculateSummary(history)
    const chartData = this.calculateChartData(history)

    this.setData({
      history: history.slice(0, 50), // 仅显示最近50条
      summary: summary,
      chartData: chartData
    })
  },

  calculateChartData: function (history) {
    const days = []
    const now = new Date()

    // 获取过去7天的日期
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const label = (d.getMonth() + 1) + '/' + d.getDate()

      // 计算该日期的总时长
      const dayTotal = history
        .filter(item => item.date === dateStr)
        .reduce((acc, item) => acc + item.duration, 0)

      days.push({
        date: dateStr,
        label: label,
        value: Math.round(dayTotal / 60), // 分钟
        height: 0 // 初始高度
      })
    }

    // 计算最大值以确定高度比例
    const maxValue = Math.max(...days.map(d => d.value), 5) // 至少以5分钟为基准

    return days.map(d => ({
      ...d,
      height: (d.value / maxValue) * 100
    }))
  },

  calculateSummary: function (history) {
    if (!history.length) return { totalDays: 0, totalTime: 0, totalRounds: 0 }

    const days = new Set(history.map(item => item.date)).size
    const totalTime = history.reduce((acc, item) => acc + item.duration, 0)
    const totalRounds = history.reduce((acc, item) => acc + item.rounds, 0)

    return {
      totalDays: days,
      totalTime: Math.round(totalTime / 60), // 转为分钟
      totalRounds: totalRounds
    }
  },

  formatDuration: function (seconds) {
    if (seconds < 60) return seconds + '秒'
    return Math.floor(seconds / 60) + '分' + (seconds % 60) + '秒'
  }
})