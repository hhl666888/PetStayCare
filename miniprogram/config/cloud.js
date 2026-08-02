// 云开发配置文件
const CLOUD_CONFIG = {
  // 云开发环境ID
  env: 'cloud1-2g6m2qwge2893f2c',
  traceUser: true
};

// 初始化云开发
function initCloud() {
  try {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return false;
    }
    
    // 检查是否已经初始化
    if (wx.cloud.DYNAMIC_CURRENT_ENV) {
      return true;
    }
    
    wx.cloud.init({
      env: CLOUD_CONFIG.env,
      traceUser: CLOUD_CONFIG.traceUser
    });
    
    return true;
  } catch (error) {
    console.error('云开发初始化失败:', error);
    return false;
  }
}

// 调用云函数（统一请求封装）
// 所有云函数统一返回 { code, message, data } 格式
function callFunction(name, data) {
  data = data || {};
  return new Promise(function(resolve, reject) {
    if (!wx.cloud) {
      reject(new Error('云开发未初始化或不可用'));
      return;
    }
    
    wx.cloud.callFunction({
      name: name,
      data: data,
      success: function(res) {
        const result = res.result || {};
        
        // 统一处理返回格式 { code, message, data }
        // code === 0 表示成功
        if (result.code === 0) {
          // 成功时返回 data 部分，让前端直接使用
          resolve(result.data);
        } else {
          // 失败时抛出包含错误信息的 Error
          const error = new Error(result.message || '操作失败');
          error.code = result.code;
          reject(error);
        }
      },
      fail: function(err) {
        console.error('云函数 ' + name + ' 调用失败:', err);
        if (err.errCode === -501000) {
          err.userMessage = '云开发环境配置错误';
        }
        reject(err);
      }
    });
  });
}

// 测试云开发连接
function testCloudConnection() {
  return new Promise(function(resolve, reject) {
    if (!wx.cloud) {
      reject(new Error('云开发未初始化'));
      return;
    }
    
    try {
      var envInfo = wx.cloud.DYNAMIC_CURRENT_ENV || CLOUD_CONFIG.env;
      
      wx.cloud.callFunction({
        name: 'testHotels',
        data: { test: true }
      }).then(function(res) {
        resolve({ success: true, env: envInfo, data: res });
      }).catch(function(err) {
        if (err.errCode && err.errCode === -1) {
          resolve({ success: true, env: envInfo, message: '云连接正常，但测试函数不存在' });
        } else {
          reject(err);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  initCloud,
  callFunction,
  testCloudConnection,
  CLOUD_CONFIG
};