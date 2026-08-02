// 用户注册云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('用户注册云函数被调用:', event);
  console.log('接收到的 account 字段:', event.account);
  
  try {
    const {
      account,
      username,
      phone,
      password,
      email,
      realName,
      gender,
      birthDate,
      avatarUrl,
      status = 'normal',
      role = 'user'
    } = event;
    
    // 验证必填字段
    if (!account || !username || !phone || !password || !email || !realName || !gender || !birthDate) {
      return {
        code: -1,
        message: '缺少必要参数'
      }
    }
    
    // 基本格式验证
    if (account.length < 3 || account.length > 20) {
      return {
        code: -1,
        message: '账号长度应为3-20个字符'
      }
    }
    
    if (username.length < 3 || username.length > 20) {
      return {
        code: -1,
        message: '用户名长度应为3-20个字符'
      }
    }
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return {
        code: -1,
        message: '手机号格式不正确'
      }
    }
    
    if (password.length < 6 || password.length > 20) {
      return {
        code: -1,
        message: '密码长度应为6-20个字符'
      }
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        code: -1,
        message: '邮箱格式不正确'
      }
    }
    
    const wxContext = cloud.getWXContext();
    
    // 检查账号是否已存在
    const accountCheck = await db.collection('users').where({
      account: account
    }).get();
    
    if (accountCheck.data.length > 0) {
      return {
        code: -501000,
        message: '账号已存在'
      }
    }
    
    // 检查用户名是否已存在
    const usernameCheck = await db.collection('users').where({
      username: username
    }).get();
    
    if (usernameCheck.data.length > 0) {
      return {
        code: -501001,
        message: '用户名已存在'
      }
    }
    
    // 检查手机号是否已存在
    const phoneCheck = await db.collection('users').where({
      phone: phone
    }).get();
    
    if (phoneCheck.data.length > 0) {
      return {
        code: -501002,
        message: '手机号已存在'
      }
    }
    
    // 检查邮箱是否已存在
    const emailCheck = await db.collection('users').where({
      email: email
    }).get();
    
    if (emailCheck.data.length > 0) {
      return {
        code: -501003,
        message: '邮箱已存在'
      }
    }
    
    // 生成用户ID
    const userId = `USER_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // 密码加密（在实际项目中应该使用更安全的加密方式）
    const encryptedPassword = require('crypto').createHash('md5').update(password).digest('hex');
    
    // 构建用户数据
    const userData = {
      _id: userId,
      account: account.trim(),
      username: username.trim(),
      phone: phone,
      password: encryptedPassword,
      email: email.trim(),
      realName: realName.trim(),
      gender: gender,
      birthDate: birthDate,
      avatarUrl: avatarUrl || '',
      // 统一使用 openid（小写）
      openid: wxContext.OPENID,
      status: status,
      role: role,
      favorites: [],
      createTime: new Date(),
      updateTime: new Date()
    };

    console.log('准备保存的用户数据（包含 account）:', {
      account: userData.account,
      _id: userData._id,
      username: userData.username
    });

    // 保存到数据库
    const result = await db.collection('users').add({
      data: userData
    });

    console.log('用户注册成功，已保存到数据库:', userId);
    
    // 构建返回给前端的数据（不包含敏感信息）
    const returnData = {
      _id: userId,
      account: userData.account,
      username: userData.username,
      phone: userData.phone,
      email: userData.email,
      realName: userData.realName,
      gender: userData.gender,
      birthDate: userData.birthDate,
      avatarUrl: userData.avatarUrl,
      openid: userData.openid,
      role: userData.role,
      status: userData.status,
      createTime: userData.createTime
    };
    
    // 返回成功结果
    return {
      code: 0,
      message: '注册成功',
      data: returnData
    }
    
  } catch (error) {
    console.error('用户注册失败:', error);
    return {
      code: -1,
      message: error.message || '注册失败',
      error: error
    }
  }
}