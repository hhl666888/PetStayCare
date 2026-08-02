const cloud = require('wx-server-sdk');
cloud.init();

const db = cloud.database();
const _ = db.command;

// ====== 辅助函数：将 gender 原始值转换为中文文本 ======
function getGenderText(gender) {
  const genderMap = {
    'male': '男',
    'female': '女'
  };
  return genderMap[gender] || gender || '未设置';
}

// ====== 辅助函数：将 status 原始值转换为中文文本 ======
function getUserStatusText(status) {
  const statusMap = {
    'normal': '正常',
    'disabled': '禁用'
  };
  return statusMap[status] || status || '未知';
}

// ====== 辅助函数：将 role 原始值转换为中文文本 ======
function getRoleText(role) {
  const roleMap = {
    'user': '普通用户',
    'admin': '管理员'
  };
  return roleMap[role] || role || '用户';
}

// ====== 辅助函数：格式化日期时间 ======
function formatDateTime(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

// ====== CMS 查询用户列表功能 ======
async function getUsers(event) {
  try {
    const { page = 1, pageSize = 20, keyword = '' } = event;
    
    // 构建查询条件
    let query = db.collection('users');
    
    // 如果有关键词搜索
    if (keyword) {
      query = query.where(_.or([
        { account: db.command.regex(keyword, 'i') },
        { username: db.command.regex(keyword, 'i') },
        { phone: db.command.regex(keyword, 'i') },
        { realName: db.command.regex(keyword, 'i') }
      ]));
    }
    
    // 查询总数
    const countResult = await query.count();
    const total = countResult.total;
    
    // 分页查询
    const skip = (page - 1) * pageSize;
    const result = await query
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();
    
    // 格式化数据
    const userList = result.data.map(user => {
      // 移除敏感信息
      const { password, _openid, ...safeUser } = user;
      return {
        ...safeUser,
        // 格式化性别（关键修改！）
        gender: getGenderText(user.gender),
        // 格式化其他字段
        status: getUserStatusText(user.status),
        role: getRoleText(user.role),
        createTime: formatDateTime(user.createTime),
        updateTime: formatDateTime(user.updateTime)
      };
    });
    
    return {
      code: 0,
      message: '查询成功',
      data: {
        list: userList,
        total: total,
        page: page,
        pageSize: pageSize
      }
    };
  } catch (error) {
    console.error('查询用户列表失败:', error);
    return {
      code: -1,
      message: error.message || '查询失败',
      data: null
    };
  }
}

exports.main = async (event, context) => {
  try {
    // 如果是 CMS 查询用户列表
    if (event.action === 'getUsers') {
      return await getUsers(event);
    }
    
    // 原有登录逻辑
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    
    // 查询用户信息（统一用openid）
    let userData = null;
    let isNewUser = true;
    
    try {
      const userRes = await db.collection('users')
        .where({ openid: openid })
        .get();
      
      if (userRes.data && userRes.data.length > 0) {
        userData = userRes.data[0];
        isNewUser = false;
        // 移除数据库内部字段，保留用户可见数据
        delete userData._openid;
      }
    } catch (dbError) {
      console.error('查询用户失败:', dbError);
      // 查询失败不影响登录，继续
    }
    
    // 构建返回数据
    const resultData = {
      openid: openid,
      appid: wxContext.APPID,
      isNewUser: isNewUser,
      // 如果有数据库记录，返回完整信息
      ...(userData || {}),
      // 合并前端传入的用户信息
      ...(event.userInfo || {}),
      // 确保关键字段存在
      isComplete: !!userData
    };
    
    // 如果是新用户且无基本信息，只返回标识
    if (isNewUser && !userData) {
      return {
        code: 0,
        message: '登录成功',
        data: {
          openid: openid,
          appid: wxContext.APPID,
          isNewUser: true,
          isComplete: false
        }
      };
    }
    
    return {
      code: 0,
      message: '登录成功',
      data: resultData
    };
  } catch (error) {
    console.error('登录云函数错误:', error);
    return {
      code: -1,
      message: '登录服务异常，请稍后重试',
      data: null
    };
  }
};