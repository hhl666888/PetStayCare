// 获取订单列表云函数（合并getOrderDetail功能）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 辅助函数：获取状态文本
function getStatusText(status) {
  const statusMap = {
    'pending': '待支付',
    'paid': '已支付',
    'ongoing': '进行中',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
}

// 辅助函数：获取状态颜色
function getStatusColor(status) {
  const colorMap = {
    'pending': '#FF9800',
    'paid': '#4CAF50',
    'ongoing': '#4CAF50',
    'completed': '#9E9E9E',
    'cancelled': '#F44336'
  };
  return colorMap[status] || '#999999';
}

// 辅助函数：获取状态背景色
function getStatusBgColor(status) {
  const bgColorMap = {
    'pending': '#FFF3E0',
    'paid': '#E8F5E9',
    'ongoing': '#E8F5E9',
    'completed': '#F5F5F5',
    'cancelled': '#FFEBEE'
  };
  return bgColorMap[status] || '#F5F5F5';
}

// 辅助函数：将 Date 对象或时间戳格式化为字符串 (YYYY-MM-DD)
function formatDateToString(dateValue) {
  if (!dateValue) return '';
  try {
    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'number') {
      // 时间戳
      date = new Date(dateValue);
    } else if (typeof dateValue === 'string') {
      // 字符串日期
      date = new Date(dateValue);
    } else {
      return '';
    }
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.warn('格式化日期失败:', e);
    return '';
  }
}

// 辅助函数：将 Date 对象或时间戳格式化为完整时间字符串 (YYYY-MM-DD HH:mm:ss)
function formatDateTimeToString(dateValue) {
  if (!dateValue) return null;
  try {
    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'number') {
      date = new Date(dateValue);
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else {
      return null;
    }
    if (isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch (e) {
    console.warn('格式化日期时间失败:', e);
    return null;
  }
}

// 辅助函数：获取订单类型文本
function getOrderTypeText(orderType) {
  const orderTypeMap = {
    'room': 'room',
    'service': 'service',
    '1': 'room',
    '2': 'service'
  };
  return orderTypeMap[orderType] || orderType || 'unknown';
}

// 获取单个订单详情
async function getOrderDetail(orderId) {
  try {
    const result = await db.collection('orders').doc(orderId).get();
    
    if (result.data) {
      const order = result.data;

      // 如果有房型ID，从hotel_room集合查询真实的room_name
      if (order.roomId) {
        try {
          const roomResult = await db.collection('hotel_room').doc(order.roomId).get();
          if (roomResult.data) {
            order.roomName = roomResult.data.room_name || order.roomName;
            order.roomPrice = roomResult.data.price || order.roomPrice;
          }
        } catch (roomError) {
          console.error('查询房型信息失败:', roomError);
        }
      }

      // 如果有服务ID，从supporting_services集合查询真实的service_name
      if (order.serviceId) {
        try {
          const serviceResult = await db.collection('supporting_services').doc(order.serviceId).get();
          if (serviceResult.data) {
            order.serviceName = serviceResult.data.service_name || serviceResult.data.name || order.serviceName;
            order.servicePrice = serviceResult.data.price || order.servicePrice;
          }
        } catch (serviceError) {
          console.error('查询服务信息失败:', serviceError);
        }
      }

      return {
        code: 0,
        message: '获取成功',
        data: order
      };
    } else {
      throw new Error('订单不存在');
    }
  } catch (error) {
    console.error('获取订单详情失败:', error);
    return {
      code: -1,
      message: error.message || '获取订单详情失败',
      data: null
    };
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  // 如果传入了orderId,则获取单个订单详情
  if (event.orderId) {
    return await getOrderDetail(event.orderId);
  }

  try {
    const {
      page = 1,
      pageSize = 10,
      userId,
      status = 'all'
    } = event;

    // 构建查询条件
    let queryConditions = {};

    // 如果指定了用户ID，按用户查询
    if (userId && userId !== 'default_user') {
      queryConditions.openid = userId;
    }
    
    // 如果指定了状态，按状态查询
    if (status && status !== 'all') {
      const statusMap = {
        'pending': ['pending', '1'],
        'paid': ['paid', '2'],
        'ongoing': ['ongoing', '3'],
        'completed': ['completed', '4'],
        'cancelled': ['cancelled', '5']
      };
      
      const statusList = statusMap[status];
      if (statusList) {
        queryConditions.status = db.command.in(statusList);
      }
    }
    
    // 构建查询
    let query = db.collection('orders');
    if (Object.keys(queryConditions).length > 0) {
      query = query.where(queryConditions);
    }
    
    // 按创建时间倒序排列
    query = query.orderBy('createTime', 'desc');
    
    // 分页查询
    const skipCount = (page - 1) * pageSize;
    query = query.skip(skipCount).limit(pageSize);
    
    // 执行查询
    const result = await query.get();
    // 获取总数
    const countResult = await (Object.keys(queryConditions).length > 0 
      ? db.collection('orders').where(queryConditions).count()
      : db.collection('orders').count());
    const total = countResult.total || 0;

    // 获取订单中的酒店ID列表 - 支持多种字段名
    const hotelIds = [...new Set(result.data.map(order => {
      return order.hotelId || order.hotel_id || order.hotel;
    }).filter(id => id))];
    
    // 从pet_hotel集合批量获取酒店详细信息（N+1优化）
    let hotelDetails = {};
    if (hotelIds.length > 0) {
      try {
        // 使用 _.in() 批量查询
        const hotelRes = await db.collection('pet_hotel')
          .where({
            _id: _.in(hotelIds)
          })
          .field({
            _id: true,
            hotel_name: true,
            hotel_address: true,
            contact_phone: true,
            hotel_phone: true,
            address: true,
            location: true,
            score: true
          })
          .get();
        
        // 构建 hotelDetails 映射
        (hotelRes.data || []).forEach(hotel => {
          hotelDetails[hotel._id] = {
            hotelName: hotel.hotel_name || '未知酒店',
            phone: hotel.contact_phone || hotel.hotel_phone || '暂无电话',
            address: hotel.hotel_address || hotel.address || hotel.location || '暂无地址',
            rating: hotel.score || 0
          };
        });
      } catch (hotelError) {
        console.error('获取酒店详情失败:', hotelError);
      }
    }

    // 将酒店信息合并到订单数据中
    const ordersWithHotelDetails = result.data.map(order => {
      const hotelIdForLookup = order.hotelId || order.hotel_id || order.hotel;
      const hotelInfo = hotelDetails[hotelIdForLookup] || {};

      // 创建酒店对象,优先使用从pet_hotel集合获取的信息
      const hotelData = {
        id: hotelIdForLookup,
        name: hotelInfo.hotelName || order.hotelName || order.hotel_name || '未知酒店',
        phone: hotelInfo.phone || order.hotelPhone || order.contact_phone || '暂无电话',
        address: hotelInfo.address || order.hotelAddress || order.hotel_address || order.address || '地址待完善',
        rating: hotelInfo.rating || order.rating || 0
      };

      // 处理预约时间
      let appointmentDate = order.appointmentDate || '';
      let appointmentTime = order.appointmentTime || '';
      let appointmentDateTime = order.appointmentDateTime || '';
      
      // 格式化日期为"年月日"格式 (如: 2026年3月15日)
      let formattedDate = appointmentDate;
      if (appointmentDate && appointmentDate.includes('-')) {
        try {
          const dateParts = appointmentDate.split('-');
          if (dateParts.length === 3) {
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]);
            const day = parseInt(dateParts[2]);
            formattedDate = `${year}年${month}月${day}日`;
          }
        } catch (e) {
          console.warn('格式化appointmentDate失败:', e);
        }
      }
      
      // 格式化时间为友好格式 (如: 上午10:00)
      let formattedTime = appointmentTime;
      if (appointmentTime && appointmentTime.includes(':')) {
        try {
          const [hourStr, minuteStr] = appointmentTime.split(':');
          const hour = parseInt(hourStr, 10);
          const timePeriod = hour < 12 ? '上午' : (hour < 18 ? '下午' : '晚上');
          const displayHour = hour % 12 || 12;
          formattedTime = `${timePeriod}${displayHour}:${minuteStr}`;
        } catch (e) {
          console.warn('格式化appointmentTime失败:', e);
        }
      }

      // 优先使用单独的日期和时间字段
      if (appointmentDate && appointmentTime) {
        // 格式化为友好显示格式: 2026年7月9日 上午10:00
        try {
          const [hourStr, minuteStr] = appointmentTime.split(':');
          const hour = parseInt(hourStr, 10);
          const timePeriod = hour < 12 ? '上午' : (hour < 18 ? '下午' : '晚上');
          const displayHour = hour % 12 || 12;

          const dateParts = appointmentDate.split('-');
          if (dateParts.length === 3) {
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]);
            const day = parseInt(dateParts[2]);
            appointmentDateTime = `${year}年${month}月${day}日 ${timePeriod}${displayHour}:${minuteStr}`;
          }
        } catch (e) {
          console.warn('格式化appointmentDateTime失败:', e);
          appointmentDateTime = `${appointmentDate} ${appointmentTime}`;
        }
      } else if (appointmentDateTime) {
        // 如果没有单独的日期和时间,尝试从appointmentDateTime解析
        try {
          // 判断是否是ISO格式
          if (appointmentDateTime.includes('T')) {
            const dateTime = new Date(appointmentDateTime);
            appointmentDate = `${dateTime.getFullYear()}-${String(dateTime.getMonth() + 1).padStart(2, '0')}-${String(dateTime.getDate()).padStart(2, '0')}`;
            appointmentTime = `${String(dateTime.getHours()).padStart(2, '0')}:${String(dateTime.getMinutes()).padStart(2, '0')}`;

            const year = dateTime.getFullYear();
            const month = dateTime.getMonth() + 1;
            const day = dateTime.getDate();
            const hour = dateTime.getHours();
            const minute = String(dateTime.getMinutes()).padStart(2, '0');
            const timePeriod = hour < 12 ? '上午' : (hour < 18 ? '下午' : '晚上');
            const displayHour = hour % 12 || 12;

            appointmentDateTime = `${year}年${month}月${day}日 ${timePeriod}${displayHour}:${minute}`;
          } else {
            // 普通格式 "2026-07-09 10:00"
            const parts = appointmentDateTime.split(' ');
            if (parts.length === 2) {
              appointmentDate = parts[0];
              appointmentTime = parts[1];

              const [hourStr, minuteStr] = parts[1].split(':');
              const hour = parseInt(hourStr, 10);
              const timePeriod = hour < 12 ? '上午' : (hour < 18 ? '下午' : '晚上');
              const displayHour = hour % 12 || 12;

              const dateParts = parts[0].split('-');
              if (dateParts.length === 3) {
                const year = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]);
                const day = parseInt(dateParts[2]);
                appointmentDateTime = `${year}年${month}月${day}日 ${timePeriod}${displayHour}:${minuteStr}`;
              }
            }
          }
        } catch (e) {
          console.warn('解析appointmentDateTime失败:', e);
        }
      }

      // 处理入住退房日期 - 支持 Date 对象、时间戳或字符串
      const checkInDateStr = formatDateToString(order.checkInDate);
      const checkOutDateStr = formatDateToString(order.checkOutDate);
      let nights = order.nights || 1;

      // 如果有入住退房日期但没有nights,计算天数
      if (checkInDateStr && checkOutDateStr && !order.nights) {
        try {
          const start = new Date(order.checkInDate);
          const end = new Date(order.checkOutDate);
          const diffTime = end - start;
          nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } catch (e) {
          console.warn('计算nights失败:', e);
        }
      }

      // 处理价格信息
      const roomPrice = parseFloat(order.roomPrice || order.price || 0);
      const actualPrice = parseFloat(order.actualPrice || 0);
      const serviceFee = parseFloat(order.serviceFee || 0);

      return {
        ...order,
        hotel: hotelData,
        // 确保关键字段存在
        id: order._id || order.id,
        orderType: getOrderTypeText(order.orderType) || (order.roomId ? 'room' : 'service'), // 确保订单类型字段存在（标准化）
        appointmentDate: formattedDate || appointmentDate,
        appointmentTime: formattedTime || appointmentTime,
        appointmentDateTime: appointmentDateTime,
        checkInDate: checkInDateStr,
        checkOutDate: checkOutDateStr,
        nights: nights,
        roomPrice: roomPrice,
        actualPrice: actualPrice,
        serviceFee: serviceFee,
        // 格式化状态文本
        statusText: getStatusText(order.status),
        statusColor: getStatusColor(order.status),
        statusBgColor: getStatusBgColor(order.status),
        // 格式化订单类型文本
        orderTypeText: getOrderTypeText(order.orderType),
        // 格式化支付时间（仅已支付的订单显示）
        payTime: order.status === 'paid' ? formatDateTimeToString(order.payTime) : null
      };
    });
    
    return {
      code: 0,
      message: '获取订单列表成功',
      data: {
        orders: ordersWithHotelDetails,
        page: page,
        pageSize: pageSize,
        total: total,
        hasMore: page * pageSize < total
      }
    };
    
  } catch (error) {
    console.error('获取订单列表失败:', error);
    return {
      code: -1,
      message: error.message,
      data: null
    };
  }
};