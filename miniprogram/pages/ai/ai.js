// pages/ai/ai.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    chatMode: "bot", // bot 表示使用agent，model 表示使用大模型
    showBotAvatar: true, // 是否在对话框左侧显示头像
    agentConfig: {
      botId: "ibot-cloudblog-ibfxxxs6pa", // agent id
      allowWebSearch: true, // 允许客户端选择启用联网搜索
      allowUploadFile: true, // 允许上传文件
      allowPullRefresh: true, // 允许下拉刷新
      allowUploadImage: true, // 允许上传图片
      showToolCallDetail: true, // 是否展示工具调用细节
      allowMultiConversation: true // 是否展示会话列表，创建会话按钮
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  async onLoad(options) {
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: 'AI助手'
    });
    
    console.log('AI助手页面加载完成');
  },

  /**
   * 快速提问功能
   */
  askQuestion: function(e) {
    const question = e.currentTarget.dataset.question;
    console.log('用户提问:', question);
    
    // 显示提问提示
    wx.showToast({
      title: '正在发送问题...',
      icon: 'loading',
      duration: 1000
    });
    
    // 这里可以集成到agent-ui组件中，或者显示提示用户在下方输入框中提问
    // 暂时复制问题到剪贴板，方便用户粘贴
    wx.setClipboardData({
      data: question,
      success: () => {
        wx.showToast({
          title: '问题已复制，请在下方粘贴发送',
          icon: 'none',
          duration: 2000
        });
      },
      fail: () => {
        wx.showToast({
          title: '请在下方输入框中输入问题',
          icon: 'none',
          duration: 2000
        });
      }
    });
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