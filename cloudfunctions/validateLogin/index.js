// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const { account, password } = event

  try {
    const db = cloud.database()
    
    // 查询用户
    const result = await db.collection('users')
      .where({
        account: account
      })
      .get()
    
    if (result.data.length === 0) {
      return {
        code: -1,
        message: '账号不存在',
        data: null
      }
    }
    
    const user = result.data[0]
    
    // 验证密码
    const crypto = require('crypto');
    const encryptedPassword = crypto.createHash('md5').update(password).digest('hex');
    
    if (user.password !== encryptedPassword) {
      return {
        code: -1,
        message: '密码错误',
        data: null
      }
    }
    
    // 登录成功，返回用户信息（不包含密码）
    return {
      code: 0,
      message: '登录成功',
      data: {
        _id: user._id,
        account: user.account,
        username: user.username || user.nickname || user.account,
        nickName: user.username || user.nickname || user.account,
        avatarUrl: user.avatarUrl || '',
        phone: user.phone || '',
        address: user.address || '',
        openid: user.openid, // 统一使用 openid
        createTime: user.createTime
      }
    }
    
  } catch (error) {
    console.error('登录验证失败:', error)
    return {
      code: -1,
      message: '登录验证失败，请稍后重试',
      data: null
    }
  }
}