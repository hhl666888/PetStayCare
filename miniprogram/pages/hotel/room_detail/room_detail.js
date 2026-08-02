// pages/hotel/room_detail/room_detail.js
const { callFunction } = require('../../../config/cloud.js');

Page({
  data: {
    roomId: '',
    hotelId: '',
    room: null,
    hotel: null,
    loading: true,
    currentImageIndex: 0
  },

  onLoad: function(options) {
    console.log('房间详情页面接收到的参数:', options);

    if (options.roomId) {
      this.setData({
        roomId: options.roomId,
        hotelId: options.hotelId
      });

      // 先加载房间详情，加载完成后再检查收藏状态
      this.loadRoomDetail();
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

  // 加载房间详情
  loadRoomDetail: function() {
    if (!this.data.roomId) {
      wx.showToast({
        title: '房间ID不能为空',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '加载中...'
    });

    console.log('🔍 开始加载房间详情，房间ID:', this.data.roomId);

    // 调用云函数获取房间详情
    callFunction('getRoomDetail', {
      roomId: this.data.roomId,
      hotelId: this.data.hotelId
    })
    .then(res => {
      console.log('获取房间详情成功:', res);

      if (res && res.room) {
        const { room, hotel } = res;

        console.log('房间信息:', room);
        console.log('酒店信息:', hotel);

        // 处理房间图片 - 云函数返回的字段是 img
        let roomImages = [];

        // 使用 img 字段
        if (Array.isArray(room.img) && room.img.length > 0) {
          roomImages = room.img;
        }

        // 如果都没有，使用默认图片
        if (!Array.isArray(roomImages) || roomImages.length === 0) {
          roomImages = [
            'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
          ];
          console.log('使用默认图片');
        }

        console.log('最终房间图片数组:', roomImages);

        // 处理房间数据，确保所有必要字段都存在
        const processedRoom = {
          id: room._id || room.id,
          name: room.room_name || room.room_type || '标准间',
          description: room.description || '舒适的宠物寄养环境，提供专业护理和营养配餐',
          price: room.price || 0,
          capacity: room.capacity || 1,
          // 优先使用 pet_size 字段，后面加上"平方"
          size: room.pet_size ? `${room.pet_size}平方` : (room.size || room.area || '标准间'),
          pet_size: room.pet_size, // 保留原始 pet_size 字段
          facilities: room.facilities || ['24小时监控', '空调', '独立空间'],
          images: roomImages,
          stock: room.stock !== undefined ? room.stock : 99,
          hotel_id: room.hotel_id || this.data.hotelId
        };

        console.log('处理后的房间数据:', processedRoom);

        this.setData({
          room: processedRoom,
          hotel: hotel || null,
          loading: false
        });

        wx.hideLoading();

        // 设置导航栏标题
        wx.setNavigationBarTitle({
          title: processedRoom.name || '房间详情'
        });
      } else {
        throw new Error('数据格式错误：缺少房间信息');
      }
    })
    .catch(err => {
      console.error('获取房间详情失败:', err);
      wx.hideLoading();

      // 即使加载失败，也设置 loading 为 false，并尝试显示错误信息
      this.setData({
        loading: false,
        room: null,
        hotel: null
      });

      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 2000
      });
    });
  },

  // 购买房间
  onBuyRoom: function() {
    if (!this.data.room || this.data.room.stock <= 0) {
      wx.showToast({
        title: '该房间已售罄',
        icon: 'none'
      });
      return;
    }

    console.log('抢购房间:', {
      roomId: this.data.roomId,
      hotelId: this.data.hotelId,
      roomName: this.data.room.name
    });

    // 直接跳转到订单创建页面
    wx.navigateTo({
      url: `/pages/order/create/create?hotelId=${this.data.hotelId}&roomId=${this.data.roomId}`
    });
  },

  // 图片轮播改变
  onSwiperChange: function(e) {
    this.setData({
      currentImageIndex: e.detail.current
    });
  },

  // 图片预览
  onImagePreview: function() {
    if (!this.data.room || !this.data.room.images) return;

    const images = this.data.room.images.filter(img => img && img.trim() !== '');

    if (images.length > 0) {
      wx.previewImage({
        urls: images,
        current: images[this.data.currentImageIndex]
      });
    }
  },

  // 返回上一页（优先返回酒店详情页）
  onBack: function() {
    if (this.data.hotelId) {
      wx.redirectTo({
        url: `/pages/hotel/detail/detail?id=${this.data.hotelId}`
      });
    } else {
      wx.navigateBack();
    }
  },

  // 查看酒店详情
  onViewHotel: function() {
    if (!this.data.hotelId) return;

    wx.navigateTo({
      url: `/pages/hotel/detail/detail?id=${this.data.hotelId}`
    });
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadRoomDetail().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 页面分享
  onShareAppMessage: function() {
    const { room, hotel } = this.data;
    return {
      title: `${room.name} - ${hotel ? hotel.name : '宠物酒店'}`,
      desc: room.description || '舒适的宠物寄养环境',
      path: `/pages/hotel/room_detail/room_detail?roomId=${this.data.roomId}&hotelId=${this.data.hotelId}`,
      imageUrl: room.images && room.images[0] || '/images/share-banner.png'
    };
  }
});
