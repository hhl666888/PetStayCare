// pages/order/order.js - 订单管理页面
// 功能：订单列表展示、订单筛选、订单操作（取消、支付等）
const { callFunction } = require('../../config/cloud.js');

Page({
  data: {
    currentTab: 'all',
    orders: [],
    filteredOrders: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    userInfo: null,
    pendingCount: 0,
    countdownTimers: {},
    countdown: {}
  },

  /**
   * 页面加载
   */
  onLoad: function(options) {
    this.handleTabParam(options);
    this.resetOrderData();
    this.checkLoginAndLoadOrders();
  },

  /**
   * 处理tab参数
   */
  handleTabParam: function(options) {
    if (options.tab) {
      this.setData({ currentTab: options.tab });
    }
  },

  /**
   * 重置订单数据
   */
  resetOrderData: function() {
    this.setData({
      orders: [],
      filteredOrders: [],
      loading: false
    });
  },

  /**
   * 页面显示
   */
  onShow: function() {
    // 每次显示订单页面都强制刷新，确保获取最新状态（包括后台手动修改的）
    console.log('【订单页面】onShow - 强制刷新订单数据');
    this.loadOrders(true);
  },

  /**
   * 检查是否需要刷新订单
   */
  checkNeedRefresh: function() {
    const app = getApp();
    if (app?.globalData?.needRefreshOrders) {
      app.globalData.needRefreshOrders = false;
      return true;
    }
    return false;
  },

  /**
   * 检查登录状态并加载订单
   */
  checkLoginAndLoadOrders: function() {
    const userInfo = this.getUserInfo();

    if (this.isValidUser(userInfo)) {
      this.handleLoggedInUser(userInfo);
    } else {
      this.handleLoggedOutUser();
    }
  },

  /**
   * 获取用户信息
   */
  getUserInfo: function() {
    const app = getApp();
    return app.globalData?.userInfo || wx.getStorageSync('userInfo');
  },

  /**
   * 检查用户是否有效
   * 简化验证：只要登录成功即可访问订单页面
   * - isLoggedIn: 登录成功的标志（登录页面设置）
   */
  isValidUser: function(userInfo) {
    if (!userInfo) {
      console.log('【订单页面】用户信息为空');
      return false;
    }
    
    const app = getApp();
    
    // 只检查是否已登录成功（isLoggedIn = true，通过login页面登录后设置）
    const isLoggedIn = userInfo.isLoggedIn === true || app.globalData.isLoggedIn === true;
    
    console.log('【订单页面】用户状态检查:', {
      isLoggedIn: isLoggedIn,
      userIsLoggedIn: userInfo.isLoggedIn,
      globalIsLoggedIn: app.globalData.isLoggedIn
    });
    
    // 只要登录成功即可访问订单
    if (isLoggedIn) {
      console.log('✅ 验证通过：用户已登录，允许访问订单');
      return true;
    }
    
    console.log('❌ 用户未登录，拒绝访问订单');
    return false;
  },

  /**
   * 处理已登录用户
   */
  handleLoggedInUser: function(userInfo) {
    this.setData({
      hasValidUser: true,
      userInfo: userInfo
    });
    this.loadOrders();
  },

  /**
   * 处理未登录用户
   */
  handleLoggedOutUser: function() {
    console.log('【订单页面】用户未登录或未注册，显示登录提示');
    this.setData({
      hasValidUser: false,
      userInfo: null,
      orders: [],
      filteredOrders: [],
      loading: false
    });
  },

  /**
   * 启动待支付订单倒计时
   */
  startPendingCountdown: function(orders) {
    this.clearAllCountdowns();

    orders.forEach(order => {
      if (order.status === 'pending' && order.createTime) {
        this.startOrderCountdown(order);
      }
    });
  },

  /**
   * 启动单个订单倒计时
   */
  startOrderCountdown: function(order) {
    const orderId = this.getOrderId(order);
    
    const remainingSeconds = this.calculateRemainingTime(order.createTime);

    if (remainingSeconds <= 0) {
      // 已超时
      this.updateOrderCountdownText(orderId, '支付超时');
      this.updateOrderExpireStatus(orderId);
      return;
    }

    // 立即显示准确的倒计时（如 "剩余支付时间：14:58"）
    const countdownText = '剩余支付时间：' + this.formatCountdown(remainingSeconds);
    this.updateOrderCountdownText(orderId, countdownText);

    this.initializeCountdown(orderId, remainingSeconds);
    this.createCountdownTimer(orderId, remainingSeconds);
  },

  /**
   * 获取订单ID
   */
  getOrderId: function(order) {
    return order._id || order.id;
  },

  /**
   * 计算剩余时间
   */
  calculateRemainingTime: function(createTime) {
    const EXPIRE_MINUTES = 15;
    
    // 容错处理：确保 createTime 格式正确
    if (!createTime) {
      console.error('【订单页面】订单创建时间不存在');
      return 0;
    }
    
    let createTimeMs;
    try {
      createTimeMs = new Date(createTime).getTime();
    } catch (e) {
      console.error('【订单页面】时间解析失败:', createTime, e);
      return 0;
    }
    
    // 检查是否解析成功
    if (isNaN(createTimeMs) || createTimeMs <= 0) {
      console.error('【订单页面】时间戳无效:', createTime, createTimeMs);
      return 0;
    }
    
    const expireTime = createTimeMs + EXPIRE_MINUTES * 60 * 1000;
    const now = Date.now();
    const remaining = Math.floor((expireTime - now) / 1000);
    
    console.log('【订单页面】倒计时计算:', {
      createTime,
      createTimeMs,
      expireTime,
      now,
      remainingSeconds: remaining
    });
    
    return Math.max(0, remaining);
  },

  /**
   * 初始化倒计时数据
   */
  initializeCountdown: function(orderId, remainingSeconds) {
    const countdownKey = `order_${orderId}`;
    this.data.countdown[countdownKey] = remainingSeconds;

    const countdownText = '剩余支付时间：' + this.formatCountdown(remainingSeconds);
    this.updateOrderCountdownText(orderId, countdownText);
  },

  /**
   * 创建倒计时定时器
   */
  createCountdownTimer: function(orderId, initialSeconds) {
    const countdownKey = `order_${orderId}`;

    const timer = setInterval(() => {
      if (this.data.countdown[countdownKey] !== undefined) {
        this.data.countdown[countdownKey]--;

        if (this.data.countdown[countdownKey] <= 0) {
          this.handleCountdownEnd(timer, orderId, countdownKey);
        } else {
          this.handleCountdownTick(orderId, countdownKey);
        }
      }
    }, 1000);

    this.data.countdownTimers[orderId] = timer;
  },

  /**
   * 处理倒计时结束
   */
  handleCountdownEnd: function(timer, orderId, countdownKey) {
    clearInterval(timer);
    delete this.data.countdown[countdownKey];
    delete this.data.countdownTimers[orderId];

    this.updateOrderCountdownText(orderId, '支付超时');
    this.updateOrderExpireStatus(orderId);
  },

  /**
   * 处理倒计时每秒更新
   */
  handleCountdownTick: function(orderId, countdownKey) {
    const countdownText = '剩余支付时间：' + this.formatCountdown(this.data.countdown[countdownKey]);
    this.updateOrderCountdownText(orderId, countdownText);
    this.setData({
      countdown: { ...this.data.countdown }
    });
  },

  /**
   * 更新订单倒计时文本
   */
  updateOrderCountdownText: function(orderId, countdownText) {
    const orders = this.data.orders.map(order => {
      if (this.getOrderId(order) === orderId) {
        return { ...order, countdownText };
      }
      return order;
    });
    // 同步更新 filteredOrders，确保 wxml 立即刷新倒计时文本
    const filteredOrders = this.data.filteredOrders.map(order => {
      if (this.getOrderId(order) === orderId) {
        return { ...order, countdownText };
      }
      return order;
    });
    this.setData({ orders, filteredOrders });
  },

  /**
   * 清除所有倒计时
   */
  clearAllCountdowns: function() {
    Object.values(this.data.countdownTimers).forEach(timer => {
      clearInterval(timer);
    });
    this.data.countdownTimers = {};
    this.data.countdown = {};
  },

  /**
   * 格式化倒计时为 MM:SS
   */
  formatCountdown: function(seconds) {
    if (seconds <= 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  /**
   * 更新订单过期状态
   */
  updateOrderExpireStatus: function(orderId) {
    const userId = this.getUserId();
    if (!userId) return;

    callFunction('updateOrderStatus', {
      orderId: orderId,
      status: 'cancelled',
      openid: userId,
      reason: '支付超时自动取消'
    }).then(res => {
      if (res.result?.success) {
        this.loadOrders(true);
      }
    }).catch(err => {
      console.error('【订单管理】自动取消订单失败:', err);
    });
  },

  /**
   * 获取用户ID（统一使用 openid）
   */
  getUserId: function() {
    const app = getApp();
    const userInfo = app.globalData?.userInfo || wx.getStorageSync('userInfo');
    return userInfo?.openid;
  },

  /**
   * 加载订单数据
   */
  loadOrders(isRefresh = false) {
    // 先检查登录状态
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');

    // 使用与isValidUser相同的检查逻辑
    if (!this.isValidUser(userInfo)) {
      console.log('❌ 用户未登录或未注册，不加载订单');
      this.setData({
        hasValidUser: false,
        orders: [],
        filteredOrders: [],
        loading: false
      });
      return;
    }

    if (this.data.loading) return;

    this.setData({ loading: true });

    if (isRefresh) {
      this.setData({
        page: 1,
        hasMore: true
      });
    }

    // 从云数据库获取订单数据
    this.loadOrdersFromCloud(isRefresh);
  },

  /**
   * 从云数据库加载订单
   */
  loadOrdersFromCloud(isRefresh = false) {
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');

    console.log('📱 订单页面 - 当前用户信息:', userInfo);
    console.log('📱 用户 openId:', userInfo?.openId);
    console.log('📱 用户 openid:', userInfo?.openid);
    console.log('📱 用户名:', userInfo?.username);
    console.log('📱 用户昵称:', userInfo?.nickName);
    console.log('📱 用户账号:', userInfo?.account);

    if (!userInfo) {
      this.setData({ loading: false });
      this.handleLoggedOutUser();
      return;
    }
    
    // 再次检查用户是否有效
    if (!this.isValidUser(userInfo)) {
      this.setData({ loading: false });
      this.handleLoggedOutUser();
      return;
    }

    // 使用openid作为用户标识
    const userId = userInfo.openid || userInfo.openId || userInfo._id;

    if (!userId) {
      console.error('❌ 用户信息中没有openid字段！');
      console.log('用户信息:', userInfo);
      this.setData({ loading: false });
      wx.showToast({
        title: '用户信息异常，请重新登录',
        icon: 'none'
      });
      return;
    }

    // 调用云函数获取订单列表
    callFunction('getOrders', {
      page: this.data.page,
      pageSize: this.data.pageSize,
      userId: userId  // 传递 openid 作为用户标识
    })
    .then(res => {
      // 统一响应格式: res 已经是 data 部分
      const newOrders = res.orders || [];

      // 处理订单中宠物的云存储头像URL（解决临时URL过期403问题）
      this.processOrderPetAvatars(newOrders)
        .then(processedOrders => {
          if (isRefresh) {
            this.setData({
              orders: processedOrders
            });
          } else {
            this.setData({
              orders: [...this.data.orders, ...processedOrders]
            });
          }

          this.filterOrders();

          // 启动待支付订单倒计时
          this.startPendingCountdown(this.data.orders);

          this.setData({
            loading: false,
            hasMore: processedOrders.length >= this.data.pageSize
          });

          if (isRefresh) {
            wx.stopPullDownRefresh();
          }
        });
    })
    .catch(err => {
      this.setData({ loading: false });

      console.error('获取订单失败:', err);

      // 处理集合不存在的错误
      if (err.errCode === -502001 || err.code === -502001 || err.message?.includes('COLLECTION_NOT_FOUND') || err.message?.includes('MODEL_TABLE_NOT_EXIST')) {
        wx.showModal({
          title: '系统错误',
          content: '订单数据表不存在，请联系管理员创建',
          showCancel: false
        });
        return;
      }

      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 2000
      });

      if (isRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },

  /**
   * 刷新订单数据
   */
  refreshOrders: function() {
    this.loadOrders(true);
  },

  /**
   * 格式化时间
   */
  formatTime: function(date) {
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${hour}:${minute}`;
  },

  /**
   * 格式化日期
   */
  formatDate: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 切换标签页
   */
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;

    this.setData({ currentTab: tab });
    this.filterOrders();
  },

  /**
   * 筛选订单
   */
  filterOrders: function() {
    const { orders, currentTab } = this.data;

    const filteredOrders = this.filterOrdersByStatus(orders, currentTab);
    const pendingCount = this.countPendingOrders(orders);

    this.setData({
      filteredOrders,
      pendingCount
    });
  },

  /**
   * 根据状态筛选订单
   */
  filterOrdersByStatus: function(orders, status) {
    switch (status) {
      case 'all':
        return orders;
      case 'cancelled':
        return orders.filter(order => order.status === 'cancelled');
      case 'pending':
        return orders.filter(order => order.status === 'pending');
      case 'paid':
        return orders.filter(order => order.status === 'paid');
      case 'ongoing':
        return orders.filter(order => order.status === 'ongoing');
      case 'completed':
        return orders.filter(order => order.status === 'completed');
      default:
        return orders;
    }
  },

  /**
   * 统计待支付订单数量
   */
  countPendingOrders: function(orders) {
    return orders.filter(order => order.status === 'pending').length;
  },

  /**
   * 查看订单详情
   */
  onOrderDetail: function(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order/order-list/order-list?id=${orderId}`
    });
  },

  /**
   * 取消订单
   */
  onCancelOrder: function(e) {
    const orderId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认取消',
      content: '取消后订单将移至"已取消"分类，是否继续？',
      success: (res) => {
        if (res.confirm) {
          this.executeCancelOrder(orderId);
        }
      }
    });
  },

  /**
   * 执行取消订单
   */
  executeCancelOrder: async function(orderId) {
    this.showLoading('取消中...');

    try {
      const userId = this.getUserId();
      
      // 调用 updateOrderStatus 将订单状态改为 cancelled
      const result = await     callFunction('updateOrderStatus', {
      orderId: orderId,
      status: 'cancelled',
      openid: userId,
      reason: '用户主动取消'
    });

    // 统一响应格式处理
    this.clearOrderCountdown(orderId);
    this.updateLocalOrderStatus(orderId, 'cancelled', '已取消');
    this.filterOrders();
    this.showToast('订单已取消', 'success');
    } catch (error) {
      console.error('【订单管理】取消订单失败:', error);
      this.showToast('取消失败，请重试', 'none');
    } finally {
      this.hideLoading();
    }
  },

  /**
   * 更新本地订单状态（不删除订单）
   */
  updateLocalOrderStatus: function(orderId, status, statusText) {
    const orders = this.data.orders.map(order => {
      if ((order._id || order.id) === orderId) {
        return {
          ...order,
          status: status,
          statusText: statusText,
          updateTime: new Date().toLocaleString()
        };
      }
      return order;
    });
    this.setData({ orders });
  },

  /**
   * 清除订单倒计时
   */
  clearOrderCountdown: function(orderId) {
    if (this.data.countdownTimers[orderId]) {
      clearInterval(this.data.countdownTimers[orderId]);
      delete this.data.countdownTimers[orderId];
    }
  },

  /**
   * 从列表中移除订单
   */
  removeOrderFromList: function(orderId) {
    const orders = this.data.orders.filter(order =>
      (order._id || order.id) !== orderId
    );
    this.setData({ orders });
  },



  /**
   * 评价订单
   */
  onReview: function(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/review/review?orderId=${orderId}`
    });
  },

  /**
   * 去支付
   */
  onGoToPay: function(e) {
    const orderId = e.currentTarget.dataset.orderId || e.currentTarget.dataset.id;

    if (!orderId) {
      this.showToast('订单ID不存在', 'none');
      return;
    }

    wx.navigateTo({
      url: `/pages/payment/payment?orderId=${orderId}`,
      fail: () => {
        this.showToast('跳转失败', 'none');
      }
    });
  },

  /**
   * 再次预订
   */
  onRebook: function(e) {
    const hotelId = e.currentTarget.dataset.hotelId;

    wx.switchTab({
      url: '/pages/hotel/hotel',
      success: () => {
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/hotel/detail/detail?id=${hotelId}`
          });
        }, 100);
      }
    });
  },

  /**
   * 宠物头像加载错误
   */
  onPetAvatarError(e) {
    const { petIndex, avatarIndex } = e.currentTarget.dataset;
    console.log(`订单中宠物${petIndex + 1}头像加载失败`);
    
    // 重置为默认头像
    const orders = this.data.orders.map((order, i) => 
      i === petIndex ? {
        ...order,
        pets: order.pets.map((pet, j) => 
          j === avatarIndex ? { ...pet, avatar: '' } : pet
        )
      } : order
    );
    
    this.setData({ orders });
    this.filterOrders();
  },

  /**
   * 检查用户登录状态
   */
  checkUserLoginStatus() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      // 支持多种用户名字段：username 或 nickName 或 account
      const hasValidUser = userInfo && (
        (userInfo.username && userInfo.username.trim() !== '') ||
        (userInfo.nickName && userInfo.nickName.trim() !== '') ||
        (userInfo.account && userInfo.account.trim() !== '')
      );

      this.setData({
        hasValidUser: hasValidUser,
        userInfo: userInfo
      });

      console.log('🔍 用户登录状态检查:', {
        hasValidUser,
        username: userInfo?.username,
        nickName: userInfo?.nickName,
        account: userInfo?.account,
        openId: userInfo?.openId
      });

    } catch (error) {
      console.error('❌ 检查登录状态失败:', error);
      this.setData({
        hasValidUser: false
      });
    }
  },

  /**
   * 跳转到登录页面
   */
  goToLogin() {
    console.log('🔐 用户点击登录按钮，跳转到登录页面');

    // 显示提示
    wx.showToast({
      title: '正在跳转...',
      icon: 'loading',
      mask: true,
      duration: 1000
    });

    setTimeout(() => {
      // 使用 redirectTo 跳转到登录页面（index页面是登录页面）
      wx.redirectTo({
        url: '/pages/index/index',
        success: () => {
          console.log('✅ 成功跳转到登录页面');
        },
        fail: (err) => {
          console.error('❌ 跳转登录页面失败:', err);
          wx.showToast({
            title: '跳转失败，请重试',
            icon: 'none'
          });
        }
      });
    }, 500);
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 空函数，仅用于阻止事件冒泡
  },

  /**
   * 去搜索酒店
   */
  goToSearch() {
    wx.switchTab({
      url: '/pages/search/search'
    });
  },

  /**
   * 加载更多
   */
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    
    this.setData({
      page: this.data.page + 1
    });
    
    this.loadOrders();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.refreshOrders();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    this.loadMore();
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '我的订单 - 宠宿无忧',
      path: '/pages/order/order'
    };
  },

  /**
   * 页面卸载时清除所有倒计时
   */
  onUnload() {
    this.clearAllCountdowns();
  },

  /**
   * 页面隐藏时清除所有倒计时
   */
  onHide: function() {
    this.clearAllCountdowns();
  },

  /**
   * 显示加载提示
   */
  showLoading: function(title) {
    wx.showLoading({
      title: title,
      mask: true
    });
  },

  /**
   * 隐藏加载提示
   */
  hideLoading: function() {
    wx.hideLoading();
  },

  /**
   * 显示提示
   */
  showToast: function(title, icon) {
    wx.showToast({
      title: title,
      icon: icon || 'none'
    });
  },

  /**
   * 处理订单中宠物头像的云存储URL转换
   * 解决临时URL过期导致的403问题
   */
  processOrderPetAvatars: function(orders) {
    const fileIds = [];

    // 收集所有需要转换的 cloud:// 文件ID
    orders.forEach(order => {
      (order.pets || []).forEach(pet => {
        if (pet.avatar && pet.avatar.startsWith('cloud://')) {
          fileIds.push(pet.avatar);
        }
      });
    });

    if (fileIds.length === 0) {
      return Promise.resolve(orders);
    }

    return wx.cloud.getTempFileURL({ fileList: fileIds })
      .then(result => {
        const urlMap = {};
        (result.fileList || []).forEach(item => {
          if (item.status === 0 && item.tempFileURL) {
            urlMap[item.fileID] = item.tempFileURL;
          }
        });

        // 更新订单中的宠物头像URL
        return orders.map(order => ({
          ...order,
          pets: (order.pets || []).map(pet => ({
            ...pet,
            avatar: (pet.avatar && urlMap[pet.avatar]) ? urlMap[pet.avatar] : pet.avatar
          }))
        }));
      })
      .catch(err => {
        console.warn('【订单】获取宠物头像临时URL失败:', err);
        return orders;
      });
  }
});