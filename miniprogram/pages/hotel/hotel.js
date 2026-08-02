// pages/hotel/hotel.js - 酒店列表页面
// 功能：展示酒店列表、搜索筛选、加载酒店数据
const { callFunction } = require('../../config/cloud.js');

Page({
  data: {
    searchKeyword: '',
    bannerList: [
      '/images/banner-1.png',
      '/images/banner-2.png',
      '/images/banner-3.png'
    ],
    recommendHotels: [],
    allHotels: [],
    loading: true,
    stats: { total: 0, areas: 0, highRated: 0 }
  },

  onLoad: function() {
    wx.setNavigationBarTitle({
      title: '宠物酒店'
    });

    // 延迟加载数据，避免阻塞页面初始化
    setTimeout(() => {
      this.loadHotelData();
    }, 300);
  },

  // 加载酒店数据
  loadHotelData: function(retryCount = 0) {
    this.setData({ loading: true });

    this.callCloudFunctionWithRetry(retryCount);
  },

  // 带重试机制的云函数调用
  callCloudFunctionWithRetry: async function(retryCount = 0) {
    const maxRetries = 3;

    try {
      // 调用云函数获取酒店数据（只获取推荐酒店）
      const res = await callFunction('searchHotels', { recommendOnly: true });

      console.log('【酒店列表】获取数据成功');

      // 解析返回数据
      const hotelsData = this.parseCloudResponse(res);

      if (!hotelsData || !Array.isArray(hotelsData)) {
        throw new Error('返回数据格式不正确');
      }

      // 处理酒店数据
      const hotels = this.processHotelData(hotelsData);

      // 转换云存储图片URL
      const hotelsWithImages = await this.convertCloudImagesToTempUrls(hotels);

      // 分离推荐酒店
      const recommendHotels = hotelsWithImages.filter(hotel => hotel.is_recommend === true);

      // 更新页面数据
      this.setData({
        recommendHotels: recommendHotels,
        allHotels: hotelsWithImages,
        loading: false,
        stats: this.calculateStats(hotelsWithImages)
      });

      wx.showToast({
        title: '加载成功',
        icon: 'success',
        duration: 1000
      });

    } catch (err) {
      console.error('【酒店列表】加载数据失败:', err);

      // 重试逻辑
      if (retryCount < maxRetries) {
        console.log(`【酒店列表】第 ${retryCount + 1} 次重试...`);
        setTimeout(() => {
          this.callCloudFunctionWithRetry(retryCount + 1);
        }, 1500);
      } else {
        // 重试失败，显示空状态
        this.handleLoadError(err);
      }
    }
  },

  // 解析云函数响应（适配统一响应格式）
  // callFunction 现在直接返回 data 部分
  parseCloudResponse: function(res) {
    if (!res) {
      return null;
    }

    // res 已经是 data 部分（酒店数组）
    let hotelsData = res;

    // 兼容不同的数据格式
    if (!Array.isArray(hotelsData)) {
      hotelsData = hotelsData.list || hotelsData.hotels || [];
    }

    return hotelsData;
  },

  // 处理加载错误
  handleLoadError: function(err) {
    console.error('【酒店列表】最终加载失败:', err);

    this.setData({
      recommendHotels: [],
      allHotels: [],
      loading: false,
      stats: { total: 0, areas: 0, highRated: 0 }
    });

    wx.showToast({
      title: '加载失败，请重试',
      icon: 'none',
      duration: 3000
    });
  },



  // 批量转换云存储链接为临时URL
  convertCloudImagesToTempUrls: function(hotels) {
    return new Promise((resolve) => {
      if (!Array.isArray(hotels) || hotels.length === 0) {
        resolve(hotels);
        return;
      }

      // 收集所有需要转换的cloud://链接
      const cloudUrls = this.extractCloudUrls(hotels);

      if (cloudUrls.length === 0) {
        resolve(hotels);
        return;
      }

      console.log(`【酒店列表】需要转换的云存储链接数量: ${cloudUrls.length}`);

      // 批量获取临时URL
      wx.cloud.getTempFileURL({
        fileList: cloudUrls,
        success: (res) => {
          const urlMap = this.buildUrlMap(cloudUrls, res.fileList);
          const updatedHotels = this.applyTempUrls(hotels, urlMap);
          resolve(updatedHotels);
        },
        fail: (err) => {
          console.error('【酒店列表】批量获取临时URL失败:', err);
          const updatedHotels = this.fallbackToDefaultImages(hotels);
          resolve(updatedHotels);
        }
      });
    });
  },

  // 提取所有云存储URL
  extractCloudUrls: function(hotels) {
    const cloudUrls = [];
    hotels.forEach(hotel => {
      if (hotel.image && hotel.image.includes('cloud://')) {
        cloudUrls.push(hotel.image);
      }
    });
    return cloudUrls;
  },

  // 构建URL映射表
  buildUrlMap: function(originalUrls, fileList) {
    const urlMap = new Map();

    if (!Array.isArray(fileList) || fileList.length === 0) {
      return urlMap;
    }

    fileList.forEach((item, index) => {
      if (item.status === 0 && item.tempFileURL) {
        urlMap.set(originalUrls[index], item.tempFileURL);
      } else {
        console.error(`【酒店列表】链接 ${index} 转换失败:`, item.errMsg);
      }
    });

    return urlMap;
  },

  // 应用临时URL到酒店数据
  applyTempUrls: function(hotels, urlMap) {
    return hotels.map(hotel => {
      if (hotel.image && hotel.image.includes('cloud://')) {
        const tempUrl = urlMap.get(hotel.image);
        if (tempUrl) {
          hotel.image = tempUrl;
        } else {
          hotel.image = '/images/banner-1.png';
        }
      }
      return hotel;
    });
  },

  // 转换失败时使用默认图片
  fallbackToDefaultImages: function(hotels) {
    return hotels.map(hotel => {
      if (hotel.image && hotel.image.includes('cloud://')) {
        hotel.image = '/images/banner-1.png';
      }
      return hotel;
    });
  },

  // 处理酒店数据，统一格式
  processHotelData: function(hotels) {
    if (!Array.isArray(hotels)) {
      console.error('【酒店列表】processHotelData 期望数组，收到:', typeof hotels);
      return [];
    }

    return hotels
      .map(hotel => this.transformSingleHotel(hotel))
      .filter(hotel => hotel !== null); // 过滤掉无效数据
  },

  // 转换单个酒店数据
  transformSingleHotel: function(hotel) {
    if (!hotel || typeof hotel !== 'object') {
      console.warn('【酒店列表】无效的酒店数据:', hotel);
      return null;
    }

    return {
      id: hotel._id,
      name: this.getHotelName(hotel),
      rating: this.getHotelRating(hotel),
      price: this.getHotelPrice(hotel),
      image: this.getHotelImage(hotel),
      tags: this.getHotelTags(hotel),
      address: this.getHotelAddress(hotel),
      area: this.getHotelArea(hotel),
      phone: this.getHotelPhone(hotel),
      description: this.getHotelDescription(hotel),
      status: hotel.status || 'active',
      businessHours: hotel.business_hours,
      services: hotel.services,
      is_recommend: hotel.is_recommend,
      originalData: hotel
    };
  },

  // 获取酒店名称（兼容多种字段）
  getHotelName: function(hotel) {
    return hotel.hotel_name || hotel.name || '宠物酒店';
  },

  // 获取酒店图片URL
  getHotelImage: function(hotel) {
    // 优先级：banner > hotel_images > images
    if (Array.isArray(hotel.banner) && hotel.banner.length > 0) {
      return hotel.banner[0];
    }
    if (Array.isArray(hotel.hotel_images) && hotel.hotel_images.length > 0) {
      return hotel.hotel_images[0];
    }
    if (Array.isArray(hotel.images) && hotel.images.length > 0) {
      return hotel.images[0];
    }
    return '/images/banner-1.png';
  },

  // 获取酒店评分
  getHotelRating: function(hotel) {
    return hotel.rating || hotel.score || hotel.hotel_score || 4.0;
  },

  // 获取酒店价格
  getHotelPrice: function(hotel) {
    return hotel.min_price || hotel.minPrice || hotel.hotel_price_min || 98;
  },

  // 获取酒店标签
  getHotelTags: function(hotel) {
    // 优先级：tags > pet_types > pet_type > services > facilities
    if (Array.isArray(hotel.tags) && hotel.tags.length > 0) {
      return hotel.tags.slice(0, 3);
    }
    if (Array.isArray(hotel.pet_types) && hotel.pet_types.length > 0) {
      return hotel.pet_types.slice(0, 3);
    }
    if (typeof hotel.pet_type === 'string' && hotel.pet_type) {
      return hotel.pet_type.split(',').map(t => t.trim()).slice(0, 3);
    }
    if (Array.isArray(hotel.services) && hotel.services.length > 0) {
      return hotel.services.slice(0, 2).map(s =>
        s.service_name || s.name || (typeof s === 'string' ? s : '服务')
      );
    }
    if (Array.isArray(hotel.facilities) && hotel.facilities.length > 0) {
      return hotel.facilities.slice(0, 2);
    }
    return ['猫咪', '狗狗'];
  },

  // 获取酒店地址
  getHotelAddress: function(hotel) {
    return hotel.hotel_address || hotel.address || '地址待完善';
  },

  // 获取酒店区域
  getHotelArea: function(hotel) {
    return hotel.hotel_area || hotel.area || '未知区域';
  },

  // 获取酒店电话
  getHotelPhone: function(hotel) {
    return hotel.hotel_phone || hotel.phone || '暂无电话';
  },

  // 获取酒店描述
  getHotelDescription: function(hotel) {
    return hotel.description || hotel.hotel_description || '专业的宠物寄养服务';
  },

  // 计算统计数据
  calculateStats: function(hotels) {
    if (!Array.isArray(hotels)) {
      return { total: 0, areas: 0, highRated: 0 };
    }

    const total = hotels.length;
    const areas = new Set(hotels.map(h => h.area).filter(Boolean)).size;
    const highRated = hotels.filter(h => (h.rating || 0) >= 4.5).length;

    return { total, areas, highRated };
  },

  // 轮播图点击
  onBannerTap: function(e) {
    const index = e.currentTarget.dataset.index;
    console.log('【酒店列表】点击轮播图：', index);
  },

  // 酒店卡片点击
  onHotelTap: function(e) {
    const hotelId = e.currentTarget.dataset.id;

    if (!hotelId) {
      wx.showToast({
        title: '酒店ID获取失败',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/hotel/detail/detail?id=${hotelId}`,
      fail: (err) => {
        console.error('【酒店列表】跳转详情页失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 图片加载错误处理
  onImageError: function(e) {
    const hotelId = e.currentTarget.dataset.hotelId;
    console.error(`【酒店列表】酒店 ${hotelId} 的图片加载失败`);
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadHotelData();
    wx.stopPullDownRefresh();
  },

  // 页面分享
  onShareAppMessage: function() {
    return {
      title: '宠宿无忧 - 专业宠物酒店',
      path: '/pages/hotel/hotel',
      imageUrl: '/images/share-banner.png'
    };
  }
});