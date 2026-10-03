// utils/recommend.js
// 智能推荐引擎：基于用户训练历史生成个性化训练建议
// 纯函数，不依赖全局状态，便于测试与复用

function pad(n) {
  return String(n).padStart(2, '0')
}

function dateStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function uniqueDates(history) {
  const s = {}
  history.forEach(function (i) {
    s[i.date] = true
  })
  return Object.keys(s)
}

function getHistoryInDays(history, days) {
  const today = startOfToday()
  const start = new Date(today)
  start.setDate(start.getDate() - (days - 1))
  const startStr = dateStr(start)
  return history.filter(function (i) {
    return i.date >= startStr
  })
}

// 基于累计组数计算等级（与 stats.js 口径一致）
function calcLevel(totalRounds) {
  const tiers = [
    { min: 500, level: 4, title: '盆底达人' },
    { min: 200, level: 3, title: '稳步提升' },
    { min: 50, level: 2, title: '渐入佳境' },
    { min: 0, level: 1, title: '新手上路' }
  ]
  const tier = tiers.find(function (t) {
    return totalRounds >= t.min
  }) || tiers[tiers.length - 1]
  return { level: tier.level, title: tier.title }
}

function calcStreak(history) {
  if (!history.length) return 0
  const dates = uniqueDates(history).sort().reverse()
  let streak = 0
  const current = startOfToday()
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i])
    d.setHours(0, 0, 0, 0)
    const diff = Math.floor((current - d) / 86400000)
    if (diff === streak) {
      streak++
    } else if (diff > streak) {
      break
    }
  }
  return streak
}

function presetKeyOf(plan, presets) {
  const f = (presets || []).find(function (p) {
    return p.holdTime === plan.holdTime &&
      p.relaxTime === plan.relaxTime &&
      p.repeats === plan.repeats
  })
  return f ? f.key : null
}

function wrap(p, name) {
  return Object.assign({}, p, { name: (p && p.name) || name })
}

/**
 * 生成训练推荐
 * @param {Array} history 训练记录 [{date, rounds, duration, ...}]
 * @param {Object} currentPlan 当前生效方案 {holdTime, relaxTime, repeats, name?}
 * @param {Array} presets 预设方案列表 [{key, name, holdTime, relaxTime, repeats}]
 * @returns {Object} {type, tag, title, reason, suggestedPlan, presetKey, actionText, tip}
 */
function getRecommendation(history, currentPlan, presets) {
  presets = presets || []
  const totalRounds = history.reduce(function (a, i) {
    return a + (i.rounds || 0)
  }, 0)
  const level = calcLevel(totalRounds)
  const streak = calcStreak(history)

  const defaultPlanName = (currentPlan && currentPlan.name) ? currentPlan.name : '当前方案'

  // 无任何记录：从初学者起步
  if (!history.length) {
    const p = presets.find(function (x) { return x.key === 'beginner' }) || currentPlan || {}
    return {
      type: 'start',
      tag: '新手建议',
      title: '从初学者方案起步',
      reason: '还没有训练记录，先建立习惯比强度更重要。',
      suggestedPlan: wrap(p, '初学者'),
      presetKey: p.key || null,
      actionText: '采用初学者方案',
      tip: '每天 3s 收缩 / 3s 放松 / 10 次，先坚持满一周。'
    }
  }

  const last7 = getHistoryInDays(history, 7)
  const last14 = getHistoryInDays(history, 14)
  const trained7 = uniqueDates(last7).length
  const avg7 = last7.length
    ? last7.reduce(function (a, i) { return a + (i.rounds || 0) }, 0) / last7.length
    : 0
  const avg14 = last14.length
    ? last14.reduce(function (a, i) { return a + (i.rounds || 0) }, 0) / last14.length
    : 0
  const target = (currentPlan && currentPlan.repeats) || 10
  const hitRate = target > 0 ? avg7 / target : 0

  const curKey = presetKeyOf(currentPlan, presets)
  const idx = presets.findIndex(function (p) { return p.key === curKey })

  // A. 依从性低 + 新手：先稳住打卡节奏
  if (trained7 < 3 && level.level <= 2) {
    const p = presets.find(function (x) { return x.key === 'beginner' }) || currentPlan
    return {
      type: 'consolidate',
      tag: '巩固节奏',
      title: '先稳住打卡节奏',
      reason: '近 7 天只训练 ' + trained7 + ' 天，习惯还没养成。先把规律打卡跑起来。',
      suggestedPlan: wrap(p, '初学者'),
      presetKey: 'beginner',
      actionText: '采用初学者方案',
      tip: '本周目标：打卡满 3 天，不追求次数，让身体记住动作。'
    }
  }

  // B. 达标率偏低：当前强度偏难，宜巩固
  if (hitRate < 0.8) {
    return {
      type: 'maintain',
      tag: '保持',
      title: '当前强度偏难，宜巩固',
      reason: '近 7 天平均每次 ' + avg7.toFixed(1) + ' 组，低于目标 ' + target + ' 组。强行加量易受伤或放弃。',
      suggestedPlan: wrap(currentPlan, defaultPlanName),
      presetKey: curKey,
      actionText: '维持当前方案',
      tip: '动作标准比多做更重要，稳定达标 2 周后再进阶。'
    }
  }

  // C. 稳定达标且非最高档：升级到下一预设
  if (hitRate >= 0.9 && last14.length >= 10 && idx >= 0 && idx < presets.length - 1) {
    const next = presets[idx + 1]
    return {
      type: 'upgrade',
      tag: '进阶',
      title: '升级到「' + next.name + '」',
      reason: '近 14 天稳定达标（平均每次 ' + avg14.toFixed(1) + ' 组），肌肉已适应，可提升强度。',
      suggestedPlan: wrap(next, next.name),
      presetKey: next.key,
      actionText: '采用' + next.name + '方案',
      tip: '收缩延长至 ' + next.holdTime + 's，单次 ' + next.repeats + ' 组，循序渐进。'
    }
  }

  // D. 已是最高档且稳定：维持 + 微挑战
  if (idx === presets.length - 1) {
    const baseRepeats = (currentPlan && currentPlan.repeats) || 20
    const challenge = Object.assign({}, currentPlan, { repeats: baseRepeats + 5 })
    return {
      type: 'upgrade',
      tag: '进阶',
      title: '维持专家级，适度加量',
      reason: '已是最高预设档位，近 7 天平均 ' + avg7.toFixed(1) + ' 组，状态出色（连胜 ' + streak + ' 天）。',
      suggestedPlan: wrap(challenge, (currentPlan && currentPlan.name) || '专家级'),
      presetKey: curKey,
      actionText: '采用加量方案',
      tip: '可尝试单次加到 ' + challenge.repeats + ' 组，或延长收缩至 ' + ((currentPlan && currentPlan.holdTime) || 8) + 1 + 's 突破。'
    }
  }

  // 默认：保持当前节奏
  return {
    type: 'maintain',
    tag: '保持',
    title: '保持当前节奏',
    reason: '近 7 天训练 ' + trained7 + ' 天，平均每次 ' + avg7.toFixed(1) + ' 组，进展平稳。',
    suggestedPlan: wrap(currentPlan, defaultPlanName),
    presetKey: curKey,
    actionText: '维持当前方案',
    tip: '每周保持 4~5 天打卡，稳步提升即可。'
  }
}

module.exports = {
  getRecommendation: getRecommendation
}
