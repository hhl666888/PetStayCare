// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 处理酒店图片的函数
function processHotelImages(hotel) {
  console.log('开始处理酒店图片，原始数据:', hotel);

  // 尝试多种图片字段，按优先级处理
  let images = [];

  // 1. 优先处理banner字段
  if (hotel.banner) {
    console.log('处理banner字段:', hotel.banner, '类型:', typeof hotel.banner);
    if (Array.isArray(hotel.banner)) {
      images = hotel.banner.filter(img => img && img.trim() !== '');
      console.log('banner是数组，过滤后:', images);
    } else if (typeof hotel.banner === 'string') {
      // 如果是字符串，尝试分割
      if (hotel.banner.includes(',')) {
        images = hotel.banner.split(',').map(img => img.trim()).filter(img => img);
      } else {
        images = [hotel.banner.trim()];
      }
      console.log('banner是字符串，处理后:', images);
    }
  }

  // 2. 如果banner为空，尝试hotel_images字段
  if (images.length === 0 && hotel.hotel_images) {
    console.log('处理hotel_images字段:', hotel.hotel_images);
    if (Array.isArray(hotel.hotel_images)) {
      images = hotel.hotel_images.filter(img => img && img.trim() !== '');
    } else if (typeof hotel.hotel_images === 'string') {
      if (hotel.hotel_images.includes(',')) {
        images = hotel.hotel_images.split(',').map(img => img.trim()).filter(img => img);
      } else {
        images = [hotel.hotel_images.trim()];
      }
    }
    console.log('hotel_images处理后:', images);
  }

  // 3. 如果还是空，尝试images字段
  if (images.length === 0 && hotel.images) {
    console.log('处理images字段:', hotel.images);
    if (Array.isArray(hotel.images)) {
      images = hotel.images.filter(img => img && img.trim() !== '');
    } else if (typeof hotel.images === 'string') {
      if (hotel.images.includes(',')) {
        images = hotel.images.split(',').map(img => img.trim()).filter(img => img);
      } else {
        images = [hotel.images.trim()];
      }
    }
    console.log('images处理后:', images);
  }

  // 4. 过滤掉云存储图片中可能存在问题的URL（某些特定路径）
  images = images.filter(img => {
    if (!img) return false;
    const imgStr = String(img).trim();
    // 过滤掉空值
    if (!imgStr) return false;

    // 过滤掉weda-uploader路径的云存储图片（这些通常来自低代码平台，可能无法访问）
    if (imgStr.includes('weda-uploader')) {
      console.log('过滤掉weda-uploader路径的图片:', imgStr);
      return false;
    }

    // 保留有效图片，包括云存储图片和HTTP/HTTPS图片
    // 云存储图片格式：cloud://xxx
    // 网络图片格式：http://xxx 或 https://xxx
    return imgStr.startsWith('cloud://') ||
           imgStr.startsWith('http://') ||
           imgStr.startsWith('https://');
  });

  console.log('过滤URL格式后的图片数组:', images);

  // 5. 如果既有网络图片又有云存储图片，优先使用网络图片
  const cloudImages = images.filter(img => img.startsWith('cloud://'));
  const networkImages = images.filter(img => !img.startsWith('cloud://'));

  console.log('云存储图片数量:', cloudImages.length);
  console.log('网络图片数量:', networkImages.length);

  if (networkImages.length > 0) {
    console.log('优先使用网络图片');
    images = [...networkImages, ...cloudImages];
  }

  // 6. 如果所有图片字段都为空，提供默认图片
  if (images.length === 0) {
    images = ['https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'];
    console.log('使用默认图片');
  }

  console.log('最终处理后的图片数组:', images);
  return images;
}

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('获取酒店详情云函数被调用，参数:', event);
  
  try {
    const { hotelId } = event

    if (!hotelId) {
      throw new Error('酒店ID不能为空')
    }

    // 获取酒店基本信息
    const hotelResult = await db.collection('pet_hotel')
      .doc(hotelId)
      .get()

    if (!hotelResult.data) {
      throw new Error('酒店不存在')
    }

    const hotel = hotelResult.data

    // 获取房型信息
    const roomsResult = await db.collection('hotel_room')
      .where({
        hotel_id: hotelId,
        status: 'active'
      })
      .orderBy('price', 'asc')
      .get()

    // 获取配套服务 - 只显示 hotel_id 严格匹配的服务
    console.log('查询 supporting_services，hotel_id:', hotelId);
    
    let servicesResult;
    try {
      servicesResult = await db.collection('supporting_services')
        .where({
          hotel_id: hotelId
        })
        .get()
      
      console.log('supporting_services 查询结果:', servicesResult);
      console.log('服务数量:', servicesResult.data ? servicesResult.data.length : 0);
    } catch (e) {
      console.log('查询 supporting_services 失败:', e.message);
      servicesResult = { data: [] };
    }

    // 处理服务数据，支持数据库表中实际存在的多种字段名
    console.log('=== 开始处理服务数据 ===');
    console.log('原始服务数据:', servicesResult.data);

    const processedServices = servicesResult.data.map((service, index) => {
      console.log(`\n处理服务 ${index}:`, {
        _id: service._id,
        // 支持多种可能的名称字段
        name: service.name,
        service_name: service.service_name,
        description: service.description,
        service_desc: service.service_desc,
        desc: service.desc,
        // 支持多种可能的图片字段
        image: service.image,
        service_image: service.service_image,
        service_img: service.service_img,
        img: service.img,
        images: service.images,
        price: service.price
      });

      // 处理服务名称 - 支持多种可能的字段名
      const serviceName = service.service_name || service.name || service.title || '服务项目';
      
      // 处理服务描述 - 支持多种可能的字段名
      const serviceDesc = service.service_desc || service.description || service.desc || '';
      
      // 处理服务图片 - 支持多种可能的字段名，按优先级选择
      let serviceImage = null;
      const imageFields = ['image', 'service_image', 'service_img', 'img'];
      
      for (const field of imageFields) {
        if (service[field]) {
          if (Array.isArray(service[field]) && service[field].length > 0) {
            // 取数组的第一个有效图片
            for (const img of service[field]) {
              let imgUrl = typeof img === 'object' ? img.url : img;
              if (imgUrl && typeof imgUrl === 'string' && imgUrl.trim() !== '' &&
                  (imgUrl.startsWith('cloud://') || imgUrl.startsWith('http'))) {
                serviceImage = imgUrl;
                console.log(`服务 ${index} 使用 ${field}[0]:`, serviceImage);
                break;
              }
            }
          } else if (typeof service[field] === 'string' && service[field].trim() !== '' &&
                     (service[field].startsWith('cloud://') || service[field].startsWith('http'))) {
            serviceImage = service[field];
            console.log(`服务 ${index} 使用 ${field} 字符串:`, serviceImage);
          }
          if (serviceImage) break;
        }
      }

      // 处理 images 数组字段
      let imagesArray = [];
      if (service.images && Array.isArray(service.images)) {
        imagesArray = service.images
          .map(img => typeof img === 'object' ? img.url : img)
          .filter(img => img && typeof img === 'string' && img.trim() !== '' &&
                        (img.startsWith('cloud://') || img.startsWith('http')));
      }

      // 如果图片为空，提供默认图片
      if (!serviceImage || (typeof serviceImage === 'string' && serviceImage.trim() === '')) {
        if (imagesArray.length > 0) {
          serviceImage = imagesArray[0];
        } else {
          serviceImage = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';
          console.log(`服务 ${index} 图片为空，使用默认图片`);
        }
      }

      console.log(`服务 ${index} 最终图片URL:`, serviceImage);
      console.log(`服务 ${index} 最终名称:`, serviceName);
      console.log(`服务 ${index} 最终描述:`, serviceDesc);

      return {
        ...service,
        id: service._id || service.id,
        // 统一字段名，确保前端可以使用
        service_name: serviceName,      // 统一使用 service_name
        name: serviceName,              // 同时保留 name
        description: serviceDesc,       // 统一使用 description
        service_desc: serviceDesc,      // 同时保留 service_desc
        image: serviceImage,
        images: imagesArray.length > 0 ? imagesArray : [serviceImage],
        originalPrice: service.original_price || (service.price ? parseFloat(service.price) * 1.5 : 99),
        price: parseFloat(service.price) || 0
      };
    });

    console.log('=== 处理后的服务数据 ===');
    console.log('processedServices:', processedServices);

    // 处理房型数据
    const processedRooms = roomsResult.data.map(room => {
      return {
        _id: room._id,
        room_name: room.room_name || '标准间',
        description: room.description || '舒适的宠物寄养环境，提供专业护理服务',
        price: room.price || 0,
        capacity: room.capacity || 1,
        // 优先使用 pet_size 字段，后面加上"平方"
        size: room.pet_size ? `${room.pet_size}平方` : (room.size || room.area || '标准间'),
        pet_size: room.pet_size, // 保留原始 pet_size 字段供前端使用
        facilities: room.facilities || ['24小时监控', '空调', '独立空间'],
        img: room.img || [],
        kucun: room.kucun !== undefined ? room.kucun : 0,
        hotel_id: room.hotel_id,
        status: room.status || 'active'
      }
    })
    
    console.log('处理后的房型数据:', processedRooms);

    return {
      code: 0,
      message: '获取成功',
      data: {
        hotel: {
          _id: hotel._id,
          hotel_name: hotel.hotel_name,
          hotel_address: hotel.hotel_address,
          hotel_phone: hotel.hotel_phone,
          business_hours: hotel.business_hours,
          jianjie: hotel.jianjie || '暂无简介',
          score: hotel.score,
          hotel_latitude: hotel.hotel_latitude,
          hotel_longitude: hotel.hotel_longitude,
          banner: hotel.banner,
          hotel_images: hotel.hotel_images,
          unified_images: processHotelImages(hotel),
          services: processedServices,
          room_count: roomsResult.data.length
        },
        rooms: processedRooms
      }
    }

  } catch (error) {
    console.error('获取酒店详情失败:', error)
    return {
      code: -1,
      message: error.message || '获取酒店详情失败',
      data: null
    }
  }
}