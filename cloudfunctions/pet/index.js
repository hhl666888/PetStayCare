// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 数据库错误处理工具函数（内联）

/**
 * 检查集合是否存在
 */
async function checkCollectionExists(db, collectionName) {
  try {
    const result = await db.collection(collectionName).limit(1).get();
    return true;
  } catch (error) {
    if (error.errCode === -502001 || error.code === 'COLLECTION_NOT_FOUND' || error.code === 'MODEL_TABLE_NOT_EXIST') {
      return false;
    }
    throw error;
  }
}

/**
 * 处理数据库操作错误
 */
function handleDatabaseError(error, operation, collectionName) {
  const errorMessage = error.message || error.errMsg || '未知错误';
  const errorCode = error.errCode || error.code;

  if (errorCode === -502001 || errorCode === 'COLLECTION_NOT_FOUND' || errorCode === 'MODEL_TABLE_NOT_EXIST') {
    return {
      code: -502001,
      message: `数据集合 ${collectionName} 不存在，请联系管理员创建`,
      error: errorMessage
    };
  }

  return {
    code: -1,
    message: `${operation}失败: ${errorMessage}`,
    error: errorMessage
  };
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, petData, petId } = event

  try {
    // 检查 pet 集合是否存在
    const collectionExists = await checkCollectionExists(db, 'pet')
    if (!collectionExists) {
      return handleDatabaseError(
        new Error('COLLECTION_NOT_FOUND'),
        'Pet操作',
        'pet'
      )
    }

    switch (action) {
      case 'add':
        return await addPet(petData, wxContext)
      case 'update':
        return await updatePet(petId, petData, wxContext)
      case 'delete':
        return await deletePet(petId, wxContext)
      case 'get':
        return await getPets(wxContext)
      default:
        return {
          code: -1,
          message: '未知操作类型'
        }
    }
  } catch (error) {
    console.error('Pet操作失败:', error)
    return handleDatabaseError(error, 'Pet操作', 'pet')
  }
}

// 添加宠物
async function addPet(petData, wxContext) {
  // 添加用户ID和创建时间
  const newPet = {
    ...petData,
    user_id: wxContext.OPENID,
    createTime: db.serverDate(),
    updateTime: db.serverDate()
  }
  
  const result = await db.collection('pet').add({
    data: newPet
  })
  
  return {
    code: 0,
    message: '添加成功',
    data: {
      _id: result._id,
      ...newPet
    }
  }
}

// 更新宠物
async function updatePet(petId, petData, wxContext) {
  const updateData = {
    ...petData,
    updateTime: db.serverDate()
  }
  
  const result = await db.collection('pet').where({
    _id: petId,
    user_id: wxContext.OPENID
  }).update({
    data: updateData
  })
  
  if (result.stats.updated === 0) {
    return {
      code: -1,
      message: '宠物不存在或无权限修改'
    }
  }
  
  return {
    code: 0,
    message: '更新成功'
  }
}

// 删除宠物
async function deletePet(petId, wxContext) {
  const result = await db.collection('pet').where({
    _id: petId,
    user_id: wxContext.OPENID
  }).remove()
  
  if (result.stats.removed === 0) {
    return {
      code: -1,
      message: '宠物不存在或无权限删除'
    }
  }
  
  return {
    code: 0,
    message: '删除成功'
  }
}

// 获取用户的宠物列表
async function getPets(wxContext) {
  console.log('查询宠物列表，当前用户 OPENID:', wxContext.OPENID);

  const result = await db.collection('pet').where({
    user_id: wxContext.OPENID
  }).orderBy('createTime', 'desc').get()

  console.log('查询到的宠物数量:', result.data.length);
  console.log('查询到的宠物数据:', result.data);

  return {
    code: 0,
    message: '获取成功',
    data: result.data
  }
}