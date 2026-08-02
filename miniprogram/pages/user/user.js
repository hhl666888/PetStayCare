// pages/user/user.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    hasUserInfo: false,
    defaultAvatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const app = getApp();
    this.setData({ app });
    this.loadUserInfo();
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
    // 每次页面显示时重新加载用户信息，确保数据最新
    this.loadUserInfo();
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    try {
      const app = getApp();
      // 优先从全局数据获取
      let userInfo = app.globalData && app.globalData.userInfo;
      
      // 如果全局数据没有，从本地存储获取
      if (!userInfo) {
        userInfo = wx.getStorageSync('userInfo');
      }
      
      // 更新页面数据
      if (userInfo && (userInfo.account || userInfo.nickName || userInfo.username)) {
        // 确保头像URL正确，如果是云存储fileID，需要转换为临时URL
        let avatarUrl = userInfo.avatarUrl || userInfo.avatar || this.data.defaultAvatarUrl;
        
        // 如果是云存储fileID（以cloud://开头），需要获取临时URL
        if (avatarUrl && avatarUrl.startsWith('cloud://')) {
          wx.cloud.getTempFileURL({
            fileList: [avatarUrl],
            success: (res) => {
              if (res.fileList && res.fileList.length > 0 && res.fileList[0].tempFileURL) {
                this.setData({
                  'userInfo.avatarUrl': res.fileList[0].tempFileURL
                });
              }
            },
            fail: () => {
              // 获取临时URL失败，使用默认头像
              avatarUrl = this.data.defaultAvatarUrl;
            }
          });
        }
        
        this.setData({
          userInfo: {
            account: userInfo.account || '',
            nickName: userInfo.nickName || userInfo.username || userInfo.account || '用户',
            username: userInfo.username || userInfo.nickName || userInfo.account || '用户',
            avatarUrl: avatarUrl,
            phone: userInfo.phone || '',
            _id: userInfo._id || ''
          },
          hasUserInfo: true
        });
        console.log('用户信息加载成功:', this.data.userInfo);
      } else {
        this.setData({
          userInfo: {
            account: '',
            nickName: '未登录',
            username: '未登录',
            avatarUrl: this.data.defaultAvatarUrl
          },
          hasUserInfo: false
        });
        console.log('未找到用户信息');
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
      this.setData({
        userInfo: {
          account: '',
          nickName: '获取失败',
          username: '获取失败',
          avatarUrl: this.data.defaultAvatarUrl
        },
        hasUserInfo: false
      });
    }
  },

  /**
   * 跳转到登录页面
   */
  goToLogin() {
    console.log('跳转到登录页面');
    const app = getApp();
    // 清除当前用户信息，强制重新登录
    try {
      if (app.globalData) {
        app.globalData.userInfo = null;
      }
      wx.removeStorageSync('userInfo');
      
      // 清除页面状态
      this.setData({
        userInfo: {
          avatarUrl: this.data.defaultAvatarUrl,
          nickName: '未登录'
        },
        hasUserInfo: false
      });
      
      console.log('已清除用户信息，准备重新登录');
    } catch (error) {
      console.error('清除用户信息失败:', error);
    }

    // 跳转到登录页面
    wx.redirectTo({
      url: '/pages/index/index',
      success: () => {
        console.log('跳转到登录页面成功');
      },
      fail: (err) => {
        console.error('跳转到登录页面失败:', err);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 跳转到我的宠物页面
   */
  goToMyPets() {
    // 检查登录状态
    const auth = require('../../utils/auth.js');
    if (!auth.checkLogin()) {
      return;
    }

    wx.navigateTo({
      url: '/pages/mypet/mypet',
      success: () => {
        console.log('跳转到我的宠物页面成功');
      },
      fail: (err) => {
        console.error('跳转我的宠物页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 跳转到收藏页面
   */
  goToFavorites() {
    wx.navigateTo({
      url: '/pages/favorites/favorites',
      success: () => {
        console.log('跳转到收藏页面成功');
      },
      fail: (err) => {
        console.error('跳转收藏页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 跳转到AI助手页面
   */
  goToAIAssistant() {
    wx.navigateTo({
      url: '/pages/ai/ai',
      success: () => {
        console.log('跳转到AI助手页面成功');
      },
      fail: (err) => {
        console.error('跳转AI助手页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },


  /**
   * 退出登录
   */
  logout() {
    const app = getApp();
    wx.showModal({
      title: '确认退出',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (res.confirm) {
          try {
            // 使用 app.clearUserInfo() 统一清除（包括 isLoggedIn）
            app.clearUserInfo();

            // 清除宠物缓存
            wx.removeStorageSync('petsList');
            wx.removeStorageSync('myPetsList');

            // 更新页面状态
            this.setData({
              userInfo: {
                avatarUrl: this.data.defaultAvatarUrl,
                nickName: '未登录'
              },
              hasUserInfo: false
            });

            wx.showToast({
              title: '已退出登录',
              icon: 'success',
              duration: 2000
            });

            console.log('用户退出登录成功');

            // 退出登录后跳转到酒店首页
            setTimeout(() => {
              wx.switchTab({
                url: '/pages/hotel/hotel'
              });
            }, 1500);

          } catch (error) {
            console.error('退出登录失败:', error);
            wx.showToast({
              title: '退出失败',
              icon: 'error'
            });
          }
        }
      }
    });
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

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

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})