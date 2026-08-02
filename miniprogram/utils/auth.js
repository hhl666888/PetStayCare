/**
 * auth.js - 登录认证工具函数
 * 提供统一的登录状态检查和错误处理
 */

const CONSTANTS = require('../config/constants.js');

/**
 * 验证用户信息是否完整有效
 * @param {object} userInfo 用户信息
 * @returns {boolean} 是否完整
 */
function isValidUser(userInfo) {
  if (!userInfo) return false;
  // 必须明确标记为已完成注册
  if (userInfo.isComplete !== true) return false;
  // 必须有用户标识
  const hasIdentity = !!(userInfo.openid || userInfo._id || userInfo.account);
  // 必须有用户名
  const hasName = !!(userInfo.nickName || userInfo.username || userInfo.account);
  return hasIdentity && hasName;
}

/**
 * 检查用户登录状态
 * @param {boolean} showToast 是否显示提示
 * @param {boolean} redirectLogin 是否跳转到登录页面
 * @returns {boolean} 是否已登录
 */
function checkLogin(showToast = true, redirectLogin = true) {
  const app = getApp();
  
  // 检查全局登录状态
  if (app.globalData && app.globalData.isLoggedIn) {
    // 二次验证用户信息完整性
    if (isValidUser(app.globalData.userInfo)) {
      return true;
    }
    // 信息不完整，重新检查
  }
  
  // 检查本地存储的用户信息
  try {
    const userInfo = wx.getStorageSync(CONSTANTS.STORAGE_KEYS.USER_INFO);
    
    // 严格验证：必须 isComplete=true 且有标识和名称
    if (isValidUser(userInfo)) {
      // 更新全局状态
      app.globalData.userInfo = userInfo;
      app.globalData.isLoggedIn = true;
      return true;
    }
  } catch (error) {
    console.error('【宠宿无忧】检查本地存储失败:', error);
  }
  
  // 未登录时的处理
  if (showToast) {
    wx.showToast({
      title: '请先登录',
      icon: 'none',
      duration: 2000
    });
  }
  
  if (redirectLogin) {
    // 延迟跳转到登录页面
    setTimeout(() => {
      wx.redirectTo({
        url: CONSTANTS.PAGES.INDEX,
        fail: (error) => {
          console.error('【宠宿无忧】跳转登录页面失败:', error);
          wx.navigateBack();
        }
      });
    }, 1500);
  }
  
  return false;
}

/**
 * 获取当前用户信息
 * @returns {object|null} 用户信息
 */
function getCurrentUser() {
  const app = getApp();
  
  // 优先从全局获取
  if (app.globalData && app.globalData.userInfo) {
    return app.globalData.userInfo;
  }
  
  // 从本地存储获取
  try {
    const userInfo = wx.getStorageSync(CONSTANTS.STORAGE_KEYS.USER_INFO);
    if (userInfo) {
      // 更新全局状态
      app.globalData.userInfo = userInfo;
      app.globalData.isLoggedIn = userInfo.isComplete || false;
      return userInfo;
    }
  } catch (error) {
    console.error('【宠宿无忧】获取用户信息失败:', error);
  }
  
  return null;
}

/**
 * 验证用户信息是否完整（复用 isValidUser）
 * @param {object} userInfo 用户信息
 * @returns {boolean} 是否完整
 */
function validateUserInfo(userInfo) {
  return isValidUser(userInfo);
}

/**
 * 显示登录错误提示
 * @param {string} message 错误信息
 */
function showLoginError(message) {
  const errorMessage = message || '登录失败，请重试';
  
  wx.showModal({
    title: '登录失败',
    content: errorMessage,
    showCancel: false,
    confirmText: '知道了',
    success: () => {
      // 返回首页重新登录
      wx.redirectTo({
        url: CONSTANTS.PAGES.INDEX
      });
    }
  });
}

/**
 * 处理登录回调
 * @param {object} result 登录结果
 * @returns {boolean} 是否登录成功
 */
function handleLoginResult(result) {
  if (!result) {
    showLoginError('登录服务异常');
    return false;
  }
  
  if (result.code === CONSTANTS.RESPONSE_CODE.SUCCESS) {
    const userData = result.data;
    
    // 验证用户数据
    if (!validateUserInfo(userData)) {
      showLoginError('用户信息不完整');
      return false;
    }
    
    // 保存用户信息
    const app = getApp();
    app.updateUserInfo(userData);
    
    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1500
    });
    
    return true;
  } else {
    const errorMessage = result.message || '登录失败';
    showLoginError(errorMessage);
    return false;
  }
}

module.exports = {
  checkLogin,
  getCurrentUser,
  validateUserInfo,
  showLoginError,
  handleLoginResult
};