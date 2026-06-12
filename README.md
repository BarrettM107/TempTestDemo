# 网页 GBA 模拟器

一个基于 HTML5 + JavaScript 的 Game Boy Advance (GBA) 模拟器，可直接在浏览器中运行。

## 项目结构

```
gba-emulator/
├── index.html          # 前端界面（UI、演示模式、输入处理）
├── js/
│   └── emulator.js     # 模拟器核心（CPU、MMU、PPU、输入、ROM加载器）
└── README.md           # 项目说明
```

## 快速开始

1. 使用任意现代浏览器（Chrome、Firefox、Edge、Safari）打开 `index.html`
2. 点击"选择 GBA 游戏 ROM"按钮上传 `.gba` 格式的游戏文件
3. 游戏将自动加载并运行

> 注意：由于浏览器安全策略，建议通过本地 HTTP 服务器访问（如 `npx serve` 或 VS Code Live Server），直接双击打开在某些浏览器中可能受限。

## 功能特性

### 核心模拟器（emulator.js）
- **ARM7TDMI CPU**：支持 ARM 和 Thumb 两种指令集模式
- **内存管理单元（MMU）**：完整的 GBA 内存映射（BIOS、EWRAM、IWRAM、I/O、调色板、VRAM、OAM、ROM、SRAM）
- **图形处理单元（PPU）**：支持多种显示模式（Mode 0-5）、精灵渲染、颜色转换
- **输入处理**：完整的 GBA 按键映射（A、B、Select、Start、方向键、L、R）
- **ROM 加载器**：支持从文件、URL、ArrayBuffer 加载 ROM，自动解析 ROM 头部信息

### 前端界面（index.html）
- **响应式设计**：适配桌面和移动设备
- **虚拟手柄**：屏幕上的方向键、A/B 按钮、L/R 肩键、Start/Select 按钮
- **键盘支持**：完整的键盘映射
- **触摸支持**：支持移动设备触摸操作
- **演示模式**：未上传 ROM 时显示 GBA 风格的彩色动画演示画面

## 键盘映射

| 键盘按键 | GBA 按键 |
|---------|---------|
| 方向键 | 方向键 |
| Z | A |
| X | B |
| A | L |
| S | R |
| Enter | Start |
| Shift | Select |

## 演示模式

当用户未上传 ROM 文件时，模拟器会自动进入演示模式，显示：
- 流动的彩色渐变背景（GBA 风格调色板）
- 移动的星星粒子效果
- "GBA" 像素风格大标题
- 滚动提示文字
- 按键操作提示
- 支持按键触发的粒子特效

## 技术说明

- 本模拟器为教学/演示级别的简化实现，展示了 GBA 模拟器的核心架构
- 使用 Canvas 2D API 进行画面渲染
- 基于 `requestAnimationFrame` 实现平滑的渲染循环
- 模块分离设计：`index.html` 负责 UI 和演示模式，`emulator.js` 负责核心模拟逻辑

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Edge 80+
- Safari 13+

## 许可证

本项目仅供学习和研究使用。
