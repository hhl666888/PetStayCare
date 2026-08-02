// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 正则转义函数，防止特殊字符干扰匹配
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('搜索酒店云函数被调用，参数:', event);
  
  try {
    const { keyword, page = 1, pageSize = 20, recommendOnly = false } = event;
    
    let query = db.collection('pet_hotel');
    
    // 如果只需要推荐酒店
    if (recommendOnly) {
      query = query.where({ is_recommend: true });
    }
    
    // 如果有关键词，添加搜索条件
    if (keyword && keyword.trim()) {
      const searchKeyword = keyword.trim();
      // 转义正则特殊字符，确保搜索词被当作普通文本匹配
      const escapedKeyword = escapeRegExp(searchKeyword);
      
      // 使用 db.command.or 进行多字段搜索
      const _ = db.command;
      query = query.where(_.or([
        {
          hotel_name: db.RegExp({
            regexp: escapedKeyword,
            options: 'i' // 不区分大小写
          })
        },
        {
          hotel_address: db.RegExp({
            regexp: escapedKeyword,
            options: 'i'
          })
        },
        {
          description: db.RegExp({
            regexp: escapedKeyword,
            options: 'i'
          })
        },
        {
          serviceTags: db.RegExp({
            regexp: escapedKeyword,
            options: 'i'
          })
        }
      ]));
    }
    
    // 分页查询
    const skipCount = (page - 1) * pageSize;
    const result = await query.skip(skipCount).limit(pageSize).get();
    
    console.log('搜索结果数量:', result.data.length);
    
    // 查询每个酒店的房间最低价和服务信息
    const enrichedData = await Promise.all(result.data.map(async (hotel) => {
      try {
        // 查询该酒店的所有房间
        const roomsResult = await db.collection('hotel_room')
          .where({ hotel_id: hotel._id, status: 'active' })
          .field({ price: true })
          .get();
        
        // 计算最低价
        let minRoomPrice = null;
        let roomCount = 0;
        if (roomsResult.data && roomsResult.data.length > 0) {
          const prices = roomsResult.data
            .map(room => parseFloat(room.price) || 0)
            .filter(p => p > 0);
          if (prices.length > 0) {
            minRoomPrice = Math.min(...prices);
          }
          roomCount = roomsResult.data.length;
        }
        
        // 标签：只从 pet_hotel 集合获取 tags 字段
        let allTags = [];
        
        // 添加 tags 数组
        if (Array.isArray(hotel.tags) && hotel.tags.length > 0) {
          const validTags = hotel.tags.filter(tag => typeof tag === 'string' && tag.trim());
          allTags = allTags.concat(validTags);
        } else if (typeof hotel.tags === 'string' && hotel.tags.trim()) {
          // 如果tags是逗号分隔的字符串
          allTags = allTags.concat(hotel.tags.split(',').map(t => t.trim()).filter(t => t));
        }
        
        // 去重
        allTags = [...new Set(allTags)];
        
        return {
          ...hotel,
          min_room_price: minRoomPrice,
          room_count: roomCount,
          allTags: allTags,
          score: hotel.score || 0
        };
      } catch (err) {
        console.error('处理酒店数据失败:', hotel._id, err);
        return {
          ...hotel,
          min_room_price: null,
          room_count: 0,
          serviceNames: [],
          allTags: []
        };
      }
    }));
    
    console.log('搜索结果数量:', enrichedData.length);
    
    // 记录搜索到的酒店信息
    enrichedData.forEach((hotel, index) => {
      console.log(`搜索结果 ${index + 1}:`, {
        name: hotel.hotel_name || hotel.name,
        address: hotel.hotel_address || hotel.address,
        minPrice: hotel.min_room_price,
        roomCount: hotel.room_count,
        tags: hotel.allTags
      });
    });
    
    // 按房间最低价升序排序（无价格排后面）
    enrichedData.sort((a, b) => {
      const priceA = a.min_room_price || Infinity;
      const priceB = b.min_room_price || Infinity;
      return priceA - priceB;
    });

    // 获取符合条件的总记录数
    let total = 0;
    try {
      const countQuery = db.collection('pet_hotel');
      
      // 如果只需要推荐酒店
      if (recommendOnly) {
        countQuery.where({ is_recommend: true });
      }
      
      if (keyword && keyword.trim()) {
        const escapedKeyword = escapeRegExp(keyword.trim());
        const _ = db.command;
        if (recommendOnly) {
          // 同时有推荐和关键词条件
          countQuery.where(_.and([
            { is_recommend: true },
            _.or([
              { hotel_name: db.RegExp({ regexp: escapedKeyword, options: 'i' }) },
              { hotel_address: db.RegExp({ regexp: escapedKeyword, options: 'i' }) },
              { description: db.RegExp({ regexp: escapedKeyword, options: 'i' }) },
              { serviceTags: db.RegExp({ regexp: escapedKeyword, options: 'i' }) }
            ])
          ]));
          total = (await countQuery.count()).total;
        } else {
          total = (await countQuery.where(_.or([
            { hotel_name: db.RegExp({ regexp: escapedKeyword, options: 'i' }) },
            { hotel_address: db.RegExp({ regexp: escapedKeyword, options: 'i' }) },
            { description: db.RegExp({ regexp: escapedKeyword, options: 'i' }) },
            { serviceTags: db.RegExp({ regexp: escapedKeyword, options: 'i' }) }
          ])).count()).total;
        }
      } else {
        total = (await countQuery.count()).total;
      }
    } catch (countError) {
      console.error('获取总数失败:', countError);
      total = enrichedData.length;
    }
    
    return {
      code: 0,
      message: '获取成功',
      data: enrichedData,
      keyword: keyword,
      page: page,
      pageSize: pageSize,
      total: total
    };
    
  } catch (error) {
    console.error('搜索酒店失败:', error);
    return {
      code: -1,
      message: error.message,
      data: []
    };
  }
}