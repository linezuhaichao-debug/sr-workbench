/**
 * 面板的**设计令牌** —— 唯一参数源（界面美化 P0）。
 *
 * ── 为什么要它 ──────────────────────────────────────────────────────────
 *   改之前，`client.js` 里同时存在 **11 种间距**（2/3/4/5/6/7/8/9/10/12/13/14）与
 *   **9 种字号**（10.5…17）—— "不好看"的根因不是配色，是**没有刻度**。
 *   从这一版起：**面板里不许再写裸数字**，要间距/字号/圆角就引用这里。
 *
 * ── 与宿主的关系（硬边界，别越界）────────────────────────────────────────
 *   · 颜色**一律走宿主令牌**（`--dsw-alias-*`，14 支）—— 只在 `COLOR.accent*` 破例一支蓝：
 *     宿主契约里**没有蓝**（`brand-primary` 实测是中性墨色），而链接与主按钮需要一支明确的蓝。
 *   · 圆角/字号/间距是面板自己的事，不需要宿主令牌。
 *
 * ── 怎么用 ──────────────────────────────────────────────────────────────
 *   `import { GAP, FONT, RADIUS, LINE, SHADOW, COLOR, MOTION } from "./ui/tokens.js";`
 *   然后 `style: { padding: GAP.md, fontSize: FONT.body, borderRadius: RADIUS.card }`。
 *
 * ── 口径（P0 的"零视觉变化"怎么做到的）──────────────────────────────────
 *   P0 **只把"已经落在刻度上"的字面量换成令牌**（如 `"12.5px"` → `FONT.body`），
 *   不在刻度上的（如 `"10.5px"` / `"7px"`）**原样留着**，等各自那一屏的美化批次再归位
 *   （P1 卡片墙 / P2 决策时间线 / …）。这样这一批跑完，渲染出来的字一个都不会变 ——
 *   渲染冒烟的"每遍字符数"前后一致就是判据。
 */

/** 间距刻度（8 基准）。 */
export const GAP = {
	/** 4px —— 图标与文字、标签内边距 */
	xs: "4px",
	/** 8px —— 卡片内相邻行、按钮间距 */
	sm: "8px",
	/** 12px —— 卡片内边距、网格间距 */
	md: "12px",
	/** 16px —— 区块之间 */
	lg: "16px",
	/** 24px —— 页面级 */
	xl: "24px"
};

/** 字号阶梯（五档）。含数字的元数据请配 `fontVariantNumeric`。 */
export const FONT = {
	/** 11px / 1.5 —— 元数据：件数、路径、时间、提示 */
	meta: "12px",
	/** 12.5px / 1.6 —— 正文 */
	body: "13.5px",
	/** 13px / 1.4 / 600 —— 小标题 */
	title: "14px",
	/** 15px / 1.35 / 600 —— 功能名、模块标题 */
	card: "16px",
	/** 20px / 1.3 / 700 —— 页面标题 */
	page: "21px"
};

/** 字重（与 `FONT` 搭配用）。 */
export const WEIGHT = { normal: 400, medium: 500, semibold: 600, bold: 700 };

/** 行高。 */
export const LEADING = { meta: 1.5, body: 1.6, tight: 1.35 };

/** 圆角。 */
export const RADIUS = { card: "8px", control: "5px", chip: "3px" };

/** 线宽与外框。 */
export const LINE = {
	/** 1px 分隔线与卡片边线 */
	hair: "1px",
	/** 键盘焦点环（外层 2px 半透明强调色） */
	ring: "2px"
};

/** 阴影（克制：悬停一点、浮层一点）。 */
export const SHADOW = {
	hover: "0 2px 8px #0000000f",
	float: "0 6px 20px #00000014"
};

/**
 * 颜色：**能走宿主令牌就走令牌**；只有强调蓝是明确色值。
 * `accentSoft` 用于焦点环（带透明度的同色）。
 */
export const COLOR = {
	/** 强调蓝（浅色主题） */
	accent: "#1a73e8",
	/** 强调蓝（深色主题；`light-dark()` 不可用时退回 `accent`） */
	accentDark: "#6aa9ff",
	/** 焦点环 */
	accentSoft: "#1a73e833",
	/** 白字（放在强调色实底上） */
	onAccent: "#fff"
};

/**
 * 动效预算：**只三处**，最长 1.6s。
 * 尊重 `prefers-reduced-motion`：`motionOff()` 为真时把时长归 0。
 */
export const MOTION = {
	/** 卡片悬停 */
	hoverMs: 120,
	/** 通知淡入 */
	noticeMs: 150,
	/** "正在写…" 呼吸周期 */
	breatheMs: 1600
};

/** 用户是否要求减少动效（无 `window` 时按"要减少"处理，宁少不动）。 */
export function motionOff() {
	try {
		return !(typeof window !== "undefined" && window.matchMedia && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
	} catch (e) {
		return true;
	}
}

/** 时长字符串（尊重 reduced-motion）。 */
export function ms(v) {
	return (motionOff() ? 0 : Number(v) || 0) + "ms";
}
