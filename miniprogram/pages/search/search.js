// pages/search/search.js
const { initCloud, callFunction, testCloudConnection, CLOUD_CONFIG } = require('../../config/cloud.js');
Page({
  /**
   * 页面的初始数据
   */
  data: {
    searchKeyword: '',
    activeFilter: 'all',
    hasSearched: false,
    searchResults: [],
    searchHistory: [],
    hotKeywords: [
      '宠物酒店',
      '猫咪寄养',
      '狗狗护理',
      '24小时服务',
      '独立房间',
      '专业医疗'
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.initializePage(options);
  },

  /**
   * 初始化页面
   */
  async initializePage(options) {
    const cloudInitSuccess = initCloud();
    
    if (cloudInitSuccess) {
      try {
        await testCloudConnection();
      } catch (err) {
        console.error('云开发连接测试失败:', err);
        this.showToast('云开发连接失败', 'none');
      }
    }
    
    this.loadSearchHistory();
    
    if (options.keyword) {
      this.setData({ searchKeyword: options.keyword });
      this.onSearch();
    }
  },

  /**
   * 加载搜索历史
   */
  loadSearchHistory() {
    try {
      const history = wx.getStorageSync('searchHistory') || [];
      this.setData({
        searchHistory: history.slice(0, 10)
      });
    } catch (e) {
      console.error('加载搜索历史失败:', e);
    }
  },

  /**
   * 保存搜索历史
   */
  saveSearchHistory(keyword) {
    if (!keyword.trim()) return;
    
    try {
      const history = this.getUpdatedHistory(keyword);
      wx.setStorageSync('searchHistory', history);
      this.setData({ searchHistory: history.slice(0, 10) });
    } catch (e) {
      console.error('保存搜索历史失败:', e);
    }
  },

  /**
   * 获取更新后的历史记录
   */
  getUpdatedHistory(keyword) {
    let history = wx.getStorageSync('searchHistory') || [];
    history = history.filter(item => item !== keyword);
    history.unshift(keyword);
    return history.slice(0, 20);
  },

  /**
   * 输入框内容变化
   */
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  /**
   * 点击搜索按钮
   */
  onSearch() {
    const keyword = this.data.searchKeyword.trim();
    if (!keyword) {
      // 空关键词时重置到初始状态
      this.setData({
        hasSearched: false,
        searchResults: [],
        activeFilter: 'all',
        searchKeyword: ''
      });
      return;
    }
    this.performSearch(keyword);
  },

  /**
   * 确认搜索
   */
  onSearchConfirm() {
    this.onSearch();
  },

  /**
   * 执行搜索
   */
  async performSearch(keyword) {
    this.showLoading('搜索中...');
    this.saveSearchHistory(keyword);
    
    try {
      const results = await this.searchHotels(keyword);
      this.handleSearchSuccess(results, keyword);
    } catch (err) {
      this.handleSearchError(err);
    } finally {
      this.hideLoading();
    }
  },

  /**
   * 搜索酒店
   */
  async searchHotels(keyword) {
    const res = await callFunction('searchHotels', {
      keyword: keyword,
      page: 1,
      pageSize: 20
    });
    
    const hotelsData = this.extractHotelsData(res);
    return this.processHotelData(hotelsData, keyword);
  },

  /**
   * 提取酒店数据
   * 统一响应格式: res 已经是 data 部分
   */
  extractHotelsData(res) {
    if (!res) {
      throw new Error('搜索返回数据为空');
    }

    // res 已经是 callFunction 返回的 data 部分
    let hotelsData = res;

    if (!Array.isArray(hotelsData)) {
      hotelsData = hotelsData.list || hotelsData.hotels || [];
    }

    return hotelsData;
  },

  /**
   * 处理搜索成功
   */
  handleSearchSuccess(results, keyword) {
    // 默认按价格升序排序
    results.sort((a, b) => {
      const priceA = a.minPrice || Infinity;
      const priceB = b.minPrice || Infinity;
      return priceA - priceB;
    });
    
    this.setData({
      hasSearched: true,
      searchResults: results
    });
    
    if (results.length > 0) {
      this.showToast(`找到${results.length}家酒店`, 'success', 1000);
    }
  },

  /**
   * 处理搜索错误
   */
  handleSearchError(err) {
    console.error('搜索酒店失败:', err);
    this.setData({
      hasSearched: true,
      searchResults: []
    });
    this.showToast('搜索失败，请重试', 'none', 2000);
  },

  /**
   * 处理酒店数据
   */
  processHotelData(hotels) {
    if (!Array.isArray(hotels)) {
      return [];
    }
    
    return hotels.map((hotel, index) => this.transformHotelData(hotel, index));
  },

  /**
   * 转换单个酒店数据
   */
  transformHotelData(hotel, index) {
    const mainImage = this.getHotelMainImage(hotel);
    const serviceTags = this.getHotelTags(hotel);
    const minPrice = this.getHotelPrice(hotel);

    return {
      id: hotel._id || `hotel_${index}`,
      name: this.getHotelName(hotel, index),
      rating: this.getHotelRating(hotel),
      minPrice,
      mainImage,
      address: this.getHotelAddress(hotel, index),
      area: hotel.hotel_area || hotel.area || '',
      phone: this.getHotelPhone(hotel, index),
      description: this.getHotelDescription(hotel),
      roomCount: hotel.room_count || hotel.roomCount || null,
      serviceCount: serviceTags.length,
      serviceTags,
      businessHours: hotel.business_hours || hotel.businessHours || '',
      status: hotel.status || 'active',
      originalData: hotel
    };
  },

  /**
   * 获取酒店主图片
   */
  getHotelMainImage(hotel) {
    const imageFields = ['banner', 'hotel_images', 'images'];
    
    for (const field of imageFields) {
      if (Array.isArray(hotel[field]) && hotel[field].length > 0) {
        const imageUrl = hotel[field][0];
        if (!this.isInvalidCloudUrl(imageUrl)) {
          return imageUrl;
        }
      }
    }
    
    return '/images/banner-1.png';
  },

  /**
   * 检查是否为无效的云存储URL
   */
  isInvalidCloudUrl(url) {
    if (!url || !url.includes('cloud://')) {
      return false;
    }
    return url.includes('sign=') || url.includes('t=');
  },

  /**
   * 获取酒店名称
   */
  getHotelName(hotel, index) {
    return hotel.hotel_name || hotel.name || `宠物酒店${index + 1}`;
  },

  /**
   * 获取酒店评分
   */
  getHotelRating(hotel) {
    // 只使用 pet_hotel 的 score 字段
    const score = hotel.score;
    if (score && typeof score === 'number' && score > 0) {
      return score;
    }
    return 0;
  },

  /**
   * 获取酒店地址
   */
  getHotelAddress(hotel, index) {
    return hotel.hotel_address || hotel.address || `北京市朝阳区建国路${index + 1}号`;
  },

  /**
   * 获取酒店电话
   */
  getHotelPhone(hotel, index) {
    return hotel.hotel_phone || hotel.phone || `1380013800${index}`;
  },

  /**
   * 获取酒店描述
   */
  getHotelDescription(hotel) {
    return hotel.description || hotel.hotel_description || '专业的宠物寄养服务，环境舒适，护理周到';
  },

  /**
   * 获取酒店标签
   */
  getHotelTags(hotel) {
    // 只使用云函数返回的 allTags（来自 pet_hotel 集合的 tags 字段）
    if (Array.isArray(hotel.allTags) && hotel.allTags.length > 0) return hotel.allTags;
    if (Array.isArray(hotel.tags) && hotel.tags.length > 0) return hotel.tags;
    return [];
  },

  /**
   * 获取酒店价格
   */
  getHotelPrice(hotel) {
    // 优先使用云函数返回的房间最低价
    return hotel.min_room_price || hotel.min_price || hotel.minPrice || hotel.hotel_price_min || null;
  },

  /**
   * 筛选条件变化
   */
  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ activeFilter: filter });
    this.sortResults(filter);
  },

  /**
   * 排序搜索结果
   */
  sortResults(filter) {
    const results = [...this.data.searchResults];
    
    switch (filter) {
      case 'price':
        // 价格排序：有价格的排前面，按价格升序；无价格的排后面
        results.sort((a, b) => {
          const priceA = a.minPrice || Infinity;
          const priceB = b.minPrice || Infinity;
          return priceA - priceB;
        });
        break;
      case 'rating':
        // 评分排序：按评分降序
        results.sort((a, b) => b.rating - a.rating);
        break;
      default:
        break;
    }
    
    this.setData({ searchResults: results });
  },

  /**
   * 点击历史搜索项
   */
  onHistoryTap(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ searchKeyword: keyword });
    this.performSearch(keyword);
  },

  /**
   * 点击热门搜索项
   */
  onHotTap(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ searchKeyword: keyword });
    this.performSearch(keyword);
  },

  /**
   * 清空搜索历史
   */
  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          this.executeClearHistory();
        }
      }
    });
  },

  /**
   * 执行清空历史
   */
  executeClearHistory() {
    try {
      wx.removeStorageSync('searchHistory');
      this.setData({ searchHistory: [] });
      this.showToast('已清空', 'success');
    } catch (e) {
      console.error('清空搜索历史失败:', e);
    }
  },

  /**
   * 点击酒店项
   */
  onHotelTap(e) {
    const hotelId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/hotel/detail/detail?id=${hotelId}`
    });
  },



  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    if (this.data.hasSearched && this.data.searchKeyword) {
      this.performSearch(this.data.searchKeyword);
    }
    wx.stopPullDownRefresh();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    // 可在此实现加载更多功能
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '宠宿无忧 - 专业宠物酒店搜索',
      path: '/pages/search/search'
    };
  },

  /**
   * 工具函数：显示加载中
   */
  showLoading(title = '加载中...') {
    wx.showLoading({ title });
  },

  /**
   * 工具函数：隐藏加载中
   */
  hideLoading() {
    wx.hideLoading();
  },

  /**
   * 工具函数：显示提示
   */
  showToast(title, icon = 'none', duration = 2000) {
    wx.showToast({ title, icon, duration });
  }
})