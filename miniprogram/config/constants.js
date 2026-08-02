// config/constants.js - 应用程序常量配置
module.exports = {
  /**
   * 存储键名常量
   */
  STORAGE_KEYS: {
    USER_INFO: 'userInfo',
    TOKEN: 'token',
    OPENID: 'openid',
    SEARCH_HISTORY: 'searchHistory',
    FAVORITES: 'favorites'
  },

  /**
   * 云函数名称常量
   */
  CLOUD_FUNCTIONS: {
    LOGIN: 'login',
    REGISTER_USER: 'registerUser',
    VALIDATE_LOGIN: 'validateLogin',
    GET_HOTELS: 'getHotels',
    GET_HOTEL_DETAIL: 'getHotelDetail',
    GET_SERVICE_DETAIL: 'getServiceDetail',
    SEARCH_HOTELS: 'searchHotels',
    CREATE_ORDER: 'createOrder',
    UPDATE_ORDER_STATUS: 'updateOrderStatus',
    GET_ORDERS: 'getOrders',
    GET_PETS: 'getPets',
    ADD_PET: 'addPet',
    UPDATE_PET: 'updatePet',
    DELETE_PET: 'deletePet',
    UPLOAD_IMAGE: 'uploadImage'
  },

  /**
   * 订单状态常量
   */
  ORDER_STATUS: {
    PENDING: 'pending',
    CHECKED_IN: 'checked_in',
    CHECKED_OUT: 'checked_out',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed'
  },

  /**
   * 宠物类型常量
   */
  PET_TYPES: {
    DOG: 'dog',
    CAT: 'cat',
    OTHER: 'other'
  },

  /**
   * 用户角色常量
   */
  USER_ROLES: {
    USER: 'user',
    ADMIN: 'admin',
    MERCHANT: 'merchant'
  },

  /**
   * 页面路径常量
   */
  PAGES: {
    INDEX: '/pages/index/index',
    HOTEL: '/pages/hotel/hotel',
    HOTEL_DETAIL: '/pages/hotel/detail/detail',
    SEARCH: '/pages/search/search',
    FAVORITES: '/pages/favorites/favorites',
    MYPET: '/pages/mypet/mypet',
    ORDER: '/pages/order/order',
    USER: '/pages/user/user'
  },

  /**
   * API 响应状态码
   */
  RESPONSE_CODE: {
    SUCCESS: 0,
    ERROR: -1,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    SERVER_ERROR: 500
  }
};
