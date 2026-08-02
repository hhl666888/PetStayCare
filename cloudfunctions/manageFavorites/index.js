const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action, hotelId, hotelData } = event
  
  try {
    // 根据 openid 获取用户记录（统一使用 openid 小写）
    const userRes = await db.collection('users')
      .where({ openid: openid })
      .get()
    
    if (userRes.data.length === 0) {
      return { code: -1, message: '用户不存在', data: null }
    }
    
    const userDocId = userRes.data[0]._id
    
    switch (action) {
      case 'add':
        return await addFavorite(userDocId, hotelId, hotelData)
      case 'remove':
        return await removeFavorite(userDocId, hotelId)
      case 'list':
        return await getFavorites(userDocId)
      case 'check':
        return await checkFavorite(userDocId, hotelId)
      case 'clear':
        return await clearFavorites(userDocId)
      default:
        return { code: -1, message: '未知操作', data: null }
    }
  } catch (error) {
    console.error('manageFavorites 错误:', error)
    return { code: -1, message: error.message || '操作失败', data: null }
  }
}

// 添加收藏
async function addFavorite(userDocId, hotelId, hotelData) {
  // 获取用户当前收藏列表
  const userRes = await db.collection('users').doc(userDocId).get()
  const favorites = userRes.data.favorites || []
  
  // 检查是否已收藏
  if (favorites.includes(hotelId)) {
    return { code: -1, message: '已收藏', data: null }
  }
  
  // 添加到收藏列表（使用 addToSet 防止重复）
  await db.collection('users').doc(userDocId).update({
    data: {
      favorites: _.addToSet(hotelId)
    }
  })
  
  return { code: 0, message: '收藏成功', data: null }
}

  // 取消收藏
async function removeFavorite(userDocId, hotelId) {
  await db.collection('users').doc(userDocId).update({
    data: {
      favorites: _.pull(hotelId)
    }
  })
  
  return { code: 0, message: '取消收藏成功', data: null }
}

// 获取收藏列表
async function getFavorites(userDocId) {
  const userRes = await db.collection('users').doc(userDocId).get()
  const favoriteIds = userRes.data.favorites || []
  
  if (favoriteIds.length === 0) {
    return {
      code: 0,
      message: '获取成功',
      data: { list: [], total: 0 }
    }
  }
  
  // 批量获取酒店详情
  const hotelsRes = await db.collection('pet_hotel')
    .where({
      _id: _.in(favoriteIds)
    })
    .get()
  
  // 按收藏顺序返回
  const favorites = favoriteIds.map(id => {
    const hotel = hotelsRes.data.find(h => h._id === id)
    if (!hotel) return null
    return {
      id: hotel._id,
      name: hotel.hotel_name || hotel.name || '未命名酒店',
      image: hotel.image || hotel.banner?.[0] || '',
      address: hotel.hotel_address || hotel.address || '地址未知',
      rating: hotel.rating || hotel.score || 0,
      tags: hotel.hotel_tags || hotel.tags || []
    }
  }).filter(item => item !== null)
  
  return {
    code: 0,
    message: '获取成功',
    data: { list: favorites, total: favorites.length }
  }
}

// 检查是否已收藏
async function checkFavorite(userDocId, hotelId) {
  const userRes = await db.collection('users').doc(userDocId).get()
  const favorites = userRes.data.favorites || []
  
  return { 
    code: 0, 
    message: '检查完成',
    data: { isFavorited: favorites.includes(hotelId) }
  }
}

// 清空收藏
async function clearFavorites(userDocId) {
  await db.collection('users').doc(userDocId).update({
    data: {
      favorites: []
    }
  })
  
  return { code: 0, message: '清空成功', data: null }
}
