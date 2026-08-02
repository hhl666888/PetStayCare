// pages/order/create/create.js
const { callFunction, initCloud } = require('../../../config/cloud.js');

Page({
  data: {
    // 基本信息
    hotelId: '',
    roomId: '',
    serviceId: '',
    serviceName: '',
    servicePrice: 0,
    hotel: null,
    room: null,
    orderType: 'room', // 'room' 或 'service'
    
    // 日期选择
    checkInDate: '',
    checkOutDate: '',
    nights: 1,
    
    // 预约时间（服务订单）
    appointmentDate: '',
    appointmentTime: '',
    appointmentDateTime: '',
    
    // 宠物信息 - 初始为空,只有从我的宠物选择后才添加
    pets: [],

    // 我的宠物列表
    myPetsList: [],
    
    // 上传状态
    uploadingIndex: -1,
    
    // 联系信息
    contactName: '',
    contactPhone: '',
    
    // 价格计算
    roomPrice: 0,
    totalPrice: 0,
    discountAmount: 0,
    actualPrice: 0,
    
    // 服务选择
    selectedServices: [],
    
    // 其他
    loading: false,
    submitting: false,
    agreeTerms: false
  },

  onLoad: function(options) {

    // 初始化云开发
    initCloud();

    // 检查登录状态
    const app = getApp();
    const userInfo = app.globalData && app.globalData.userInfo || wx.getStorageSync('userInfo');

    if (!userInfo || (!userInfo.account && !userInfo.nickName && !userInfo.openid)) {
      console.log('用户未登录，清空宠物列表');
      this.setData({
        myPetsList: [],
        pets: []
      });
    }

    if (options.hotelId) {
      this.setData({
        hotelId: options.hotelId,
        checkInDate: options.checkIn || this.getDefaultCheckInDate(),
        checkOutDate: options.checkOut || this.getDefaultCheckOutDate()
      });
      
      // 判断是房型订单还是服务订单
      if (options.roomId) {
        // 房型订单
        this.setData({
          roomId: options.roomId,
          orderType: 'room'
        });
        this.loadRoomAndHotel();
      } else if (options.serviceId && options.type === 'service') {
        // 服务订单
        this.setData({
          serviceId: options.serviceId,
          serviceName: options.serviceName,
          servicePrice: parseFloat(options.price),
          orderType: 'service'
        });
        this.loadHotelForService();
      }
      
      this.loadMyPets();
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

  // 页面显示时重新加载宠物列表
  onShow: function() {
    // 检查登录状态
    const app = getApp();
    const userInfo = app.globalData && app.globalData.userInfo || wx.getStorageSync('userInfo');

    if (!userInfo || (!userInfo.account && !userInfo.nickName && !userInfo.openid)) {
      console.log('用户未登录，清空宠物列表');
      this.setData({
        myPetsList: [],
        pets: []
      });
      return;
    }

    // 从其他页面返回时重新加载宠物列表
    this.loadMyPets();
  },

  // 加载我的宠物列表
  async loadMyPets() {
    // 先检查登录状态
    const app = getApp();
    const userInfo = app.globalData && app.globalData.userInfo || wx.getStorageSync('userInfo');

    if (!userInfo || (!userInfo.account && !userInfo.nickName && !userInfo.openid)) {
      console.log('用户未登录，清空宠物列表');
      this.setData({
        myPetsList: [],
        pets: []
      });
      return;
    }

    try {
      // 只从云端获取当前用户的宠物数据
      const result = await wx.cloud.callFunction({
        name: 'pet',
        data: {
          action: 'get'
        }
      });

      const res = result.result || {};
      // 统一响应格式: { code, message, data }
      if (res.code === 0) {
        const cloudPets = (res.data || []).map(pet => ({
          id: pet._id,
          name: pet.name,
          type: pet.type,
          breed: pet.variety || pet.breed,
          gender: pet.gender,
          age: pet.age,
          weight: pet.weight,
          avatar: pet.avatar || '',
          notes: pet.beizhu || pet.notes
        }));

        this.setData({
          myPetsList: cloudPets
        });

        wx.setStorageSync('petsList', cloudPets);
      } else {
        throw new Error(res.message);
      }
    } catch (error) {
      console.error('加载宠物列表失败:', error);
      this.setData({
        myPetsList: []
      });
    }
  },

  // 获取默认入住日期（今天）
  getDefaultCheckInDate: function() {
    const today = new Date();
    return this.formatDate(today);
  },

  // 获取默认退房日期（明天）
  getDefaultCheckOutDate: function() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.formatDate(tomorrow);
  },

  // 格式化日期
  formatDate: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 加载房型和酒店信息
  loadRoomAndHotel: function() {
    wx.showLoading({
      title: '加载中...'
    });

    Promise.all([
      callFunction('getRoomDetail', {
        roomId: this.data.roomId,
        hotelId: this.data.hotelId
      }),
      callFunction('getHotelDetail', {
        hotelId: this.data.hotelId
      })
    ])
    .then(([roomRes, hotelRes]) => {
      console.log('房型信息:', roomRes);
      console.log('酒店信息:', hotelRes);

      // 统一响应格式: res 已经是 data 部分
      const room = roomRes.room || roomRes;
      const hotel = hotelRes.hotel || hotelRes;

      this.setData({
        room: this.processRoomData(room),
        hotel: this.processHotelData(hotel),
        roomPrice: room.price || 0
      });

      this.calculateTotalPrice();
      wx.hideLoading();
    })
    .catch(err => {
      console.error('加载失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 2000
      });
    });
  },

  // 加载酒店信息（用于服务订单）
  loadHotelForService: function() {
    wx.showLoading({
      title: '加载中...'
    });

    callFunction('getHotelDetail', {
      hotelId: this.data.hotelId
    })
    .then(res => {
      console.log('酒店信息:', res);

      // 统一响应格式: res 已经是 data 部分
      const hotel = res.hotel || res;

      this.setData({
        hotel: this.processHotelData(hotel),
        roomPrice: this.data.servicePrice
      });

      this.calculateTotalPrice();
      wx.hideLoading();
    })
    .catch(err => {
      console.error('加载失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 2000
      });
    });
  },

  // 处理房型数据
  processRoomData: function(room) {
    return {
      ...room,
      name: room.name || room.room_name || room.room_type || '标准间',
      facilities: room.facilities || ['24小时监控', '空调', '独立空间'],
      features: room.features || ['专业护理', '营养配餐'],
      services: room.services || ['清洁服务', '健康检查']
    };
  },

  // 处理酒店数据
  processHotelData: function(hotel) {
    return {
      ...hotel,
      name: hotel.hotel_name || hotel.name || '未知酒店',
      hotel_name: hotel.hotel_name || hotel.name || '未知酒店',
      address: hotel.hotel_address || hotel.address || '地址待完善',
      hotel_address: hotel.hotel_address || hotel.address || '地址待完善',
      phone: hotel.hotel_phone || hotel.phone || '暂无电话',
      hotel_phone: hotel.hotel_phone || hotel.phone || '暂无电话'
    };
  },

  // 入住日期改变
  onCheckInDateChange: function(e) {
    const checkInDate = e.detail.value;
    const checkOutDate = this.calculateCheckOutDate(checkInDate);
    
    this.setData({
      checkInDate,
      checkOutDate
    });
    
    this.calculateNights();
    this.calculateTotalPrice();
  },

  // 退房日期改变
  onCheckOutDateChange: function(e) {
    this.setData({
      checkOutDate: e.detail.value
    });
    
    this.calculateNights();
    this.calculateTotalPrice();
  },

  // 预约日期变化
  onAppointmentDateChange: function(e) {
    const appointmentDate = e.detail.value;
    this.setData({ appointmentDate });
    this.updateAppointmentDateTime();
  },

  // 预约时间变化
  onAppointmentTimeChange: function(e) {
    const appointmentTime = e.detail.value;
    this.setData({ appointmentTime });
    this.updateAppointmentDateTime();
  },

  // 更新预约日期时间字符串
  updateAppointmentDateTime: function() {
    const { appointmentDate, appointmentTime } = this.data;
    if (appointmentDate && appointmentTime) {
      const appointmentDateTime = `${appointmentDate} ${appointmentTime}`;
      this.setData({ appointmentDateTime });
      console.log('预约时间已更新:', appointmentDateTime);
    }
  },

  // 计算退房日期（默认入住1天）
  calculateCheckOutDate: function(checkInDate) {
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 1);
    return this.formatDate(checkOut);
  },

  // 计算住宿天数
  calculateNights: function() {
    const { checkInDate, checkOutDate } = this.data;
    
    if (checkInDate && checkOutDate) {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      
      this.setData({
        nights: Math.max(1, nights)
      });
    }
  },

  // 计算总价
  calculateTotalPrice: function() {
    const { roomPrice, nights, selectedServices } = this.data;
    
    const roomTotal = roomPrice * nights;
    const servicesTotal = selectedServices.reduce((total, service) => total + (service.price || 0), 0);
    const total = roomTotal + servicesTotal;
    
    // 模拟优惠
    const discountAmount = total > 500 ? 50 : 0;
    const actualPrice = total - discountAmount;
    
    this.setData({
      totalPrice: total,
      discountAmount,
      actualPrice
    });
  },



  // 宠物类型改变
  onPetTypeChange: function(e) {
    const index = e.currentTarget.dataset.index;
    const type = e.detail.value;
    const field = e.currentTarget.dataset.field || 'type';
    
    const pets = this.data.pets.map((pet, i) => 
      i === index ? { ...pet, [field]: type } : pet
    );
    
    this.setData({ pets });
  },

  // 宠物信息输入
  onPetInfoInput: function(e) {
    const { field, index } = e.currentTarget.dataset;
    const value = e.detail.value;
    
    const pets = this.data.pets.map((pet, i) => 
      i === index ? { ...pet, [field]: value } : pet
    );
    
    this.setData({ pets });
    
    // 打印调试信息
    console.log(`宠物${index + 1} ${field} 更新为:`, value);
    console.log('当前宠物列表:', pets);
  },

  // 联系信息输入
  onContactInput: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [field]: value
    });
  },

  // 添加宠物
  addPet: function() {
    if (this.data.pets.length >= 3) {
      wx.showToast({
        title: '最多添加3只宠物',
        icon: 'none'
      });
      return;
    }
    
    const newPet = {
      name: '',
      type: 'cat',
      breed: '',
      age: '',
      weight: '',
      gender: 'male',
      vaccine: true,
      sterilization: true,
      specialNotes: ''
    };
    
    this.setData({
      pets: [...this.data.pets, newPet]
    });
  },

  // 从我的宠物中选择
  selectMyPet: function(e) {
    const petIndex = e.currentTarget.dataset.index;
    const selectedPet = this.data.myPetsList[petIndex];
    
    if (!selectedPet) return;

    // 检查是否已经选择过
    const isAlreadySelected = this.data.pets.some(pet => 
      pet.name === selectedPet.name && pet.breed === selectedPet.breed
    );

    if (isAlreadySelected) {
      wx.showToast({
        title: '该宠物已在订单中',
        icon: 'none'
      });
      return;
    }

    if (this.data.pets.length >= 3) {
      wx.showToast({
        title: '最多添加3只宠物',
        icon: 'none'
      });
      return;
    }

    // 转换宠物数据格式
    const orderPet = {
      name: selectedPet.name || '',
      type: selectedPet.type === '狗' ? 'dog' : (selectedPet.type === '猫' ? 'cat' : 'other'),
      breed: selectedPet.breed || '',
      age: selectedPet.age || '',
      weight: selectedPet.weight || '',
      gender: selectedPet.gender || 'male',
      vaccine: false, // 默认未接种疫苗，健康状态已删除
      sterilization: false, // 默认未绝育，健康状态已删除
      specialNotes: selectedPet.notes || '',
      avatar: selectedPet.avatar || '',
      petId: selectedPet.id,
      isFromMyPets: true // 标记来源，用于显示不同的上传提示
    };

    this.setData({
      pets: [...this.data.pets, orderPet]
    });

    wx.showToast({
      title: `已添加 ${orderPet.name}`,
      icon: 'success'
    });
  },

  // 选择宠物头像
  choosePetAvatar: function(e) {
    const index = e.currentTarget.dataset.index;
    
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.takePhoto(index);
        } else if (res.tapIndex === 1) {
          this.chooseFromAlbum(index);
        }
      }
    });
  },

  // 拍照
  takePhoto: function(index) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      maxDuration: 30,
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadPetAvatar(tempFilePath, index);
      },
      fail: (err) => {
        console.error('拍照失败:', err);
        wx.showToast({
          title: '拍照失败',
          icon: 'error'
        });
      }
    });
  },

  // 从相册选择
  chooseFromAlbum: function(index) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      maxDuration: 30,
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadPetAvatar(tempFilePath, index);
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'error'
        });
      }
    });
  },

  // 上传宠物头像到云存储
  uploadPetAvatar: function(tempFilePath, index) {
    this.setData({ uploadingIndex: index });
    
    wx.showLoading({
      title: '上传中...',
      mask: true
    });

    // 生成唯一文件名
    const fileExtension = tempFilePath.split('.').pop() || 'jpg';
    const fileName = `pet_${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${fileExtension}`;

    wx.cloud.uploadFile({
      cloudPath: `pet/${fileName}`, // 上传到云存储的pet文件夹
      filePath: tempFilePath,
      success: (res) => {
        // 上传成功，获取云存储URL
        const fileID = res.fileID;
        
        // 获取下载链接
        wx.cloud.getTempFileURL({
          fileList: [fileID],
          success: (urlRes) => {
            if (urlRes.fileList && urlRes.fileList.length > 0) {
              const avatarUrl = urlRes.fileList[0].tempFileURL;
              
              // 更新宠物头像
              const pets = this.data.pets.map((pet, i) => 
                i === index ? { ...pet, avatar: fileID } : pet
              );
              
              this.setData({
                pets: pets,
                uploadingIndex: -1
              });

              wx.hideLoading();
              wx.showToast({
                title: '头像上传成功',
                icon: 'success'
              });

              console.log('宠物头像上传成功:', fileID);
            }
          },
          fail: (err) => {
            console.error('获取文件链接失败:', err);
            this.handleUploadError(index);
          }
        });
      },
      fail: (err) => {
        console.error('上传失败:', err);
        this.handleUploadError(index);
      }
    });
  },

  // 处理上传错误
  handleUploadError: function(index) {
    this.setData({ uploadingIndex: -1 });
    wx.hideLoading();
    wx.showToast({
      title: '上传失败，请重试',
      icon: 'error'
    });
  },

  // 头像加载错误处理
  onAvatarError: function(e) {
    const index = e.currentTarget.dataset.index;
    console.log(`宠物${index + 1}头像加载失败`);
    
    // 重置为默认头像
    const pets = this.data.pets.map((pet, i) => 
      i === index ? { ...pet, avatar: '' } : pet
    );
    
    this.setData({ pets });
  },

  // 显示宠物选择弹窗
  showPetSelector: function() {
    console.log('🐾 显示宠物选择弹窗，当前宠物列表:', this.data.myPetsList);
    console.log('🐾 宠物列表长度:', this.data.myPetsList.length);

    // 使用与页面 onLoad/onShow 一致的登录检查（宽松模式）
    const app = getApp();
    const userInfo = app.globalData && app.globalData.userInfo || wx.getStorageSync('userInfo');

    if (!userInfo || (!userInfo.account && !userInfo.nickName && !userInfo.openid)) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再选择宠物',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/index/index'
            });
          }
        }
      });
      return;
    }

    // 获取当前用户信息
    const auth = require('../../../utils/auth.js');
    const currentUser = auth.getCurrentUser();

    if (this.data.myPetsList.length === 0) {
      console.log('📝 没有宠物数据，显示添加提示');
      wx.showModal({
        title: '提示',
        content: '您还没有添加宠物信息，是否先去添加？',
        confirmText: '去添加',
        success: (res) => {
          if (res.confirm) {
            console.log('👤 用户选择去添加宠物，跳转到mypet页面');
            wx.navigateTo({
              url: '/pages/mypet/mypet'
            });
          }
        }
      });
      return;
    }

    // 构建宠物选择列表
    const petListText = this.data.myPetsList.map(pet => {
      const breedText = pet.breed || '未知品种';
      return `${pet.name} (${pet.type} - ${breedText})`;
    });
    
    console.log('📋 宠物选择列表:', petListText);

    // 显示宠物选择列表
    wx.showActionSheet({
      itemList: petListText,
      success: (res) => {
        console.log('✅ 用户选择了宠物:', res.tapIndex);
        this.selectMyPet({ currentTarget: { dataset: { index: res.tapIndex } } });
      },
      fail: (err) => {
        console.log('❌ 用户取消选择宠物:', err);
      }
    });
  },

  // 删除宠物
  removePet: function(e) {
    const index = e.currentTarget.dataset.index;

    const pets = this.data.pets.filter((_, i) => i !== index);
    this.setData({ pets });
  },

  // 服务选择
  onServiceToggle: function(e) {
    const service = e.currentTarget.dataset.service;
    const { selectedServices } = this.data;
    
    const index = selectedServices.findIndex(s => s.id === service.id);
    
    if (index === -1) {
      // 添加服务
      this.setData({
        selectedServices: [...selectedServices, service]
      });
    } else {
      // 移除服务
      this.setData({
        selectedServices: selectedServices.filter((_, i) => i !== index)
      });
    }
    
    this.calculateTotalPrice();
  },

  // 同意条款
  onTermsChange: function(e) {
    console.log('条款选择变化:', e.detail.value);
    this.setData({
      agreeTerms: e.detail.value.includes('agree')
    });
  },

  // 提交订单
  submitOrder: function() {
    // 表单验证
    if (!this.validateForm()) {
      return;
    }

    this.setData({ submitting: true });

    const orderData = {
      // 必填字段
      hotelId: this.data.hotelId,
      orderType: this.data.orderType || 'room',
      contactName: this.data.contactName,
      contactPhone: this.data.contactPhone,
      actualPrice: this.data.actualPrice || 0,
      paymentMethod: this.data.paymentMethod || '微信支付',  // 修复：设置默认支付方式
      pets: this.data.pets || [],
      
      // 房型订单字段
      roomId: this.data.roomId || '',
      checkInDate: this.data.checkInDate || '',
      checkOutDate: this.data.checkOutDate || '',
      nights: this.data.nights || 1,
      
      // 服务订单字段
      serviceId: this.data.serviceId || '',
      appointmentDate: this.data.appointmentDate || '',
      appointmentTime: this.data.appointmentTime || ''
    };

    // 调试日志：打印关键字段
    console.log('📤 提交订单数据:', orderData);
    console.log('✅ 关键字段检查:', {
      orderType: orderData.orderType,
      paymentMethod: orderData.paymentMethod,
      hotelId: orderData.hotelId
    });

    // 调用云函数创建订单
    callFunction('createOrder', orderData)
    .then(res => {
      console.log('创建订单结果:', res);

      // 统一响应格式: res 已经是 data 部分
      wx.hideLoading();
      this.setData({ submitting: false });

      // 跳转到支付页面
      wx.redirectTo({
        url: `/pages/payment/payment?orderId=${res.orderId}`
      });
    })
    .catch(err => {
      console.error('订单创建失败:', err);
      this.setData({ submitting: false });
      
      // 如果是支付相关错误，跳转到支付失败页面
      if (err.message && (err.message.includes('支付') || err.message.includes('payment'))) {
        wx.redirectTo({
          url: `/pages/order/payment-failed/payment-failed?orderId=${this.data.hotelId}_${this.data.roomId}_${Date.now()}&errorCode=PAYMENT_FAILED&amount=${this.data.actualPrice}&errorMessage=${encodeURIComponent(err.message)}`
        });
        return;
      }
      
      wx.showToast({
        title: '订单创建失败，请重试',
        icon: 'none',
        duration: 2000
      });
    });
  },

  // 表单验证
  validateForm: function() {
    const {
      orderType,
      checkInDate,
      checkOutDate,
      appointmentDate,
      appointmentTime,
      pets,
      contactName,
      contactPhone,
      agreeTerms
    } = this.data;

    // 房型订单需要日期验证
    if (orderType === 'room' && (!checkInDate || !checkOutDate)) {
      wx.showToast({
        title: '请选择入住和退房日期',
        icon: 'none'
      });
      return false;
    }

    // 服务订单需要预约时间验证
    if (orderType === 'service' && (!appointmentDate || !appointmentTime)) {
      wx.showToast({
        title: '请选择预约日期和时间',
        icon: 'none'
      });
      return false;
    }

    // 宠物信息验证
    if (pets.length === 0) {
      wx.showToast({
        title: '请至少选择一只宠物',
        icon: 'none'
      });
      return false;
    }

    for (let i = 0; i < pets.length; i++) {
      const pet = pets[i];
      if (!pet.name) {
        wx.showToast({
          title: `请填写第${i + 1}只宠物的名字`,
          icon: 'none'
        });
        return false;
      }
      if (!pet.breed) {
        wx.showToast({
          title: `请填写第${i + 1}只宠物的品种`,
          icon: 'none'
        });
        return false;
      }
    }

    // 联系信息验证
    if (!contactName) {
      wx.showToast({
        title: '请填写联系人姓名',
        icon: 'none'
      });
      return false;
    }

    if (!contactPhone) {
      wx.showToast({
        title: '请填写联系电话',
        icon: 'none'
      });
      return false;
    }

    // 手机号格式验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(contactPhone)) {
      wx.showToast({
        title: '请填写正确的手机号',
        icon: 'none'
      });
      return false;
    }

    // 条款验证
    if (!agreeTerms) {
      wx.showToast({
        title: '请同意服务条款',
        icon: 'none'
      });
      return false;
    }

    return true;
  }
});