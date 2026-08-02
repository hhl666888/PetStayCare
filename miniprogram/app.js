// app.js - 小程序主入口
// 负责云开发初始化、全局数据管理和用户登录状态检查

const CONSTANTS = require('./config/constants.js');

App({
  // 云环境ID
  cloudEnvId: 'cloud1-2g6m2qwge2893f2c',

  // 默认用户头像
  defaultAvatar: 'https://developers.weixin.qq.com/miniprogram/dev/image/cat/0.jpg',

  /**
   * 小程序启动时执行
   * 初始化云开发、全局数据和用户登录状态
   */
  onLaunch: function() {
    console.log('【宠宿无忧】小程序启动');

    // 初始化云开发
    this.initCloud();

    // 初始化全局数据
    this.initGlobalData();

    // 检查用户登录状态
    this.checkLoginStatus();
  },

  /**
   * 初始化云开发
   */
  initCloud: function() {
    if (!wx.cloud) {
      console.error('【宠宿无忧】请升级微信基础库到2.2.3以上版本以使用云开发');
      wx.showModal({
        title: '版本过低',
        content: '请升级微信至最新版本',
        showCancel: false
      });
      return false;
    }

    try {
      wx.cloud.init({
        env: this.cloudEnvId,
        traceUser: true
      });
      console.log('【宠宿无忧】云开发初始化成功');
      return true;
    } catch (error) {
      console.error('【宠宿无忧】云开发初始化失败:', error);
      return false;
    }
  },

  /**
   * 初始化全局数据
   */
  initGlobalData: function() {
    this.globalData = {
      userInfo: null,              // 当前登录用户信息
      cloudEnv: this.cloudEnvId,   // 云环境ID
      isLoggedIn: false           // 登录状态
    };
    console.log('【宠宿无忧】全局数据初始化完成');
  },

  /**
   * 检查用户登录状态
   * 注意：不再自动登录，每次进入小程序都需要用户在登录页面手动输入账号密码
   */
  checkLoginStatus: function() {
    console.log('【宠宿无忧】检查登录状态 - 将清除本地登录状态，要求手动登录');

    // 清除本地存储的用户信息
    this.clearUserInfo();

    // 重置全局数据
    this.globalData.userInfo = null;
    this.globalData.isLoggedIn = false;

    // 注意：不再自动调用 login 云函数
    // 用户必须手动在登录页面输入账号密码登录
    return false;
  },

  /**
   * 后台静默刷新 token（不阻塞页面）
   */
  silentRefreshToken: function(localUserInfo) {
    this.callLogin(localUserInfo).then(result => {
      if (result && result.code === 0) {
        console.log('【宠宿无忧】Token 静默刷新成功');
        this.saveUserInfo(result.data);
      }
    }).catch(err => {
      console.warn('【宠宿无忧】Token 静默刷新失败（不影响使用）:', err);
    });
  },

  /**
   * 从本地存储获取用户信息
   */
  getStoredUserInfo: function() {
    try {
      const userInfo = wx.getStorageSync(CONSTANTS.STORAGE_KEYS.USER_INFO);
      return userInfo || null;
    } catch (error) {
      console.error('【宠宿无忧】读取本地存储失败:', error);
      return null;
    }
  },

  /**
   * 调用 login 云函数获取用户信息
   */
  callLogin: async function(localUserInfo) {
    try {
      const res = await wx.cloud.callFunction({
        name: CONSTANTS.CLOUD_FUNCTIONS.LOGIN,
        data: {
          userInfo: localUserInfo || {}
        }
      });

      if (res && res.result) {
        console.log('【宠宿无忧】login 云函数返回:', res.result);
        
        // 确保返回格式包含必要的字段
        if (!res.result.code && res.result.openid) {
          // 兼容旧格式，转换为新格式
          return {
            code: 0,
            message: '登录成功',
            data: res.result
          };
        }
        
        return res.result;
      }
      
      return { code: -1, message: '服务器响应异常', data: null };
    } catch (error) {
      console.error('【宠宿无忧】调用 login 云函数失败:', error);
      return { code: -1, message: '网络连接异常，请检查网络后重试', data: null };
    }
  },

  /**
   * 保存用户信息到全局和本地存储
   */
  saveUserInfo: function(userData) {
    try {
      this.globalData.userInfo = userData;
      wx.setStorageSync(CONSTANTS.STORAGE_KEYS.USER_INFO, userData);
      console.log('【宠宿无忧】用户信息已保存');
    } catch (error) {
      console.error('【宠宿无忧】保存用户信息失败:', error);
    }
  },

  /**
   * 检查用户信息是否有效
   */
  isValidUserInfo: function(userInfo) {
    return !!(userInfo && userInfo.isComplete);
  },

  /**
   * 更新用户信息（供其他页面调用）
   */
  updateUserInfo: function(userInfo) {
    if (!userInfo) {
      console.warn('【宠宿无忧】更新用户信息失败：userInfo为空');
      return false;
    }

    try {
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = this.isValidUserInfo(userInfo);

      // 保存到本地存储
      wx.setStorageSync(CONSTANTS.STORAGE_KEYS.USER_INFO, userInfo);

      console.log('【宠宿无忧】用户信息已更新');
      return true;
    } catch (error) {
      console.error('【宠宿无忧】更新用户信息失败:', error);
      return false;
    }
  },

  /**
   * 清除用户信息（退出登录）
   */
  clearUserInfo: function() {
    try {
      this.globalData.userInfo = null;
      this.globalData.isLoggedIn = false;
      wx.removeStorageSync(CONSTANTS.STORAGE_KEYS.USER_INFO);
      console.log('【宠宿无忧】用户信息已清除');
      return true;
    } catch (error) {
      console.error('【宠宿无忧】清除用户信息失败:', error);
      return false;
    }
  },

  /**
   * 获取当前用户信息
   */
  getUserInfo: function() {
    return this.globalData.userInfo || null;
  },

  /**
   * 检查是否已登录
   */
  isLoggedIn: function() {
    return this.globalData.isLoggedIn;
  }
});