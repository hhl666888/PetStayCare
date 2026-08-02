// pages/welcome/welcome.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
  },

  /**
   * 点击开始使用按钮
   * 检查用户登录状态，已登录则跳转到hotel页面，未登录则跳转到登录页面
   */
  enterMain() {
    // 显示加载提示
    wx.showLoading({
      title: '正在进入...',
      mask: true
    });
    
    // 获取应用实例
    const app = getApp();
    
    // 获取本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo') || null;
    
    // 检查用户是否已登录：isLoggedIn 为 true 且有 account 或 username
    const isLoggedIn = !!(userInfo && userInfo.isLoggedIn && (userInfo.account || userInfo.username));
    
    if (isLoggedIn) {
      console.log('【欢迎页】用户已登录，跳转到酒店页面');
      // 已登录，跳转到 hotel 页面
      this.redirectToHotel();
    } else {
      console.log('【欢迎页】用户未登录，跳转到登录页面');
      // 未登录，跳转到登录页面
      wx.hideLoading();
      wx.reLaunch({
        url: '/pages/index/index'
      });
    }
  },

  /**
   * 直接跳转到hotel页面的备用方法
   */
  redirectToHotel() {
    // 直接跳转到hotel页面
    wx.switchTab({
      url: '/pages/hotel/hotel'
    });
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    // 页面隐藏时可以暂停某些动画
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    // 停止下拉刷新
    wx.stopPullDownRefresh();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    // 可以在这里添加一些交互
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '宠宿无忧 - 为您的爱宠找到温馨的家',
      path: '/pages/welcome/welcome',
      imageUrl: '' // 可以分享自定义图片
    };
  },

  /**
   * 用户点击右上角分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '宠宿无忧 - 让每一次出行都充满温暖与安心',
      imageUrl: '' // 可以分享自定义图片
    };
  }
})