// pages/service/detail/detail.js - 服务详情页面
Page({
  data: {
    serviceId: '',
    hotelId: '',
    service: null,
    loading: true,
    currentIndex: 0
  },

  onLoad(options) {
    const { serviceId, hotelId } = options;
    
    if (!serviceId) {
      wx.showToast({
        title: '服务ID不存在',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    
    this.setData({
      serviceId,
      hotelId
    });
    
    this.loadServiceDetail();
  },

  // 加载服务详情
  loadServiceDetail: async function() {
    try {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });

      const res = await wx.cloud.callFunction({
        name: 'getServiceDetail',
        data: {
          serviceId: this.data.serviceId
        }
      });

      if (res.result && res.result.code === 0) {
        const service = res.result.data;

        this.setData({
          service: service,
          serviceImgList: service.service_img ? [service.service_img] : [],
          loading: false
        });

        wx.setNavigationBarTitle({
          title: service.service_name || '服务详情'
        });
      } else {
        throw new Error(res.result?.message || '加载失败');
      }

      wx.hideLoading();

    } catch (error) {
      wx.hideLoading();
      this.setData({ loading: false });

      wx.showModal({
        title: '加载失败',
        content: error.message || '服务详情加载失败，请重试',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  // 图片轮播切换
  onSwiperChange: function(e) {
    this.setData({
      currentIndex: e.detail.current
    });
  },

  // 预览图片
  onPreviewImage: function(e) {
    const { index } = e.currentTarget.dataset;
    const service = this.data.service;
    
    if (service.service_img) {
      wx.previewImage({
        current: service.service_img,
        urls: [service.service_img]
      });
    }
  },

  // 图片加载错误
  onImageError: function(e) {
    console.error('图片加载失败');
  },

  // 立即预订
  onBookNow: function() {
    const { service, hotelId } = this.data;
    
    wx.navigateTo({
      url: `/pages/order/create/create?hotelId=${hotelId}&serviceId=${service._id}&serviceName=${service.service_name}&price=${service.price}&type=service`
    });
  },

  // 分享
  onShareAppMessage: function() {
    const { service } = this.data;
    return {
      title: service.service_name || '热门服务',
      path: `/pages/service/detail/detail?serviceId=${service._id}&hotelId=${this.data.hotelId}`,
      imageUrl: service.service_img || ''
    };
  }
});
