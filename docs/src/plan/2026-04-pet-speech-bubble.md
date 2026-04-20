---
name: 三花猫语录气泡
description: 小猫首次出现和每次落地时，头顶弹出短句气泡，1.8 s 后自动消失
type: project
---

# 三花猫语录气泡方案

## 功能目标

小猫在两个时机头顶弹出一个轻盈的文字气泡：
1. **首次出现**（appear 动画播完后）
2. **每次落地**（land 动画播完后）

气泡显示约 1.8 s 后自动淡出，文案从预制语录池随机抽取。
设计原则：**不遮主体、不抢眼、像飘过的气息**。

---

## 视觉设计

### 外形

```
        ┌──────────┐
        │  喵～    │   ← 半透明圆角气泡，极细边框
        └────┬─────┘
             │  ← 小三角指向猫头顶
           [cat]
```

- 圆角：`border-radius: 8px`
- 背景：`rgba(var(--background-rgb), 0.82)` + `backdrop-filter: blur(6px)`，使内容透过气泡隐约可见，不产生"挡住"感
- 边框：`1px solid color-mix(in oklab, var(--foreground) 10%, transparent)`，极淡
- 字号：`11px`，`color: var(--muted-foreground)`，不抢主文案
- 最大宽：`120px`，超出自动换行（但语录本身很短，基本单行）
- 阴影：`drop-shadow(0 1px 4px rgba(0,0,0,0.1))`

### 动画

```
显示：translateY(4px) opacity:0  →  translateY(0) opacity:1   (0.2 s ease-out)
消失：opacity:1  →  opacity:0                                   (0.4 s ease-in, delay 1.4 s)
```

总时长约 2 s，不打断走路或后续落地。

### 定位

气泡用 `position: absolute` 挂在 `.frame-pet` 上，随猫移动；
垂直方向固定在猫头顶上方约 `8px`，水平居中于猫身。

---

## 语录池

共 16 条，随机不重复（环形随机洗牌）。

**猫语**（8 条）
```
喵～
...zZZ
呼噜呼噜
又来啦
摸摸我
我在看你
肚子饿了
喵？
```

**博客相关**（8 条）
```
这里有好文章
随便逛逛吧
有新帖子哦
记得收藏～
欢迎回来
别光看不说话
代码写完了吗
慢慢看，不急
```

语录统一用中文，简短（≤ 7 字），无标点堆砌。

---

## 方案设计

### DOM 结构

在 `.frame-pet` 内，SVG 和静音按钮之间插入气泡元素（初始隐藏）：

```html
<div class="pet-bubble" id="pet-bubble" aria-hidden="true"></div>
```

### CSS 核心

```css
.pet-bubble {
  position: absolute;
  bottom: calc(100% + 8px);   /* 猫头顶上方 */
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;

  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid color-mix(in oklab, var(--foreground) 10%, transparent);
  background: color-mix(in oklab, var(--background) 82%, transparent);
  backdrop-filter: blur(6px);
  font-size: 11px;
  color: var(--muted-foreground);
  pointer-events: none;

  opacity: 0;
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
  transform: translateX(-50%) translateY(4px);
}

.pet-bubble.pet-bubble-show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* 小三角 */
.pet-bubble::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: color-mix(in oklab, var(--background) 82%, transparent);
}
```

### JS 逻辑

```ts
// 语录池 + 环形随机洗牌
const QUOTES = [ /* 16 条 */ ]
let shuffled = shuffle([...QUOTES])
let qi = 0
function nextQuote() {
  if (qi >= shuffled.length) { shuffled = shuffle([...QUOTES]); qi = 0 }
  return shuffled[qi++]
}

let bubbleTimer: number | undefined

function showBubble() {
  if (!bubble) return
  clearTimeout(bubbleTimer)

  bubble.textContent = nextQuote()
  bubble.classList.add('pet-bubble-show')

  // 1.4 s 后开始淡出（transition 0.4 s）
  bubbleTimer = window.setTimeout(() => {
    bubble.classList.remove('pet-bubble-show')
  }, 1400)
}
```

触发点：
- `unlock()` 末尾调用 `showBubble()`（首次出现）
- `land()` 末尾（`animationend` 回调内）调用 `showBubble()`（落地）

---

## 受影响的文件

| 文件 | 变动 |
|------|------|
| `src/components/FramePet.astro` | 新增气泡 DOM、CSS、`showBubble()` 及触发逻辑 |

---

## 潜在风险与边界情况

| 场景 | 处理 |
|------|------|
| 气泡超出相框右边界 | 猫在最右侧时气泡左移，用 `max-width: 120px` + 溢出检查或接受自然截断 |
| 气泡被 `.intro-grid { overflow: hidden }` 裁切 | 气泡在猫头顶上方，若猫在底部则向上延伸，仍在 `.frame` 内，不被裁切 |
| 走路途中收到新落地 | `clearTimeout` 重置计时，显示新语录 |
| `prefers-reduced-motion` | 跳过 transition，直接显示/隐藏（opacity 切换依然有效） |
| 连续快速点击 | `clearTimeout` 防止气泡被上一个定时器提前关闭 |

---

## 实施步骤

1. 在 `.frame-pet` 内添加 `<div class="pet-bubble" id="pet-bubble">`
2. 添加气泡 CSS（定位、背景、三角、show/hide 动画）
3. 定义语录池和 `nextQuote()` 洗牌逻辑
4. 实现 `showBubble()`，在 `unlock()` 和 land `animationend` 中调用
5. 确认气泡位置在各猫咪水平位置下不越界

---

*等待确认后开始实施。*
