const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

/**
 * getServiceDetail 云函数 - 获取服务详情
 */
exports.main = async (event, context) => {
  const { serviceId = '' } = event;

  if (!serviceId) {
    return {
      code: -1,
      message: '缺少服务ID参数',
      data: null
    };
  }

  try {
    const res = await db.collection('supporting_services').doc(serviceId).field({
      _id: true,
      booking_rules: true,
      hotel_id: true,
      included_items: true,
      price: true,
      safety_notice: true,
      service_desc: true,
      service_img: true,
      service_name: true,
      service_type: true,
      staff_requirement: true,
      status: true
    }).get();

    if (!res.data) {
      return {
        code: -1,
        message: '服务不存在或已下架',
        data: null
      };
    }

    return {
      code: 0,
      message: '获取成功',
      data: res.data
    };

  } catch (err) {
    console.error('getServiceDetail 云函数错误:', err);
    return {
      code: -1,
      message: '服务器错误',
      data: null
    };
  }
};
