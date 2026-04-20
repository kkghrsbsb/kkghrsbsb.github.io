---
name: 三花猫落地喵叫音效
description: 小猫完成走动落地时用 Web Audio API 合成一声喵叫，不干扰 APlayer
type: project
---

# 三花猫落地喵叫音效方案

## 功能目标

小猫完成走动、进入落地动画的瞬间，播放一声短促的"喵～"音效，增强反馈感。要求：

1. 不打断、不暂停正在播放的 APlayer 音乐
2. 无需额外音频文件（不依赖 `/public/` 资源）
3. 移动端 iOS/Android 可用（用户已有点击手势）

---

## 技术选型

### 方案 A：`new Audio(url)` + 音频文件

- 需要将喵叫 `.mp3` 放入 `/public/sounds/`
- HTMLAudioElement 与 APlayer 各自独立，不会相互中断
- **缺点**：多一个外部资源文件；需要找/录制合适音效

### 方案 B：Web Audio API 合成（推荐）

用 `AudioContext` + `OscillatorNode` + `GainNode` 实时合成一段类似猫叫的音调曲线：

- **零依赖**，无需音频文件
- 与 APlayer 的 HTMLAudioElement 完全隔离，APlayer 不受任何影响
- iOS 需要在用户手势上下文中首次 resume AudioContext——走动交互本身是 `click`/`touchstart`，天然满足
- 可调节音高、时长、音色，做出像素风格的"8-bit 喵"或写实感的猫叫

### 为什么 Web Audio API 不会打断 APlayer

APlayer 使用的是 `HTMLAudioElement`（`<audio>` 标签），Web Audio API 的 `AudioContext` 是完全独立的音频管道。两者在浏览器音频混音器层面并行输出，互不感知。只要不调用 `APlayer.pause()` 或操作其 DOM，就不存在干扰。

---

## 方案设计（方案 B）

### 合成思路

猫叫"喵～"的音调特征：

```
频率曲线：
  0 ms  →  150 ms : 300 Hz → 900 Hz  （上升，"m→i"）
150 ms  →  350 ms : 900 Hz → 500 Hz  （下降，"ao"）
350 ms  →  500 ms : 500 Hz → 300 Hz  （尾音衰减）

响度曲线（Gain）：
  0 ms  → 20 ms  : 0 → 0.35  （快速起音）
 20 ms  → 300 ms : 0.35      （保持）
300 ms  → 500 ms : 0.35 → 0  （淡出）
```

波形：`sine`（柔和）或 `triangle`（略带像素感）

### 关键代码结构

```ts
// AudioContext 懒创建并复用
let ctx: AudioContext | null = null

function playMeow() {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()

    const t = ctx.currentTime

    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'sine'

    // 频率包络
    osc.frequency.setValueAtTime(300, t)
    osc.frequency.linearRampToValueAtTime(900, t + 0.15)
    osc.frequency.linearRampToValueAtTime(500, t + 0.35)
    osc.frequency.linearRampToValueAtTime(300, t + 0.5)

    // 响度包络
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02)
    gain.gain.setValueAtTime(0.35, t + 0.30)
    gain.gain.linearRampToValueAtTime(0, t + 0.5)

    osc.start(t)
    osc.stop(t + 0.5)
  } catch {
    // 静默失败，音效不是关键功能
  }
}
```

### 触发时机

在 `land()` 函数开头调用 `playMeow()`，与落地动画同时开始：

```ts
const land = () => {
  playMeow()                         // ← 新增
  pet.classList.remove('pet-walking')
  // ...
}
```

---

## 受影响的文件

| 文件 | 变动 |
|------|------|
| `src/components/FramePet.astro` | 新增 `playMeow()` 函数，在 `land()` 中调用 |

---

## 潜在风险与边界情况

| 场景 | 处理 |
|------|------|
| 浏览器自动播放策略 | 走动由用户点击触发，AudioContext 在手势链中，可以正常 resume |
| iOS Safari 首次点击 | 同上，点击相框 → `touchstart` → `walkTo()` → `land()` → `playMeow()`，在手势链中 |
| `prefers-reduced-motion` | 该偏好通常与视觉动画有关，不影响音效；可考虑一并静音，但没有强制要求 |
| 用户快速连续点击 | 每次落地都创建新的 Oscillator，它们独立发声后自动销毁，不会叠加累积内存 |
| 音量过大 | Gain 设为 0.35（最大值 1.0），相对较低，不会盖过背景音乐 |
| AudioContext 异常 | `try/catch` 静默失败，音效是可选增强，不影响核心走动功能 |

---

## 实施步骤

1. 在 `FramePet.astro` 的 `<script>` 中，在 `initFramePet()` 外部（模块作用域）定义 `playMeow()`
2. 在 `land()` 函数第一行调用 `playMeow()`
3. 调整 `gain.gain` 和频率参数至听感自然

---

*等待确认后开始实施。*
