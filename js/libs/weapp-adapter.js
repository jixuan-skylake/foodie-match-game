// 微信小游戏适配器 - 修复版
// 在小游戏环境中，window 已经存在且只读，不能重新赋值

// 获取系统信息
const systemInfo = wx.getSystemInfoSync();

// 导出常用的全局变量（只做引用，不重新赋值）
export const canvas = wx.createCanvas();
export const windowWidth = systemInfo.windowWidth;
export const windowHeight = systemInfo.windowHeight;
export const pixelRatio = systemInfo.pixelRatio;
