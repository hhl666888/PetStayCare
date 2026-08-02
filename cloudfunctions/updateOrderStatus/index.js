// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  console.log('updateOrderStatus 云函数调用，参数:', event)
  console.log('微信上下文:', wxContext)

  const { orderId, status, openId, userId } = event
  // 兼容前端传的 userId 参数
  const effectiveOpenId = openId || userId

  // 参数验证
  if (!orderId || !status) {
    return {
      code: -1,
      message: '缺少必要参数'
    }
  }

  try {
    // 验证订单是否存在
    const orderRes = await db.collection('orders')
      .doc(orderId)
      .get()

    if (!orderRes.data) {
      return {
        code: -2,
        message: '订单不存在'
      }
    }

    const order = orderRes.data
    console.log('找到订单:', order)

    // 验证订单归属（支持 openid、openId 或 userOpenId）
    if (effectiveOpenId && order.openid !== effectiveOpenId && order.openId !== effectiveOpenId && order.userOpenId !== effectiveOpenId) {
      console.error('订单归属验证失败', {
        effectiveOpenId,
        orderOpenid: order.openid,
        orderOpenId: order.openId,
        orderUserOpenId: order.userOpenId
      })
      return {
        code: -3,
        message: '无权操作该订单'
      }
    }

    // 数字状态映射（兼容后台传枚举数字的情况）
    const numericStatusMap = {
      '1': 'pending',
      '2': 'paid',
      '3': 'ongoing',
      '4': 'completed',
      '5': 'cancelled'
    }

    // 如果传入的是数字，转换为字符串状态
    if (numericStatusMap[String(status)]) {
      console.log(`检测到数字状态 ${status}，转换为 ${numericStatusMap[String(status)]}`);
      status = numericStatusMap[String(status)];
    }

    // 定义状态文本映射
    const statusTextMap = {
      'pending': '待支付',
      'paid': '已支付',
      'ongoing': '进行中',
      'completed': '已完成',
      'cancelled': '已取消'
    }

    // 更新订单状态
    const updateData = {
      status: status,
      statusText: statusTextMap[status] || status,
      updateTime: new Date().toISOString()
    }

    // 根据状态添加额外字段
    if (status === 'paid') {
      updateData.payTime = new Date().toISOString()
      updateData.paymentMethod = 'wechat' // 微信支付
      
      // 支付成功时扣减库存（只在房型订单且之前未支付的情况下扣减）
      if (order.roomId && order.status === 'pending') {
        try {
          const itemRes = await db.collection('hotel_room').doc(order.roomId).get()
          if (itemRes.data) {
            const currentStock = itemRes.data.kucun || 0
            if (currentStock <= 0) {
              console.error('商品库存不足，无法完成支付')
            } else {
              await db.collection('hotel_room').doc(order.roomId).update({
                data: {
                  kucun: currentStock - 1
                }
              })
              updateData.stockDeducted = true // 标记库存已扣减
              console.log(`支付成功，库存已扣减: ${currentStock} -> ${currentStock - 1}`)
            }
          }
        } catch (stockError) {
          console.error('扣减库存失败:', stockError)
        }
      }
    }

    if (status === 'cancelled') {
      updateData.cancelTime = new Date().toISOString()

      // 如果订单取消且之前已支付并扣减了库存，需要恢复库存
      if (order.roomId && updateData.stockDeducted) {
        try {
          const itemRes = await db.collection('hotel_room').doc(order.roomId).get()
          if (itemRes.data) {
            const currentStock = itemRes.data.kucun || 0
            await db.collection('hotel_room').doc(order.roomId).update({
              data: {
                kucun: currentStock + 1
              }
            })
            console.log(`订单取消，库存已恢复: ${currentStock} -> ${currentStock + 1}`)
          }
        } catch (stockError) {
          console.error('恢复库存失败:', stockError)
        }
      }
    }

    const updateRes = await db.collection('orders')
      .doc(orderId)
      .update({
        data: updateData
      })

    console.log('订单状态更新成功:', updateRes)

    // 构建返回数据
    const resultData = {
      orderId: orderId,
      status: status,
      statusText: statusTextMap[status]
    }

    // 支付成功时返回支付时间
    if (status === 'paid') {
      resultData.payTime = updateData.payTime
    }

    return {
      code: 0,
      message: '订单状态更新成功',
      data: resultData
    }

  } catch (error) {
    console.error('更新订单状态失败:', error)
    return {
      code: -4,
      message: '更新失败: ' + error.message
    }
  }
}
