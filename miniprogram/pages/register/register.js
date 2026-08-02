// pages/register/register.js - 用户注册页面
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    formData: {
      account: '', // 账号（用于登录）
      avatar: '', // 用户头像
      username: '', // 用户名
      phone: '', // 手机号
      password: '', // 密码
      email: '', // 邮箱地址
      realName: '', // 真实姓名
      gender: '', // 性别
      birthDate: '', // 出生日期
      status: 'normal', // 用户状态
      userId: '', // 用户ID
      openId: '', // Open ID
      avatarPath: '' // 用户头像路径
    },
    statusOptions: ['正常', '禁用'],
    statusIndex: 0,
    maxDate: '', // 最大可选日期
    canSubmit: false, // 是否可以提交
    submitting: false, // 是否正在提交
    uploadingAvatar: false // 是否正在上传头像
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 设置当前日期作为最大可选日期
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    
    this.setData({
      maxDate: formattedDate,
      'formData.status': 'normal'
    });
  },

  /**
   * 选择头像
   */
  chooseAvatar: function() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      maxDuration: 30,
      camera: 'back',
      success: function(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        that.uploadAvatar(tempFilePath);
      },
      fail: function(err) {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 上传头像到云存储
  uploadAvatar: function(tempFilePath) {
    const that = this;
    
    // 防止重复上传
    if (this.data.uploadingAvatar) {
      console.log('头像正在上传中，请勿重复操作');
      return;
    }
    
    this.setData({ uploadingAvatar: true });
    
    wx.showLoading({
      title: '上传头像中...',
      mask: true
    });

    // 生成唯一文件名，使用用户账号作为前缀（如果已输入）
    const { account } = this.data.formData;
    const userPrefix = account.trim() || `user_${Date.now()}`;
    const fileExtension = tempFilePath.split('.').pop() || 'jpg';
    const fileName = `${userPrefix}_avatar_${Date.now()}.${fileExtension}`;

    console.log('📤 开始上传头像文件名:', fileName);
    console.log('📁 上传到云存储路径:', `user-avatars/${fileName}`);

    wx.cloud.uploadFile({
      cloudPath: `user-avatars/${fileName}`, // 上传到云存储的user-avatars文件夹
      filePath: tempFilePath,
      success: function(res) {
        console.log('✅ 头像上传成功:', res);
        // 上传成功，获取云存储URL
        const fileID = res.fileID;
        
        // 获取下载链接（可选，主要用于显示）
        wx.cloud.getTempFileURL({
          fileList: [fileID],
          success: function(urlRes) {
            console.log('🔗 获取文件链接成功:', urlRes);
            if (urlRes.fileList && urlRes.fileList.length > 0) {
              const avatarUrl = urlRes.fileList[0].tempFileURL;
              
              that.setData({
                'formData.avatar': fileID, // 保存云存储fileID
                'formData.avatarPath': fileID, // 保存路径
                uploadingAvatar: false
              });

              wx.hideLoading();
              wx.showToast({
                title: '头像上传成功',
                icon: 'success'
              });

              console.log('👤 用户头像信息保存成功:', { fileID, avatarUrl });
              that.validateForm();
            }
          },
          fail: function(err) {
            console.error('❌ 获取文件链接失败:', err);
            // 即使获取临时链接失败，fileID也是有效的，继续使用
            that.setData({
              'formData.avatar': fileID,
              'formData.avatarPath': fileID,
              uploadingAvatar: false
            });
            wx.hideLoading();
            wx.showToast({
              title: '头像上传成功',
              icon: 'success'
            });
            that.validateForm();
          }
        });
      },
      fail: function(err) {
        console.error('❌ 上传失败:', err);
        that.setData({ uploadingAvatar: false });
        that.handleUploadError();
      }
    });
  },

  // 处理上传错误
  handleUploadError: function() {
    wx.hideLoading();
    wx.showToast({
      title: '头像上传失败，请重试',
      icon: 'none'
    });
  },

  /**
   * 输入框事件
   */
  onAccountInput: function(e) {
    this.setData({
      'formData.account': e.detail.value
    });
    this.validateForm();
  },

  onUsernameInput: function(e) {
    this.setData({
      'formData.username': e.detail.value
    });
    this.validateForm();
  },

  onPhoneInput: function(e) {
    const value = e.detail.value.replace(/\D/g, '');
    this.setData({
      'formData.phone': value
    });
    this.validateForm();
  },

  onPasswordInput: function(e) {
    this.setData({
      'formData.password': e.detail.value
    });
    this.validateForm();
  },

  onEmailInput: function(e) {
    this.setData({
      'formData.email': e.detail.value
    });
    this.validateForm();
  },

  onRealNameInput: function(e) {
    this.setData({
      'formData.realName': e.detail.value
    });
    this.validateForm();
  },

  /**
   * 选择性别
   */
  selectGender: function(e) {
    const gender = e.currentTarget.dataset.gender;
    this.setData({
      'formData.gender': gender
    });
    this.validateForm();
  },

  /**
   * 选择出生日期
   */
  onBirthDateChange: function(e) {
    this.setData({
      'formData.birthDate': e.detail.value
    });
    this.validateForm();
  },

  /**
   * 选择用户状态（虽然禁用，但保留事件）
   */
  onStatusChange: function(e) {
    const index = parseInt(e.detail.value);
    const status = this.data.statusOptions[index];
    this.setData({
      statusIndex: index,
      'formData.status': status === '正常' ? 'normal' : 'disabled'
    });
  },

  /**
   * 表单验证
   */
  validateForm: function() {
    const { account, username, phone, password, email, realName, gender, birthDate, avatar } = this.data.formData;

    console.log('📝 表单验证检查:', {
      account: account ? '✓' : '✗',
      username: username ? '✓' : '✗',
      phone: phone,
      phoneValid: phone.length === 11,
      password: password ? '✓' : '✗',
      passwordValid: password.length >= 6,
      email: email ? '✓' : '✗',
      emailValid: this.validateEmail(email),
      realName: realName ? '✓' : '✗',
      gender: gender ? '✓' : '✗',
      birthDate: birthDate ? '✓' : '✗',
      avatar: avatar ? '✓' : '✗',
      accountLength: account ? account.length : 0,
      usernameLength: username ? username.length : 0
    });

    const canSubmit = account &&
                    account.trim() &&
                    username &&
                    username.trim() &&
                    phone &&
                    phone.trim().length === 11 &&
                    password &&
                    password.length >= 6 &&
                    email &&
                    email.trim() &&
                    this.validateEmail(email) &&
                    realName &&
                    realName.trim() &&
                    gender &&
                    birthDate &&
                    avatar &&
                    account.length >= 3 &&
                    username.length >= 3;

    console.log('✅ canSubmit 状态:', canSubmit);
    this.setData({ canSubmit });
  },

  /**
   * 验证邮箱格式
   */
  validateEmail: function(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * 提交注册
   */
  handleRegister: function() {
    console.log('🔘 点击了提交注册按钮');
    console.log('📊 当前状态:', {
      canSubmit: this.data.canSubmit,
      submitting: this.data.submitting
    });

    if (!this.data.canSubmit) {
      console.log('❌ 表单验证失败，无法提交');
      wx.showToast({
        title: '请填写必要信息',
        icon: 'none'
      });
      return;
    }

    console.log('✅ 开始提交注册');
    this.setData({ submitting: true });

    // 准备提交给云函数的数据
    const registerData = {
      account: this.data.formData.account, // 添加账号字段
      username: this.data.formData.username,
      phone: this.data.formData.phone,
      password: this.data.formData.password,
      email: this.data.formData.email,
      realName: this.data.formData.realName,
      gender: this.data.formData.gender,
      birthDate: this.data.formData.birthDate,
      avatarUrl: this.data.formData.avatar, // 改为avatarUrl与数据库一致
      avatarPath: this.data.formData.avatarPath,
      status: 'normal', // 默认状态
      role: 'user' // 默认角色
    };

    console.log('🔍 注册数据收集完成:', registerData);
    console.log('📋 注册数据中的 account 字段:', registerData.account);

    // 调用云函数进行注册
    wx.cloud.callFunction({
      name: 'registerUser',
      data: registerData,
      success: (res) => {
        console.log('📤 注册云函数调用成功:', res);

        const result = res.result || {};
        // 统一使用 { code, message, data } 格式
        if (result.code === 0) {
          const data = result.data;
          const userInfo = {
            _id: data._id,
            account: data.account,
            username: data.username,
            avatarUrl: data.avatarUrl,
            phone: data.phone,
            address: '',
            createTime: data.createTime,
            openid: data.openid, // 统一使用 openid
            isLoggedIn: false
          };

          console.log('注册返回的用户信息，包含openid:', {
            account: data.account,
            openid: data.openid
          });

          wx.setStorageSync('userInfo', userInfo);

          wx.removeStorageSync('petsList');
          wx.removeStorageSync('myPetsList');

          if (app.globalData) {
            app.globalData.userInfo = userInfo;
          }

          wx.hideLoading();
          this.setData({ submitting: false });

          wx.showModal({
            title: '注册成功',
            content: `恭喜 ${userInfo.username || userInfo.account}，注册成功！请使用账号密码登录`,
            showCancel: false,
            confirmText: '去登录',
            success: () => {
              wx.redirectTo({
                url: '/pages/index/index',
                success: () => {
                  console.log('✅ 注册成功，跳转到登录页面');
                },
                fail: (err) => {
                  console.error('跳转登录页面失败:', err);
                  wx.navigateTo({
                    url: '/pages/index/index'
                  });
                }
              });
            }
          });
        } else {
          throw new Error(result.message || '注册失败');
        }
      },
      fail: (err) => {
        console.error('❌ 注册云函数调用失败:', err);
        this.handleRegisterError(err);
      }
    });
  },

  // 处理注册错误
  handleRegisterError: function(error) {
    this.setData({ submitting: false });
    wx.hideLoading();
    
    if (error.errCode === -1 && error.errMsg.includes('function not found')) {
      wx.showModal({
        title: '提示',
        content: 'registerUser云函数未部署，请先部署云函数',
        showCancel: false
      });
    } else if (error.errCode === -501001 || error.errMsg.includes('duplicate')) {
      wx.showToast({
        title: '用户名或手机号已存在',
        icon: 'none'
      });
    } else {
      wx.showToast({
        title: '注册失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 返回登录页面
   */
  goToLogin: function() {
    wx.redirectTo({
      url: '/pages/index/index',
      success: () => {
        console.log('成功跳转到登录页面');
      },
      fail: (err) => {
        console.error('跳转登录页面失败:', err);
        // 如果redirectTo失败，尝试使用navigateTo
        wx.navigateTo({
          url: '/pages/index/index'
        });
      }
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时重新验证表单
    this.validateForm();
  }
});