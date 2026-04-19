---
name: 主页相框虚拟宠物
description: 在主页 .frame 相框元素上添加可互动的虚拟小宠物
type: project
---

# 主页相框虚拟宠物方案

## 功能目标

在主页 `<figure class="frame">` 相框元素上放置一只可互动的虚拟小宠物，增加页面趣味性。宠物能感知鼠标悬停/点击，做出反应动作（如注视、跳跃、挥手等）。

## 现有结构

```
.frame               position: relative; z-index: 1
  └── .frame-paper   width: min(460px, 100%); padding: 16px 16px 52px; polaroid 风格阴影
        ├── .frame-img    照片
        └── .frame-cap    底部说明文字（absolute 定位）
```

宠物的自然放置点：`.frame-paper` 底部边缘（caption 区域附近），或照片左/右下角。

---

## 方案调研

### 方案 A：oneko.js（光标追踪猫）

- **原理**：纯 JS，使用 CSS sprite sheet（像素猫咪），追踪鼠标光标在整个页面移动
- **体积**：~2KB（极轻量）
- **交互**：跟随光标，有走路/奔跑动画帧
- **优点**：零依赖，怀旧感强，实现简单
- **缺点**：全局行为，不局限于 `.frame`；视觉上是像素风格；移动端无光标，体验断档
- **适配性**：⭐⭐⭐（桌面端有趣，移动端完全失效）
- **参考实现**：`https://github.com/adryd325/oneko.js`

### 方案 B：CSS Sprite + 自定义交互（推荐）

- **原理**：将宠物以绝对定位叠在 `.frame` 上，使用 CSS `animation` + `steps()` 播放 sprite sheet 帧动画；JS 监听 hover/click 切换动画状态
- **体积**：0 依赖（sprite PNG ~10–30KB）
- **交互**：idle 循环 → hover 时抬头/注视 → click 时跳跃/摇尾
- **技术点**：
  - sprite sheet（可使用像素猫、柴犬等经典形象）
  - CSS `animation-name` 切换控制状态机
  - `pointer-events: auto` 仅在宠物区域响应
- **优点**：完全可控样式，无额外 JS 包，符合现有 CSS-first 风格
- **缺点**：需要自己制作或找到合适的 sprite sheet；动画复杂度受限
- **适配性**：⭐⭐⭐⭐⭐（推荐，最轻量且可定制）

### 方案 C：Rive（`@rive-app/react-canvas`）

- **原理**：Rive 是专为交互动画设计的运行时，使用状态机驱动。动画文件为 `.riv` 格式（二进制，通常 20–200KB）
- **体积**：运行时 ~40KB gzip + `.riv` 文件
- **交互**：极其丰富，支持 hover/click/拖拽触发状态转换，可做出流畅的有机动画
- **优点**：业界最佳交互动画方案，视觉效果专业；Rive 社区有免费宠物素材
- **缺点**：需要 Rive 编辑器制作或购买现成 `.riv`；React Island 增加客户端 JS
- **资源**：`rive.app/community` 有猫、狗、龙等免费宠物素材
- **适配性**：⭐⭐⭐⭐（最佳效果，但有体积代价）

### 方案 D：Lottie（`@dotlottie/react`）

- **原理**：播放 After Effects 导出的 JSON/dotLottie 动画，`LottieFiles.com` 有大量免费素材
- **体积**：运行时 ~60KB gzip + JSON 动画文件（通常 30–300KB）
- **交互**：支持 `goToAndPlay` 切换片段，但状态机不如 Rive 灵活
- **优点**：素材丰富，搜索 "virtual pet" "cat" "dog" 有大量免费选项
- **缺点**：运行时最重；交互能力弱于 Rive
- **适配性**：⭐⭐⭐（素材丰富但偏重）

### 方案 E：纯 SVG + CSS 动画

- **原理**：内联 SVG 角色，用 CSS keyframes 实现尾巴摆动、眨眼、耳朵抖动等，JS 控制 class 切换
- **体积**：几乎 0（SVG 内联）
- **交互**：hover/click 触发 CSS 动画类切换
- **优点**：最轻量，完全可定制颜色/风格以匹配博客主题（支持 dark mode）
- **缺点**：需要自己设计 SVG 角色（或从 unDraw/IconScout 找现成的）；动画不如 sprite 流畅
- **适配性**：⭐⭐⭐⭐（轻量，暗色模式自适应）

---

## 推荐方向

| 优先级 | 方案 | 理由 |
|-------|------|------|
| 🥇 首选 | **B：CSS Sprite** | 轻量、无依赖、像素宠物视觉与 polaroid 相框的复古感契合 |
| 🥈 备选 | **E：纯 SVG** | 若想要现代风格且适配 dark mode，SVG 更灵活 |
| 🥉 效果最好 | **C：Rive** | 若愿意接受 40KB+ 开销且能找到好素材 |

---

## 方案设计（以方案 B 为例）

### 宠物定位

```html
<!-- 在 .frame 内，.frame-paper 之后 -->
<div class="frame-pet" aria-hidden="true">
  <div class="pet-sprite" data-state="idle"></div>
</div>
```

```css
.frame-pet {
  position: absolute;
  bottom: 44px;   /* 叠在 caption 上方，坐在相框底边 */
  right: -12px;   /* 略微探出相框右侧 */
  width: 64px;
  height: 64px;
  pointer-events: auto;
  cursor: pointer;
  z-index: 2;
}
```

### 状态机

```
idle  ──hover──▶  look   ──mouseout──▶  idle
idle  ──click──▶  react  ──(1.2s)────▶  idle
```

### 实施方式

作为 Astro 组件实现（`FramePet.astro`），内联 sprite CSS，无需 React Island，适合 SSG。

---

## 受影响的文件

- `src/pages/index.astro` — 引入宠物组件
- `src/components/FramePet.astro`（新建）— 宠物组件
- `src/components/HomeIntroStyles.astro` — 可能需要给 `.frame` 加 `overflow: visible`
- `public/sprites/` 或内联 — sprite sheet 资源

## 潜在风险与边界情况

1. `.frame` 当前 `overflow: hidden` 未设置，但 `.frame-paper` 有 `border-radius: 0`，宠物探出不会被裁切，需确认
2. 移动端触摸：用 `touchstart` 代替 `click`，避免 300ms 延迟
3. `prefers-reduced-motion`：媒体查询关闭动画，保留静止状态
4. 宠物图片应为非关键资源，用 `loading="lazy"` 或内联 CSS background-image

## 实施步骤

1. 确认宠物视觉风格（像素猫/SVG 小狗/其他），选定或制作素材
2. 创建 `src/components/FramePet.astro`，实现 idle + hover + click 三态
3. 在 `src/pages/index.astro` 的 `.frame` 内插入组件
4. 调整 `HomeIntroStyles.astro` 确保 `.frame` 的层叠/溢出正确
5. 测试移动端触摸交互
6. 验证 `prefers-reduced-motion` 降级

---

*等待用户确认方案后开始实施。*
