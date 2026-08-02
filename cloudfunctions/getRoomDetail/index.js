// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('获取房型详情云函数被调用，参数:', event);
  
  try {
    const { roomId, hotelId } = event

    if (!roomId || !hotelId) {
      throw new Error('房型ID和酒店ID不能为空')
    }

    // 获取房型信息
    const roomResult = await db.collection('hotel_room')
      .doc(roomId)
      .get()

    if (!roomResult.data) {
      throw new Error('房型不存在')
    }

    const room = roomResult.data

    // 确保房型属于指定酒店
    if (room.hotel_id !== hotelId) {
      throw new Error('房型信息不匹配')
    }

    // 获取酒店基本信息
    const hotelResult = await db.collection('pet_hotel')
      .doc(hotelId)
      .get()

    if (!hotelResult.data) {
      throw new Error('酒店不存在')
    }

    const hotel = hotelResult.data

    // 处理房型数据 - 透传 hotel_room 所有字段
    const processedRoom = {
      _id: room._id,
      room_name: room.room_name || '标准间',
      price: room.price || 0,
      capacity: room.capacity || 1,
      pet_size: room.pet_size || 0,
      size: room.pet_size ? `${room.pet_size}平方` : '标准间',
      img: room.img || [],
      kucun: room.kucun !== undefined ? room.kucun : 10,
      hotel_id: room.hotel_id,
      status: room.status || 'active',
      description: room.description || '舒适的宠物寄养环境',
      facilities: Array.isArray(room.facilities) ? room.facilities : ['24小时监控', '空调', '独立空间']
    }

    // 处理酒店数据
    const processedHotel = {
      _id: hotel._id,
      hotel_name: hotel.hotel_name || '宠物酒店',
      hotel_address: hotel.hotel_address || '地址待完善',
      hotel_phone: hotel.hotel_phone || '暂无电话',
      score: hotel.score || 4.5
    }

    console.log('处理后的房型数据:', processedRoom);
    console.log('处理后的酒店数据:', processedHotel);

    return {
      code: 0,
      message: '获取成功',
      data: {
        room: processedRoom,
        hotel: processedHotel
      }
    }

  } catch (error) {
    console.error('获取房型详情失败:', error)
    return {
      code: -1,
      message: error.message || '获取房型详情失败'
    }
  }
}