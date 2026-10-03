// pages/index/index.js
const app = getApp()
const recommend = require('../../utils/recommend.js')
const store = require('../../utils/store.js')

Page({
    data: {
        todayCount: 0,
        streak: 0,
        totalTime: 0,
        currentPlan: {
            holdTime: 3,
            relaxTime: 3,
            repeats: 10
        },
        recommendation: null
    },

    onLoad: function () {
        // 从本地存储或云端获取数据
    },

    onShow: function () {
        this.refreshStats()
    },

    refreshStats: function () {
        const history = store.getLocal('training_history', [])

        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

        let todayCount = 0
        let totalMinutes = 0
        let streak = 0

        if (history.length > 0) {
            const todayRecords = history.filter(item => item.date === today)
            todayCount = todayRecords.length

            // 计算累计时间（分钟）
            const totalSeconds = history.reduce((acc, item) => acc + item.duration, 0)
            totalMinutes = Math.round(totalSeconds / 60)

            // 简单计算连胜天数
            streak = this.calculateStreak(history)
        }

        this.setData({
            todayCount: todayCount,
            totalTime: totalMinutes,
            streak: streak,
            currentPlan: app.globalData.currentPlan,
            recommendation: recommend.getRecommendation(history, app.globalData.currentPlan, app.globalData.presets)
        })
    },

    calculateStreak: function (history) {
        if (!history.length) return 0
        const dates = [...new Set(history.map(item => item.date))].sort().reverse()
        let streak = 0
        let current = new Date()
        current.setHours(0, 0, 0, 0) // Normalize current date to start of day

        for (let i = 0; i < dates.length; i++) {
            const d = new Date(dates[i])
            d.setHours(0, 0, 0, 0) // Normalize history date to start of day

            const diff = Math.floor((current - d) / (1000 * 60 * 60 * 24))

            if (diff === streak) { // If the date is 'streak' days ago (e.g., today for streak=0, yesterday for streak=1)
                streak++
            } else if (diff > streak) { // If there's a gap, streak is broken
                break
            }
            // If diff < streak, it means we've already counted this day or it's a duplicate entry for a day already processed
        }
        return streak
    },

    startTraining: function () {
        wx.navigateTo({
            url: '/pages/training/training'
        })
    },

    // 一键采用推荐方案并进入训练
    applyRecommendation: function () {
        const rec = this.data.recommendation
        if (!rec) return
        const p = rec.suggestedPlan || {}
        const newPlan = {
            holdTime: parseInt(p.holdTime) || 3,
            relaxTime: parseInt(p.relaxTime) || 3,
            repeats: parseInt(p.repeats) || 10,
            name: p.name
        }
        store.setSetting('custom_plan', newPlan)
        app.globalData.currentPlan = newPlan
        wx.navigateTo({
            url: '/pages/training/training'
        })
    }
})
