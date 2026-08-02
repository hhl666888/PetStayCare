// 创建订单云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 参数验证函数
function validateParams(event) {
  const errors = [];
  
  if (!event.hotelId) {
    errors.push('缺少酒店ID');
  }
  
  if (!event.contactName || !event.contactName.trim()) {
    errors.push('缺少联系人姓名');
  }
  
  if (!event.contactPhone || !event.contactPhone.trim()) {
    errors.push('缺少联系电话');
  }
  
  // 验证手机号格式
  if (event.contactPhone && !/^1[3-9]\d{9}$/.test(event.contactPhone)) {
    errors.push('手机号格式不正确');
  }
  
  return errors;
}

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('创建订单云函数被调用:', event);

  // 1. 参数验证
  const validationErrors = validateParams(event);
  if (validationErrors.length > 0) {
    return {
      code: -1,
      message: validationErrors.join('; '),
      data: null
    };
  }

  // 2. 权限验证 - 必须获取到用户的openid
  const wxContext = cloud.getWXContext();
  const userOpenid = wxContext.OPENID;
  
  console.log('🔐 用户标识获取:', {
    openid: userOpenid || '❌ 未获取'
  });

  if (!userOpenid) {
    return {
      code: -2,
      message: '用户未登录，请先登录',
      data: null
    };
  }

  try {
    const {
      hotelId,
      roomId,
      serviceId,
      checkInDate,
      checkOutDate,
      nights,
      pets,
      contactName,
      contactPhone,
      actualPrice,
      appointmentDate,
      appointmentTime
    } = event;

    // 生成订单ID
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    // 订单类型判断
    let orderType = event.orderType;
    if (!orderType) {
      if (roomId) {
        orderType = 'room';
      } else if (serviceId) {
        orderType = 'service';
      } else {
        orderType = 'unknown';
      }
    }

    // 构建基础订单数据
    const orderData = {
      _id: orderId,
      hotelId,
      orderType: orderType,
      status: 'pending',
      statusText: '待支付',
      actualPrice: actualPrice || 0,
      paymentMethod: '微信支付',
      payTime: '',
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      pets: pets || [],
      createTime: new Date(),
      // 订单用 openid (小写)
      openid: userOpenid
    };

    // 根据订单类型添加不同的可选字段
    if (orderType === 'room' && roomId) {
      orderData.roomId = roomId;
      // 将字符串日期转为 Date 类型存入数据库
      orderData.checkInDate = checkInDate ? new Date(checkInDate) : null;
      orderData.checkOutDate = checkOutDate ? new Date(checkOutDate) : null;
      orderData.nights = nights || 1;
    } else if (orderType === 'service' && serviceId) {
      orderData.serviceId = serviceId;
      orderData.appointmentDate = appointmentDate || '';
      orderData.appointmentTime = appointmentTime || '';
    }

    console.log('📋 订单基础数据构建完成:', {
      orderId,
      orderType: orderData.orderType,
      status: orderData.status,
      openid: orderData.openid
    });

    // 注意：不再在创建订单时扣减库存，只有支付成功后才扣减
    // 库存扣减逻辑移到 updateOrderStatus 中处理

    // 保存到数据库
    const result = await db.collection('orders').add({
      data: orderData
    });

    console.log('订单创建成功:', orderId);

    // 返回成功结果 - 统一格式 {code, message, data}
    return {
      code: 0,
      message: '订单创建成功',
      data: {
        orderId: orderId,
        orderData: orderData,
        createTime: orderData.createTime
      }
    };

  } catch (error) {
    console.error('创建订单失败:', error);

    return {
      code: -3,
      message: '创建订单失败: ' + error.message,
      data: null
    };
  }
};
