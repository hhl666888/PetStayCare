// pages/index/index.js - 用户登录页面
// 功能：用户登录、登录状态检查、跳转主页面
const app = getApp();

Page({
  data: {
    userInfo: {
      account: ''
    },
    password: '',
    hasUserInfo: false,
    loading: false
  },

  /**
   * 页面加载时检查登录状态
   */
  onLoad: function() {
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus: function() {
    try {
      const savedUserInfo = this.getStoredUserInfo();

      if (this.isLoggedIn(savedUserInfo)) {
        console.log('【登录页】用户已登录，自动跳转');
        this.handleLoggedInUser(savedUserInfo);
      } else {
        console.log('【登录页】用户未登录，显示登录界面');
        this.resetLoginForm();
      }
    } catch (error) {
      console.error('【登录页】检查登录状态失败:', error);
      this.resetLoginForm();
    }
  },

  /**
   * 获取本地存储的用户信息
   */
  getStoredUserInfo: function() {
    try {
      return wx.getStorageSync('userInfo') || null;
    } catch (error) {
      console.error('【登录页】读取本地存储失败:', error);
      return null;
    }
  },

  /**
   * 检查用户是否已登录
   */
  isLoggedIn: function(userInfo) {
    return !!(userInfo && userInfo.isLoggedIn && (userInfo.account || userInfo.username));
  },

  /**
   * 处理已登录用户
   */
  handleLoggedInUser: function(userInfo) {
    this.setData({
      userInfo: userInfo,
      hasUserInfo: true
    });
    this.enterHotel();
  },

  /**
   * 重置登录表单
   */
  resetLoginForm: function() {
    this.setData({
      userInfo: { account: '' },
      password: '',
      hasUserInfo: false
    });
  },

  /**
   * 快速进入（已登录用户）
   */
  quickEnter: function() {
    if (!this.data.hasUserInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });
    this.enterHotel();

    // 3秒后隐藏loading状态
    setTimeout(() => {
      this.setData({ loading: false });
    }, 3000);
  },

  /**
   * 跳转到酒店页面
   */
  enterHotel: function() {
    wx.switchTab({
      url: '/pages/hotel/hotel',
      fail: (err) => {
        console.error('【登录页】跳转失败:', err);
        wx.showModal({
          title: '跳转失败',
          content: '无法跳转到酒店页面，请重启小程序',
          showCancel: false
        });
        this.setData({ loading: false });
      }
    });
  },

  /**
   * 账号输入处理
   */
  onAccountChange: function(e) {
    this.setData({
      'userInfo.account': e.detail.value || '',
      hasUserInfo: false
    });
  },

  /**
   * 密码输入处理
   */
  onPasswordChange: function(e) {
    this.setData({
      password: e.detail.value || '',
      hasUserInfo: false
    });
  },

  /**
   * 验证登录
   */
  validateLogin: async function() {
    const { account } = this.data.userInfo;
    const { password } = this.data;

    // 表单验证
    const validationResult = this.validateLoginForm(account, password);
    if (!validationResult.isValid) {
      wx.showToast({
        title: validationResult.message,
        icon: 'none'
      });
      return;
    }

    // 显示加载状态
    this.setData({ loading: true });

    try {
      // 调用云函数验证登录
      const loginResult = await this.callLoginFunction(account, password);

      if (loginResult.success) {
        await this.handleLoginSuccess(loginResult.userInfo);
      } else {
        this.handleLoginFailure(loginResult.message);
      }
    } catch (error) {
      this.handleLoginError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 验证登录表单
   */
  validateLoginForm: function(account, password) {
    if (!account || !account.trim()) {
      return { isValid: false, message: '请输入账号' };
    }
    if (!password || !password.trim()) {
      return { isValid: false, message: '请输入密码' };
    }
    return { isValid: true, message: '' };
  },

  /**
   * 调用登录云函数
   */
  callLoginFunction: async function(account, password) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'validateLogin',
        data: {
          account: account.trim(),
          password: password
        }
      });

      if (res.result && res.result.code === 0) {
        return {
          success: true,
          userInfo: res.result.data
        };
      } else {
        return {
          success: false,
          message: res.result?.message || '账号或密码错误'
        };
      }
    } catch (error) {
      throw error;
    }
  },

  /**
   * 处理登录成功
   */
  handleLoginSuccess: async function(userInfo) {
    // 标准化用户信息
    const normalizedUserInfo = this.normalizeUserInfo(userInfo);

    // 保存用户信息
    this.saveUserInfo(normalizedUserInfo);

    // 更新页面状态
    this.setData({
      userInfo: normalizedUserInfo,
      hasUserInfo: true
    });

    // 显示成功提示
    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1000
    });

    // 延迟跳转
    setTimeout(() => {
      this.enterHotel();
    }, 1000);
  },

  /**
   * 标准化用户信息
   */
  normalizeUserInfo: function(userInfo) {
    const normalized = {
      ...userInfo,
      loginTime: new Date().toISOString(),
      isLoggedIn: true,
      isComplete: true
    };

    // 确保nickName字段存在
    if (!normalized.nickName) {
      normalized.nickName = normalized.username || normalized.account || '用户';
    }

    return normalized;
  },

  /**
   * 保存用户信息
   */
  saveUserInfo: function(userInfo) {
    // 保存到本地存储
    try {
      wx.setStorageSync('userInfo', userInfo);
    } catch (error) {
      console.error('【登录页】保存用户信息到本地失败:', error);
    }

    // 更新全局数据
    if (app.globalData) {
      app.globalData.userInfo = userInfo;
    }

    // 清除其他用户的数据缓存
    this.clearOtherUserData();
  },

  /**
   * 清除其他用户的数据缓存
   */
  clearOtherUserData: function() {
    const cacheKeys = ['petsList', 'myPetsList'];
    cacheKeys.forEach(key => {
      try {
        wx.removeStorageSync(key);
      } catch (error) {
        console.warn(`【登录页】清除缓存 ${key} 失败:`, error);
      }
    });
  },

  /**
   * 处理登录失败
   */
  handleLoginFailure: function(message) {
    wx.showToast({
      title: message || '登录失败',
      icon: 'none',
      duration: 2000
    });
  },

  /**
   * 处理登录错误
   */
  handleLoginError: function(error) {
    console.error('【登录页】登录验证失败:', error);

    // 判断错误类型
    if (this.isCloudFunctionNotFoundError(error)) {
      wx.showModal({
        title: '提示',
        content: 'validateLogin云函数未部署，请先部署云函数',
        showCancel: false
      });
    } else {
      wx.showToast({
        title: '登录验证失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 判断是否为云函数未找到错误
   */
  isCloudFunctionNotFoundError: function(error) {
    return error.errCode === -1 &&
           error.errMsg &&
           error.errMsg.includes('function not found');
  },

  /**
   * 跳转到注册页面
   */
  goToRegister: function() {
    wx.navigateTo({
      url: '/pages/register/register',
      fail: (err) => {
        console.error('【登录页】跳转注册页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  }
});