// pages/training/training.js
const app = getApp()

Page({
    data: {
        currentTime: 3,
        isHolding: true,
        isPreparing: true,
        prepareTime: 2,
        currentRound: 1,
        totalRounds: 10,
        timer: null,
        segments: [],
        progressDeg: 0
    },

    onLoad: function () {
        const plan = app.globalData.currentPlan
        const segments = Array.from({ length: plan.holdTime }, (_, i) => i)
        this.setData({
            currentTime: plan.holdTime,
            holdTime: plan.holdTime,
            relaxTime: plan.relaxTime,
            totalRounds: plan.repeats,
            segments: segments,
            isPreparing: true,
            prepareTime: 2
        })
        this.startPrepare()
    },

    startPrepare: function () {
        this.timer = setInterval(() => {
            let nextTime = this.data.prepareTime - 1
            if (nextTime < 0) {
                clearInterval(this.timer)
                this.setData({ isPreparing: false })
                this.startTimer()
            } else {
                this.setData({ prepareTime: nextTime })
            }
        }, 1000)
    },

    startTimer: function () {
        this.timer = setInterval(() => {
            let nextTime = this.data.currentTime - 1

            if (nextTime < 0) {
                this.switchStage()
            } else {
                // 计算进度百分比
                const plan = app.globalData.currentPlan
                const totalTime = this.data.isHolding ? plan.holdTime : plan.relaxTime
                const elapsed = totalTime - nextTime
                const progress = (elapsed / totalTime) * 360

                this.setData({
                    currentTime: nextTime,
                    progressDeg: progress
                })
            }
        }, 1000)
    },

    switchStage: function () {
        const plan = app.globalData.currentPlan
        if (this.data.isHolding) {
            // 切换到放松
            this.setData({
                isHolding: false,
                currentTime: plan.relaxTime,
                segments: [] // 放松时清空红色分段圆环
            })
            wx.vibrateShort()
        } else {
            // 切换到收缩
            let nextRound = this.data.currentRound + 1
            if (nextRound > this.data.totalRounds) {
                this.finishTraining()
            } else {
                const segments = Array.from({ length: plan.holdTime }, (_, i) => i)
                this.setData({
                    isHolding: true,
                    currentTime: plan.holdTime,
                    currentRound: nextRound,
                    segments: segments
                })
                wx.vibrateShort()
            }
        }
    },

    finishTraining: function () {
        clearInterval(this.timer)

        // 保存训练记录
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
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const record = {
            date: dateStr,
            timestamp: now.getTime(),
            rounds: this.data.totalRounds,
            duration: duration
        }

        let history = wx.getStorageSync('training_history') || []
        history.unshift(record)
        wx.setStorageSync('training_history', history)
    },
    cancelTraining: function () {
        wx.showModal({
            title: '停止训练',
            content: '确定要结束本次训练吗？',
            success: (res) => {
                if (res.confirm) {
                    clearInterval(this.timer)
                    wx.navigateBack()
                }
            }
        })
    },

    onUnload: function () {
        if (this.timer) clearInterval(this.timer)
    }
})
