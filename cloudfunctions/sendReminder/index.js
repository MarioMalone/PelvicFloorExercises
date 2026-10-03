// 云函数 sendReminder：向当前用户发送训练提醒订阅消息
// 部署：在微信开发者工具中右键 cloudfunctions/sendReminder -> 上传并部署（云端安装依赖）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { templateId, data, page } = event

  if (!templateId || templateId === 'YOUR_TEMPLATE_ID') {
    return { success: false, err: 'templateId 未配置' }
  }

  try {
    const res = await cloud.openapi.subscribeMessage.send({
      touser: OPENID,
      templateId: templateId,
      page: page || 'pages/index/index',
      data: data
    })
    return { success: true, res }
  } catch (e) {
    return { success: false, err: (e && e.errMsg) ? e.errMsg : String(e) }
  }
}
