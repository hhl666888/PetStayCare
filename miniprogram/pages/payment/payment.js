// pages/payment/payment.js
const { callFunction } = require('../../config/cloud.js');

Page({
  data: {
    orderId: '',
    amount: 0,
    merchantName: '宠宿无忧',
    orderDesc: '宠物酒店预订',
    payMethod: 'wechat', // wechat, alipay
    paying: false,
    countdown: 15, // 15分钟倒计时
    countdownText: '14:59',
    orderInfo: null
  },

  onLoad: function(options) {
    if (options.orderId) {
      this.setData({
        orderId: options.orderId,
        amount: 0
      });

      this.loadOrderInfo();
      this.startCountdown();
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

  onShow: function() {
    wx.enableAlertBeforeUnload({
      message: '是否放弃本次支付'
    });
  },

  // 加载订单信息
  loadOrderInfo: function() {
    wx.showLoading({
      title: '加载订单...'
    });

    callFunction('getOrders', {
      orderId: this.data.orderId
    })
    .then(orderData => {
      wx.hideLoading();

      // 统一响应格式: res 已经是 data 部分
      // 从订单数据中获取正确的价格
      let price = 0;

      if (orderData.orderType === 'room') {
        price =
          orderData.hotel_room?.price ||
          orderData.room?.price ||
          orderData.roomPrice ||
          orderData.totalPrice ||
          orderData.actualPrice ||
          0;
      } else {
        price =
          orderData.servicePrice ||
          orderData.totalPrice ||
          orderData.actualPrice ||
          0;
      }

      if (price === 0 && orderData.actualPrice) {
        price = orderData.actualPrice;
      }

      this.setData({
        orderInfo: orderData,
        amount: price.toFixed(2),
        orderDesc: orderData.orderType === 'service' ? '宠物服务' : '宠物酒店预订'
      });
    })
    .catch(err => {
      wx.hideLoading();
      console.error('获取订单详情失败:', err);
    });
  },

  // 开始倒计时
  startCountdown: function() {
    let totalSeconds = 15 * 60; // 15分钟

    this.timer = setInterval(() => {
      if (totalSeconds <= 0) {
        clearInterval(this.timer);
        this.setData({
          countdownText: '00:00'
        });

        // 倒计时结束，取消订单
        this.cancelOrder();
        return;
      }

      totalSeconds--;

      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      this.setData({
        countdownText: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      });
    }, 1000);
  },

  // 选择支付方式
  selectPayMethod: function(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({
      payMethod: method
    });
  },

  // 确认支付
  confirmPay: function() {
    if (this.data.paying) {
      return;
    }

    this.setData({
      paying: true
    });

    wx.showLoading({
      title: '支付中...',
      mask: true
    });

    // 立即开始更新订单状态，同时启动超时机制
    this.updateOrderStatus();
  },

  // 更新订单状态为已支付
  updateOrderStatus: function() {
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');

    callFunction('updateOrderStatus', {
      orderId: this.data.orderId,
      status: 'paid',
      openid: userInfo?.openid
    })
    .then(res => {
      this.handlePaymentSuccess();
    })
    .catch(err => {
      console.error('更新订单状态失败:', err);
      this.cancelOrderOnFailure();
    });
  },

  // 支付失败时取消订单
  cancelOrderOnFailure: function() {
    wx.hideLoading();
    this.setData({ paying: false });

    wx.showModal({
      title: '支付失败',
      content: '订单状态更新失败，是否取消该订单？',
      confirmText: '取消订单',
      cancelText: '稍后重试',
      success: (res) => {
        if (res.confirm) {
          callFunction('updateOrderStatus', {
            orderId: this.data.orderId,
            status: 'cancelled'
          }).then(() => {
            wx.redirectTo({
              url: `/pages/order/order`
            });
          });
        } else {
          // 用户选择稍后重试，返回订单页面
          wx.switchTab({
            url: '/pages/order/order'
          });
        }
      }
    });
  },

  // 处理支付成功
  handlePaymentSuccess: function() {
    wx.hideLoading();
    this.setData({ paying: false });

    wx.showToast({
      title: '支付成功',
      icon: 'success',
      duration: 1500
    });

    // 设置全局刷新标记
    const app = getApp();
    if (app) {
      app.globalData.needRefreshOrders = true;
    }

    setTimeout(() => {
      wx.redirectTo({
        url: `/pages/order/success/success?orderId=${this.data.orderId}`,
        fail: () => {
          wx.switchTab({
            url: '/pages/order/order'
          });
        }
      });
    }, 100);
  },

  // 取消支付
  cancelPay: function() {
    wx.showModal({
      title: '是否放弃本次支付',
      content: '您确定要放弃本次支付吗？',
      confirmText: '继续支付',
      cancelText: '放弃',
      confirmColor: '#07c160',
      cancelColor: '#dc3545',
      success: (res) => {
        if (!res.confirm) {
          // 用户点击"放弃"，跳转到支付失败页面
          wx.redirectTo({
            url: `/pages/order/payment-failed/payment-failed?orderId=${this.data.orderId}`
          });
        }
      }
    });
  },

  // 取消订单（超时用）
  cancelOrder: function() {
    clearInterval(this.timer);

    // 调用云函数取消订单
    callFunction('updateOrderStatus', {
      orderId: this.data.orderId,
      status: 'cancelled'
    })
    .then(() => {
      console.log('订单已取消');
    })
    .catch(err => {
      console.error('取消订单失败:', err);
    })
    .finally(() => {
      // 跳转到支付失败页面
      wx.redirectTo({
        url: `/pages/order/payment-failed/payment-failed?orderId=${this.data.orderId}`
      });
    });
  },

  // 页面卸载时清除定时器和返回拦截
  onUnload: function() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    // 取消返回拦截
    wx.disableAlertBeforeUnload();
  },

  // 页面隐藏时清除定时器和返回拦截
  onHide: function() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    // 取消返回拦截
    wx.disableAlertBeforeUnload();
  }
});

