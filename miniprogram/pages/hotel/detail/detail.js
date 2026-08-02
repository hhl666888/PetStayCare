// pages/hotel/detail/detail.js
const { callFunction } = require('../../../config/cloud.js');
const favoritesManager = require('../../../utils/favorites.js');

Page({
  data: {
    hotelId: '',
    hotel: null,
    originalHotelData: null, // 保存未转换云存储URL的原始数据，用于收藏
    rooms: [],
    loading: true,
    currentImageIndex: 0,
    isFavorite: false
  },

  onLoad: function(options) {
    console.log('酒店详情页面接收到的参数:', options);
    
    if (options.id) {
      this.setData({
        hotelId: options.id
      });
      
      // 加载酒店详情
      this.loadHotelDetail();
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 检查收藏状态
  checkFavoriteStatus: async function() {
    if (!this.data.hotel) return;
    
    try {
      const isFav = await favoritesManager.isFavorite(this.data.hotel.id);
      this.setData({
        isFavorite: isFav
      });
      console.log('收藏状态:', isFav);
    } catch (error) {
      console.error('检查收藏状态失败:', error);
      this.setData({
        isFavorite: false
      });
    }
  },

  // 切换收藏状态
  onFavorite: async function() {
    console.log('收藏按钮被点击，当前收藏状态:', this.data.isFavorite);
    console.log('酒店数据:', this.data.hotel);
    
    if (!this.data.hotel) {
      wx.showToast({
        title: '酒店信息加载中',
        icon: 'none'
      });
      return;
    }

    if (!this.data.hotel.id) {
      wx.showToast({
        title: '酒店ID不存在',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: this.data.isFavorite ? '取消收藏中...' : '收藏中...'
    });

    let result;
    if (this.data.isFavorite) {
      // 取消收藏
      console.log('执行取消收藏，酒店ID:', this.data.hotel.id);
      result = await favoritesManager.removeFavorite(this.data.hotel.id);
    } else {
      // 添加收藏 - 使用原始未转换的数据（包含cloud://链接）
      console.log('执行添加收藏，酒店数据:', this.data.hotel);
      console.log('使用原始数据收藏（未转换cloud://链接）:', this.data.originalHotelData);
      result = await favoritesManager.addFavorite(this.data.originalHotelData);
    }

    wx.hideLoading();

    if (result.success) {
      this.setData({
        isFavorite: !this.data.isFavorite
      });
      
      wx.showToast({
        title: result.message,
        icon: 'success',
        duration: 1500
      });
      
      // 更新收藏按钮显示
      this.updateFavoriteButton();
    } else {
      wx.showToast({
        title: result.message,
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 更新收藏按钮显示
  updateFavoriteButton: function() {
    // 这里可以添加一些UI更新逻辑
    console.log('收藏按钮状态已更新');
  },


  
  // 加载酒店详情
  loadHotelDetail: function() {
    if (!this.data.hotelId) {
      wx.showToast({
        title: '酒店ID不能为空',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '加载中...'
    });

    console.log('🔍 开始加载酒店详情，酒店ID:', this.data.hotelId);

    // 调用获取详情函数
    callFunction('getHotelDetail', {
      hotelId: this.data.hotelId
    })
    .then(res => {
      console.log('获取酒店详情成功:', res);

      // 统一响应格式: res 已经是 data 部分
      const { hotel, rooms } = res;

      console.log('=== 数据处理 ===');
      console.log('酒店信息:', hotel);
      console.log('房型数量:', rooms ? rooms.length : 0);

      const processedHotel = this.processHotelData(hotel);
      const processedRooms = this.processRoomsData(rooms || []);

      console.log('处理完成，准备转换云存储图片URL');

      // 保存未转换的原始数据，用于收藏（确保保存cloud://链接）
      this.setData({
        originalHotelData: hotel
      });

      // 先转换云存储图片URL，转换完成后再设置数据
      this.convertCloudImages(processedHotel, processedRooms).then(() => {
        console.log('云存储图片转换完成，设置页面数据');

        // 设置数据
        this.setData({
          hotel: processedHotel,
          rooms: processedRooms,
          loading: false
        });

        // 检查收藏状态
        this.checkFavoriteStatus();

        wx.hideLoading();

        // 设置导航栏标题
        wx.setNavigationBarTitle({
          title: processedHotel.hotel_name || processedHotel.name || '酒店详情'
        });
      }).catch(err => {
        console.error('云存储图片转换失败，但继续使用原数据:', err);

        // 转换失败也继续使用原数据
        this.setData({
          hotel: processedHotel,
          rooms: processedRooms,
          loading: false
        });

        // 检查收藏状态
        this.checkFavoriteStatus();

        wx.hideLoading();

        // 设置导航栏标题
        wx.setNavigationBarTitle({
          title: processedHotel.hotel_name || processedHotel.name || '酒店详情'
        });
      });
    })
    .catch(err => {
      console.error('获取酒店详情失败:', err);
      wx.hideLoading();

      this.setData({ loading: false });

      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 2000
      });
    });
  },

  // 处理酒店数据
  processHotelData: function(hotel) {
    console.log('处理酒店数据，原始数据:', hotel);
    console.log('banner字段内容:', hotel.banner);
    console.log('hotel_images字段内容:', hotel.hotel_images);
    console.log('images字段内容:', hotel.images);
    console.log('unified_images字段内容:', hotel.unified_images);
    
    // 检查坐标字段
    console.log('=== 坐标字段调试信息 ===');
    console.log('hotel_latitude:', hotel.hotel_latitude);
    console.log('hotel_longitude:', hotel.hotel_longitude);
    console.log('latitude:', hotel.latitude);
    console.log('longitude:', hotel.longitude);
    console.log('=====================');
    
    // 增强的图片处理逻辑
    let images = [];
    
    // 1. 优先使用云函数处理后的unified_images
    if (hotel.unified_images && Array.isArray(hotel.unified_images) && hotel.unified_images.length > 0) {
      images = hotel.unified_images;
      console.log('使用云函数处理的unified_images:', images);
    } else {
      // 2. 如果云函数处理失败，手动处理
      console.log('云函数处理的images为空，开始手动处理...');
      
      // 尝试banner字段
      if (hotel.banner) {
        if (Array.isArray(hotel.banner)) {
          images = hotel.banner.filter(img => img && img.trim() !== '');
        } else if (typeof hotel.banner === 'string') {
          if (hotel.banner.includes(',')) {
            images = hotel.banner.split(',').map(img => img.trim()).filter(img => img);
          } else {
            images = [hotel.banner.trim()];
          }
        }
        console.log('手动处理banner字段:', images);
      }
      
      // 尝试hotel_images字段
      if (images.length === 0 && hotel.hotel_images) {
        if (Array.isArray(hotel.hotel_images)) {
          images = hotel.hotel_images.filter(img => img && img.trim() !== '');
        } else if (typeof hotel.hotel_images === 'string') {
          if (hotel.hotel_images.includes(',')) {
            images = hotel.hotel_images.split(',').map(img => img.trim()).filter(img => img);
          } else {
            images = [hotel.hotel_images.trim()];
          }
        }
        console.log('手动处理hotel_images字段:', images);
      }
      
      // 尝试images字段
      if (images.length === 0 && hotel.images) {
        if (Array.isArray(hotel.images)) {
          images = hotel.images.filter(img => img && img.trim() !== '');
        } else if (typeof hotel.images === 'string') {
          if (hotel.images.includes(',')) {
            images = hotel.images.split(',').map(img => img.trim()).filter(img => img);
          } else {
            images = [hotel.images.trim()];
          }
        }
        console.log('手动处理images字段:', images);
      }
    }
    
    // 3. 如果所有图片字段都为空，提供默认图片
    if (images.length === 0) {
      images = ['https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'];
      console.log('使用默认图片:', images);
    }
    
    console.log('最终处理后的图片数组:', images);
    console.log('图片数组长度:', images.length);
    
    // 处理坐标字段，支持多种可能的字段名
    const latitude = hotel.hotel_latitude || hotel.latitude || hotel.lat || null;
    const longitude = hotel.hotel_longitude || hotel.longitude || hotel.lng || hotel.lon || null;
    
    console.log('最终使用的坐标:', { latitude, longitude });
    
    // 处理服务项目数据，添加美团风格需要的默认字段
    const processedServices = (hotel.services || []).map(service => {
      console.log('处理服务数据:', {
        serviceName: service.service_name || service.name,
        image: service.image,
        images: service.images,
        images数组内容: JSON.stringify(service.images),
        images长度: service.images ? service.images.length : 0,
        service_img: service.service_img
      });

      // 云函数已经处理好了image字段，直接使用
      let serviceImage = service.image;

      // 如果云函数处理的image还是空，尝试从images数组取
      if (!serviceImage && service.images && Array.isArray(service.images) && service.images.length > 0) {
        console.log('尝试从 images 数组取第一张图片:', service.images[0]);
        serviceImage = service.images[0];
      }

      // 如果还是空，使用默认图片
      if (!serviceImage) {
        serviceImage = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';
        console.log('使用默认图片');
      }

      console.log('服务最终图片:', serviceImage);
      console.log('服务最终images数组:', service.images || (serviceImage ? [serviceImage] : []));

      return {
        ...service,
        id: service._id || service.id,
        image: serviceImage,
        images: service.images || (serviceImage ? [serviceImage] : []),
        originalPrice: service.originalPrice || (service.price ? parseFloat(service.price) * 1.5 : 99),
        price: parseFloat(service.price) || 0
      };
    });

    return {
      id: hotel._id,
      name: hotel.hotel_name || hotel.name || '宠物酒店',
      rating: hotel.rating || hotel.score || 4.5,
      images: images,
      address: hotel.hotel_address || hotel.address || '地址待完善',
      phone: hotel.hotel_phone || hotel.phone || '暂无电话',
      businessHours: hotel.business_hours || hotel.businessHours || '08:00-22:00',
      description: hotel.jianjie || '专业的宠物寄养服务',
      jianjie: hotel.jianjie || '',
      services: processedServices,
      serviceCount: processedServices.length,
      roomCount: hotel.room_count || 0,
      latitude: latitude,
      longitude: longitude
    };
  },

  // 处理房型数据
  processRoomsData: function(rooms) {
    console.log('开始处理房型数据，原始数据:', rooms);
    
    const processedRooms = rooms.map(room => {
      console.log(`处理房型: ${room.room_name}`, room);
      
      // 处理房型图片数据 - 全面检测所有可能的图片字段
      let roomImages = [];
      
      console.log(`处理房型图片: ${room.room_name}`, {
        allFields: Object.keys(room),
        allData: room,
        img: room.img,
        room_images: room.room_images,
        images: room.images
      });
      
      // 定义所有可能的图片字段名（按优先级排序）
      const imageFields = [
        'img',           // 最可能的字段名
        'image',         // 单数形式
        'images',        // 复数形式
        'roomImages',     // 驼峰命名
        'room_image',    // 单数形式
        'photo',         // 照片
        'photos',        // 多张照片
        'picture',       // 图片
        'pictures',      // 多张图片
        'banner',        // 横幅
        'gallery',       // 图库
        'media'          // 媒体文件
      ];
      
      // 遍历所有可能的图片字段
      for (let i = 0; i < imageFields.length; i++) {
        const fieldName = imageFields[i];
        const fieldValue = room[fieldName];
        
        if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
          console.log(`✓ 找到字段 ${fieldName}:`, fieldValue, `(类型: ${typeof fieldValue})`);
          
          if (Array.isArray(fieldValue)) {
            // 数组格式
            roomImages = fieldValue.filter(img => img && img.trim() !== '');
            console.log(`✓ ${fieldName} 数组处理结果:`, roomImages);
            if (roomImages.length > 0) break; // 找到有效图片就停止
          } else if (typeof fieldValue === 'string') {
            // 字符串格式
            if (fieldValue.includes(',')) {
              roomImages = fieldValue.split(',').map(img => img.trim()).filter(img => img);
            } else {
              roomImages = [fieldValue.trim()];
            }
            console.log(`✓ ${fieldName} 字符串处理结果:`, roomImages);
            if (roomImages.length > 0) break; // 找到有效图片就停止
          }
        }
      }
      
      // 如果所有图片字段都为空，提供默认图片
      if (roomImages.length === 0) {
        roomImages = [
          'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
        ];
        console.log('⚠️ 所有图片字段都为空，使用默认图片:', roomImages);
      }
      
      console.log(`✅ 最终房型图片 (${room.room_name}):`, roomImages);
      console.log(`图片数量: ${roomImages.length}`);
      
      return {
        id: room._id,
        name: room.room_name || room.room_type || '标准间',
        description: room.description || '舒适的宠物寄养环境，提供专业护理和营养配餐',
        price: room.price || 0,
        capacity: room.capacity || 1,
        size: room.size || room.area || '标准间',
        facilities: room.facilities || ['24小时监控', '空调', '独立空间'],
        images: roomImages,
        kucun: room.kucun || 0,
        hotel_id: room.hotel_id,
        status: room.status || 'active'
      };
    });
    
    console.log('处理后的房型数据:', processedRooms);
    return processedRooms;
  },

  // 图片轮播改变
  onSwiperChange: function(e) {
    this.setData({
      currentImageIndex: e.detail.current
    });
  },

  // 转换云存储图片URL为临时链接
  convertCloudImages: function(hotel, rooms) {
    console.log('开始转换云存储图片URL');

    // 收集所有需要转换的云存储URL
    const cloudUrls = new Set();

    // 收集酒店图片
    if (hotel.images && Array.isArray(hotel.images)) {
      hotel.images.forEach(img => {
        if (img && img.startsWith('cloud://')) {
          console.log('收集酒店图片:', img);
          cloudUrls.add(img);
        }
      });
    }

    // 收集服务图片
    if (hotel.services && Array.isArray(hotel.services)) {
      hotel.services.forEach(service => {
        if (service.image && service.image.startsWith('cloud://')) {
          console.log('收集服务单图:', service.image);
          cloudUrls.add(service.image);
        }
        if (service.images && Array.isArray(service.images)) {
          service.images.forEach(img => {
            if (img && img.startsWith('cloud://')) {
              console.log('收集服务轮播图:', img);
              cloudUrls.add(img);
            }
          });
        }
      });
    }

    // 收集房型图片
    if (rooms && Array.isArray(rooms)) {
      rooms.forEach(room => {
        if (room.images && Array.isArray(room.images)) {
          room.images.forEach(img => {
            if (img && img.startsWith('cloud://')) {
              console.log('收集房型图片:', img);
              cloudUrls.add(img);
            }
          });
        }
      });
    }

    const urlArray = Array.from(cloudUrls);
    console.log('需要转换的云存储URL数量:', urlArray.length);
    console.log('云存储URL列表:', urlArray);
    console.log('========== URL 格式检查 ==========');
    urlArray.forEach((url, idx) => {
      console.log(`URL[${idx}]: ${url}`);
      console.log(`  长度: ${url.length}`);
      console.log(`  格式检查: ${url.match(/^cloud:\/\/[^.]+\.[^\/]+\/.+/) ? '✅ 格式正确' : '❌ 格式异常'}`);
    });
    console.log('============================');

    if (urlArray.length === 0) {
      console.log('没有云存储图片需要转换');
      return Promise.resolve();
    }

    // 返回 Promise
    return new Promise((resolve, reject) => {
      // 批量转换为临时链接
      wx.cloud.getTempFileURL({
        fileList: urlArray,
        success: res => {
          console.log('云存储URL转换完成:', res);

          // 创建映射表：cloud://url -> https://temp-url
          const urlMap = {};

          res.fileList.forEach((item, index) => {
            if (item.status === 0) {
              // 转换成功
              urlMap[urlArray[index]] = item.tempFileURL;
              console.log(`✅ ${urlArray[index].substring(0, 50)}... -> ${item.tempFileURL.substring(0, 50)}...`);
            } else {
              // 转换失败（权限不足、文件不存在等）
              // 不使用默认图片,保留原始 cloud:// URL(小程序可以直接使用)
              console.error(`❌ ${urlArray[index]} 转换失败 [${item.errMsg}],保留原始URL`);
            }
          });

          // 更新酒店图片
          if (hotel.images && Array.isArray(hotel.images)) {
            hotel.images = hotel.images.map(img => {
              if (img && img.startsWith('cloud://')) {
                // 转换成功则使用临时链接,否则保留原始 cloud:// URL
                return urlMap[img] || img;
              }
              return img;
            });
          }

          // 更新服务图片
          if (hotel.services && Array.isArray(hotel.services)) {
            hotel.services = hotel.services.map(service => {
              return {
                ...service,
                image: service.image && service.image.startsWith('cloud://')
                  ? (urlMap[service.image] || service.image)
                  : service.image,
                images: service.images && Array.isArray(service.images)
                  ? service.images.map(img => {
                      if (img && img.startsWith('cloud://')) {
                        // 转换成功则使用临时链接,否则保留原始 cloud:// URL
                        return urlMap[img] || img;
                      }
                      return img;
                    })
                  : service.images
              };
            });
          }

          // 更新房型图片
          if (rooms && Array.isArray(rooms)) {
            rooms.forEach(room => {
              if (room.images && Array.isArray(room.images)) {
                room.images = room.images.map(img => {
                  if (img && img.startsWith('cloud://')) {
                    // 转换成功则使用临时链接,否则保留原始 cloud:// URL
                    return urlMap[img] || img;
                  }
                  return img;
                });
              }
            });
          }

          console.log('✅ 云存储图片转换处理完成');
          resolve();
        },
        fail: err => {
          console.error('❌ 云存储URL批量转换失败:', err);
          console.error('❌ 请检查云存储安全规则是否配置正确');
          console.error('❌ 访问: https://console.cloud.tencent.com/tcb → 存储 → 安全规则');
          console.error('❌ 设置规则为: { "read": true, "write": "auth != null" }');
          resolve(); // 即使失败也 resolve，不阻塞页面加载
        }
      });
    });
  },

  // 图片预览
  onImagePreview: function() {
    const images = this.data.hotel.images.map(img => 
      typeof img === 'string' ? img : img.url || img
    ).filter(img => img && img !== '/images/default-hotel.png');
    
    if (images.length > 0) {
      wx.previewImage({
        urls: images,
        current: images[this.data.currentImageIndex]
      });
    }
  },

  // 房型图片预览
  onRoomImagePreview: function(e) {
    const images = e.currentTarget.dataset.images;
    const index = e.currentTarget.dataset.index;
    
    console.log('🎯 预览房型轮播图片:', { images, index });
    
    if (images && images.length > 0) {
      // 过滤有效的图片URL
      const validImages = images.filter(img => img && img.trim() !== '');
      
      if (validImages.length > 0) {
        wx.previewImage({
          urls: validImages,
          current: validImages[index] || validImages[0],
          showmenu: true,
          failsafe: true,
          success: () => {
            console.log('✅ 图片预览成功');
          },
          fail: (err) => {
            console.error('❌ 图片预览失败:', err);
            wx.showToast({
              title: '预览失败',
              icon: 'none'
            });
          }
        });
      } else {
        wx.showToast({
          title: '图片链接无效',
          icon: 'none',
          duration: 2000
        });
      }
    } else {
      wx.showToast({
        title: '暂无图片可预览',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 抢购房型
  onBuyRoom: function(e) {
    const roomId = e.currentTarget.dataset.id;
    const room = this.data.rooms.find(r => r.id === roomId);

    if (room && room.stock > 0) {
      // 直接跳转到订单创建页面
      wx.navigateTo({
        url: `/pages/order/create/create?hotelId=${this.data.hotelId}&roomId=${roomId}`
      });
    } else {
      wx.showToast({
        title: '该房型已售罄',
        icon: 'none'
      });
    }
  },

  // 服务图片加载错误处理
  onServiceImageError: function(e) {
    const index = e.currentTarget.dataset.index;
    console.log('服务图片加载失败:', index);
    
    // 设置默认图片
    const updatedServices = [...this.data.hotel.services];
    updatedServices[index] = {
      ...updatedServices[index],
      image: '/images/banner-1.png'
    };
    
    this.setData({
      'hotel.services': updatedServices
    });
  },

  // 抢购服务项目
  onBuyService: function(e) {
    const serviceId = e.currentTarget.dataset.serviceId;
    const serviceName = e.currentTarget.dataset.serviceName;
    let price = parseFloat(e.currentTarget.dataset.price) || 0;

    // 如果没有价格，设置默认价格（强制抢购）
    if (price <= 0) {
      price = 39.9; // 默认抢购价格
    }

    console.log('抢购服务项目:', { serviceId, serviceName, price });

    if (!this.data.hotel) {
      wx.showToast({
        title: '酒店信息加载中',
        icon: 'none'
      });
      return;
    }

    // 直接跳转到订单创建页面
    wx.navigateTo({
      url: `/pages/order/create/create?hotelId=${this.data.hotelId}&serviceId=${serviceId}&serviceName=${serviceName}&price=${price}&type=service`
    });
  },

  // 查看房型详情
  onViewRoomDetail: function(e) {
    const roomId = e.currentTarget.dataset.roomId;
    const room = this.data.rooms.find(r => r.id === roomId);
    
    if (!room) {
      wx.showToast({
        title: '房型信息不存在',
        icon: 'none'
      });
      return;
    }

    console.log('跳转到房型详情:', {
      roomId: roomId,
      hotelId: this.data.hotelId,
      roomName: room.name
    });

    wx.navigateTo({
      url: `/pages/hotel/room_detail/room_detail?roomId=${roomId}&hotelId=${this.data.hotelId}`
    });
  },

  // 查看服务详情
  onViewServiceDetail: function(e) {
    // 防止重复点击
    if (this.data.isNavigating) {
      return;
    }
    
    const serviceId = e.currentTarget.dataset.serviceId;
    
    if (!serviceId) {
      wx.showToast({
        title: '服务信息不存在',
        icon: 'none'
      });
      return;
    }

    console.log('跳转到服务详情:', {
      serviceId: serviceId,
      hotelId: this.data.hotelId
    });

    this.setData({ isNavigating: true });

    wx.navigateTo({
      url: `/pages/service/detail/detail?serviceId=${serviceId}&hotelId=${this.data.hotelId}`,
      success: () => {
        console.log('跳转到服务详情成功');
      },
      fail: (err) => {
        console.error('跳转到服务详情失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
        this.setData({ isNavigating: false });
      },
      complete: () => {
        // 延迟重置状态，防止快速点击
        setTimeout(() => {
          this.setData({ isNavigating: false });
        }, 500);
      }
    });
  },



  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadHotelDetail().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 图片加载错误处理
  onImageError: function(e) {
    const errorSrc = e.currentTarget.dataset.src;
    console.error('图片加载失败:', errorSrc);

    // 如果是云存储图片加载失败，尝试替换为默认图片
    if (errorSrc && errorSrc.startsWith('cloud://')) {
      const { hotel } = this.data;
      const currentImages = hotel.images || [];

      // 找到加载失败的图片索引
      const failedIndex = currentImages.indexOf(errorSrc);
      if (failedIndex !== -1) {
        // 替换为默认图片
        const defaultImage = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';
        const newImages = [...currentImages];
        newImages[failedIndex] = defaultImage;

        this.setData({
          'hotel.images': newImages
        });

        console.log('已将失败的云存储图片替换为默认图片:', {
          原图片: errorSrc,
          替换为: defaultImage,
          索引: failedIndex
        });
      }
    }
  },

  // 页面分享
  onShareAppMessage: function() {
    const { name, description } = this.data.hotel;
    return {
      title: `${name} - 宠物酒店`,
      desc: description,
      path: `/pages/hotel/detail/detail?id=${this.data.hotelId}`,
      imageUrl: this.data.hotel.images[0] || '/images/share-banner.png'
    };
  }
});