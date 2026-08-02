// pages/mypet/mypet.js - 宠物管理页面
// 功能：宠物列表展示、添加编辑删除宠物、头像上传
const app = getApp();
const auth = require('../../utils/auth.js');

Page({
  data: {
    petsList: [],
    showModal: false,
    isEditing: false,
    editingPetId: null,
    isLoggedIn: false,
    userInfo: null,

    // 表单数据
    formData: {
      name: '',
      type: '',
      breed: '',
      gender: '',
      age: '',
      weight: '',
      avatar: '',
      notes: ''
    },

    // 选项数据
    petTypes: ['狗', '猫', '其他'],
    typeIndex: -1,

    // 表单验证
    canSave: false,

    // 上传状态
    uploadingAvatar: false
  },

  /**
   * 页面加载
   */
  onLoad: function() {
    this.checkLoginStatus();
  },

  /**
   * 返回上一页
   */
  goBack: function() {
    wx.navigateBack({
      fail: () => {
        // 如果没有上一页，跳转到首页
        wx.switchTab({
          url: '/pages/hotel/hotel'
        });
      }
    });
  },

  /**
   * 页面显示
   */
  onShow: function() {
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus: function() {
    try {
      const userInfo = this.getUserInfo();

      if (this.isValidUser(userInfo)) {
        this.handleLoggedInUser(userInfo);
      } else {
        this.handleLoggedOutUser();
      }
    } catch (error) {
      console.error('【宠物管理】检查登录状态失败:', error);
      this.handleLoggedOutUser();
    }
  },

  /**
   * 获取用户信息
   */
  getUserInfo: function() {
    // 优先从全局数据获取
    let userInfo = app.globalData?.userInfo;

    // 如果全局数据没有，从本地存储获取
    if (!userInfo) {
      try {
        userInfo = wx.getStorageSync('userInfo');
      } catch (error) {
        console.error('【宠物管理】读取本地存储失败:', error);
        return null;
      }
    }

    return userInfo;
  },

  /**
   * 检查用户是否有效
   * 统一标准：isLoggedIn 或 openid 或 isComplete 或 _id 都算已登录
   */
  isValidUser: function(userInfo) {
    if (!userInfo) return false;

    // 登录成功后会设置 isLoggedIn=true
    if (userInfo.isLoggedIn) {
      return true;
    }

    // 只要有 openid 或 isComplete 或 _id 就算已登录
    if (userInfo.isComplete || userInfo.openid || userInfo._id) {
      return true;
    }

    // 兼容旧数据：有 account/nickName/username 也算有效
    if ((userInfo.account && userInfo.account.trim()) ||
        (userInfo.nickName && userInfo.nickName.trim()) ||
        (userInfo.username && userInfo.username.trim())) {
      return true;
    }

    return false;
  },

  /**
   * 处理已登录用户
   */
  handleLoggedInUser: function(userInfo) {
    this.setData({
      isLoggedIn: true,
      userInfo: userInfo
    });
    this.loadPetsList();
  },

  /**
   * 处理未登录用户
   */
  handleLoggedOutUser: function() {
    this.setData({
      isLoggedIn: false,
      userInfo: null,
      petsList: []
    });
  },

  /**
   * 加载宠物列表
   */
  loadPetsList: function() {
    this.fetchPetsFromCloud()
      .then(cloudResult => {
        console.log('【宠物管理】cloudResult:', cloudResult);
        const isSuccess = cloudResult.code === 0 || cloudResult.code === '0';
        if (!isSuccess) {
          throw new Error(cloudResult.message || '获取失败');
        }
        console.log('【宠物管理】加载成功，数据条数:', cloudResult.data.length);
        return this.processPetsData(cloudResult.data);
      })
      .then(processedPets => {
        this.updatePetsList(processedPets);
        this.backupPetsToStorage(processedPets);
      })
      .catch(error => {
        this.handleLoadPetsError(error);
      });
  },

  /**
   * 从云端获取宠物数据
   * 统一响应格式: { code, message, data }
   */
  fetchPetsFromCloud: function() {
    return wx.cloud.callFunction({
      name: 'pet',
      data: { action: 'get' }
    }).then(result => {
      const res = result.result || {};
      const cloudResult = {
        code: res.code !== undefined ? res.code : 0,
        data: res.data || [],
        message: res.message || '获取失败'
      };
      console.log('【宠物管理】云函数返回结果:', cloudResult);
      return cloudResult;
    });
  },

  /**
   * 处理宠物数据（转换URL和字段）
   */
  processPetsData: function(rawPets) {
    if (!Array.isArray(rawPets) || rawPets.length === 0) {
      return Promise.resolve([]);
    }

    const cloudFileIds = this.extractCloudFileIds(rawPets);

    if (cloudFileIds.length === 0) {
      return Promise.resolve(rawPets.map(pet => this.transformPetData(pet, {})));
    }

    return this.getTempUrlMap(cloudFileIds)
      .then(urlMap => {
        return rawPets.map(pet => this.transformPetData(pet, urlMap));
      });
  },

  /**
   * 提取云存储文件ID
   */
  extractCloudFileIds: function(pets) {
    return pets
      .filter(pet => pet.avatar && pet.avatar.startsWith('cloud://'))
      .map(pet => pet.avatar);
  },

  /**
   * 获取临时URL映射
   */
  getTempUrlMap: function(fileIds) {
    return wx.cloud.getTempFileURL({ fileList: fileIds })
      .then(result => {
        const urlMap = {};

        if (result.fileList) {
          result.fileList.forEach((item, index) => {
            if (item.status === 0 && item.tempFileURL) {
              urlMap[fileIds[index]] = item.tempFileURL;
            }
          });
        }

        return urlMap;
      })
      .catch(error => {
        console.warn('【宠物管理】获取临时URL失败:', error);
        return {};
      });
  },

  /**
   * 转换单个宠物数据
   */
  transformPetData: function(pet, urlMap) {
    const avatar = this.getPetAvatar(pet, urlMap);

    return {
      id: pet._id,
      name: pet.name || '',
      type: pet.type || '',
      breed: pet.variety || '', // 数据库字段是variety
      gender: pet.gender || '',
      age: pet.age || '',
      weight: pet.weight || '',
      avatar: avatar,
      notes: pet.beizhu || '', // 数据库字段是beizhu
      createTime: pet.createTime,
      updateTime: pet.updateTime
    };
  },

  /**
   * 获取宠物头像URL
   */
  getPetAvatar: function(pet, urlMap) {
    if (!pet.avatar) {
      return '';
    }

    if (pet.avatar.startsWith('cloud://')) {
      return urlMap[pet.avatar] || pet.avatar;
    }

    return pet.avatar;
  },

  /**
   * 更新宠物列表
   */
  updatePetsList: function(pets) {
    this.setData({ petsList: pets });
  },

  /**
   * 备份宠物列表到本地存储
   */
  backupPetsToStorage: function(pets) {
    try {
      wx.setStorageSync('petsList', pets);
    } catch (error) {
      console.warn('【宠物管理】备份到本地存储失败:', error);
    }
  },

  /**
   * 处理加载宠物列表错误
   */
  handleLoadPetsError: function(error) {
    console.error('【宠物管理】加载宠物列表失败:', error);
    this.setData({ petsList: [] });
    wx.showToast({
      title: '加载失败',
      icon: 'none'
    });
  },

  /**
   * 显示添加宠物弹窗
   */
  showAddPetModal: function() {
    if (!this.checkAndPromptLogin()) {
      return;
    }

    this.resetForm();
    this.setData({
      showModal: true,
      isEditing: false,
      editingPetId: null
    });
  },

  /**
   * 检查登录状态，未登录则提示
   */
  checkAndPromptLogin: function() {
    return auth.checkLogin();
  },

  /**
   * 跳转到登录页面
   */
  navigateToLogin: function() {
    wx.redirectTo({
      url: '/pages/index/index',
      fail: () => {
        wx.navigateBack();
      }
    });
  },

  /**
   * 编辑宠物
   */
  editPet: function(e) {
    if (!this.checkAndPromptLogin()) {
      return;
    }

    const pet = e.currentTarget.dataset.pet;
    if (!pet || !pet.id) {
      return;
    }

    const typeIndex = this.data.petTypes.indexOf(pet.type);

    this.setData({
      showModal: true,
      isEditing: true,
      editingPetId: pet.id,
      formData: this.buildFormDataFromPet(pet),
      typeIndex: typeIndex >= 0 ? typeIndex : -1
    });

    this.validateForm();
  },

  /**
   * 从宠物数据构建表单数据
   */
  buildFormDataFromPet: function(pet) {
    return {
      name: pet.name || '',
      type: pet.type || '',
      breed: pet.breed || '',
      gender: pet.gender || '',
      age: pet.age || '',
      weight: pet.weight || '',
      avatar: pet.avatar || '',
      notes: pet.notes || ''
    };
  },

  /**
   * 删除宠物
   */
  deletePet: function(e) {
    if (!this.checkAndPromptLogin()) {
      return;
    }

    const petId = e.currentTarget.dataset.petId;
    if (!petId) {
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个宠物吗？此操作不可恢复。',
      confirmText: '删除',
      confirmColor: '#ff4757',
      success: (res) => {
        if (res.confirm) {
          this.executeDeletePet(petId);
        }
      }
    });
  },

  /**
   * 执行删除操作
   */
  executeDeletePet: function(petId) {
    this.showLoading('删除中...');

    this.deletePetFromCloud(petId)
      .then(result => {
        if (result.code === 0) {
          return this.loadPetsList();
        }
        throw new Error(result.message);
      })
      .then(() => {
        this.showToast('删除成功', 'success');
      })
      .catch(error => {
        console.error('【宠物管理】删除宠物失败:', error);
        this.showToast('删除失败，请重试', 'none');
      })
      .finally(() => {
        this.hideLoading();
      });
  },

  /**
   * 从云端删除宠物
   * 统一响应格式: { code, message, data }
   */
  deletePetFromCloud: function(petId) {
    return wx.cloud.callFunction({
      name: 'pet',
      data: {
        action: 'delete',
        petId: petId
      }
    }).then(result => {
      const res = result.result || {};
      return {
        code: res.code !== undefined ? res.code : -1,
        message: res.message || '删除失败'
      };
    });
  },

  /**
   * 隐藏弹窗
   */
  hideModal: function() {
    this.setData({ showModal: false });
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation: function() {
    // 阻止点击弹窗内容区域关闭弹窗
  },

  /**
   * 重置表单
   */
  resetForm: function() {
    this.setData({
      formData: {
        name: '',
        type: '',
        breed: '',
        gender: '',
        age: '',
        weight: '',
        avatar: '',
        notes: ''
      },
      typeIndex: -1,
      canSave: false
    });
  },

  /**
   * 选择头像
   */
  chooseAvatar: function() {
    if (this.data.uploadingAvatar) {
      return;
    }

    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.takePhoto();
        } else if (res.tapIndex === 1) {
          this.chooseFromAlbum();
        }
      }
    });
  },

  /**
   * 拍照
   */
  takePhoto: function() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadAvatar(tempFilePath);
      },
      fail: (err) => {
        console.error('【宠物管理】拍照失败:', err);
        this.showToast('拍照失败', 'none');
      }
    });
  },

  /**
   * 从相册选择
   */
  chooseFromAlbum: function() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadAvatar(tempFilePath);
      },
      fail: (err) => {
        console.error('【宠物管理】选择图片失败:', err);
        this.showToast('选择图片失败', 'none');
      }
    });
  },

  /**
   * 上传头像到云存储
   */
  uploadAvatar: function(tempFilePath) {
    this.setData({ uploadingAvatar: true });
    this.showLoading('上传头像中...');

    const fileName = this.generateFileName(tempFilePath);

    wx.cloud.uploadFile({
      cloudPath: `pet/${fileName}`,
      filePath: tempFilePath,
      success: (res) => {
        this.handleUploadSuccess(res.fileID);
      },
      fail: (err) => {
        this.handleUploadError(err);
      }
    });
  },

  /**
   * 生成唯一文件名
   */
  generateFileName: function(filePath) {
    const extension = filePath.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 11);
    return `pet_${timestamp}_${random}.${extension}`;
  },

  /**
   * 处理上传成功
   */
  handleUploadSuccess: function(fileID) {
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: (urlRes) => {
        if (urlRes.fileList && urlRes.fileList.length > 0) {
          this.setData({
            'formData.avatar': fileID,
            uploadingAvatar: false
          });
          this.hideLoading();
          this.showToast('头像上传成功', 'success');
          this.validateForm();
        }
      },
      fail: (err) => {
        this.handleUploadError(err);
      }
    });
  },

  /**
   * 处理上传错误
   */
  handleUploadError: function(err) {
    console.error('【宠物管理】上传失败:', err);
    this.setData({ uploadingAvatar: false });
    this.hideLoading();
    this.showToast('上传失败，请重试', 'none');
  },

  /**
   * 输入框事件处理
   */
  onNameInput: function(e) {
    this.updateFormData('name', e.detail.value);
  },

  onBreedInput: function(e) {
    this.updateFormData('breed', e.detail.value);
  },

  onAgeInput: function(e) {
    this.updateFormData('age', e.detail.value);
  },

  onWeightInput: function(e) {
    this.updateFormData('weight', e.detail.value);
  },

  onNotesInput: function(e) {
    this.updateFormData('notes', e.detail.value);
  },

  /**
   * 更新表单数据
   */
  updateFormData: function(field, value) {
    this.setData({
      [`formData.${field}`]: value
    });
    this.validateForm();
  },

  /**
   * 选择宠物类型
   */
  onTypeChange: function(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      typeIndex: index,
      'formData.type': this.data.petTypes[index]
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
   * 表单验证
   */
  validateForm: function() {
    const { name, type, breed, gender, age } = this.data.formData;
    const canSave = this.isFormValid(name, type, breed, gender, age);
    this.setData({ canSave });
  },

  /**
   * 检查表单是否有效
   */
  isFormValid: function(name, type, breed, gender, age) {
    return !!(name?.trim() && type && breed?.trim() && gender && age?.trim());
  },

  /**
   * 跳转到登录页面
   */
  goToLogin: function() {
    wx.redirectTo({
      url: '/pages/index/index',
      fail: () => {
        wx.navigateBack();
      }
    });
  },

  /**
   * 保存宠物
   */
  savePet: function() {
    if (!this.checkAndPromptLogin()) {
      this.setData({ showModal: false });
      return;
    }

    if (!this.data.canSave) {
      this.showToast('请填写必要信息', 'none');
      return;
    }

    this.showLoading(this.data.isEditing ? '保存中...' : '添加中...');

    const petData = this.buildPetDataForCloud();
    const action = this.data.isEditing ? 'update' : 'add';

    this.savePetToCloud(petData, action, this.data.editingPetId)
      .then(result => {
        if (result.code === 0) {
          return this.loadPetsList();
        }
        throw new Error(result.message);
      })
      .then(() => {
        this.setData({ showModal: false });
        this.showToast(this.data.isEditing ? '保存成功' : '添加成功', 'success');
        this.resetForm();
      })
      .catch(error => {
        console.error('【宠物管理】保存宠物失败:', error);
        this.showToast(error.message || '保存失败', 'none');
      })
      .finally(() => {
        this.hideLoading();
      });
  },

  /**
   * 构建云数据库宠物数据
   */
  buildPetDataForCloud: function() {
    return {
      name: this.data.formData.name,
      type: this.data.formData.type,
      variety: this.data.formData.breed,
      gender: this.data.formData.gender,
      age: this.data.formData.age,
      weight: this.data.formData.weight,
      avatar: this.data.formData.avatar || '',
      beizhu: this.data.formData.notes
    };
  },

  /**
   * 保存宠物到云数据库
   * 统一响应格式: { code, message, data }
   */
  savePetToCloud: function(petData, action, petId) {
    return wx.cloud.callFunction({
      name: 'pet',
      data: {
        action: action,
        petData: petData,
        petId: petId
      }
    }).then(result => {
      const res = result.result || {};
      return {
        code: res.code !== undefined ? res.code : -1,
        message: res.message || '保存失败'
      };
    });
  },

  /**
   * 生成唯一ID
   */
  generateId: function() {
    return 'pet_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
  },

  /**
   * 头像加载错误处理
   */
  onAvatarLoadError: function(e) {
    const index = e.currentTarget.dataset.index;
    const petsList = this.data.petsList.map((pet, i) =>
      i === index ? { ...pet, avatar: '' } : pet
    );
    this.setData({ petsList });
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
      icon: icon || 'none',
      duration: 2000
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function() {
    this.loadPetsList();
    wx.stopPullDownRefresh();
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function() {
    return {
      title: '我的宠物',
      path: '/pages/mypet/mypet'
    };
  }
});