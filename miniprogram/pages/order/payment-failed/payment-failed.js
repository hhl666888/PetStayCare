// pages/order/payment-failed/payment-failed.js
const { callFunction } = require('../../../config/cloud.js');

Page({
  data: {
    orderId: '',
    amount: '0.00',
    orderInfo: null,
    remainingSeconds: 0,
    countdownText: '',
    countdownTimer: null
  },

  onLoad(options) {
    console.log('支付失败页面参数:', options);

    if (options.orderId) {
      this.setData({
        orderId: options.orderId
      });

      this.loadOrderInfo();
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

  onUnload() {
    if (this.data.countdownTimer) {
      clearInterval(this.data.countdownTimer);
    }
  },

  // 加载订单信息
  loadOrderInfo: function() {
    wx.showLoading({
      title: '加载订单...'
    });

    callFunction('getOrders', {
      orderId: this.data.orderId
    })
    .then(res => {
      wx.hideLoading();
      console.log('获取订单详情成功:', res);

      if (res) {
        const orderData = res;

        // 从订单数据中获取价格
        let price = 0;
        if (orderData.orderType === 'room') {
          price = orderData.actualPrice || orderData.totalPrice || orderData.roomPrice || 0;
        } else {
          price = orderData.actualPrice || orderData.totalPrice || orderData.servicePrice || 0;
        }

        this.setData({
          orderInfo: orderData,
          amount: price.toFixed(2)
        });

        // 启动倒计时
        this.startCountdown(orderData);
      } else {
        wx.showToast({
          title: '未找到订单信息',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error('获取订单详情失败:', err);
    });
  },

  // 启动倒计时
  startCountdown: function(orderData) {
    if (orderData.status !== 'pending') {
      this.setData({
        remainingSeconds: 0,
        countdownText: '已超时'
      });
      return;
    }

    const createTime = new Date(orderData.createTime).getTime();
    const expireTime = createTime + 15 * 60 * 1000; // 15分钟
    const now = Date.now();
    const remainingSeconds = Math.max(0, Math.floor((expireTime - now) / 1000));

    this.setData({
      remainingSeconds: remainingSeconds,
      countdownText: `将在${this.formatCountdown(remainingSeconds)}后过期`
    });

    if (remainingSeconds <= 0) return;

    // 启动倒计时
    const timer = setInterval(() => {
      let remaining = this.data.remainingSeconds - 1;

      if (remaining <= 0) {
        clearInterval(timer);
        this.setData({
          remainingSeconds: 0,
          countdownText: '已超时'
        });
      } else {
        this.setData({
          remainingSeconds: remaining,
          countdownText: `将在${this.formatCountdown(remaining)}后过期`
        });
      }
    }, 1000);

    this.setData({
      countdownTimer: timer
    });
  },

  // 格式化倒计时
  formatCountdown: function(seconds) {
    if (seconds <= 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
      return `${minutes}分${secs}秒`;
    }
    return `${secs}秒`;
  },

  // 复制订单号
  copyOrderId: function(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.setClipboardData({
      data: orderId,
      success: () => {
        wx.showToast({
          title: '订单号已复制',
          icon: 'success'
        });
      }
    });
  },

  // 重新支付
  retryPay: function() {
    // 检查订单状态，如果订单已取消，提示用户重新下单
    if (this.data.orderInfo && this.data.orderInfo.status === 'cancelled') {
      wx.showModal({
        title: '订单已取消',
        content: '该订单已取消，请重新下单',
        showCancel: false,
        success: () => {
          wx.switchTab({
            url: '/pages/hotel/hotel'
          });
        }
      });
      return;
    }

    if (this.data.remainingSeconds <= 0) {
      wx.showToast({
        title: '订单已超时',
        icon: 'none'
      });
      return;
    }

    // 跳转到支付页面
    wx.navigateTo({
      url: `/pages/payment/payment?orderId=${this.data.orderId}`,
      fail: (err) => {
        console.error('跳转支付页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 重新预订
  goToHotel: function() {
    wx.switchTab({
      url: '/pages/hotel/hotel'
    });
  },

  // 取消支付，跳转首页
  cancelPayment: function() {
    wx.showModal({
      title: '确认取消',
      content: '是否取消支付？取消后订单将被关闭。',
      confirmText: '确认取消',
      cancelText: '继续支付',
      success: (res) => {
        if (res.confirm) {
          // 更新订单状态为已取消
          this.updateOrderStatusToCancelled();
          
          // 跳转到首页
          wx.switchTab({
            url: '/pages/index/index',
            fail: () => {
              wx.redirectTo({
                url: '/pages/index/index'
              });
            }
          });
        }
      }
    });
  },

  // 更新订单状态为已取消
  updateOrderStatusToCancelled: function() {
    if (!this.data.orderId) return;
    
    const userInfo = wx.getStorageSync('userInfo');
    const userId = userInfo?.openid || userInfo?.openId;
    
    callFunction('updateOrderStatus', {
      orderId: this.data.orderId,
      status: 'cancelled',
      userId: userId,
      reason: '用户主动取消支付'
    }).then(res => {
      console.log('订单状态已更新为已取消:', res);
    }).catch(err => {
      console.error('更新订单状态失败:', err);
    });
  }
});
