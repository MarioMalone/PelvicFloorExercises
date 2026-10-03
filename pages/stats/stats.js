// pages/stats/stats.js
const store = require('../../utils/store.js')

Page({
  data: {
    history: [],
    summary: {
      totalDays: 0,
      totalTime: 0,
      totalRounds: 0
    },
    chartData: [],
    calendarDays: [],
    currentMonthName: '',
    levelInfo: { level: 1, title: '新手上路', nextRounds: 50, progress: 0 },
    badges: []
  },

  onShow: function () {
    this.loadStats()
  },

  loadStats: function () {
    const history = store.getLocal('training_history', [])

    // 计算统计数据
    const summary = this.calculateSummary(history)
    const chartData = this.calculateChartData(history)
    const calendar = this.calculateCalendar(history)
    const streak = this.calculateStreak(history)
    const levelInfo = this.calculateLevel(summary.totalRounds)
    const badges = this.calculateBadges(summary, streak)

    this.setData({
      history: history.slice(0, 50),
      summary: summary,
      chartData: chartData,
      calendarDays: calendar.days,
      currentMonthName: calendar.monthName,
      levelInfo: levelInfo,
      badges: badges
    })
  },

  calculateCalendar: function (history) {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() // 0-11
    const monthName = `${year}年${month + 1}月`

    // 获取本月第一天是周几
    const firstDay = new Date(year, month, 1).getDay()
    // 获取本月共有多少天
    const totalDays = new Date(year, month + 1, 0).getDate()

    const days = []
    // 填充空白日期
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: '', training: false })
    }

    // 填充实际日期
    const trainedDates = new Set(history.map(item => item.date))
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      days.push({
        day: i,
        isCurrentDay: i === now.getDate(),
        hasTrained: trainedDates.has(dateStr)
      })
    }

    return {
      days: days,
      monthName: monthName
    }
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

      // 计算该日期的训练指数（当日总训练分钟，避免组数被重复计算）
      const records = history.filter(item => item.date === dateStr)
      const dayIndex = records.reduce((acc, item) => {
        return acc + (item.duration / 60)
      }, 0)

      days.push({
        date: dateStr,
        label: label,
        value: Math.round(dayIndex), // 训练指数
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
  },

  // 计算连续打卡天数（与 index 页逻辑一致）
  calculateStreak: function (history) {
    if (!history.length) return 0
    const dates = [...new Set(history.map(item => item.date))].sort().reverse()
    let streak = 0
    let current = new Date()
    current.setHours(0, 0, 0, 0)
    for (let i = 0; i < dates.length; i++) {
      const d = new Date(dates[i])
      d.setHours(0, 0, 0, 0)
      const diff = Math.floor((current - d) / (1000 * 60 * 60 * 24))
      if (diff === streak) {
        streak++
      } else if (diff > streak) {
        break
      }
    }
    return streak
  },

  // 基于累计组数计算等级
  calculateLevel: function (totalRounds) {
    const tiers = [
      { min: 500, level: 4, title: '盆底达人' },
      { min: 200, level: 3, title: '稳步提升' },
      { min: 50, level: 2, title: '渐入佳境' },
      { min: 0, level: 1, title: '新手上路' }
    ]
    const tier = tiers.find(t => totalRounds >= t.min) || tiers[tiers.length - 1]
    const upper = tiers.find(t => t.level === tier.level + 1)
    const nextRounds = upper ? upper.min : null
    const span = nextRounds ? (nextRounds - tier.min) : 1
    const done = nextRounds ? (totalRounds - tier.min) : totalRounds
    const progress = nextRounds ? Math.min(100, Math.round((done / span) * 100)) : 100
    return {
      level: tier.level,
      title: tier.title,
      nextRounds: nextRounds,
      progress: progress
    }
  },

  // 基于汇总数据计算成就勋章
  calculateBadges: function (summary, streak) {
    const defs = [
      { key: 'first', name: '初出茅庐', icon: '🌱', unlocked: summary.totalDays >= 1 },
      { key: 'week', name: '一周坚持', icon: '🔥', unlocked: streak >= 7 || summary.totalDays >= 7 },
      { key: 'hundred', name: '百组达成', icon: '💯', unlocked: summary.totalRounds >= 100 },
      { key: 'month', name: '月度达人', icon: '🏅', unlocked: summary.totalDays >= 30 }
    ]
    return defs
  }
})