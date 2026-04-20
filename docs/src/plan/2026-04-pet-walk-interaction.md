---
name: 三花猫点击走动交互
description: 点击相框任意位置，小猫沿底边水平走到点击处，到达后切换回坐姿
type: project
---

# 三花猫点击走动交互方案

## 功能目标

将"点击小猫跳一下"替换为"点击相框任意位置，小猫沿底边水平走过去，到达后坐下"。
出现动画（从相框内跳出）和出现位置保持不变。

---

## 交互流程

```
用户点击 .frame 任意位置
        │
        ▼
计算目标 X（相对于 .frame 左边）
        │
        ├─ 目标在当前位置左侧 → 猫朝左走（镜像翻转）
        └─ 目标在当前位置右侧 → 猫朝右走（默认方向）
        │
        ▼
走路动画（身体上下抖动 + 尾巴略平）
        │
        ▼
到达目标（距离 / 速度 计算持续时间）
        │
        ▼
落地动画（轻微蹲压 → 回弹）
        │
        ▼
切换回坐姿（尾巴恢复摇摆，正面朝前）
```

---

## 方案设计

### 1. 定位方式切换

当前用 `right: 12px` 定位。出现动画结束后，立即转为 `left: Xpx` 等价坐标，方便后续用 JS 直接操控水平位置。

```js
// 出现动画结束后
const frameRect  = frame.getBoundingClientRect()
const petRect    = pet.getBoundingClientRect()
const currentLeft = petRect.left - frameRect.left
pet.style.right = 'auto'
pet.style.left  = currentLeft + 'px'
```

### 2. 走路速度

固定速度 **110 px/s**（可调），走动时长 = `Math.abs(dx) / 110`，上限 3 s，下限 0.15 s（防止极短距离闪烁）。

### 3. 走路动画（CSS）

走路期间给 `.frame-pet` 加 `.pet-walking` 类：

```css
/* 身体上下抖动（步频） */
.frame-pet.pet-walking .pet-svg {
  animation: pet-walk-bob 0.28s ease-in-out infinite;
}

@keyframes pet-walk-bob {
  0%, 100% { transform: translateY(0)   scaleX(var(--pet-dir, 1)); }
  50%       { transform: translateY(-5px) scaleX(var(--pet-dir, 1)); }
}
```

方向通过 CSS 自定义属性控制，JS 注入：

```js
pet.style.setProperty('--pet-dir', goingLeft ? '-1' : '1')
```

`scaleX(-1)` 翻转整个 SVG → 猫面向行进方向。

### 4. 水平位移

用 `requestAnimationFrame` 线性移动 `pet.style.left`：

```js
function walkTo(targetLeft, duration) {
  const start = parseFloat(pet.style.left)
  const delta = targetLeft - start
  const t0 = performance.now()

  function step(now) {
    const p = Math.min((now - t0) / duration, 1)
    pet.style.left = (start + delta * p) + 'px'
    if (p < 1) requestAnimationFrame(step)
    else onArrived()
  }
  requestAnimationFrame(step)
}
```

### 5. 落地动画（CSS）

到达后加 `.pet-landing` 类：

```css
.frame-pet.pet-landing .pet-svg {
  animation: pet-land 0.35s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

@keyframes pet-land {
  0%   { transform: scaleX(var(--pet-dir,1)) scaleY(0.78) translateY(4px); }
  55%  { transform: scaleX(var(--pet-dir,1)) scaleY(1.05) translateY(-2px); }
  100% { transform: scaleX(1) scaleY(1) translateY(0); }
}
```

落地结束后恢复 `--pet-dir: 1`（正面朝前）、尾巴摇摆继续。

### 6. 边界限制

```
minLeft = 4px
maxLeft = frameWidth - petWidth - 4px
```

点击坐标超出范围时夹在边界，防止猫走出相框。

### 7. 点击重定向（走到一半再收到新点击）

直接取消当前 RAF 循环，以当前 `left` 为新起点，重新计算方向和时长，开始新一段走路。

### 8. 点击事件来源

监听器挂在 `.frame`（`figure` 元素）上，而非猫本身。猫出现前屏蔽（`pointer-events: none` 已有）；点击猫自身也触发走路（猫走到自己的位置，等同于原地落地动画）。

---

## 受影响的文件

| 文件 | 变动 |
|------|------|
| `src/components/FramePet.astro` | 主要改动：定位逻辑、走路/落地动画、事件监听 |
| `src/components/HomeIntroStyles.astro` | 可能需要给 `.frame` 加 `cursor: pointer`（桌面端） |
| `src/pages/index.astro` | 无变动 |

---

## 潜在风险与边界情况

| 场景 | 处理 |
|------|------|
| 移动端（touchstart） | 用 `touchstart` + `changedTouches[0]` 获取坐标 |
| 相框宽度响应式变化 | 每次点击实时读 `frameRect`，不缓存 |
| 走路途中 `prefers-reduced-motion` | 跳过走路直接瞬移到目标位置 |
| `.frame` 内图片的 drag 触发 | `event.preventDefault()` 或忽略 `dragstart` |
| 出现动画尚未结束就点击 | `pointer-events: none` 期间点击无效，已有保障 |

---

## 实施步骤

1. 出现动画结束后，将定位从 `right` 切换为 `left` 等价值
2. 添加 `.pet-walking` / `pet-walk-bob` 走路动画（CSS + CSS 变量控制方向）
3. 添加 `.pet-landing` / `pet-land` 落地动画
4. 实现 `walkTo(targetLeft, duration)` RAF 循环，含重定向逻辑
5. 将 `click` / `touchstart` 监听器挂到 `.frame` 上，计算目标 `left` 并调用 `walkTo`
6. 边界夹值（minLeft / maxLeft）
7. `prefers-reduced-motion` 降级：跳过动画，直接 `left = target`

---

*等待确认后开始实施。*
