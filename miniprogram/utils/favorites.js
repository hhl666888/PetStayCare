// 收藏功能工具类 - 云端版本

const FavoritesManager = {
  maxFavorites: 50,

  /**
   * 调用云函数的通用方法（统一请求封装）
   * 统一使用 { code, message, data } 格式
   */
  callCloudFunction: function(action, data = {}) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'manageFavorites',
        data: {
          action: action,
          ...data
        },
        success: (res) => {
          const result = res.result || {};
          if (result.code === 0) {
            // 成功时返回 data 部分
            resolve(result.data);
          } else {
            reject(new Error(result.message || '操作失败'));
          }
        },
        fail: (err) => {
          console.error('云函数调用失败:', err);
          reject(err);
        }
      });
    });
  },

  // 获取所有收藏
  getFavorites: async function() {
    try {
      const result = await this.callCloudFunction('list');
      // result 已经是 { list: [...], total: N } 格式
      return result?.list || [];
    } catch (error) {
      console.error('获取收藏列表失败:', error);
      
      // 降级：尝试从本地获取（兼容旧数据）
      try {
        const local = wx.getStorageSync('userFavorites');
        return Array.isArray(local) ? local : [];
      } catch (e) {
        return [];
      }
    }
  },

  // 添加收藏
  addFavorite: async function(hotel) {
    try {
      const hotelData = {
        id: hotel.id || hotel._id,
        name: hotel.name || hotel.hotel_name || hotel.hotelName || '未命名酒店',
        image: this.extractImageUrl(hotel),
        address: hotel.address || hotel.hotel_address || '地址未知',
        score: hotel.score || hotel.rating || 0,
        tags: hotel.tags || hotel.hotel_tags || [],
        phone: hotel.phone || '',
        businessHours: hotel.business_hours || hotel.businessHours || ''
      };

      await this.callCloudFunction('add', { hotelId: hotelData.id, hotelData });
      
      // 同时保存到本地作为备份
      this.syncToLocal(hotelData);
      
      return { success: true, message: '收藏成功' };
    } catch (error) {
      console.error('添加收藏失败:', error);
      
      if (error.message === '已收藏') {
        return { success: false, message: '已收藏' };
      }
      return { success: false, message: '收藏失败' };
    }
  },

  // 取消收藏
  removeFavorite: async function(hotelId) {
    try {
      const result = await this.callCloudFunction('remove', { hotelId });
      
      // 同步移除本地备份
      this.removeFromLocal(hotelId);
      
      return { success: true, message: '取消收藏成功' };
    } catch (error) {
      console.error('取消收藏失败:', error);
      return { success: false, message: '取消收藏失败' };
    }
  },

  // 检查是否已收藏
  isFavorite: async function(hotelId) {
    try {
      // callCloudFunction 现在返回 data 部分
      const data = await this.callCloudFunction('check', { hotelId });
      return data?.isFavorited || false;
    } catch (error) {
      console.error('检查收藏状态失败:', error);
      // 降级：检查本地
      try {
        const local = wx.getStorageSync('userFavorites');
        if (!Array.isArray(local)) return false;
        return local.some(item => item.id === hotelId);
      } catch (e) {
        return false;
      }
    }
  },

  // 获取收藏数量
  getFavoritesCount: async function() {
    try {
      const favorites = await this.getFavorites();
      return favorites.length;
    } catch (error) {
      return 0;
    }
  },

  // 清空收藏
  clearFavorites: async function() {
    try {
      const result = await this.callCloudFunction('clear');
      wx.removeStorageSync('userFavorites');
      return { success: true, message: '清空成功' };
    } catch (error) {
      return { success: false, message: '清空失败' };
    }
  },

  // 提取图片URL
  extractImageUrl: function(hotel) {
    let imageUrl = '';
    
    if (Array.isArray(hotel.banner) && hotel.banner.length > 0) {
      imageUrl = hotel.banner[0];
    } else if (hotel.image) {
      imageUrl = hotel.image;
    } else if (Array.isArray(hotel.images) && hotel.images.length > 0) {
      imageUrl = hotel.images[0];
    }

    // 如果是临时链接，清空
    if (imageUrl && !imageUrl.includes('cloud://')) {
      if (hotel.originalData) {
        const original = hotel.originalData;
        if (Array.isArray(original.banner)) {
          const cloudBanner = original.banner.find(img => img && img.includes('cloud://'));
          if (cloudBanner) imageUrl = cloudBanner;
        }
        if (!imageUrl.includes('cloud://') && original.image?.includes('cloud://')) {
          imageUrl = original.image;
        }
      }
      
      if (imageUrl && !imageUrl.includes('cloud://') && (imageUrl.includes('sign=') || imageUrl.includes('t='))) {
        imageUrl = '';
      }
    }

    return imageUrl;
  },

  // 同步到本地（作为备份）
  syncToLocal: function(hotelData) {
    try {
      let favorites = wx.getStorageSync('userFavorites');
      if (!Array.isArray(favorites)) favorites = [];

      const exists = favorites.some(item => item.id === hotelData.id);
      if (!exists) {
        favorites.unshift({
          ...hotelData,
          addedTime: new Date().toISOString()
        });
        wx.setStorageSync('userFavorites', favorites);
      }
    } catch (e) {
      // 忽略本地存储错误
    }
  },

  // 从本地移除
  removeFromLocal: function(hotelId) {
    try {
      let favorites = wx.getStorageSync('userFavorites');
      if (Array.isArray(favorites)) {
        favorites = favorites.filter(item => item.id !== hotelId);
        wx.setStorageSync('userFavorites', favorites);
      }
    } catch (e) {
      // 忽略
    }
  },

  // 排序方法
  sortByTime: function(favorites, descending) {
    descending = descending !== false;
    return favorites.sort(function(a, b) {
      var timeA = new Date(a.addedTime).getTime();
      var timeB = new Date(b.addedTime).getTime();
      return descending ? timeB - timeA : timeA - timeB;
    });
  },

  sortByName: function(favorites, ascending) {
    ascending = ascending !== false;
    return favorites.sort(function(a, b) {
      var nameA = (a.name || '').toLowerCase();
      var nameB = (b.name || '').toLowerCase();
      if (ascending) {
        return nameA < nameB ? -1 : (nameA > nameB ? 1 : 0);
      } else {
        return nameB < nameA ? -1 : (nameB > nameA ? 1 : 0);
      }
    });
  },

  sortByRating: function(favorites, descending) {
    descending = descending !== false;
    return favorites.sort(function(a, b) {
      var ratingA = a.rating || 0;
      var ratingB = b.rating || 0;
      return descending ? ratingB - ratingA : ratingA - ratingB;
    });
  }
};

module.exports = FavoritesManager;
