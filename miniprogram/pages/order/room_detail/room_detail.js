// pages/hotel/room_detail/room_detail.js
const { callFunction } = require('../../../config/cloud.js');

Page({
  data: {
    roomId: '',
    hotelId: '',
    room: null,
    hotel: null,
    loading: true,
    currentImageIndex: 0,
    showBookingModal: false,
    bookingQuantity: 1,
    selectedDates: {
      checkIn: '',
      checkOut: ''
    }
  },

  onLoad: function(options) {
    console.log('房型详情页面接收到的参数:', options);
    
    if (options.roomId && options.hotelId) {
      this.setData({
        roomId: options.roomId,
        hotelId: options.hotelId
      });
      
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

  // 加载房型详情
  loadRoomDetail: function() {
    wx.showLoading({
      title: '加载中...'
    });

    console.log('🔍 开始加载房型详情，房型ID:', this.data.roomId, '酒店ID:', this.data.hotelId);

    // 调用获取房型详情的云函数
    callFunction('getRoomDetail', {
      roomId: this.data.roomId,
      hotelId: this.data.hotelId
    })
    .then(res => {
      console.log('获取房型详情成功:', res);
      
      if (res && res.room) {
        const { room, hotel } = res;
        
        console.log('房型信息:', room);
        console.log('酒店信息:', hotel);
        
        const processedRoom = this.processRoomData(room);
        const processedHotel = this.processHotelData(hotel);
        
        this.setData({
          room: processedRoom,
          hotel: processedHotel,
          loading: false
        });
        
        // 设置导航栏标题
        wx.setNavigationBarTitle({
          title: processedRoom.name || '房型详情'
        });
      } else {
        throw new Error('数据格式错误：缺少房间信息');
      }
    })
    .catch(err => {
      console.error('获取房型详情失败:', err);
      wx.hideLoading();
      
      this.setData({ loading: false });
      
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 2000
      });
    })
    .finally(() => {
      wx.hideLoading();
    });
  },

  // 处理房型数据
  processRoomData: function(room) {
    console.log('处理房型数据，原始数据:', room);
    
    // 处理房型图片
    let images = [];
    
    // 定义所有可能的图片字段名（按优先级排序）
    const imageFields = [
      'img', 'image', 'images', 'roomImages', 'room_image', 
      'photo', 'photos', 'picture', 'pictures', 'banner', 'gallery', 'media'
    ];
    
    // 遍历所有可能的图片字段
    for (let i = 0; i < imageFields.length; i++) {
      const fieldName = imageFields[i];
      const fieldValue = room[fieldName];
      
      if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
        if (Array.isArray(fieldValue)) {
          images = fieldValue.filter(img => img && img.trim() !== '');
        } else if (typeof fieldValue === 'string') {
          if (fieldValue.includes(',')) {
            images = fieldValue.split(',').map(img => img.trim()).filter(img => img);
          } else {
            images = [fieldValue.trim()];
          }
        }
        if (images.length > 0) break;
      }
    }
    
    // 如果所有图片字段都为空，提供默认图片
    if (images.length === 0) {
      images = [
        'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
      ];
    }
    
    console.log('最终房型图片:', images);
    
    return {
      id: room._id,
      name: room.room_name || room.room_type || '标准间',
      description: room.description || '舒适的宠物寄养环境，提供专业护理和营养配餐',
      price: room.price || 0,
      capacity: room.capacity || 1,
      size: room.size || room.area || '标准间',
      facilities: room.facilities || ['24小时监控', '空调', '独立空间'],
      images: images,
      stock: room.stock !== undefined ? room.stock : (room.kucun !== undefined ? room.kucun : 10),
      hotel_id: room.hotel_id,
      status: room.status || 'active',
      // 美团风格需要的额外字段
      features: room.features || ['专业护理', '营养配餐', '定时喂食'],
      services: room.services || ['清洁服务', '健康检查', '行为训练'],
      rules: room.rules || ['禁止携带传染性疾病宠物', '需要提供疫苗接种证明'],
      cancelPolicy: room.cancel_policy || '入住前24小时免费取消，之后收取50%费用'
    };
  },

  // 处理酒店数据
  processHotelData: function(hotel) {
    return {
      id: hotel._id,
      name: hotel.hotel_name || hotel.name || '宠物酒店',
      address: hotel.hotel_address || hotel.address || '地址待完善',
      phone: hotel.hotel_phone || hotel.phone || '暂无电话',
      rating: hotel.rating || hotel.score || 4.5
    };
  },

  // 图片轮播改变
  onSwiperChange: function(e) {
    this.setData({
      currentImageIndex: e.detail.current
    });
  },

  // 图片预览
  onImagePreview: function() {
    const images = this.data.room.images;
    
    if (images.length > 0) {
      wx.previewImage({
        urls: images,
        current: images[this.data.currentImageIndex]
      });
    }
  },

  // 显示预订弹窗
  onBooking: function() {
    if (this.data.room.stock <= 0) {
      wx.showToast({
        title: '该房型已售罄',
        icon: 'none'
      });
      return;
    }

    this.setData({
      showBookingModal: true,
      bookingQuantity: 1
    });
  },

  // 隐藏预订弹窗
  hideBookingModal: function() {
    this.setData({
      showBookingModal: false
    });
  },

  // 增加预订数量
  increaseQuantity: function() {
    if (this.data.bookingQuantity < this.data.room.stock) {
      this.setData({
        bookingQuantity: this.data.bookingQuantity + 1
      });
    } else {
      wx.showToast({
        title: '超出库存数量',
        icon: 'none'
      });
    }
  },

  // 减少预订数量
  decreaseQuantity: function() {
    if (this.data.bookingQuantity > 1) {
      this.setData({
        bookingQuantity: this.data.bookingQuantity - 1
      });
    }
  },

  // 选择入住日期
  onCheckInDateChange: function(e) {
    this.setData({
      'selectedDates.checkIn': e.detail.value
    });
  },

  // 选择退房日期
  onCheckOutDateChange: function(e) {
    this.setData({
      'selectedDates.checkOut': e.detail.value
    });
  },

  // 确认预订
  confirmBooking: function() {
    const { checkIn, checkOut } = this.data.selectedDates;
    
    if (!checkIn || !checkOut) {
      wx.showToast({
        title: '请选择入住和退房日期',
        icon: 'none'
      });
      return;
    }

    // 跳转到美团风格的订单创建页面
    wx.navigateTo({
      url: `/pages/order/create/create?hotelId=${this.data.hotelId}&roomId=${this.data.roomId}&quantity=${this.data.bookingQuantity}&checkIn=${checkIn}&checkOut=${checkOut}`
    });
    
    this.hideBookingModal();
  },

  // 直接预订 - 不选择日期
  onDirectBooking: function() {
    if (this.data.room.stock <= 0) {
      wx.showToast({
        title: '该房型已售罄',
        icon: 'none'
      });
      return;
    }

    // 使用默认日期：今天入住，明天退房
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const checkIn = this.formatDate(today);
    const checkOut = this.formatDate(tomorrow);

    console.log('直接预订，使用默认日期:', { checkIn, checkOut });

    // 跳转到美团风格的订单创建页面
    wx.navigateTo({
      url: `/pages/order/create/create?hotelId=${this.data.hotelId}&roomId=${this.data.roomId}&quantity=${this.data.bookingQuantity}&checkIn=${checkIn}&checkOut=${checkOut}`
    });
  },

  // 格式化日期
  formatDate: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 联系酒店
  onContactHotel: function() {
    const phone = this.data.hotel.phone;
    if (phone && phone !== '暂无电话') {
      wx.makePhoneCall({
        phoneNumber: phone
      });
    } else {
      wx.showToast({
        title: '暂无联系电话',
        icon: 'none'
      });
    }
  },

  // 查看酒店位置
  onViewLocation: function() {
    const hotel = this.data.hotel;
    
    wx.showModal({
      title: hotel.name,
      content: `地址：${hotel.address}\n电话：${hotel.phone}`,
      showCancel: false,
      confirmText: '知道了'
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
      title: `${room.name} - ${hotel.name}`,
      desc: room.description,
      path: `/pages/hotel/room_detail/room_detail?roomId=${this.data.roomId}&hotelId=${this.data.hotelId}`,
      imageUrl: room.images[0] || '/images/share-banner.png'
    };
  }
});