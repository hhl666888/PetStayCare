# 宠宿无忧 (PetStayCare)

> 一款专注于宠物寄宿、酒店预订与宠物服务的微信小程序,基于微信云开发(CloudBase)构建,为养宠用户提供一站式宠物寄宿解决方案。

## 项目简介

**宠宿无忧** 是一个面向宠物主的宠物寄宿酒店预订平台,用户可以通过小程序查找附近的宠物酒店、浏览房型与服务、在线预订下单,并管理自己的宠物信息和订单。同时集成 AI 智能助手,为用户提供智能化的宠物寄宿咨询和推荐服务。

- **项目名称**: 宠宿无忧 (chongsu-hotel)
- **版本**: 1.0.0
- **类型**: 微信小程序 + 云开发
- **AppID**: `wxa3bd806f203b8de0`
- **云环境ID**: `cloud1-2g6m2qwge2893f2c`

## 核心功能

### 用户端功能
- **用户登录与注册**: 支持账号密码注册登录,基于云开发鉴权
- **酒店搜索与浏览**: 首页酒店列表、关键词搜索、位置定位附近酒店
- **酒店详情展示**: 酒店信息、房型展示、服务详情
- **在线预订下单**: 选择房型、填写信息、创建订单
- **订单管理**: 订单列表、状态跟踪(待入住/已入住/已退房/已取消/已完成)
- **支付流程**: 支付页、支付成功/失败结果页
- **收藏管理**: 酒店收藏、收藏夹管理
- **宠物管理**: 我的宠物信息增删改查
- **个人中心**: 用户信息维护、退出登录
- **AI 智能助手**: 集成 Agent UI 智能问答,提供宠物寄宿建议

### 底部导航 (TabBar)
| Tab | 页面 | 说明 |
|-----|------|------|
| 首页 | `pages/hotel/hotel` | 酒店列表展示 |
| 搜索 | `pages/search/search` | 酒店搜索 |
| 订单 | `pages/order/order` | 订单管理 |
| 我的 | `pages/user/user` | 个人中心 |

## 技术栈

- **前端框架**: 微信小程序原生开发 (WXML / WXSS / JS)
- **UI 组件库**: TDesign Miniprogram
- **后端服务**: 微信云开发 (CloudBase)
  - 云函数 (Node.js + wx-server-sdk)
  - 云数据库
  - 云存储
- **AI 能力**: 集成 Agent UI 组件,支持 Markdown 渲染、语音、图片等多模态交互
- **构建工具**: Vite (辅助工具链)

## 项目结构

```
宠宿无忧ok/
├── miniprogram/                  # 小程序前端代码
│   ├── app.js                    # 小程序主入口(云开发初始化、登录状态管理)
│   ├── app.json                  # 小程序全局配置
│   ├── app.wxss                  # 全局样式
│   ├── config/                   # 配置文件
│   │   ├── cloud.js              # 云开发配置
│   │   └── constants.js          # 常量定义(存储键、云函数名、订单状态等)
│   ├── pages/                    # 页面目录
│   │   ├── welcome/              # 欢迎页
│   │   ├── hotel/                # 酒店相关页面
│   │   │   ├── hotel             # 酒店首页
│   │   │   ├── detail/           # 酒店详情
│   │   │   └── room_detail/      # 房间详情
│   │   ├── search/               # 搜索页
│   │   ├── order/                # 订单相关页面
│   │   │   ├── order             # 订单列表
│   │   │   ├── create/           # 订单创建
│   │   │   ├── order-create/     # 订单生成
│   │   │   ├── success/          # 下单成功
│   │   │   ├── payment-failed/   # 支付失败
│   │   │   └── room_detail/      # 订单房间详情
│   │   ├── user/                 # 个人中心
│   │   ├── register/             # 注册页
│   │   ├── payment/              # 支付页
│   │   ├── favorites/           # 收藏夹
│   │   ├── mypet/                # 我的宠物
│   │   ├── ai/                   # AI 智能助手
│   │   ├── index/                # 首页
│   │   └── service/detail/       # 服务详情
│   ├── components/               # 自定义组件
│   │   ├── agent-ui/             # AI 智能助手组件
│   │   │   ├── wd-markdown/      # Markdown 渲染
│   │   │   ├── feedback/         # 反馈组件
│   │   │   ├── collapse/         # 折叠组件
│   │   │   └── imgs/            # 图标资源
│   │   └── cloudTipModal/        # 云端提示弹窗
│   ├── utils/                    # 工具函数
│   │   ├── auth.js               # 鉴权工具
│   │   └── favorites.js          # 收藏工具
│   ├── images/                   # 图片资源(图标、banner等)
│   └── envList.js                # 环境列表
├── cloudfunctions/               # 云函数目录
│   ├── login/                    # 登录
│   ├── registerUser/             # 用户注册
│   ├── validateLogin/            # 登录验证
│   ├── searchHotels/             # 搜索酒店
│   ├── getHotelDetail/           # 获取酒店详情
│   ├── getRoomDetail/            # 获取房间详情
│   ├── getServiceDetail/         # 获取服务详情
│   ├── createOrder/              # 创建订单
│   ├── updateOrderStatus/        # 更新订单状态
│   ├── getOrders/                # 获取订单列表
│   ├── manageFavorites/          # 收藏管理
│   └── pet/                      # 宠物信息管理
├── project.config.json           # 项目配置
├── package.json                  # npm 依赖配置
├── sitemap.json                  # 小程序搜索配置
└── .gitignore                    # Git 忽略规则
```

## 云函数清单

| 云函数名 | 功能说明 |
|---------|---------|
| `login` | 用户登录,获取 openid 和用户信息 |
| `registerUser` | 新用户注册 |
| `validateLogin` | 验证登录态有效性 |
| `searchHotels` | 搜索酒店(支持关键词、位置等) |
| `getHotelDetail` | 获取酒店详情 |
| `getRoomDetail` | 获取房型详情 |
| `getServiceDetail` | 获取服务详情 |
| `createOrder` | 创建订单 |
| `updateOrderStatus` | 更新订单状态 |
| `getOrders` | 获取用户订单列表 |
| `manageFavorites` | 收藏夹增删改查 |
| `pet` | 宠物信息管理(增删改查) |

## 订单状态流转

```
pending (待入住) → checked_in (已入住) → checked_out (已退房) → completed (已完成)
      ↓
cancelled (已取消)
```

## 快速开始

### 环境要求
- 微信开发者工具(最新版)
- Node.js 14+
- 已开通微信云开发

### 安装与运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/hhl666888/PetStayCare.git
   cd PetStayCare
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **导入项目**
   - 打开微信开发者工具
   - 选择「导入项目」
   - 项目目录指向本仓库根目录
   - AppID 填写: `wxa3bd806f203b8de0`(或使用测试号)

4. **开通云开发**
   - 在微信开发者工具中开通云开发
   - 云环境ID: `cloud1-2g6m2qwge2893f2c`
   - 上传部署所有云函数(右键 `cloudfunctions` 下各文件夹 → 上传并部署)

5. **初始化数据库集合**(建议)
   - `users` - 用户信息
   - `hotels` - 酒店信息
   - `rooms` - 房型信息
   - `orders` - 订单信息
   - `favorites` - 收藏记录
   - `pets` - 宠物信息

6. **编译运行**
   - 点击开发者工具中的「编译」按钮即可预览

## 部署说明

- **前端**: 通过微信开发者工具上传审核发布
- **云函数**: 右键 `cloudfunctions` 目录下各云函数文件夹,选择「上传并部署:云端安装依赖」
- **数据库**: 在云开发控制台手动创建集合或通过云函数自动初始化

## 项目特色

1. **完整业务闭环**: 从浏览、搜索、预订、支付到订单管理,覆盖宠物寄宿全流程
2. **AI 智能助手**: 集成多模态 AI 组件,支持文本/语音/图片交互,提供智能寄宿建议
3. **云原生架构**: 基于微信云开发,无需自建服务器,开箱即用
4. **宠物信息管理**: 支持多宠物信息管理,下单时便捷选择
5. **收藏与定位**: 支持酒店收藏和基于位置的附近酒店查找

## 联系方式

- **GitHub**: [https://github.com/hhl666888/PetStayCare](https://github.com/hhl666888/PetStayCare)

## 许可证

本项目仅用于学习与交流用途。

---

> © 2026 宠宿无忧 PetStayCare. All Rights Reserved.
