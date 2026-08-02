// pages/order/success/success.js
const { callFunction } = require('../../../config/cloud.js');

Page({
  data: {
    orderId: '',
    orderInfo: null,
    countdown: 30,
    loading: true
  },

  onLoad: function(options) {
    console.log('订单成功页面参数:', options);
    
    if (options.orderId) {
      this.setData({
        orderId: options.orderId
      });
      
      this.loadOrderInfo();
      this.startCountdown();
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/hotel/hotel'
        });
      }, 1500);
    }
  },

  // 加载订单信息
  loadOrderInfo: function() {
    wx.showLoading({
      title: '加载订单信息...'
    });

    // 从云数据库获取真实订单信息
    callFunction('getOrders', {
      orderId: this.data.orderId
    })
    .then(orderData => {
      wx.hideLoading();
      console.log('获取订单详情成功:', orderData);

      // callFunction 已自动解包，orderData 直接是订单对象
      if (!orderData || !orderData._id) {
        throw new Error('获取订单信息失败');
      }

      // 如果订单中有hotelId但没有完整的酒店信息，重新获取酒店详细信息
      if (orderData.hotelId && !orderData.hotel?.name) {
        return this.loadHotelInfo(orderData.hotelId).then(hotelInfo => {
          return {
            ...orderData,
            hotel: {
              id: orderData.hotelId,
              name: hotelInfo.hotel_name || hotelInfo.hotel_name || '未知酒店',
              address: hotelInfo.hotel_address || hotelInfo.address || '地址待完善'
            }
          };
        });
      }

      return orderData;
    })
    .then(orderData => {
      // 处理订单数据，适配页面显示
      const processedOrderInfo = {
        orderId: orderData._id || orderData.orderId,
        status: orderData.status || 'pending',
        statusText: orderData.statusText || this.getStatusText(orderData.status),
        createTime: orderData.createTime || new Date().toLocaleString(),
        hotel: {
          name: orderData.hotel?.name || '宠物酒店',
          address: orderData.hotel?.address || '地址待完善'
        },
          // 房型订单信息
          room: orderData.orderType === 'room' ? {
            name: orderData.roomName || orderData.room?.name || '标准间',
            checkInDate: this.formatDate(new Date(orderData.checkInDate || Date.now())),
            checkOutDate: this.formatDate(new Date(orderData.checkOutDate || Date.now() + 24 * 60 * 60 * 1000)),
            nights: orderData.nights || 1
          } : null,
          // 服务订单信息
          service: orderData.orderType === 'service' ? {
            name: orderData.serviceName || orderData.service?.name || '宠物服务',
            price: orderData.servicePrice || orderData.service?.price || 0
          } : null,
          pets: orderData.pets || [],
          totalPrice: orderData.totalPrice || 0,
          actualPrice: orderData.actualPrice || 0,
          orderType: orderData.orderType || 'room',
          payTime: orderData.payTime // 支付时间
        };

        this.setData({
          orderInfo: processedOrderInfo,
          loading: false
        });

        console.log('处理后的订单信息:', processedOrderInfo);
    })
    .catch(err => {
      wx.hideLoading();
      console.error('获取订单详情失败:', err);

      this.setData({
        loading: false,
        orderInfo: {
          orderId: this.data.orderId,
          status: 'error',
          statusText: '获取失败',
          createTime: new Date().toLocaleString(),
          hotel: {
            name: '宠物酒店',
            address: '地址获取失败'
          },
          pets: [],
          totalPrice: 0,
          actualPrice: 0
        }
      });

      wx.showToast({
        title: '获取订单信息失败',
        icon: 'none',
        duration: 2000
      });
    });
  },

  // 获取状态文本
  getStatusText: function(status) {
    const statusMap = {
      'pending': '待支付',
      'paid': '已支付',
      'ongoing': '进行中',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || '未知状态';
  },

  // 加载酒店详细信息
  loadHotelInfo: function(hotelId) {
    return callFunction('getHotelDetail', {
      hotelId: hotelId
    })
    .then(res => {
      // getHotelDetail 返回 { hotel: {...}, rooms: [...] }，提取 hotel 对象
      const hotel = res.hotel || res;
      console.log('获取酒店详细信息成功:', hotel);
      return hotel;
    });
  },

  // 格式化日期
  formatDate: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 开始倒计时
  startCountdown: function() {
    this.timer = setInterval(() => {
      let countdown = this.data.countdown - 1;
      
      if (countdown <= 0) {
        clearInterval(this.timer);
        this.setData({
          countdown: 0
        });
      } else {
        this.setData({
          countdown: countdown
        });
      }
    }, 1000);
  },

  // 查看订单 - 跳转到订单列表页（tabBar页面需用switchTab）
  onViewOrder: function() {
    wx.switchTab({
      url: '/pages/order/order'
    });
  },

  // 返回首页
  goHome: function() {
    wx.reLaunch({
      url: '/pages/hotel/hotel'
    });
  },

  // 联系客服
  contactService: function() {
    wx.showActionSheet({
      itemList: ['在线客服', '电话客服'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 跳转到客服聊天页面
          wx.navigateTo({
            url: '/pages/service/chat'
          });
        } else if (res.tapIndex === 1) {
          wx.makePhoneCall({
            phoneNumber: '400-123-4567'
          });
        }
      }
    });
  },

  // 分享订单
  onShareAppMessage: function() {
    return {
      title: '我在宠宿无忧预订了宠物酒店',
      desc: '专业的宠物寄养服务，值得信赖！',
      path: `/pages/order/success/success?orderId=${this.data.orderId}`,
      imageUrl: '/images/share-order.png'
    };
  },

  // 页面卸载时清除定时器
  onUnload: function() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
});