// pages/favorites/favorites.js - 我的收藏页面
const favoritesManager = require('../../utils/favorites.js');

Page({
  data: {
    favorites: [],
    loading: true,
    sortType: 'time',
    sortDirection: 'desc',
    emptyState: false
  },

  onLoad() {
    this.initializePage();
  },

  onShow() {
    this.loadFavorites();
  },

  /**
   * 初始化页面
   */
  initializePage() {
    wx.setNavigationBarTitle({ title: '我的收藏' });
    this.loadFavorites();
  },

  /**
   * 加载收藏列表
   */
  async loadFavorites() {
    this.setData({ loading: true });

    try {
      let favorites = await favoritesManager.getFavorites();

      if (favorites.length === 0) {
        this.setEmptyState();
        return;
      }

      favorites = this.processFavorites(favorites);

      if (favorites.length === 0) {
        this.setEmptyState();
        return;
      }

      this.displayFavorites(favorites);
    } catch (error) {
      console.error('加载收藏失败:', error);
      this.setErrorState();
    }
  },

  /**
   * 设置空状态
   */
  setEmptyState() {
    this.setData({
      favorites: [],
      loading: false,
      emptyState: true
    });
  },

  /**
   * 设置错误状态
   */
  setErrorState() {
    this.setData({
      favorites: [],
      loading: false,
      emptyState: true
    });
  },

  /**
   * 处理收藏数据
   */
  processFavorites(favorites) {
    favorites = this.cleanExpiredImages(favorites);
    favorites = this.recoverCloudImages(favorites);
    favorites = this.applySorting(favorites);
    return favorites;
  },

  /**
   * 清理过期图片
   */
  cleanExpiredImages(favorites) {
    return favorites.filter(favorite => {
      const hasExpiredImage = this.isImageExpired(favorite.image);
      if (hasExpiredImage) {
        console.log('过滤掉过期图片的收藏:', favorite.name);
      }
      return !hasExpiredImage;
    });
  },

  /**
   * 检查图片是否过期
   */
  isImageExpired(image) {
    if (!image) return false;
    const isNotCloudUrl = !image.includes('cloud://');
    const hasTempParams = image.includes('sign=') || image.includes('t=');
    return isNotCloudUrl && hasTempParams;
  },

  /**
   * 从originalData恢复云存储链接
   */
  recoverCloudImages(favorites) {
    return favorites.map(favorite => {
      if (this.needsImageRecovery(favorite) && favorite.originalData) {
        const cloudImage = this.extractCloudImage(favorite.originalData);
        if (cloudImage) {
          favorite.image = cloudImage;
        }
      }
      return favorite;
    });
  },

  /**
   * 判断是否需要恢复图片
   */
  needsImageRecovery(favorite) {
    return !favorite.image ||
           !favorite.image.includes('cloud://') ||
           (favorite.image.includes('sign=') || favorite.image.includes('t='));
  },

  /**
   * 从原始数据提取云存储图片
   */
  extractCloudImage(original) {
    const sources = [
      Array.isArray(original.banner) ? original.banner : null,
      original.image,
      Array.isArray(original.images) ? original.images : null
    ];

    for (const source of sources) {
      if (!source) continue;

      if (Array.isArray(source)) {
        const cloudImg = source.find(img => img && img.includes('cloud://'));
        if (cloudImg) return cloudImg;
      } else if (source.includes('cloud://')) {
        return source;
      }
    }

    return null;
  },

  /**
   * 应用排序
   */
  applySorting(favorites) {
    const { sortType, sortDirection } = this.data;
    let sorted = [...favorites];

    switch (sortType) {
      case 'time':
        sorted = favoritesManager.sortByTime(sorted, sortDirection === 'desc');
        break;
      case 'name':
        sorted = favoritesManager.sortByName(sorted, sortDirection === 'asc');
        break;
      case 'rating':
        sorted = favoritesManager.sortByRating(sorted, sortDirection === 'desc');
        break;
    }

    return sorted;
  },

  /**
   * 显示收藏列表
   */
  async displayFavorites(favorites) {
    try {
      const updatedFavorites = await this.convertCloudImagesToTempUrls(favorites);
      this.setData({
        favorites: updatedFavorites,
        loading: false,
        emptyState: false
      });
    } catch (error) {
      console.error('转换云存储图片失败:', error);
      this.setData({
        favorites,
        loading: false,
        emptyState: false
      });
    }
  },

  /**
   * 转换云存储链接为临时URL
   */
  convertCloudImagesToTempUrls(favorites) {
    const cloudUrls = this.collectCloudUrls(favorites);

    if (cloudUrls.length === 0) {
      return Promise.resolve(favorites);
    }

    return this.batchConvertUrls(cloudUrls, favorites);
  },

  /**
   * 收集所有云存储URL
   */
  collectCloudUrls(favorites) {
    const urlSet = new Set();
    favorites.forEach(favorite => {
      if (favorite.image && favorite.image.startsWith('cloud://')) {
        urlSet.add(favorite.image);
      }
    });
    return Array.from(urlSet);
  },

  /**
   * 批量转换URL
   */
  batchConvertUrls(cloudUrls, favorites) {
    return new Promise((resolve) => {
      wx.cloud.getTempFileURL({
        fileList: cloudUrls,
        success: (res) => {
          const urlMap = this.buildUrlMap(res, cloudUrls);
          const updated = this.applyUrlMap(favorites, urlMap);
          resolve(updated);
        },
        fail: (err) => {
          console.error('云存储URL批量转换失败:', err);
          resolve(favorites);
        }
      });
    });
  },

  /**
   * 构建URL映射表
   */
  buildUrlMap(res, cloudUrls) {
    const urlMap = {};
    res.fileList.forEach((item, index) => {
      if (item.status === 0) {
        urlMap[cloudUrls[index]] = item.tempFileURL;
      }
    });
    return urlMap;
  },

  /**
   * 应用URL映射
   */
  applyUrlMap(favorites, urlMap) {
    return favorites.map(favorite => {
      if (favorite.image && favorite.image.startsWith('cloud://') && urlMap[favorite.image]) {
        favorite.image = urlMap[favorite.image];
      }
      return favorite;
    });
  },

  /**
   * 切换排序类型
   */
  changeSortType() {
    const sortTypes = ['time', 'name', 'rating'];
    const currentIndex = sortTypes.indexOf(this.data.sortType);
    const nextIndex = (currentIndex + 1) % sortTypes.length;

    this.setData({ sortType: sortTypes[nextIndex] });
    this.loadFavorites();
  },

  /**
   * 切换排序方向
   */
  changeSortDirection() {
    const newDirection = this.data.sortDirection === 'desc' ? 'asc' : 'desc';
    this.setData({ sortDirection: newDirection });
    this.loadFavorites();
  },

  /**
   * 酒店点击
   */
  onHotelTap(e) {
    const hotelId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/hotel/detail/detail?id=${hotelId}`
    });
  },

  /**
   * 取消收藏
   */
  onRemoveFavorite(e) {
    const { id, name } = e.currentTarget.dataset;

    wx.showModal({
      title: '取消收藏',
      content: `确定要取消收藏"${name}"吗？`,
      confirmText: '取消收藏',
      confirmColor: '#ff6b6b',
      success: (res) => {
        if (res.confirm) {
          this.executeRemoveFavorite(id);
        }
      }
    });
  },

  /**
   * 执行取消收藏
   */
  async executeRemoveFavorite(hotelId) {
    this.showLoading('处理中');

    const result = await favoritesManager.removeFavorite(hotelId);
    this.hideLoading();

    if (result.success) {
      this.showToast(result.message, 'success', 1500);
      this.loadFavorites();
    } else {
      this.showToast(result.message, 'none');
    }
  },

  /**
   * 批量管理
   */
  onManageMode() {
    this.setData({
      manageMode: !this.data.manageMode
    });
  },

  /**
   * 清空收藏
   */
  onClearAll() {
    if (this.data.favorites.length === 0) {
      this.showToast('收藏列表为空', 'none');
      return;
    }

    wx.showModal({
      title: '清空收藏',
      content: `确定要清空所有${this.data.favorites.length}个收藏吗？此操作不可恢复。`,
      confirmText: '清空',
      confirmColor: '#ff6b6b',
      success: (res) => {
        if (res.confirm) {
          this.executeClearAll();
        }
      }
    });
  },

  /**
   * 执行清空收藏
   */
  async executeClearAll() {
    this.showLoading('处理中');

    const result = await favoritesManager.clearFavorites();
    this.hideLoading();

    if (result.success) {
      this.showToast(result.message, 'success', 1500);
      this.loadFavorites();
    } else {
      this.showToast(result.message, 'none');
    }
  },

  /**
   * 跳转到发现页面
   */
  goToExplore() {
    wx.switchTab({
      url: '/pages/hotel/hotel',
      success: () => {
        console.log('跳转到酒店列表成功');
      },
      fail: (err) => {
        console.error('跳转酒店列表失败:', err);
      }
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadFavorites();
    wx.stopPullDownRefresh();
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
});