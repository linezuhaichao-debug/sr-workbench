/**
 * 策划工作台 · 浏览器半侧（源码入口）—— v5 重写版。
 *
 * ★ 本文件是 tsdown 的**打包入口**，产物是 `lib/client.js`——一个形如
 *   `window.__ModuleLoader__.load({ id, factory })` 的单 bundle。
 *   改本文件后必须 `npm run build`（或开着 `npm run watch`），否则 `lib/client.js` 是旧的。
 *
 * ════════════════════════════════════════════════════════════════════════════
 * v5 的面板**只有两屏**（用户口径：只保留功能卡片和新建功能）：
 *
 *   ① 功能卡片墙 —— `features\` 下每个目录一张卡 + 一个〔＋ 新建功能〕
 *   ② 功能详情 —— 只有三个模块：**头脑风暴 / 决策记录 / 最终产物**
 *
 * v4 的其余一切（一级导航、审计面、设计台账、决策台账、定稿修订工作面、文档生成工作面、
 * 派生物与过期检测、外部交付包合入、资产索引、收件箱、V 校验清单、界面图……）**全部删除**。
 *
 * ── 新建功能做什么（v5 最大的机制变化）──────────────────────────────────────
 * v4 的面板在 Remote 层没有写能力，所以"新建"只能组装一条指令发给 agent 去建。
 * v5 用 DSH 的 `ctx.uiWorkspace.createDirectory(parent, name)`（宿主 directoryPicker 的
 * browse 后端，直接 `mkdir` 一级）**自己建**：
 *
 *     ① `features\`（没有就建）        ④ 按路径注册**专属工作区**
 *     ② `features\<主题>\`             ⑤ 在该工作区建**会话**，默认预设 =「策划模式」
 *     ③ 4 个桶：evidence / analysis / gdd / decisions
 *
 * 全程本地完成：**不发任何指令、不写任何文件内容、不经过 AI**。
 *
 * ── 两条会话（所有权凭据只有"标题 + 自己写的缓存"）──────────────────────────
 *   · 索引会话     cwd = SR 工作区根        标题 `策划工作台·索引（…）`    只读，不接指令
 *   · 功能工作会话 cwd = `features\<主题>\`  标题 `策划工作台·工作（<主题>）` **接指令**（头脑风暴四入口）
 *
 * ── 面板不做什么 ───────────────────────────────────────────────────────────
 *   · 不写任何**文件内容**（决策记录由会话里的 agent 按契约追加）；不删任何东西。
 *   · 不替定稿门背书（"最新定稿"只按文件名日期标，措辞里写清楚）。
 *   · 不假装知道：读不到就说读不到，缺桶就说缺桶。
 */

import * as React from "react";

import { decisionEntryTemplate, stampOf } from "./pure/decisions.ts";
import {
	bucketHint, buildScaffoldInstruction, checkTopicName, createDoneNotice, createPartialNotice,
	createPendingNotice, featureRootFor, manualScaffoldCommand, planNewFeature, sessionTitleFor
} from "./pure/createfeature.ts";
import { INTAKE } from "./pure/intake.ts";
import { ENTRANCES } from "./pure/analysisdoc.ts";
import { toAbs } from "./pure/path.ts";
import { relTimeOf } from "./pure/reltime.ts";
import { groupTimeline } from "./pure/timeline.ts";
import { hasBold, inlineRuns } from "./pure/richtext.ts";
import { labelLineOf } from "./pure/labels.ts";
// ★ 使用说明快照（构建期生成；面板直接读，不走网络 —— 见 tools/gen-teaching.mjs 的文件头）
import { TEACHING } from "./generated/teaching.js";
// ★ 设计令牌：间距/字号/圆角/动效的唯一参数源（面板里不许再写裸数字）
import { ALIAS as V, COLOR, FONT, GAP, LEADING, LINE, RADIUS, SHADOW } from "./ui/tokens.js";
import {
	buildConfigInstruction, CONFIG_FIELDS, pointerCandidates, POINTER_REL, validateConfigValues, workspaceMissing
} from "./pure/configentry.ts";
// ★ 官方 UI 原子库的唯一引入点（守卫式：拿不到就退回自绘控件）—— 见 `src/ui/atoms.js` 的文件头
import { HAS_PRIMITIVES, PRIMITIVES, isComponent, primitivesNote } from "./ui/atoms.js";
// ★ md 渲染器（自绘那支）：使用说明弹窗**按 md 原样渲染**；拿得到官方 MarkdownText 时优先用它
import { mdView } from "./ui/mdview.js";
import {
	ARCHIVED_CACHED_NOTE, FOREIGN_CACHE_NOTE, NO_ARCHIVE_INFO_NOTE,
	archivedFromSnapshot, configPathCandidates, indexCacheKey, indexCacheOwned, indexCacheParse,
	indexCacheSerialize, indexTitleFor, isArchivedId, mergeRows, needsFullAccess,
	normPath, permissionCommandLine, permissionPlanOf, permissionResultNote,
	pickIndexSession, pickWorkSession, rowsFromList, rowsFromStore, titleOf,
	workCacheDrop, workCacheGet, workCacheKey, workCachePut, workTitleFor
} from "./pure/sessionpick.ts";
import { planSidebarSync, sidebarSyncNeeded } from "./pure/storemerge.ts";
// ★ 面板视图记忆（上次停在哪个功能 / 哪个模块）—— 切回工作台不用重头点，见 pure/panelview.ts
import { panelModOf, panelViewKey, panelViewParse, panelViewSerialize } from "./pure/panelview.ts";
import { inspectFeatureDir, loadCreateFacts } from "./load/create.ts";
import { loadDashboard } from "./load/dashboard.ts";
import { loadFeatureDetail } from "./load/feature.ts";

const h = React.createElement;

// ════════════════════════════════════════════════════════════════════════════
// 主题令牌：一律用宿主主题变量（浅色 / 深色自动跟随，不写死颜色）
// ★ 表本体已搬进 `src/ui/tokens.js`（`ALIAS`）—— md 渲染器（ui 层）要共用同一批颜色，
//   而 ui 层不许反向 import 这个组合根。这里起个别名 `V`，下面几百处调用一个字都不用改。
// ════════════════════════════════════════════════════════════════════════════

const toneColor = (t) => (t === "ok" ? V.ok : t === "warn" ? V.warn : t === "bad" ? V.bad : t === "brand" ? V.brand : V.muted);

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
/**
 * **可点链接的蓝**（用户口径：能点的超链接就是蓝的）。
 * 不用 `--dsw-alias-brand-primary`：那支令牌在浅色主题里偏深、看着不像链接。
 * 这一支在浅色（#fff，约 4.6:1）与深色（#1e1e1e，约 4.4:1）底上都读得出来，且两边的"蓝"是一致的。
 */
const LINK = "#1a73e8";
/**
 * 主按钮的**填充蓝**（与链接同一支，一个面板只用一支蓝）。
 *
 * ★ 曾经按"用户要黑色"改成过 `--dsw-alias-brand-primary` —— 用户随后说明**并没有**要求改主按钮，
 *   于是撤回。记一笔：这类"按钮主色"的说法在中文里有歧义（圆钮图标色 / 主按钮填充 / 次按钮描边…），
 *   改之前要先问清是哪一个，别猜。
 *
 * 为什么不跟宿主走：主题里 `--dsw-alias-button-primary-fill` **就等于** `brand-primary`
 *   —— 那是**中性墨色（近黑）**，用令牌永远拿不到蓝。用户口径要蓝 ⇒ 用明确值，
 *   白字对比度约 4.6:1（AA）。
 */
const ACCENT_FILL = "#1a73e8";
/** 主按钮 hover：同一支蓝提亮一点（不依赖任何宿主令牌）。 */
const ACCENT_HOVER = "#2b7ff0";
const IN = {
	font: "inherit", fontSize: FONT.body, padding: "5px 8px", borderRadius: "4px",
	border: "1px solid " + V.line2, background: V.panel, color: V.ink, boxSizing: "border-box", width: "100%"
};
const PAGE = {
	padding: "18px 22px 40px", boxSizing: "border-box", height: "100%", overflow: "auto",
	background: V.bg, color: V.ink,
	fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontSize: FONT.title, lineHeight: 1.6
};
const PRE = {
	fontFamily: MONO, fontSize: FONT.meta, whiteSpace: "pre-wrap", wordBreak: "break-word",
	background: V.panel2, border: "1px solid " + V.line, borderRadius: "6px", padding: GAP.sm, margin: 0,
	maxHeight: "300px", overflow: "auto"
};

/**
 * **头部动作按钮的统一高度**（px）。
 *
 * 卡片墙头部（〔刷新〕〔使用说明〕）与功能详情头部（〔刷新〕〔打开会话〕）是同一套位置：
 * 都是右侧两个按钮、刷新在前、字数也一样（2 + 4）。几何也走**同一个值** ——
 * 见 `Btn` 的 `h` 说明（官方 `Button` 带 icon 时基线取图标底边，会与纯文字按钮差 3px）。
 */
const HEAD_BTN_H = 28;

// ════════════════════════════════════════════════════════════════════════════
// 小部件
// ════════════════════════════════════════════════════════════════════════════

/**
 * 状态小标签（10.5px / 1px 描边 / 3px 圆角）。
 * ★ 卡片改版时把原来那支圆角更大的 `Badge` 删了 —— 全插件只留**这一支**小标签，
 *   免得同一个东西有两套尺寸（那正是"看着不成体系"的来源）。
 */
function chip(text, color) {
	return h("span", {
		style: { fontSize: FONT.meta, color: color, border: "1px solid " + color, borderRadius: RADIUS.chip, padding: "0 5px", whiteSpace: "nowrap" }
	}, text);
}

/**
 * 按钮。`tone`: "primary" | "plain"。
 *
 * ★ **官方组件（P0）**：宿主给了 primitives 就用官方 `Button`。三档用对：
 *   · 主按钮 → `primary`，但**底色用品牌强调色** `--dsw-alias-brand-primary`（官方给插件用的那支令牌），
 *     不是 `--dsw-alias-button-primary-fill`（宿主内部那支，在浅色主题里是深色）——
 *     用户口径：深色主按钮不如品牌蓝好看。底色被内联接管后 `:hover` 类不再生效，
 *     所以 hover / active 的反馈由这里自己给（`filter: brightness`），不动其它状态。
 *   · 次按钮 → `outline`（**有可见描边**，像一个按钮；`ghost` 静止时看不出是按钮）。
 *   · `icon` 槽位传官方图标（16×16，`gap: 4px` 由官方样式负责对齐）。
 *   · 拿不到 primitives ⇒ 退回下面这套自绘，观感与行为都保持原样。
 */
function Btn(props) {
	const tone = props.tone || "plain";
	const off = !!props.off;
	/** ★ `big`：主行动按钮放大一档（用户口径：「这个按钮放大一下」—— 头脑风暴的〔交给工作会话〕）。 */
	const big = !!props.big;
	/**
	 * ★ `h`：把头部按钮的**行内几何**钉成一套 —— 同一行里必须"看着一模一样"的一组按钮都传它。
	 *
	 * 2026-10-10 用户实测：卡片墙的〔刷新〕与旁边的〔技能用法〕"高度不一样"。
	 * 量了真机截图 + 官方 `dsh-client-ui-primitives` 的 `Button.module.css` 之后，**真因不是高度**：
	 *   · 官方 `.sm` 本来就 `height: 28px` 且 `box-sizing: border-box`（描边不吃高度）；
	 *   · 两个按钮**都是 28px**，差的是**竖直位置**：〔刷新〕上边 y=77、〔技能用法〕上边 y=80（差 3px）。
	 *   · 根因是那行的 `alignItems: "baseline"`：带 `icon` 的按钮，基线取的是**图标的底边**
	 *     （图标是 replaced 元素，基线 = 其下外边距边），比纯文字按钮的**文字基线**低 ⇒
	 *     基线对齐把纯文字那个**往下推了 3px**，看着就成了"一个高一个矮"。
	 *
	 * 治法：
	 *   · `alignSelf: "center"` —— 头部动作按钮按行**居中**，绕开基线这一层（这才是那条 3px）；
	 *   · 高度显式钉成同一个值 ⇒ 官方臂 / 自绘臂、带 icon / 不带 icon，四个按钮完全一致
	 *     （自绘臂本来没有 `.sm` 那 28px，不钉就会跟官方臂差一截）。
	 * ★ 只给这一组按钮加 `alignSelf`，头部那行的 `alignItems: "baseline"` **不动** ——
	 *   「策划工作台 / 功能 N ｜ 路径」那两段不同字号的文字还得靠它压在同一条基线上。
	 */
	const hpx = props.h ? props.h + "px" : null;
	const fit = hpx
		? {
			height: hpx, minHeight: hpx, boxSizing: "border-box", alignSelf: "center",
			paddingTop: 0, paddingBottom: 0, display: "inline-flex", alignItems: "center", lineHeight: 1
		}
		: null;
	const [hover, setHover] = React.useState(false);
	if (HAS_PRIMITIVES) {
		const primary = tone === "primary";
		return h(PRIMITIVES.Button, {
			variant: primary ? "primary" : "outline",
			size: big ? "md" : "sm",
			icon: props.icon ? h(props.icon, { size: big ? 16 : 14 }) : void 0,
			disabled: off,
			title: props.title || "",
			onClick: off ? void 0 : props.onPick,
			onMouseEnter: () => setHover(true),
			onMouseLeave: () => setHover(false),
			style: Object.assign(
				primary
					? {
						background: hover && !off ? ACCENT_HOVER : ACCENT_FILL,
						color: "#fff",
						transition: "background 120ms ease"
					}
					// 次按钮：官方 `outline` 的描边是 `--dsw-alias-border-l3` 且只有 0.5px，白底上看不见 ——
					// 换成契约里的 `--dsw-alias-border-l2`（1px），这才是"看得出是按钮"
					: { border: "1px solid " + V.line2 },
				big ? { fontSize: FONT.body, padding: "6px 16px", fontWeight: 600 } : null,
				fit
			)
		}, props.label);
	}
	return h("button", {
		type: "button", disabled: off, title: props.title || "",
		onClick: off ? void 0 : props.onPick,
		style: Object.assign({
			font: "inherit", fontSize: FONT.body,
			// ★ `big` 在这一支也要放大（两条臂观感一致：拿到官方组件 / 拿不到时的自绘）
			padding: big ? "6px 16px" : "4px 11px",
			fontWeight: big ? 600 : 400,
			borderRadius: RADIUS.control,
			cursor: off ? "default" : "pointer", whiteSpace: "nowrap",
			border: "1px solid " + (tone === "primary" ? ACCENT_FILL : V.line2),
			background: tone === "primary" ? ACCENT_FILL : "transparent",
			color: tone === "primary" ? "#fff" : V.ink,
			opacity: off ? 0.45 : 1
		}, fit)
	}, props.label);
}

/**
 * **返回卡片墙**：圆形图标按钮（用户口径：「用圆形和返回箭头 SVG，跟功能标题一样大」）。
 *
 * 尺寸对齐功能标题（`FONT.page` = 21px）：直径 34px、箭头 20px —— 视觉上与标题等高。
 * 箭头优先用官方图标（它们本身就是 SVG）；官方那套里没有返回箭头时**自绘一个**——
 * 这里是唯一允许自绘的地方，理由：用户明确要"圆形 + 返回箭头"，而图标名在宿主契约里
 * 不保证存在，宁可用一个等价的自绘箭头，也不让按钮退化成纯文字。
 */
function BackBtn(props) {
	const [hover, setHover] = React.useState(false);
	const ICON = PRIMITIVES && (
		PRIMITIVES.IconArrowLeftOutlineRegular || PRIMITIVES.IconChevronLeftOutlineRegular ||
		PRIMITIVES.IconArrowBackOutlineRegular || null
	);
	const size = 34;
	return h("button", {
		key: "back", type: "button", title: "返回卡片墙", "aria-label": "返回卡片墙",
		onClick: props.onPick,
		onMouseEnter: () => setHover(true),
		onMouseLeave: () => setHover(false),
		style: {
			width: size, height: size, flex: "0 0 auto", padding: 0,
			display: "inline-flex", alignItems: "center", justifyContent: "center",
			borderRadius: "50%", cursor: "pointer",
			/**
			 * ★ 颜色按用户口径**用黑色**（`V.ink` = `--dsw-alias-label-primary`）：正常态与悬停态都不变蓝，
			 *   悬停只靠**底色**（layer-2）与**边线加深**表达 —— 蓝色留给链接与主按钮。
			 */
			border: "1px solid " + (hover ? V.ink : V.line2),
			background: hover ? "var(--dsw-alias-bg-layer-2)" : "transparent",
			color: V.ink,
			transition: "border-color 120ms ease, background 120ms ease"
		}
	}, ICON
		? h(ICON, { size: 20 })
		// 自绘箭头（24×24 视框里画一个左向箭头，线宽 2，圆头圆角）
		: h("svg", {
			width: 20, height: 20, viewBox: "0 0 24 24", fill: "none",
			stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round"
		}, [
			h("path", { key: "l", d: "M19 12H5" }),
			h("path", { key: "h", d: "M12 19l-7-7 7-7" })
		]));
}

/** 折叠区：**收起时里面的字根本不渲染**（不是拿 CSS 藏）。 */
function Fold(props) {
	const [open, setOpen] = React.useState(!!props.open);
	return h("div", { style: { marginTop: props.marginTop || "8px" } }, [
		h("button", {
			key: "h", type: "button", onClick: () => setOpen(!open),
			style: {
				font: "inherit", fontSize: FONT.meta, padding: "2px 0", border: "none",
				background: "transparent", color: V.muted, cursor: "pointer", textAlign: "left"
			}
		}, (open ? "▾ " : "▸ ") + props.label + (props.note ? "　" + props.note : "")),
		open ? h("div", { key: "b", style: { marginTop: "5px" } }, props.children) : null
	]);
}

/** 一句提示（info / ok / warn / err）。 */
function Notice(props) {
	const n = props.notice;
	if (!n) return null;
	const t = n.kind || "info";
	return h("div", {
		style: {
			border: "1px solid " + toneColor(t === "err" ? "bad" : t), borderRadius: "6px",
			padding: "7px 10px", marginBottom: "10px", fontSize: FONT.body,
			background: V.panel, color: V.ink, whiteSpace: "pre-wrap", wordBreak: "break-word"
		}
	}, [
		h("div", { key: "m" }, n.text || ""),
		n.next ? h("div", { key: "n", style: { marginTop: "3px", color: V.muted } }, n.next) : null
	]);
}

/**
 * **使用说明弹窗**（T1；面板上那个按钮 2026-10-10 由〔技能用法〕改名〔使用说明〕）。
 *
 * 内容**全部来自**包内 `skills/sr-askme/references/使用说明.md`：构建期由 `npm run gen:teaching`
 * 把它**整份**快照进 `src/generated/teaching.js`，弹窗直接 `import`。
 * （用户口径：① **纯静态的使用说明不该要"网站地址"**；② **按 md 原样渲染，尤其表格**。）
 *
 * 渲染有**两支**（观感目标一致，判据两臂都有网 —— 见 `tools/render-smoke.mjs`）：
 *   ① 宿主给了官方 `MarkdownText` ⇒ 交给它（宿主自己的 markdown 渲染器，表格/代码/引用都是它的事）；
 *   ② 拿不到 ⇒ 走自绘的 `mdView`（`src/ui/mdview.js`）。
 *
 * ★ 为什么不再按字段排版（8.0.0 之前的样子）：那时是把 SKILL.md 的教学节**解析**成
 *   steps / routes / rules / cards 四个数组再摆一遍，解析器本身就是几轮 bug 的来源；
 *   而用户要的只有一句"按 md 渲染"。现在快照里只有那份 md 的字节，排版在渲染器一处。
 */
function TeachingModal(props) {
	/**
	 * ★ **静态快照**（用户口径：这是纯静态的使用说明，不该要"网站地址"）：
	 *   内容由 `npm run gen:teaching` 在构建期从包内那个 md 生成，这里**直接 import** ——
	 *   零网络、零基址、零失败面。判据 `npm run check:teaching` 盯着"快照 == 该 md 的字节"。
	 */
	const data = TEACHING;
	const md = String((data && data.markdown) || "");
	/** 官方 markdown 渲染器（可选依赖：拿不到就自绘，绝不能因此让弹窗空白）。 */
	const MD = PRIMITIVES && isComponent(PRIMITIVES.MarkdownText) ? PRIMITIVES.MarkdownText : null;

	/** Esc 关闭（弹窗的基本礼貌）。 */
	React.useEffect(() => {
		const onKey = (e) => { if (e.key === "Escape") props.onClose(); };
		if (typeof window !== "undefined" && window.addEventListener) {
			window.addEventListener("keydown", onKey);
			return () => window.removeEventListener("keydown", onKey);
		}
		return void 0;
	}, []);

	const body = () => {
		// 静态快照：要么有正文，要么如实说它空了（既不猜、也不显示一个空壳）
		if (md.trim() === "") {
			return h("div", null, [
				h("div", { key: "a", style: { fontSize: FONT.body, color: V.warn } }, "教学正文是空的 —— 快照里没有内容。"),
				h("div", { key: "b", style: { fontSize: FONT.meta, color: V.muted } },
					"跑一次 npm run gen:teaching（来源：包内 " + String((data && data.source) || "skills/sr-askme/references/使用说明.md") + "）。")
			]);
		}
		return MD ? h(MD, { text: md, variant: "body" }) : mdView(md);
	};
	return h("div", {
		onClick: (e) => { if (e.target === e.currentTarget) props.onClose(); },   // 点遮罩关闭
		style: { position: "fixed", inset: 0, background: "#0000002e", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "9vh" }
	}, [
		h("div", {
			key: "m", role: "dialog", "aria-modal": "true", "aria-label": "SR 系列技能使用说明",
			style: {
				/**
				 * ★ 宽度（用户口径 2026-10-10：「弹窗整体拉宽一点，参考我这个 md 查看应用的显示效果」）。
				 *   820px 时 `skill 一览` 那张三列表被挤成窄条、长单元格频繁折行；1120px 下三列都舒展，
				 *   观感接近一个正常的 md 阅读器。**窄屏仍然安全**：`calc(100% - 48px)` 兜住两边留白。
				 */
				width: "min(1120px, calc(100% - 48px))", maxHeight: "78vh", display: "flex", flexDirection: "column",
				background: "var(--dsw-alias-bg-layer-1)", border: "1px solid " + V.line2, borderRadius: RADIUS.card, boxShadow: SHADOW.float
			}
		}, [
			/**
			 * ★ 头部：标题**居中**（用户口径 2026-10-10），右边是〔✕ 关闭〕。
			 *
			 * 为什么用 grid 的 `1fr auto 1fr` 而不是 flex：flex 里想居中得靠左右两个**等宽占位**，
			 * 而右格要放那个关闭按钮 ⇒ 左右天然不等宽，标题会往左偏半个按钮宽。
			 * 三列布局里两侧恒等宽，中列（标题）落在**整条头部的正中**，与按钮多宽无关。
			 * （原来这里还有一句副标题"用法都在 /sr-askme…"，用户说多余，已删 —— 它同时也兼着
			 *  那个把按钮顶到最右的 `flex: 1` 占位，改 grid 之后这个角色由第三列接手。）
			 */
			h("div", { key: "h", style: { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "baseline", gap: GAP.sm, padding: GAP.md + " " + GAP.lg + " " + GAP.sm, borderBottom: "1px solid " + V.line } }, [
				h("div", { key: "l" }),
				h("div", { key: "t", style: { fontSize: FONT.card, fontWeight: 600 } }, "使用说明"),
				h("div", { key: "r", style: { textAlign: "right" } },
					h("button", {
						key: "x", type: "button", onClick: props.onClose, title: "关闭（Esc）",
						style: { font: "inherit", fontSize: FONT.meta, color: V.muted, border: 0, background: "transparent", cursor: "pointer" }
					}, "✕ 关闭"))
			]),
			h("div", { key: "b", style: { padding: GAP.md + " " + GAP.lg, overflow: "auto" } }, body()),
			h("div", { key: "f", style: { display: "flex", alignItems: "center", gap: GAP.sm, padding: GAP.sm + " " + GAP.lg, borderTop: "1px solid " + V.line } }, [
				h("div", { key: "n", style: { fontSize: FONT.meta, color: V.idle, flex: 1 } },
					"内容来源：包内 " + String((data && data.source) || "skills/sr-askme/references/使用说明.md") + "（构建期生成快照 · npm run gen:teaching 更新）"),
				Btn({ key: "ok", label: "知道了", tone: "primary", onPick: props.onClose })
			])
		])
	]);
}

/**
 * **卡片墙的最后一张卡**：一个大大的加号 + 「新建功能」（用户口径：
 * 「新建功能改成最后一个卡片里一个大大的加号和新建功能的文本 的样式」）。
 *
 * 规格：与功能卡同尺寸（`minHeight` 132 / 自然宽 340 起）；**虚线边**（区别于实线的功能卡 ——
 * "这不是一个已有功能，是一个动作"）；加号优先用官方图标，拿不到就用全角 `＋` 当字形；
 * 键盘可达（Enter / 空格）、`role="button"`、带 title 与 aria-label。
 */
function NewCard(props) {
	const [hover, setHover] = React.useState(false);
	const [focus, setFocus] = React.useState(false);
	const off = !!props.off;
	const ICON = PRIMITIVES && PRIMITIVES.IconPlusOutlineRegular;
	const on = (hover || focus) && !off;
	return h("div", {
		role: "button", tabIndex: 0, title: "新建功能", "aria-label": "新建功能",
		onClick: off ? void 0 : props.onPick,
		onKeyDown: (e) => { if (!off && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); props.onPick(); } },
		onMouseEnter: () => setHover(true),
		onMouseLeave: () => setHover(false),
		onFocus: () => setFocus(true),
		onBlur: () => setFocus(false),
		style: {
			boxSizing: "border-box", minHeight: "132px", height: "100%", cursor: off ? "default" : "pointer",
			/**
			 * ★ **边线、底色、阴影全部与正常功能卡一致**（用户口径：「大小 边线样式都跟正常的卡片一样」）。
			 *   原来用虚线是为了"一眼看出这是动作不是功能"—— 用户否了：它就是卡片墙里的一张卡，
			 *   靠**内容**（大加号 + 新建功能）区分，不靠边线。
			 */
			border: "1px solid " + (on ? V.brand : V.line2), borderRadius: RADIUS.card,
			background: on ? "var(--dsw-alias-bg-layer-2)" : V.panel,
			display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
			gap: GAP.sm, color: on ? V.brand : V.muted, opacity: off ? 0.5 : 1,
			boxShadow: focus ? "0 0 0 " + LINE.ring + " " + COLOR.accentSoft : (on ? SHADOW.float : SHADOW.hover),
			transition: "border-color 120ms ease, background 120ms ease, color 120ms ease, box-shadow 120ms ease",
			outline: "none"
		}
	}, [
		// 加号：官方图标优先（本就是 SVG），没有就用字形 —— 字号走令牌（面板里不许有裸字号）
		ICON
			? h(ICON, { key: "i", size: 32 })
			: h("div", { key: "i", style: { fontSize: FONT.glyph, lineHeight: 1, fontWeight: 300 } }, "＋"),
		h("div", { key: "t", style: { fontSize: FONT.card, fontWeight: 600 } }, "新建功能")
	]);
}

/**
 * 一行路径。**带按钮的那条直接「打开路径」**（用户口径：想看目录就点开，别让人先复制再粘贴）。
 * 给了 `onOpen` 才有按钮 —— 没给的场合（如决策记录卡，那里已经有「打开文件」）就只是一行等宽文字，
 * 需要复制时用鼠标选中即可。
 */
function PathLine(props) {
	return h("div", { style: { display: "flex", gap: GAP.sm, alignItems: "center", fontSize: FONT.meta, color: V.muted } }, [
		h("code", { key: "c", style: { fontFamily: MONO, wordBreak: "break-all" } }, String(props.text || "")),
		typeof props.onOpen === "function"
			? h("button", {
				key: "b", type: "button", onClick: () => props.onOpen(String(props.text || "")), title: "在文件管理器 / 默认程序里打开这个路径",
				style: {
					font: "inherit", fontSize: FONT.meta, border: "1px solid " + V.line2, background: "transparent",
					/**
					 * ★ 颜色跟**左边那行路径同一个灰**（用户口径：「这个不要用蓝色，跟左边的路径一个灰就行」）。
					 *   它不是"链接"，是路径行上的一个附属动作 —— 用链接的蓝会把它抬成一等公民，
					 *   反而跟路径本身抢注意力。蓝留给真正的链接（文件名那种）。
					 */
					color: V.muted, borderRadius: "4px", padding: "0 6px", cursor: "pointer", whiteSpace: "nowrap", flex: "0 0 auto"
				}
			}, "打开路径")
			: null
	]);
}

/**
 * 模块页签（头脑风暴 / 决策记录 / 最终产物）。
 *
 * ★ P3：**优先用官方 `SegmentedTabs`** —— 键盘左右键、Home/End、`aria-selected` 都是白拿的。
 *   拿不到官方组件时退回自绘那支，并且**自己把键盘补上**（`role="tablist"` + ←/→/Home/End）。
 *
 * 契约不确定的地方两边都给：item 同时带 `value` 与 `id`；`onChange` 收到字符串或对象都认。
 */
function TabBar(props) {
	const Seg = PRIMITIVES && PRIMITIVES.SegmentedTabs;
	const textOf = (it) => it.label + (it.count === undefined ? "" : "（" + it.count + "）");
	if (Seg) {
		return h("div", { style: { marginBottom: GAP.md } },
			h(Seg, {
				items: props.items.map((it) => ({ value: it.id, id: it.id, label: textOf(it) })),
				value: props.view,
				label: "模块",
				onChange: (v) => {
					const id = typeof v === "string" ? v : (v && (v.value || v.id)) || "";
					if (id) props.onPick(id);
				}
			}));
	}
	/** 自绘那支：键盘 ←/→ 在页签间移动、Home/End 跳首尾（与官方组件的行为对齐）。 */
	const move = (from, delta) => {
		const n = props.items.length;
		const i = Math.max(0, props.items.map((x) => x.id).indexOf(from));
		const next = props.items[(((i + delta) % n) + n) % n];
		if (next) props.onPick(next.id);
	};
	return h("div", {
		role: "tablist",
		style: {
			display: "flex", gap: GAP.xs, marginBottom: GAP.md,
			borderBottom: "1px solid " + V.line, paddingBottom: GAP.sm, flexWrap: "wrap"
		}
	}, props.items.map((it) => {
		const on = props.view === it.id;
		return h("button", {
			key: it.id, type: "button", role: "tab", "aria-selected": on,
			tabIndex: on ? 0 : -1,
			onClick: () => props.onPick(it.id),
			onKeyDown: (e) => {
				if (e.key === "ArrowRight") { e.preventDefault(); move(it.id, 1); }
				else if (e.key === "ArrowLeft") { e.preventDefault(); move(it.id, -1); }
				else if (e.key === "Home") { e.preventDefault(); if (props.items[0]) props.onPick(props.items[0].id); }
				else if (e.key === "End") { e.preventDefault(); const last = props.items[props.items.length - 1]; if (last) props.onPick(last.id); }
			},
			style: {
				font: "inherit", fontSize: FONT.body, padding: "5px 12px", borderRadius: RADIUS.control, cursor: "pointer",
				border: "1px solid " + (on ? V.brand : V.line2),
				background: on ? V.brand : "transparent", color: on ? "#fff" : V.ink
			}
		}, textOf(it));
	}));
}

/** 一块内容（标题栏 + 正文）。 */
function Card(props) {
	return h("div", {
		style: { border: "1px solid " + V.line, borderRadius: RADIUS.card, background: V.panel, padding: "12px 14px", marginBottom: GAP.md }
	}, [
		props.title === undefined ? null : h("div", {
			key: "h",
			style: { display: "flex", alignItems: "baseline", gap: GAP.sm, marginBottom: GAP.sm, flexWrap: "wrap" }
		}, [
			h("div", { key: "t", style: { fontSize: FONT.title, fontWeight: 600 } }, props.title),
			h("div", { key: "n", style: { fontSize: FONT.meta, color: V.muted, flex: 1 } }, props.note || ""),
			props.actions || null
		]),
		props.children
	]);
}

/**
 * 一行文件（名字 + 注解 + 打开）。
 *
 * ★ 可点的东西一律是**蓝色**（用户口径）：宿主主题的 brand 令牌在浅色主题里偏深、
 *   看着不像链接，所以这里用一支在浅色/深色底上都读得出来的蓝，hover 加下划线。
 */
function FileRow(props) {
	const [hover, setHover] = React.useState(false);
	return h("div", {
		style: {
			display: "flex", alignItems: "baseline", gap: GAP.sm, padding: "2px 0 2px 2px",
			fontSize: FONT.body, wordBreak: "break-all", lineHeight: 1.7
		}
	}, [
		h("a", {
			key: "a", href: "#", title: props.rel,
			onMouseEnter: () => setHover(true),
			onMouseLeave: () => setHover(false),
			onClick: (e) => { e.preventDefault(); props.onOpen(toAbs(props.root, props.rel)); },
			style: { color: LINK, textDecoration: hover ? "underline" : "none", cursor: "pointer" }
		}, props.name),
		props.note ? h("span", {
			key: "n",
			style: {
				fontSize: FONT.meta, color: V.muted, whiteSpace: "nowrap",
				border: "1px solid " + V.line2, borderRadius: RADIUS.chip, padding: "0 4px"
			}
		}, props.note) : null,
		props.sub ? h("span", { key: "s", style: { fontSize: FONT.meta, color: V.idle, fontFamily: MONO } }, props.sub) : null
	]);
}

// ════════════════════════════════════════════════════════════════════════════
// ① 功能卡片墙
// ════════════════════════════════════════════════════════════════════════════

/**
 * 一张功能卡片。
 *
 * ── 这次显示优化的三件事（用户口径：卡片太素、右下大片空白没用上）────────────
 *   ① **去掉三处重复**：徽标「有成稿」、人话「有成稿 1 份 · 还没定稿」、计数「成稿 1」原来各说一遍。
 *      现在徽标**只在真有状态可说时出现**（已定稿 / 缺桶），进度交给**阶段步进器**（四个点 + 件数），
 *      计数只显示**非零项**（零的那些在步进器里已经看得见）。
 *   ② **人话留着**（`cardLineOf` 是唯一出处，界面不另写话术）—— 缺桶那种要能一眼看见。
 *   ③ **键盘可达**：`role="button"` + `tabIndex` + Enter/Space + 焦点环
 *      （原来是个纯 `div`，键盘用户根本进不去）。
 *
 * 卡片**不自己算数**：拿到什么见 `src/load/dashboard.ts` 的 `FeatureCard` 接口。
 */
const STAGES = [
	{ key: "brainstorm", label: "头脑" },
	{ key: "draft", label: "成稿" },
	{ key: "final", label: "定稿" },
	{ key: "speech", label: "宣讲" }
];

function FeatureCard(props) {
	const f = props.feature;
	const c = f.counts || {};
	const [hover, setHover] = React.useState(false);
	const [focus, setFocus] = React.useState(false);
	const warn = f.tone === "warn";
	const done = f.tone === "ok";
	const open = () => props.onOpen();

	return h("div", {
		key: f.topic,
		role: "button",
		tabIndex: 0,
		title: f.root,
		onClick: open,
		onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } },
		onMouseEnter: () => setHover(true),
		onMouseLeave: () => setHover(false),
		onFocus: () => setFocus(true),
		onBlur: () => setFocus(false),
		style: {
			// 边线用 `border-l2`（比 `l1` 实一点）—— 用户口径「现在看着没有边」
			border: "1px solid " + (warn ? V.warn : (hover || focus ? V.brand : V.line2)),
			borderRadius: RADIUS.card, background: V.panel, padding: "12px 14px", cursor: "pointer",
			display: "flex", flexDirection: "column", gap: GAP.xs, minHeight: "132px", boxSizing: "border-box",
			/** ★ 撑满外层的高度（等高靠它；块级子元素本来就撑满宽度，宽度不受影响）。 */
			height: "100%",
			/**
			 * ★ **常驻浮层阴影**（用户口径：「只做功能卡片的容器浮层阴影，现在看着没有边」）。
			 *   静息就给一层极轻的阴影 ⇒ 卡片在白底上"立得起来"，不再只靠那条 1px 边线；
			 *   悬停加重到 `SHADOW.float`，键盘聚焦时换成焦点环（阴影让位给环，不叠加）。
			 */
			boxShadow: focus ? "0 0 0 " + LINE.ring + " " + COLOR.accentSoft : (hover ? SHADOW.float : SHADOW.hover),
			transition: "border-color 120ms ease, box-shadow 120ms ease",
			outline: "none"
		}
	}, [
		h("div", { key: "t", style: { display: "flex", alignItems: "baseline", gap: GAP.sm } }, [
			h("div", { key: "n", style: { fontSize: FONT.card, fontWeight: 600, wordBreak: "break-all", flex: 1 } }, f.topic),
			warn ? chip("缺桶", V.warn) : (done ? chip("已定稿", V.ok) : null)
		]),
		// 阶段步进器：走到的实心（带件数），没走到的空心
		h("div", { key: "st", style: { display: "flex", alignItems: "center", gap: GAP.xs, margin: GAP.xs + " 0 1px", flexWrap: "wrap" } },
			STAGES.map((s, i) => {
				const n = c[s.key] || 0;
				const on = n > 0;
				return h("span", {
					key: s.key, title: s.label + "：" + n + " 件",
					style: { display: "inline-flex", alignItems: "center", gap: "5px" }
				}, [
					i === 0 ? null : h("span", {
						key: "ln", style: { width: "10px", height: "1px", background: (c[STAGES[i - 1].key] || 0) > 0 ? ACCENT_FILL : V.line2 }
					}),
					h("span", {
						key: "dot",
						style: {
							width: "7px", height: "7px", borderRadius: "50%", flex: "0 0 auto",
							background: on ? ACCENT_FILL : "transparent",
							border: "1px solid " + (on ? ACCENT_FILL : V.line2)
						}
					}),
					h("span", {
						key: "lb",
					style: { fontSize: FONT.meta, color: on ? V.ink : V.idle, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }
					}, s.label + (on ? " " + n : ""))
				]);
			})),
		h("div", { key: "l", style: { fontSize: FONT.meta, color: warn ? V.warn : V.muted } }, f.line),
		["decisions", "evidence", "other"].some((k) => (c[k] || 0) > 0)
			? h("div", {
				key: "c",
				style: { display: "flex", gap: GAP.sm, flexWrap: "wrap", fontSize: FONT.meta, color: V.muted, fontVariantNumeric: "tabular-nums" }
			},
				["decisions", "evidence", "other"].filter((k) => (c[k] || 0) > 0)
					.map((k) => h("span", { key: k },
						(k === "decisions" ? "决策" : k === "evidence" ? "证据" : "其它") + " " + c[k])))
			: null,
		h("div", {
			key: "f",
			style: {
				display: "flex", alignItems: "baseline", gap: GAP.sm, fontSize: FONT.meta, color: V.idle,
				marginTop: "auto", paddingTop: "6px", fontVariantNumeric: "tabular-nums"
			}
		}, [
			// 相对时间（"3 分钟前"）；解析不出来就退回原始时间戳，绝不编
			h("span", { key: "d", title: f.lastDecisionAt || "", style: { fontFamily: MONO, flex: 1, wordBreak: "break-all" } },
				f.lastDecisionAt ? "最近决策 " + (relTimeOf(f.lastDecisionAt) || f.lastDecisionAt) : "还没有决策"),
			hover || focus ? h("span", { key: "o", style: { color: ACCENT_FILL, whiteSpace: "nowrap" } }, "打开 ›") : null
		])
	]);
}

/**
 * **配置向导**（无本机配置时取代卡片墙）。
 *
 * 为什么要有它：同事拿到插件、或自己重装之后，本机没有 `config.local.json` 是**正常状态**，
 * 不该只丢一句"先跑 /sr-askme"。这里把四个字段摆出来，能点系统目录选择框就别手打路径。
 *
 * ★ 面板**不写盘**（整块面板的纪律）：〔保存并验证〕只是把值**交给一条会话**去写，
 *   写完面板**回读核对**（读到 + 必填齐才算成功）。会话写配置时还会把"配置在哪"写进
 *   `<工作区根>\.dsh\sr-workbench.path`（指针文件）—— 浏览器里拿不到家目录，
 *   面板靠这个相对路径认路。
 */
function ConfigWizard(props) {
	const v = props.values || {};
	const issues = props.issues || [];
	const issueOf = (k) => (issues.filter((i) => i.key === k)[0] || {}).message || "";
	const field = (f) => h("div", { key: f.key, style: { marginBottom: "10px" } }, [
		h("div", { key: "l", style: { display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "3px" } }, [
			h("span", { key: "n", style: { fontSize: FONT.body, fontWeight: 600 } }, f.label),
			f.required ? h("span", { key: "r", style: { fontSize: FONT.meta, color: V.bad } }, "必填")
				: h("span", { key: "r", style: { fontSize: FONT.meta, color: V.idle } }, "选填"),
			h("span", { key: "h", style: { fontSize: FONT.meta, color: V.muted, flex: 1 } }, f.hint)
		]),
		h("div", { key: "i", style: { display: "flex", gap: "6px" } }, [
			h("input", {
				key: "in", type: "text", value: String(v[f.key] || ""), placeholder: "D:\\...",
				onChange: (e) => props.onField(f.key, e.target.value),
				style: {
					flex: 1, minWidth: 0, font: "inherit", fontSize: FONT.body, padding: "5px 8px", borderRadius: RADIUS.control,
					border: "1px solid " + (issueOf(f.key) ? V.bad : V.line2), background: "transparent", color: V.ink
				}
			}),
			Btn({ key: "p", label: "选择…", onPick: () => props.onPick(f.key), off: props.picking })
		]),
		issueOf(f.key) ? h("div", { key: "e", style: { fontSize: FONT.meta, color: V.bad, marginTop: "3px" } }, issueOf(f.key)) : null
	]);

	return h(Card, { key: "wiz", title: "先配一下本机路径", note: "这台机器还没有配置 —— 同事第一次用、或你重装之后都是这样" }, [
		(props.notice ? h(Notice, { key: "n", notice: props.notice }) : null),
		h("div", { key: "why", style: { fontSize: FONT.meta, color: V.muted, marginBottom: "10px" } },
			"配置是**本机私有**的，落 " + "%USERPROFILE%\\.dsh\\sr-workbench\\config.local.json（不在技能目录里 —— 插件升一次级就没了）。" +
			"面板自己不写盘：点〔保存并验证〕会把这份值**交给一条会话去写**，写完面板回读核对。"),
		...CONFIG_FIELDS.map(field),
		h("div", { key: "act", style: { display: "flex", gap: GAP.sm, alignItems: "center", marginTop: GAP.xs } }, [
			Btn({ key: "s", label: props.saving ? "正在写…" : "保存并验证", tone: "primary", onPick: props.onSave, off: props.saving }),
			Btn({ key: "a", label: "在会话里问答配置（/sr-askme）", onPick: props.onAskme, off: props.saving }),
			h("span", { key: "t", style: { fontSize: FONT.meta, color: V.idle, flex: 1 } },
				props.saving ? "等会话写完（最长约 60 秒），面板会自己回读核对。" : "")
		]),
		h(Fold, { key: "dbg", label: "面板找过哪些路径", note: "（找不到配置时看这个）" },
			h("pre", { style: PRE }, (props.triedPaths || []).join("\n") + "\n" +
				"（还会读每个工作区根下的 " + POINTER_REL + " 指针，看配置被写到哪了）"))
	]);
}

/** 〔＋ 新建功能〕表单：输名字 → 建目录 + 4 桶 + 工作区 + 会话（策划模式）。 */
function CreateForm(props) {
	const topic = props.topic || "";
	const check = topic.trim() === "" ? null : checkTopicName(topic);
	const plan = props.plan || null;
	const busy = !!props.busy;
	const off = busy || !!(check && !check.ok) || !!(plan && !plan.ok);
	return h(Card, {
		title: "新建功能",
		note: "建目录 + 4 个桶 + 专属工作区 + 工作会话（策划模式）—— 全部本地完成，不发指令",
		actions: Btn({ label: "取消", onPick: props.onCancel, off: busy })
	}, [
		h("div", { key: "i", style: { display: "flex", gap: GAP.sm, alignItems: "center", flexWrap: "wrap" } }, [
			h("input", {
				key: "t", style: Object.assign({}, IN, { maxWidth: "320px" }), placeholder: "主题名，例如：联盟讨伐",
				value: topic, disabled: busy, autoFocus: true,
				onChange: (e) => props.onTopic(e.target.value),
				onKeyDown: (e) => { if (e.key === "Enter" && !off) props.onSubmit(); }
			}),
			Btn({ label: busy ? "正在建…" : "建立", tone: "primary", off: off, onPick: props.onSubmit })
		]),
		check && !check.ok ? h("div", { key: "c", style: { marginTop: "7px", fontSize: FONT.body, color: V.warn } }, [
			h("div", { key: "m" }, check.message),
			h("div", { key: "n", style: { color: V.muted } }, check.next)
		]) : null,
		plan && !plan.ok ? h("div", { key: "p", style: { marginTop: "7px", fontSize: FONT.body, color: V.warn } }, [
			h("div", { key: "m" }, plan.message),
			h("div", { key: "n", style: { color: V.muted } }, plan.next)
		]) : null,
		plan && plan.ok ? h("div", { key: "ok", style: { marginTop: "9px" } }, [
			h("div", { key: "r", style: { fontSize: FONT.meta, color: V.muted } }, "将建立："),
			h("code", { key: "c", style: { fontFamily: MONO, fontSize: FONT.body, wordBreak: "break-all" } }, plan.root + "\\"),
			h("div", { key: "b", style: { marginTop: "5px" } }, plan.buckets.map((b) => h("div", {
				key: b, style: { fontFamily: MONO, fontSize: FONT.meta, color: V.muted }
			}, b + "\\　—　" + bucketHint(b))))
		]) : null,
		h("div", { key: "h", style: { marginTop: "10px", fontSize: FONT.meta, color: V.muted } },
			"面板只建【目录】与【会话】；决策记录.md 由会话里的 agent 在这个功能第一次做决策时按统一格式创建（格式见功能详情 › 决策记录）。")
	]);
}

function Dashboard(props) {
	const d = props.dash || {};
	const feats = d.features || [];
	const nothing = feats.length === 0 && props.phase !== "loading";
	/** ★ 使用说明弹窗的开合状态（T1）。放在 Dashboard 里 ⇒ 不动 Panel 的 useState 位置（渲染冒烟的状态脚本按位置喂）。 */
	const [teachOpen, setTeachOpen] = React.useState(false);
	return h("div", null, [
		/**
		 * ★ **吸顶头部**（P1）：标题 + 计数 + 两个动作固定在上边。
		 *
		 * ★ 写法有讲究（第一版写错，用户实测："卡牌被切了"）：
		 *   ① **不要用负上边距** —— 负 margin 会把后面的网格一起往上拉 18px，卡片就被头部盖住了；
		 *      只用负**左右**外边距（横向不参与纵向流布局），让底色铺满整宽；
		 *   ② 用 `top: -18px` 把"被钉住"的位置抬到滚动口之上 18px —— 正好是它的上内边距，
		 *      吸顶时文字仍贴顶可见，底色也不留缝；未吸顶时它在流里的位置与原来完全一致。
		 *   底色用页面底（宿主令牌 bg-base）：它压在滚动内容之上，不能半透明。
		 */
		h("div", {
			key: "top",
			style: {
				position: "sticky", top: "-18px", zIndex: 5,
				display: "flex", alignItems: "baseline", gap: GAP.sm, flexWrap: "wrap",
				margin: "0 -22px " + GAP.sm, padding: "18px 22px " + GAP.sm,
				background: "var(--dsw-alias-bg-base)", borderBottom: "1px solid " + V.line
			}
		}, [
			h("div", { key: "t", style: { fontSize: FONT.page, fontWeight: 700, lineHeight: LEADING.tight } }, "策划工作台"),
			h("div", {
				key: "n",
				style: { fontSize: FONT.body, color: V.muted, fontVariantNumeric: "tabular-nums" }
			}, "功能 " + feats.length + (d.srWs ? "　｜　" + d.srWs : "")),
			h("div", { key: "s", style: { flex: 1 } }),
			Btn({ key: "r", label: "刷新", h: HEAD_BTN_H, icon: PRIMITIVES && PRIMITIVES.IconRefreshOutlineRegular, onPick: props.onRefresh, off: props.phase === "loading" }),
			// ★ 〔使用说明〕（T1；原名〔技能用法〕—— 用户口径 2026-10-10：「改名 使用说明」）：
			//   弹出 SR 系列技能的工作流程说明，内容来自包内 askme 素材
			Btn({ key: "t", label: "使用说明", h: HEAD_BTN_H, onPick: () => setTeachOpen(true) })
			// ★ 这里的〔＋ 新建功能〕按钮**挪到卡片墙最后一张卡**了（用户口径：
			//   「新建功能改成最后一个卡片里一个大大的加号和新建功能的文本 的样式」）。
		]),
		/**
		 * ★ 原来这里有一句「工作台只做三件事：看功能卡片 · 新建功能 · 进去看三个模块…」——
		 *   用户口径：**去掉**（页签上已经写着三个模块、按钮上已经写着两个动作，再讲一遍是占位置）。
		 *   那条"它不发指令、不写文件内容、不替你拍板"的边界仍在别处明说：README 与操作文档里各有一份。
		 */
		h(Notice, { key: "n", notice: props.notice }),
		props.newOpen ? h(CreateForm, {
			key: "new", topic: props.newTopic, plan: props.plan, busy: props.busy,
			onTopic: props.onTopic, onSubmit: props.onSubmit, onCancel: props.onCancel
		}) : null,
		props.phase === "loading" && feats.length === 0
			? h("div", { key: "l", style: { color: V.muted, fontSize: FONT.body } }, "正在读工作区…")
			: null,
		nothing ? h("div", {
			key: "e",
			style: { border: "1px dashed " + V.line2, borderRadius: RADIUS.card, padding: GAP.xl, textAlign: "center", color: V.muted }
		}, [
			h("div", { key: "a" }, "还没有功能。"),
			// ★ 按钮已经挪到卡片墙上（最后一张卡），文案跟着改，别再指向"右上角"
			h("div", { key: "b", style: { marginTop: GAP.xs, fontSize: FONT.body } }, "点下面那张〔＋ 新建功能〕建第一个。")
		]) : null,
		h("div", {
			key: "g",
			/**
			 * ★ 用户口径（2026-10-09，第三次修正）：**卡片不拉伸，按位置排开、中间不留空**。
			 *   历史：① `auto-fill` 网格 ⇒ 卡片只占左边几格、右边空一大片（被否）；
			 *        ② `auto-fit` 网格 ⇒ 空轨道塌掉，但卡片缩在各自格子的左边 ⇒ **中间一大片空**（被否）；
			 *        ③ 撑满格子 ⇒ 卡片被拉宽（被否："我不是让卡片自适应宽度"）。
			 *   现在：**flex 换行 + 自然宽度**（卡片 340px 起，窄屏可缩）——
			 *   卡片紧挨着排、行满了才换行，中间不再有空档；宽度不跟着面板膨胀。
			 */
			// 不写 alignItems ⇒ 默认 `stretch`：同一行的卡**等高**（新建卡内容少，否则会矮一截）
			style: { display: "flex", flexWrap: "wrap", gap: GAP.md, marginTop: GAP.sm }
		}, feats.map((f) => h("div", {
			key: f.topic,
			/**
			 * 卡片**自然宽度**：340px 起，面板窄时可缩；上限 520px 免得两三个功能被拉成一条。
			 * `display: flex` 是为了让里面的卡**跟着行高撑满**（等高就靠它）。
			 */
			style: { flex: "0 1 340px", minWidth: 0, maxWidth: "520px" }
		},
		h(FeatureCard, { feature: f, onOpen: () => props.onOpen(f.topic) }))).concat([
			/** ★ 卡片墙的**最后一张卡**就是〔＋ 新建功能〕（用户口径）。 */
			h("div", { key: "__new", style: { flex: "0 1 340px", minWidth: 0, maxWidth: "520px" } },
				h(NewCard, { onPick: props.onNew, off: props.newOpen }))
		])),
		/**
		 * ★ **UI 自我报告**：只在**拿不到宿主组件库**时出现 —— 那时界面用的是自绘控件，
		 *   观感与宿主不一致，得让你知道为什么。拿得到就一个字都不多（不占位置）。
		 */
		HAS_PRIMITIVES ? null : h("div", {
			key: "__ui", style: { fontSize: FONT.meta, color: V.idle, marginTop: GAP.md }
		}, primitivesNote()),
		// ★ 使用说明弹窗（T1）：只在打开时挂载 ⇒ 关闭即卸载，Esc 监听也跟着卸掉
		teachOpen ? h(TeachingModal, { key: "__teach", onClose: () => setTeachOpen(false) }) : null
	]);
}

// ════════════════════════════════════════════════════════════════════════════
// ② 模块一 · 头脑风暴（**沿用 v4 的四入口**）
// ════════════════════════════════════════════════════════════════════════════

const ENT = {};
for (const e of ENTRANCES) ENT[e.id] = e;

/** 每个入口的表单字段（**唯一出处**：`ENTRANCES` 的 `prereq` 决定要什么）。 */
const FIELDS = {
	analysis: [
		{ k: "materials", label: "素材（目录 / 文件路径 / 链接，一行一个）", lines: 3, mono: true },
		{ k: "note", label: "分析目标（可空）", lines: 2 }
	],
	concept: [
		{ k: "seed", label: "一句话创意", lines: 2 },
		{ k: "materials", label: "参考素材（可空，一行一个路径 / 链接）", lines: 2, mono: true }
	],
	legacy: [
		{ k: "materials", label: "旧文档（目录或文件路径，一行一个）", lines: 3, mono: true },
		{ k: "note", label: "补充说明（可空）", lines: 2 }
	],
	humannote: [
		{ k: "title", label: "标题", lines: 1 },
		{ k: "quote", label: "原话（逐字保留）", lines: 3, mono: true },
		{ k: "bounds", label: "边界（可空）", lines: 2 },
		{ k: "landing", label: "落点（可空，条目引用，如 §4 R2 / §5 UI-M1 UE2）", lines: 1 }
	]
};

/** 表单 → `buildBrainstormInstruction` 的输入（**字段名映射只有这一处**）。 */
function inputOf(kind, form) {
	const f = form || {};
	const mats = INTAKE.parseMaterials(f.materials || "");
	if (kind === "concept") return { materials: mats, note: f.seed || "" };
	if (kind === "humannote") return { title: f.title || "", quote: f.quote || "", bounds: f.bounds || "", landing: f.landing || "" };
	return { materials: mats, note: f.note || "" };
}

function BrainstormModule(props) {
	const d = props.detail;
	/** `loadBrainstorm` 的 `groups` 就是 `groupAnalyses` 的结论：`{ entries, other, counts, total }`。 */
	const b = props.detail.brainstorm || {};
	const g = b.groups || { entries: [], other: [], counts: {}, total: 0 };
	const [pick, setPick] = React.useState("analysis");
	const [form, setForm] = React.useState({});
	const setField = (k, v) => setForm(Object.assign({}, form, { [k]: v }));

	const preview = React.useMemo(() => {
		try {
			return INTAKE.buildBrainstormInstruction(pick, Object.assign(
				{ root: d.root, topic: d.topic, date: todayCompact() }, inputOf(pick, form)));
		} catch (e) {
			return { instruction: "", blocked: "指令组装失败：" + String((e && e.message) || e), next: "" };
		}
	}, [pick, form, d.root, d.topic]);

	const counts = g.counts || {};
	return h("div", null, [
		h(Notice, { key: "n", notice: props.notice }),
		h(Card, {
			key: "entry",
			/**
			 * ★ 原来这里挂着那句「没有先后，想走哪条走哪条 —— 指令发给这个功能的工作会话
			 *   （cwd = 功能目录），产出落 analysis\」—— 用户口径：**去掉**。
			 *   四张入口卡各自写着"跑什么 / 需要什么"，"发给哪条会话、产出落哪"是**实现细节**，
			 *   不必每次占一行（要看逐字指令时下面就有〔看将要发出去的指令〕）。
			 */
			title: "四个入口"
		}, [
			h("div", {
				key: "cards",
				style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(214px, 1fr))", gap: GAP.sm, marginBottom: "10px" }
			}, ENTRANCES.map((e) => h("div", {
				key: e.id, onClick: () => setPick(e.id),
				style: {
					border: "1px solid " + (pick === e.id ? V.brand : V.line), borderRadius: "7px",
					padding: "8px 10px", cursor: "pointer", background: pick === e.id ? V.panel2 : "transparent"
				}
			}, [
				h("div", { key: "t", style: { fontWeight: 600, fontSize: FONT.body } }, e.label),
				h("div", { key: "h", style: { fontSize: FONT.meta, color: V.muted } }, e.hint),
				h("div", { key: "n", style: { fontSize: FONT.meta, color: V.muted, marginTop: "3px" } }, "需要：" + e.needs),
				h("div", { key: "c", style: { fontSize: FONT.meta, marginTop: "3px", color: V.muted } }, "已有产物 " + (counts[e.id] || 0) + " 件")
			]))),
			(FIELDS[pick] || []).map((f) => h("div", { key: f.k, style: { marginBottom: "7px" } }, [
				h("div", { key: "l", style: { fontSize: FONT.meta, color: V.muted, marginBottom: "3px" } }, f.label),
				h("textarea", {
					key: "i", rows: f.lines,
					style: Object.assign({}, IN, { resize: "vertical", fontFamily: f.mono ? MONO : "inherit" }),
					value: form[f.k] || "", onChange: (ev) => setField(f.k, ev.target.value)
				})
			])),
			preview.blocked ? h("div", { key: "b", style: { fontSize: FONT.body, color: V.warn, marginBottom: "7px" } }, [
				h("div", { key: "m" }, preview.blocked),
				h("div", { key: "n", style: { color: V.muted } }, preview.next)
			]) : null,
			h("div", { key: "a", style: { display: "flex", gap: GAP.sm, alignItems: "center", flexWrap: "wrap" } }, [
				Btn({ key: "s", label: props.sending ? "正在发…" : "交给工作会话", tone: "primary", big: true, off: !!preview.blocked || props.sending, onPick: () => props.onSend(preview.instruction) }),
				h("span", { key: "n", style: { fontSize: FONT.meta, color: V.muted } }, props.sessionNote || "")
			]),
			h(Fold, { key: "p", label: "看将要发出去的指令", note: "（逐字就是发出去的那一份）" },
				h("pre", { style: PRE }, preview.instruction || "（还没填够 —— 上面那句说明了缺什么）"))
		]),
		/**
		 * ★ 这一段的标题与说明**都去掉了**（用户口径：先说「这句话去掉」，接着说「已有的分析结论 也删了」）。
		 *   留下的就是那张列表本身：分组标题（`竞品分析（4）`）+ 蓝色文件名。
		 *   ★ 去掉的只是**标题**，外面那层卡片容器留着（它给列表一个边界，不然会跟上面的输入区糊在一起）。
		 */
		h(Card, { key: "have" },
			(g.total || 0) === 0
				? h("div", { style: { color: V.muted, fontSize: FONT.body } }, "analysis\\ 还是空的 —— 上面四个入口任选一个开始。")
				: h("div", null, (g.entries || []).map((en) => h("div", { key: en.id, style: { marginBottom: "10px" } }, [
					h("div", { key: "h", style: { fontSize: FONT.body, fontWeight: 600 } }, en.label + "（" + en.count + "）"),
					en.count === 0
						? h("div", { key: "e", style: { fontSize: FONT.meta, color: V.muted } }, "这一路还没走过")
						: h("div", { key: "l" }, en.files.map((f) => h(FileRow, {
							key: f.rel, name: f.name, rel: f.rel, root: d.root, onOpen: props.onOpen
						})))
				])).concat((g.other || []).length ? [
					h("div", { key: "__other", style: { marginBottom: "10px" } }, [
						h("div", { key: "h", style: { fontSize: FONT.body, fontWeight: 600 } }, "其他 / 来源未知（" + g.other.length + "）"),
						h("div", { key: "l" }, g.other.map((f) => h(FileRow, { key: f.rel, name: f.name, rel: f.rel, root: d.root, onOpen: props.onOpen })))
					])
				] : []))),
		((b.legacy || []).length || (b.humannote || []).length || (b.unreadable || []).length)
			? h(Card, { key: "fmt", title: "固定格式的两类产物", note: "旧文档分析（四段固定章节）· 人工补充（原话与结论并排）" }, [
				(b.legacy || []).map((x) => h("div", { key: "L" + x.rel, style: { marginBottom: "6px" } }, [
					h("div", { key: "t", style: { fontSize: FONT.body, fontWeight: 600 } }, "旧文档分析：" + x.name),
					(x.missing || []).length ? h("div", { key: "m", style: { fontSize: FONT.meta, color: V.warn } }, "缺固定章节：" + x.missing.join("、")) : null,
					(x.extra || []).length ? h("div", { key: "e", style: { fontSize: FONT.meta, color: V.muted } }, "多出来的章节：" + x.extra.map((s) => s.title).join("、")) : null
				])),
				(b.humannote || []).map((x) => h("div", { key: "H" + x.rel, style: { marginBottom: "6px" } }, [
					h("div", { key: "t", style: { fontSize: FONT.body, fontWeight: 600 } }, "人工补充：" + x.name),
					h("div", { key: "q", style: { fontSize: FONT.meta, color: V.muted, whiteSpace: "pre-wrap" } },
						x.quote && x.quote.found ? x.quote.raw : "（没有 `> 原话：…` 那一行）"),
					(x.missing || []).length ? h("div", { key: "m", style: { fontSize: FONT.meta, color: V.warn } }, "缺固定章节：" + x.missing.join("、")) : null
				])),
				(b.unreadable || []).length
					? h("div", { key: "u", style: { fontSize: FONT.meta, color: V.warn } },
						"读不动的文件：" + b.unreadable.map((u) => u.name + "（" + u.why + "）").join("；"))
					: null
			])
			: null,
		(b.notes || []).length
			? h("div", { key: "notes", style: { fontSize: FONT.meta, color: V.muted } }, b.notes.map((s, i) => h("div", { key: i }, "· " + s)))
			: null
	]);
}

// ════════════════════════════════════════════════════════════════════════════
// ③ 模块二 · 决策记录（把那一份文件读成人能看的时间线）
// ════════════════════════════════════════════════════════════════════════════

/**
 * 正文 → 渲染行（不改变原文，只决定怎么显示）。
 *
 * ★ 「标签：内容」的识别在 `pure/labels.ts`（有 4 条用例）—— 那里的匹配**宽**得多：
 *   容忍前导项目符号、标签加粗/下划线、标签与冒号之间夹注释（`**影响**（DEF-002）：…`）。
 *   这一段曾经写在面板里且只认"标签紧跟冒号"，结果真实日志里有一条没被认出、
 *   退化成普通段落 —— 用户看到的就是"这条的影响为什么不显示标签"。
 */
function bodyParts(body) {
	const out = [];
	for (const line of String(body || "").split(/\r?\n/)) {
		const lab = labelLineOf(line);
		if (lab !== null) { out.push({ kind: "label", label: lab.label, text: lab.text }); continue; }
		if (/^\s*[-*]\s+/.test(line)) { out.push({ kind: "li", text: line.replace(/^\s*[-*]\s+/, "") }); continue; }
		if (line.trim() === "") { out.push({ kind: "gap" }); continue; }
		out.push({ kind: "p", text: line });
	}
	return out;
}

/**
 * 行内渲染：把 `**加粗**` 渲染成真粗体（用户口径：原样显示星号很难读）。
 *
 * 解析在 `pure/richtext.ts`（有 7 条用例，含"标记之外一个字都不许吞"）。
 * 只有真出现加粗时才建数组，普通文字走原样 —— 少建节点。
 */
function rich(text) {
	if (!hasBold(text)) return text;
	return inlineRuns(text).map((r, i) => r.bold
		? h("strong", { key: i, style: { fontWeight: 600 } }, r.text)
		: h("span", { key: i }, r.text));
}

/**
 * 标签列的宽度：装得下小标签（2 字 + 内边距 + 边框 ≈ 43px）再加一点呼吸。
 * 原来是 98px —— 用户实测「间隙还是太大」，那一半是空档。
 */
const LABEL_COL = "56px";

/**
 * 一条决策（P2 时间线形态）。
 *
 * 改之前是"一大片文字"：时间、第几条、正文混在一行行里，靠 `决策/依据/影响` 小标签区分。
 * 现在：
 *   · 左侧 2px 时间轴 + 7px 圆点（**最新一条用强调色**，其余用边线色）；
 *   · 头部一行：时间（等宽数字）+ 第 N 条 + 标题；
 *   · 正文：`决策 / 依据 / 影响` 用**固定宽度的标签列**（LABEL_COL）左对齐，内容右边对齐成一条线；
 *   · `content-visibility: auto` —— 几百条时只渲染视口附近的（长列表不卡）。
 */
function DecisionEntry(props) {
	const e = props.entry;
	const first = !!props.first;
	return h("div", {
		style: {
			position: "relative", borderLeft: "2px solid " + V.line2, paddingLeft: GAP.md,
			/**
			 * ★ **不要加 `content-visibility: auto`**（加过，用户实测："中间为什么会有这么大空隙"）。
			 *   它配合 `containIntrinsicSize` 会给"被跳过渲染"的元素一个**预估高度占位**，
			 *   于是条目中间出现一大块空白。这个优化不值得换一个视觉缺陷：
			 *   决策记录顶多几百条，直接渲染完全够用。
			 */
			paddingBottom: GAP.sm
		}
	}, [
		h("div", {
			key: "dot",
			style: {
				position: "absolute", left: "-5px", top: "6px", width: "7px", height: "7px", borderRadius: "50%",
				background: first ? COLOR.accent : V.line2
			}
		}),
		h("div", { key: "t", style: { display: "flex", alignItems: "baseline", gap: GAP.sm, flexWrap: "wrap" } }, [
			h("span", {
				key: "a",
				style: { fontFamily: MONO, fontSize: FONT.meta, color: V.ink, fontVariantNumeric: "tabular-nums" }
			}, e.at || "（没有时间戳）"),
			h("span", { key: "n", style: { fontSize: FONT.meta, color: V.idle, fontVariantNumeric: "tabular-nums" } }, "第 " + e.index + " 条"),
			e.title ? h("span", { key: "x", style: { fontSize: FONT.meta, color: V.muted } }, "· " + e.title) : null
		]),
		h("div", { key: "b", style: { marginTop: GAP.xs, lineHeight: LEADING.loose } }, bodyParts(e.body).map((p, i) => {
			if (p.kind === "gap") return h("div", { key: i, style: { height: GAP.xs } });
			if (p.kind === "li") {
				return h("div", { key: i, style: { fontSize: FONT.body, display: "flex", gap: GAP.sm, alignItems: "baseline" } }, [
					h("span", { key: "s", style: { flex: "0 0 " + LABEL_COL, color: V.idle } }, "·"),
					h("span", { key: "t", style: { flex: 1, minWidth: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, rich(p.text))
				]);
			}
			if (p.kind === "label") {
				return h("div", {
					key: i,
					style: { fontSize: FONT.body, display: "flex", gap: GAP.sm, alignItems: "baseline" }
				}, [
					/**
					 * ★ 标签列：**外面是固定宽度的列（LABEL_COL）**，里面是小标签。
					 *   · 列宽固定 ⇒ 三行左对齐、内容右边也对齐；
					 *   · 三个标签**样式完全一致**（用户口径：原来"决策"加重、"依据/影响"不加重，看着不齐）。
					 */
					h("span", {
						key: "l",
						style: { flex: "0 0 " + LABEL_COL, display: "flex", alignItems: "baseline" }
					}, [
						h("span", {
							key: "c",
							style: {
								color: V.muted, fontWeight: 400, fontSize: FONT.body,
								border: "1px solid " + V.line2, borderRadius: RADIUS.chip, padding: "1px 7px",
								whiteSpace: "nowrap", lineHeight: 1.35
							}
						}, p.label)
					]),
					h("span", { key: "t", style: { flex: 1, minWidth: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, rich(p.text))
				]);
			}
			return h("div", {
				key: i,
				style: { fontSize: FONT.body, display: "flex", gap: GAP.sm, whiteSpace: "pre-wrap", wordBreak: "break-word" }
			}, [h("span", { key: "s", style: { flex: "0 0 " + LABEL_COL } }, ""), h("span", { key: "t", style: { flex: 1, minWidth: 0 } }, rich(p.text))]);
		}))
	]);
}

function DecisionsModule(props) {
	const d = props.detail;
	const dec = d.decisions || { log: null, rel: "decisions/决策记录.md", abs: "" };
	const log = dec.log || { present: false, entries: [], issues: [], preamble: "", title: "", text: "" };
	const [raw, setRaw] = React.useState(false);
	const entries = (log.entries || []).slice().reverse();          // 最新的在最上面
	const abs = dec.abs || (String(d.root || "").replace(/[\\/]+$/, "") + "\\decisions\\决策记录.md");
	/**
	 * ★ 条目格式模板**只在"没东西可读"时出现**（文件还不存在 / 文件在但没有带时间戳的条目）。
	 *   有真实条目时它纯属占位 —— 条目标题本身就是"时间 + 决策内容"的样例，
	 *   而 `决策 / 依据 / 影响` 三个标签下每一条都印着（用户口径：不额外占位置）。
	 */
	const showFormat = !log.present || entries.length === 0;

	return h("div", null, [
		h(Card, {
			key: "h",
			title: "决策记录",
			note: "这个功能的所有决策都记在同一个文件里 —— 不管发生在哪一步、哪个 skill",
			actions: h("div", { key: "a", style: { display: "flex", gap: "6px" } }, [
				Btn({ key: "r", label: raw ? "看时间线" : "看原文", onPick: () => setRaw(!raw), off: !log.present }),
				Btn({ key: "o", label: "打开文件", onPick: () => props.onOpenAbs(abs), off: !log.present })
			])
		}, [
			h("div", { key: "p" }, PathLine({ text: abs })),
			h("div", { key: "s", style: { fontSize: FONT.meta, color: V.muted, marginTop: "5px" } },
				log.present
					? "共 " + (log.entries || []).length + " 条" + (entries[0] ? "　｜　最近一条 " + entries[0].at : "")
					: "这个文件还不存在 —— 会话里的 agent 在该功能第一次做决策时会按下面的格式创建它。"),
			(log.issues || []).length
				? h("div", { key: "i", style: { marginTop: "7px", fontSize: FONT.meta, color: V.warn } }, log.issues.map((s, i) => h("div", { key: i }, "· " + s)))
				: null
		]),
		showFormat
			? h(Card, { key: "f", title: "条目格式", note: "时间（年月日时分秒）+ 决策内容；只在文件末尾追加" },
				h("pre", { style: PRE }, decisionEntryTemplate(stampOf(new Date()))))
			: null,
		raw && log.present
			? h(Card, { key: "raw", title: "原文" }, h("pre", { style: Object.assign({}, PRE, { maxHeight: "560px" }) }, log.text))
			: (log.present
				? h(Card, { key: "list", title: "全部决策", note: "最新的在最上面" },
					entries.length === 0
						? h("div", { style: { color: V.muted, fontSize: FONT.body } }, "文件在，但还没有带时间戳的条目 —— 照上面那份格式追加第一条。")
						: (() => {
					/**
					 * ★ **按天分组**（P2）：今天 / 昨天 / 本周 / 更早，每组一个组头 + 一条贯穿细线。
					 *   分组只按**日期**（不按时间差）——"昨天 23:50"与"今天 00:10"只差 20 分钟，
					 *   但那是两天，分两组才符合直觉。分组逻辑在 `pure/timeline.ts`（有用例）。
					 */
					const groups = groupTimeline(entries);
					const firstIndex = entries.length > 0 ? entries[0].index : -1;
					return h("div", null, groups.map((g, gi) => h("div", {
						key: "g-" + g.bucket,
						style: gi === 0 ? null : { marginTop: GAP.lg }
					}, [
						h("div", {
							key: "h",
							style: { display: "flex", alignItems: "center", gap: GAP.sm, marginBottom: GAP.sm }
						}, [
							h("span", { key: "l", style: { fontSize: FONT.meta, color: V.ink, fontWeight: 600 } }, g.label),
							h("span", {
								key: "n",
								style: { fontSize: FONT.meta, color: V.idle, fontVariantNumeric: "tabular-nums" }
							}, g.entries.length + " 条"),
							h("span", { key: "r", style: { flex: 1, height: "1px", background: V.line } })
						]),
						...g.entries.map((e) => h(DecisionEntry, { key: e.index, entry: e, first: e.index === firstIndex }))
					])));
				})())
				: h(Card, { key: "empty", title: "还没有决策记录" },
					h("div", { style: { fontSize: FONT.body, color: V.muted } },
						"进了这个功能的工作会话之后，任何一步定了事，都让 agent 往 " + abs +
						" 末尾追加一条（时间 + 决策内容）。上面那份模板就是它要照抄的格式。")))
	]);
}

// ════════════════════════════════════════════════════════════════════════════
// ④ 模块三 · 最终产物（四类 + 一个折叠的兜底）
// ════════════════════════════════════════════════════════════════════════════

function OutputsModule(props) {
	const d = props.detail;
	const o = d.outputs || { groups: [], total: 0, counts: {} };
	const main = (o.groups || []).filter((g) => g.key !== "other");
	const other = (o.groups || []).filter((g) => g.key === "other")[0];

	return h("div", null, [
		/**
		 * ★ 卡片头与「这个功能的 4 个桶」整块**去掉**（用户口径）：上面那排页签已经写着「最终产物（N）」，
		 *   再顶一行标题+说明是重复占位；想看目录就点功能根那行的〔打开路径〕。
		 *   于是这里**只有四组产物**，不再有别的字。
		 */
		h(Card, { key: "h" }, [
			o.total === 0
				? h("div", { key: "e", style: { color: V.muted, fontSize: FONT.body } }, "还没有产物。")
				: main.map((g) => h("div", { key: g.key, style: { marginBottom: GAP.md } }, [
					// 组头：标签 + 桶名（等宽小字）+ 右对齐件数。长说明收进 tooltip，不占位置。
					h("div", {
						key: "h", title: g.note,
						style: { display: "flex", alignItems: "baseline", gap: GAP.sm, borderBottom: "1px solid " + V.line, paddingBottom: "3px", marginBottom: GAP.xs }
					}, [
						h("div", { key: "t", style: { fontSize: FONT.body, fontWeight: 600 } }, g.label),
						g.dir ? h("code", { key: "d", style: { fontFamily: MONO, fontSize: FONT.meta, color: V.idle } }, g.dir + "\\") : null,
						h("div", { key: "s", style: { flex: 1 } }),
						h("div", { key: "c", style: { fontSize: FONT.meta, color: g.count ? V.muted : V.idle } }, g.count + " 件")
					]),
					g.dynamic ? h("div", { key: "dy", style: { fontSize: FONT.meta, color: V.warn, margin: "2px 0 3px" } }, g.dynamic) : null,
					g.count === 0
						? h("div", { key: "e", style: { fontSize: FONT.meta, color: V.idle, paddingLeft: "2px" } }, "这一类还没有")
						: h("div", { key: "l", style: { paddingLeft: "2px" } }, g.files.map((f) => h(FileRow, {
							key: f.rel, name: f.name, rel: f.rel, root: d.root,
							sub: f.subdir ? f.subdir + "\\" : "", note: f.note, onOpen: props.onOpen
						})))
				])),
			other && other.count > 0
				? h(Fold, { key: "o", label: "其它（不属上面四类）", note: "（" + other.count + " 件 —— 如实列出，不丢）" },
					h("div", { style: { paddingLeft: "2px" } },
						other.files.map((f) => h(FileRow, {
							key: f.rel, name: f.name, rel: f.rel, root: d.root,
							note: f.kindLabel, sub: f.subdir ? f.subdir + "\\" : "", onOpen: props.onOpen
						}))))
				: null
		])
	]);
}

// ════════════════════════════════════════════════════════════════════════════
// ⑤ 功能详情（三个模块）
// ════════════════════════════════════════════════════════════════════════════

const MODULES = [
	{ id: "brainstorm", label: "头脑风暴" },
	{ id: "decisions", label: "决策记录" },
	{ id: "outputs", label: "最终产物" }
];

function FeatureView(props) {
	const d = props.detail;
	/**
	 * ★ 当前模块**由 Panel 持有**（`props.mod`），这里不再自己 `useState`。
	 *   理由：它跟"上次打开的功能"是同一条记忆（`sr-wb.view.v1`）—— 面板要能一起读回、一起写回；
	 *   两个地方各存一份必然漂移（切回面板时功能恢复了、页签却回到头脑风暴）。
	 *   受控之后"切一个页签"= 一次 `setView`，Panel 顺手把记忆写掉（见 `goFeature`）。
	 */
	const mod = panelModOf(props.mod) || MODULES[0].id;
	const items = MODULES.map((m) => Object.assign({}, m, {
		count: m.id === "brainstorm" ? ((d.brainstorm && d.brainstorm.groups && d.brainstorm.groups.total) || 0)
			: m.id === "decisions" ? ((d.decisions && d.decisions.log && d.decisions.log.entries.length) || 0)
				: (d.outputs ? d.outputs.total : 0)
	}));
	return h("div", null, [
		/**
		 * ★ 详情页头部**也吸顶**（用户实测指出的缺口：决策记录可能几百条，滚下去还得看得见
		 *   "在哪个功能里"、随时能刷新）。写法与卡片墙一致：负**左右**外边距铺满整宽，
		 *   `top: -18px` 把钉住的位置抬到滚动口之上（正好是上内边距），**不用负上边距**。
		 */
		h("div", {
			key: "top",
			style: {
				position: "sticky", top: "-18px", zIndex: 5,
				display: "flex", alignItems: "baseline", gap: GAP.sm, flexWrap: "wrap",
				margin: "0 -22px " + GAP.sm, padding: "18px 22px " + GAP.sm,
				background: "var(--dsw-alias-bg-base)", borderBottom: "1px solid " + V.line
			}
		}, [
			BackBtn({ key: "back", onPick: props.onBack }),
			h("div", { key: "t", style: { fontSize: FONT.page, fontWeight: 700 } }, d.topic),
			h("div", { key: "s", style: { flex: 1 } }),
			/**
			 * ★ 详情页头部这两个按钮，**与卡片墙头部那两个是同一套位置**（用户口径 2026-10-10）：
			 *   都是"刷新 + 4 字动作"、刷新在前、右侧排开、同一套行内几何（`HEAD_BTN_H` ⇒ 等高 + 对齐）。
			 *   ① 〔刷新〕**也带刷新小图标**（原来只有卡片墙那个有 ⇒ 两处看着不像一套）；
			 *   ② 〔打开工作会话〕改名〔打开会话〕（与〔使用说明〕同为 4 字）。
			 */
			Btn({ key: "r", label: "刷新", h: HEAD_BTN_H, icon: PRIMITIVES && PRIMITIVES.IconRefreshOutlineRegular, onPick: props.onRefresh, off: props.phase === "loading" }),
			props.sessionId ? Btn({ key: "o", label: "打开会话", h: HEAD_BTN_H, onPick: () => props.onOpenSession(props.sessionId) }) : null
		]),
		h("div", { key: "p", style: { marginBottom: "10px" } }, PathLine({ text: d.root, onOpen: props.onOpen })),
		/**
		 * 功能根下"不属 4 个桶"的东西：只在这两样非空时各占一行小字（干净的功能永远看不到它们）。
		 * ★ 原来它们挂在「这个功能的 4 个桶」卡里 —— 那张卡已按用户口径整块去掉
		 *   （想看目录直接点上面的〔打开路径〕），但"不静默丢"的纪律得有地方落。
		 */
		(d.strangerDirs || []).length
			? h("div", { key: "sd", style: { fontSize: FONT.meta, color: V.warn, marginBottom: "6px" } },
				"不是 4 个桶的目录（如实列出）：" + d.strangerDirs.join("、"))
			: null,
		(d.rootFiles || []).length
			? h("div", { key: "rf", style: { fontSize: FONT.meta, color: V.muted, marginBottom: "6px" } },
				"功能根下的散文件：" + d.rootFiles.join("、"))
			: null,
		(d.missing || []).length
			? h("div", { key: "m", style: { fontSize: FONT.body, color: V.warn, marginBottom: GAP.sm } },
				"这个功能缺桶：" + d.missing.join("、") + " —— 面板只建不删，不会替你补，请手工建这几个目录。")
			: null,
		h(Notice, { key: "n", notice: props.notice }),
		h(TabBar, { key: "tabs", items: items, view: mod, onPick: props.onModPick }),
		mod === "brainstorm" ? h(BrainstormModule, {
			detail: d, onOpen: props.onOpen, onSend: props.onSendBrainstorm,
			sending: props.sending, notice: null, sessionNote: props.sessionNote
		}) : null,
		mod === "decisions" ? h(DecisionsModule, { detail: d, onOpenAbs: props.onOpenAbs }) : null,
		mod === "outputs" ? h(OutputsModule, { detail: d, onOpen: props.onOpen }) : null
	]);
}

// ════════════════════════════════════════════════════════════════════════════
// ⑥ 错误边界 + 面板根组件
// ════════════════════════════════════════════════════════════════════════════

class PanelErrorBoundary extends React.Component {
	constructor(props) { super(props); this.state = { err: null }; }
	static getDerivedStateFromError(err) { return { err: err }; }
	componentDidCatch(err, info) { console.error("[sr-workbench] 渲染失败", err, info); }
	render() {
		const e = this.state.err;
		if (!e) return this.props.children;
		return h("div", { style: Object.assign({}, PAGE, { color: V.bad }) }, [
			h("h1", { key: "t", style: { fontSize: FONT.card, margin: "0 0 10px", color: V.ink } }, "策划工作台 · 渲染失败"),
			h("div", { key: "m", style: { fontSize: FONT.title, marginBottom: "10px" } }, String((e && e.message) || e)),
			h("pre", { key: "s", style: Object.assign({}, PRE, { maxHeight: "400px", color: V.muted }) }, String((e && e.stack) || "").slice(0, 3000))
		]);
	}
}

/** `YYYYMMDD`（四条入口的产出文件名用）。 */
function todayCompact() {
	const d = new Date();
	const p = (n) => (n < 10 ? "0" : "") + n;
	return String(d.getFullYear()) + p(d.getMonth() + 1) + p(d.getDate());
}

function Panel(props) {
	const useSessions = props.useSessions;
	const useWorkspaces = props.useWorkspaces;
	const sessionsSnap = useSessions ? useSessions((s) => s) : null;
	const wsSnap = useWorkspaces ? useWorkspaces((s) => s) : null;
	const sessionRows = React.useMemo(() => rowsFromStore(sessionsSnap), [sessionsSnap]);
	const wsPaths = React.useMemo(() => ((wsSnap && wsSnap.items) || []).map((w) => w && w.path).filter(Boolean), [wsSnap]);
	const archived = React.useMemo(() => { try { return archivedFromSnapshot(wsSnap); } catch (e) { return null; } }, [wsSnap]);

	const [idx, setIdx] = React.useState(null);
	const [phase, setPhase] = React.useState("idle");
	const [notice, setNotice] = React.useState(null);
	const [dash, setDash] = React.useState(null);
	/** 配置向导：非空 = 这台机器还没配好（值 / 试过的路径 / 保存中标志都在里面）。 */
	const [wiz, setWiz] = React.useState(null);
	const saveConfig = async () => {
		const w = wiz;
		if (!w) return;
		const chk = validateConfigValues(w.values);
		if (!chk.ok) { setWiz(Object.assign({}, w, { issues: chk.issues })); setNotice({ kind: "warn", text: "还有字段没填对。" }); return; }
		setNotice(null);
		setWiz(Object.assign({}, w, { saving: true, issues: [] }));
		try {
			const r = await props.__saveConfig({ values: w.values, roots: w.roots || [], configPathHint: w.configPathHint || "" });
			if (!r || !r.ok) {
				setWiz(Object.assign({}, wiz, { saving: false }));
				setNotice({ kind: "warn", text: "写配置没成：" + String((r && r.error) || "未知原因"),
					next: "面板不写盘 —— 写盘的是会话。去那条会话看它跑到哪了；或点〔在会话里问答配置〕让它边问边写。" });
				return;
			}
			setWiz(null);
			setNotice({ kind: "ok", text: "配置已写好并核对通过：" + String(r.path || "") });
			const again = await props.__index({ rows: sessionRows, wsPaths: wsPaths, archived: archived });
			setIdx(again);
		} catch (e) {
			setWiz(Object.assign({}, wiz, { saving: false }));
			setNotice({ kind: "err", text: "写配置失败：" + String((e && e.message) || e) });
		}
	};

	const askmeConfig = async () => {
		const w = wiz;
		if (!w) return;
		setNotice(null);
		setWiz(Object.assign({}, w, { saving: true }));
		try {
			const r = await props.__askmeConfig({ roots: w.roots || [] });
			setWiz(Object.assign({}, wiz, { saving: false }));
			if (!r || !r.ok) { setNotice({ kind: "err", text: "发起配置失败：" + String((r && r.error) || "") }); return; }
			setNotice({ kind: "info", text: "已把 /sr-askme 发进会话 —— 去那边回答问题即可。",
				next: "答完配置会自己出现（面板每 5 秒重读一次）。" });
		} catch (e) {
			setWiz(Object.assign({}, wiz, { saving: false }));
			setNotice({ kind: "err", text: "发起配置失败：" + String((e && e.message) || e) });
		}
	};
	/**
	 * ★ **视图状态**（卡片墙 / 某功能的某模块）—— 初值从 `localStorage` 的"上次打开的状态"恢复。
	 *
	 *   面板是主区里的一个槽组件：从工作会话切回工作台会**重挂载** ⇒ 不恢复的话每次都回到
	 *   卡片墙、重头点一遍（用户口径 2026-10-10）。恢复是**惰性初值**（不是 effect）：第一帧
	 *   就落在那个功能上，不会先闪一下卡片墙再跳过去；`dash` 还没到之前显示「正在读「X」…」。
	 *
	 *   `mod` 与 `topic` 放在**同一个对象**里（不另开一个 useState）⇒ 面板的 hook 位置一个没动
	 *   （渲染冒烟的状态脚本按位置喂，动了就得连脚本一起改），而且"功能 + 模块"天然同生同死。
	 */
	const [view, setView] = React.useState(() => {
		const mem = panelViewParse(typeof props.__viewCacheRaw === "function" ? props.__viewCacheRaw() : null);
		if (mem.topic === "") return { kind: "cards" };
		return { kind: "feature", topic: mem.topic, mod: panelModOf(mem.mod) || MODULES[0].id };
	});
	const [detail, setDetail] = React.useState(null);
	const [rev, setRev] = React.useState(0);
	const [sending, setSending] = React.useState(false);
	const [newOpen, setNewOpen] = React.useState(false);
	const [newTopic, setNewTopic] = React.useState("");
	const [newBusy, setNewBusy] = React.useState(false);
	const [plan, setPlan] = React.useState(null);

	const refresh = React.useCallback(() => setRev((n) => n + 1), []);
	const rowsKey = sessionRows.length + "|" + wsPaths.length + "|" + (archived === null ? "?" : archived.length);

	/**
	 * 把"上次打开的状态"记下来（卡片墙 = 空 topic）。写失败只影响下次恢复，**不影响这次界面**。
	 * ★ 只在**动视图的那几处**调用：进功能 / 切模块 / 回卡片墙 —— 不在渲染里写（渲染要纯）。
	 */
	const remember = (v) => {
		if (typeof props.__viewCacheSet !== "function") return;
		const t = v && v.kind === "feature" ? v.topic : "";
		props.__viewCacheSet(t, t === "" ? "" : panelModOf(v.mod) || MODULES[0].id);
	};
	/** 进某个功能（`mod` 给空 ⇒ 从默认模块开始；恢复走的是上面那个惰性初值，不经过这里）。 */
	const goFeature = (topic, mod) => {
		const v = { kind: "feature", topic: topic, mod: panelModOf(mod) || MODULES[0].id };
		setView(v);
		remember(v);
	};
	const goCards = () => {
		setView({ kind: "cards" });
		remember({ kind: "cards" });
	};

	// ① 解析索引会话（读通道）
	React.useEffect(() => {
		let alive = true;
		const ac = new AbortController();
		props.__index({ rows: sessionRows, wsPaths: wsPaths, archived: archived, signal: ac.signal }).then(
			(r) => {
				if (!alive) return;
				setIdx(r);
				/**
				 * ★ 这台机器还没配好 ⇒ **进配置向导**（用户口径：同事第一次用、自己重装之后没配置，是正常状态）。
				 *   只是缺一两个字段时用读到的值预填，别让人重打一遍。
				 */
				if (r && r.ok === true && r.needConfig) {
					const o = r.cfgObj || {};
					setWiz((prev) => Object.assign({}, prev, {
						values: {
							sr_workspace: String(o.sr_workspace || "").trim(),
							sr_project: String(o.sr_project || "").trim(),
							config_root: String(o.config_root || "").trim(),
							gtgenerator_workdir: String(o.gtgenerator_workdir || "").trim()
						},
						configPathHint: String(r.configFile || "") || String(props.__configPath || "") || "",
						roots: wsPaths.slice(),
						triedPaths: (r.triedPaths || []).slice(),
						issues: [],
						saving: false
					}));
				} else {
					setWiz(null);
				}
			},
			(e) => { if (alive) setIdx({ ok: false, error: String((e && e.message) || e) }); }
		);
		return () => { alive = false; ac.abort(); };
	}, [rowsKey]);

	const sid = idx && idx.ok ? idx.sid : "";

	// ② 读卡片墙
	React.useEffect(() => {
		if (!idx || !idx.ok) return;
		let alive = true;
		const ac = new AbortController();
		setPhase("loading");
		props.__dashboard(idx, ac.signal).then(
			(d) => { if (alive) { setDash(d); setPhase("idle"); } },
			(e) => { if (alive) { setPhase("idle"); setNotice({ kind: "err", text: "读工作区失败：" + String((e && e.message) || e) }); } }
		);
		return () => { alive = false; ac.abort(); };
	}, [sid, rev]);

	const topic = view.kind === "feature" ? view.topic : "";
	const rootOf = React.useCallback(
		(t) => ((dash && dash.features ? dash.features : []).filter((x) => x.topic === t)[0] || {}).root || "",
		[dash]);

	// ③ 读功能详情（进功能时 + 刷新时）
	React.useEffect(() => {
		if (!idx || !idx.ok || topic === "") { setDetail(null); return; }
		const root = rootOf(topic);
		if (!root) { setDetail(null); return; }
		let alive = true;
		const ac = new AbortController();
		setPhase("loading");
		props.__feature(idx, root, ac.signal).then(
			(d) => { if (alive) { setDetail(d); setPhase("idle"); } },
			(e) => { if (alive) { setPhase("idle"); setNotice({ kind: "err", text: "读功能目录失败：" + String((e && e.message) || e) }); } }
		);
		return () => { alive = false; ac.abort(); };
	}, [sid, topic, rev, dash]);

	// ④ 详情页每 5 秒轻量重读：agent 在会话里写的东西要自己冒出来（内容没变就保持原对象，不闪）
	React.useEffect(() => {
		if (!idx || !idx.ok || topic === "") return;
		const root = rootOf(topic);
		if (!root) return;
		const t = setInterval(() => {
			props.__feature(idx, root, undefined).then(
				(d) => setDetail((prev) => (JSON.stringify(prev) === JSON.stringify(d) ? prev : d)),
				() => { /* 轮询失败就静默等下一次：不打断正在看的人 */ }
			);
		}, 5000);
		return () => clearInterval(t);
	}, [sid, topic]);

	/**
	 * ⑤ 恢复出来的那个功能**还在不在**：卡片墙读完才知道（改名 / 删了 / 换了工作区都会落空）。
	 *   落空 ⇒ 回卡片墙，并**把那条记忆也擦掉**（自愈：否则每次切回来都白跑一趟、卡在「正在读…」），
	 *   同时如实说一句为什么。判据是"卡片墙已经读到了"（`dash` 非空），不是"这轮读不到根目录"。
	 */
	React.useEffect(() => {
		if (!idx || !idx.ok || !dash || view.kind !== "feature") return;
		if (rootOf(view.topic) !== "") return;
		goCards();
		setNotice({ kind: "warn", text: "上次打开的功能「" + view.topic + "」没找到（可能改名或删了）—— 已回到卡片墙。" });
	}, [sid, dash, topic]);

	// ── 动作 ──────────────────────────────────────────────────────────
	const openAbs = (abs) => {
		props.__open(abs).then(
			(r) => { if (r && r.ok !== true) setNotice({ kind: "warn", text: (r.error && (r.error.message || r.error)) || "打不开这个文件。" }); },
			(e) => setNotice({ kind: "warn", text: "打不开：" + String((e && e.message) || e) })
		);
	};

	const onTopic = (t) => {
		setNewTopic(t);
		setPlan(null);
		if (!idx || !idx.ok || t.trim() === "") return;
		if (!checkTopicName(t).ok) return;
		const wsPathsNow = wsPaths;
		props.__createFacts(idx, idx.srWs).then((facts) => {
			const p = planNewFeature(t, { dirNames: facts.dirNames, wsPaths: wsPathsNow, srWs: idx.srWs });
			if (!p.ok && facts.note) p.message = facts.note + " " + p.message;
			setPlan(p);
		}, () => { /* 读不到事实就不显示预览；提交时还会再算一次 */ });
	};

	const submitNew = () => {
		if (newBusy) return;
		const chk = checkTopicName(newTopic);
		if (!chk.ok) { setNotice({ kind: "warn", text: chk.message, next: chk.next }); return; }
		setNewBusy(true);
		setNotice({ kind: "info", text: createPendingNotice(newTopic) });
		props.__createFeature(newTopic, { wsPaths: wsPaths, sid: sid }).then(
			(r) => {
				setNewBusy(false);
				if (!r.ok) {
					setNotice({ kind: "warn", text: r.message || "没建成。", next: r.next || "" });
					if (r.plan) setPlan(r.plan);
					return;
				}
				setNewOpen(false);
				setNewTopic("");
				setPlan(null);
				setNotice({ kind: "ok", text: r.doneText, next: (r.notes || []).join("　") });
				refresh();
				// ★ 新建完就进它的详情：顺带把"上次打开的状态"写成这个新功能（切回来还在它上面）
				goFeature(r.topic, "");
			},
			(e) => { setNewBusy(false); setNotice({ kind: "err", text: "新建失败：" + String((e && e.message) || e) }); }
		);
	};

	const sendBrainstorm = (instruction) => {
		if (!detail || sending) return;
		setSending(true);
		props.__sendBrainstorm(detail.root, instruction).then(
			(r) => {
				setSending(false);
				if (!r.ok) setNotice({ kind: "warn", text: r.error || "没发出去。", next: r.next || "" });
				else setNotice({
					kind: "ok",
					text: "已发给这个功能的工作会话" + (r.source === "created" ? "（新建的）" : "") + "。进度与提问都在那条会话里 —— 面板不重画流程。",
					next: (r.notes || []).join("　")
				});
			},
			(e) => { setSending(false); setNotice({ kind: "err", text: "发送失败：" + String((e && e.message) || e) }); }
		);
	};

	const sessionId = React.useMemo(() => {
		if (!detail) return "";
		return props.__workSessionOf(detail.root);
	}, [detail, rev]);

	// ── 渲染 ──────────────────────────────────────────────────────────
	return h("div", { style: PAGE }, [
		!idx ? h("div", { key: "boot", style: { color: V.muted } }, "正在解析工作台锚点…") : null,
		idx && !idx.ok
			? h(Notice, {
				key: "ie",
				notice: { kind: "err", text: idx.error || "拿不到读通道（索引会话）。", next: (idx.note || []).join("；") }
			})
			: null,
		idx && idx.ok && (idx.note || []).length
			? h("div", { key: "in", style: { fontSize: FONT.meta, color: V.muted, marginBottom: GAP.sm } }, idx.note.join("　"))
			: null,
		idx && idx.ok && idx.needConfig
			? h(ConfigWizard, {
				key: "wiz",
				values: (wiz || {}).values || {},
				issues: (wiz || {}).issues || [],
				triedPaths: (wiz || {}).triedPaths || [],
				configPathHint: (wiz || {}).configPathHint || "",
				saving: !!(wiz || {}).saving,
				picking: !!(wiz || {}).picking,
				notice: notice,
				onField: (k, v) => setWiz((prev) => Object.assign({}, prev, {
					values: Object.assign({}, (prev || {}).values, { [k]: v }), issues: []
				})),
				onPick: async (k) => {
					setWiz((prev) => Object.assign({}, prev, { picking: true }));
					const p = await props.__pickDirectory();
					setWiz((prev) => Object.assign({}, prev, {
						picking: false,
						values: p ? Object.assign({}, (prev || {}).values, { [k]: p }) : (prev || {}).values
					}));
					if (!p) setNotice({ kind: "warn", text: "没拿到目录（这台机器可能没有系统目录选择框）—— 直接手打路径即可。" });
				},
				onSave: saveConfig,
				onAskme: askmeConfig
			})
			: null,
		idx && idx.ok && !idx.needConfig && view.kind === "cards"
			? h(Dashboard, {
				key: "dash", dash: dash, phase: phase, notice: notice,
				onRefresh: refresh, onOpen: (t) => { setNotice(null); goFeature(t, ""); },
				onNew: () => { setPlan(null); setNewOpen(true); },
				newOpen: newOpen, newTopic: newTopic, plan: plan, busy: newBusy,
				onTopic: onTopic, onSubmit: submitNew,
				onCancel: () => { setNewOpen(false); setNewTopic(""); setPlan(null); setNotice(null); }
			})
			: null,
		idx && idx.ok && view.kind === "feature"
			? (detail
				? h(FeatureView, {
					key: "fv", detail: detail, phase: phase, notice: notice,
					/**
					 * ★ 当前模块跟着 `view.mod` 走（受控），切换时回写记忆 ——
					 *   这样"面板重挂载后回到上次那个页签"才是真的（见 `FeatureView` 里的说明）。
					 */
					mod: view.mod, onModPick: (m) => goFeature(view.topic, m),
					onBack: () => { setNotice(null); goCards(); },
					onRefresh: refresh, onOpen: openAbs, onOpenAbs: openAbs,
					onSendBrainstorm: sendBrainstorm, sending: sending,
					sessionId: sessionId,
					sessionNote: sessionId ? "工作会话已就绪（可在右上角打开）" : "还没建工作会话 —— 发送时会自动建一条（策划模式）",
					onOpenSession: (id) => props.__openSession(id)
				})
				: h("div", { key: "fl", style: { color: V.muted } }, "正在读「" + topic + "」…"))
			: null
	]);
}

// ════════════════════════════════════════════════════════════════════════════
// ⑦ 组合根：唯一知道 ctx / remote / store 的地方
// ════════════════════════════════════════════════════════════════════════════

/** 核心服务写进 inject；可选依赖（uiWorkspace / sessions / workspaces）用 `ctx.get` 取。 */
export const inject = [
	"slots", "remote",
	"remote.workspaceFiles", "remote.session", "remote.workspace", "remote.commands", "remote.permissionPresets"
];

/** 安全取一个可选服务（可能为 undefined，不抛） */
function svc(ctx, name) {
	try { return ctx.get(name); } catch (e) { return void 0; }
}

/** 把一次 Remote 调用的结果原样收成可显示对象（同步抛错也接住）。 */
function safeCall(name, fn) {
	let p;
	try { p = Promise.resolve(fn()); }
	catch (e) { return Promise.resolve({ name: name, ok: false, error: { message: "同步抛错 " + String((e && e.message) || e) } }); }
	return p.then(
		(r) => ({ name: name, ok: !!(r && r.ok), value: r && r.value, error: r && r.error }),
		(e) => ({ name: name, ok: false, error: { message: String((e && e.message) || e) } })
	);
}

function humanError(r) {
	if (!r) return "（没有返回）";
	const e = r.error;
	if (!e) return String(r.message || r.name || "未知错误");
	return String(e.message || e.code || JSON.stringify(e));
}

/** 从可能的包装对象里取 id 文本。 */
function idText(v) {
	if (typeof v === "string") return v;
	if (v && typeof v === "object") {
		const inner = v.value || v.sessionId || v.workspaceId || v.id;
		if (typeof inner === "string") return inner;
	}
	return "";
}

/**
 * 兜底工作区根 —— 只在"前三条候选全落空"时才用（浏览器半侧收不到插件 config，
 * 绝对路径只能自己推）。候选顺序是：
 *   profile 的 `projectRoot` → 客户端登记过的**工作区列表** → 各会话的 `cwd` → 这个常量。
 * ★ 分发到别的机器：前三条通常已经命中（工作区登记过就行），这个常量留作最后兜底；
 *   如果对方的工作区不在 `D:\TimeMachine` 且一条工作区都没登记，改成对方的工作区根即可。
 */
const DEFAULT_ROOT = "D:\\TimeMachine";
/**
 * 「策划模式」预设的 **id** —— 显示名是「策划模式」，id 仍是 `sr-workbench`
 * （会话日志按 id 恢复，改 id = 旧会话打不开）。见 `cordis.patch.yml` 的 `preset-sr-workbench` 行。
 */
const PLAN_PRESET = "sr-workbench";

export function apply(ctx, config) {
	const cfg = config || {};
	const read = (sid, path, range, signal) => ctx.remote.workspaceFiles.read(sid, path, range, signal);

	/** 锚点缓存（"新建"与"读"两条路都要用工作区根）。 */
	let srWsCache = "";

	/**
	 * 端口：加载层唯一的测试接缝。只读三法需要**一条真会话**（sid）；
	 * 指令侧四法在签名里显式带 sessionId（它们的目标常常不是读通道那条会话）。
	 */
	function portOf(sid) {
		return {
			readText: async (path, range, signal) => {
				const r = await read(sid, path, range, signal);
				if (!r || r.ok !== true) throw new Error("读不到 " + path + "：" + humanError(r));
				return r.value;
			},
			listDir: async (path, signal) => {
				const r = await ctx.remote.workspaceFiles.list(sid, path, signal);
				if (!r || r.ok !== true) throw new Error("列举不了 " + path + "：" + humanError(r));
				return r.value;
			},
			stat: async (path, signal) => {
				const r = await ctx.remote.workspaceFiles.stat(sid, path, signal);
				if (!r || r.ok !== true) throw new Error("读不到 " + path + " 的信息：" + humanError(r));
				return r.value;
			},
			prompt: (sid2, text) => safeCall("session.prompt", () => ctx.remote.session.prompt({
				requestId: "wb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
				sessionId: sid2, mode: "queue", content: [{ type: "text", text: text }]
			})),
			execCommand: (sid2, line) => safeCall("commands.execute", () => ctx.remote.commands.execute(sid2, line, [])),
			renameSession: (sid2, title) => safeCall("session.rename", () => ctx.remote.session.rename({ sessionId: sid2, title: title })),
			ensureWorkspace: (path) => safeCall("workspace.create", () => ctx.remote.workspace.create({ path: path })),
			createSession: (req) => safeCall("session.create", () => ctx.remote.session.create(req))
		};
	}

	const listSessions = (signal) => safeCall("session.list", () => ctx.remote.session.list({}, signal));

	// ── 单航班锁（连点两次 / 同一页两次挂载 ⇒ 只建一条会话）─────────────
	const INFLIGHT = new Map();
	const singleFlight = (key, fn) => {
		const prev = INFLIGHT.get(key);
		if (prev) return prev;
		const p = Promise.resolve().then(fn).then(
			(v) => { INFLIGHT.delete(key); return v; },
			(e) => { INFLIGHT.delete(key); throw e; }
		);
		INFLIGHT.set(key, p);
		return p;
	};

	// ── localStorage：索引会话缓存 / 工作会话缓存 ──────────────────────
	const cacheRaw = () => {
		try {
			if (typeof localStorage === "undefined" || !localStorage) return null;
			return localStorage.getItem(indexCacheKey());
		} catch (e) { return null; }
	};
	const cacheWrite = (srWs, sid, title) => {
		try {
			if (typeof localStorage === "undefined" || !localStorage) return;
			localStorage.setItem(indexCacheKey(), indexCacheSerialize(srWs, sid, title || ""));
		} catch (e) { /* 无缓存也能用 */ }
	};
	const workCacheRaw = () => {
		try {
			if (typeof localStorage === "undefined" || !localStorage) return null;
			return localStorage.getItem(workCacheKey());
		} catch (e) { return null; }
	};
	const workCacheSet = (root, sid) => {
		try {
			if (typeof localStorage === "undefined" || !localStorage) return;
			const raw = workCacheRaw();
			localStorage.setItem(workCacheKey(), sid === null || sid === void 0 ? workCacheDrop(raw, root) : workCachePut(raw, root, sid));
		} catch (e) { /* 无缓存也能用 */ }
	};
	/**
	 * ★ **面板视图记忆**：上次停在哪个功能 / 哪个模块（用户口径 2026-10-10）。
	 *   与上面两条缓存同一路（`localStorage` + 只在组合根里读写；解析/序列化在 pure 层）。
	 *   读不到 / 坏值 ⇒ 面板照旧从卡片墙开始，什么都不影响。
	 */
	const viewCacheRaw = () => {
		try {
			if (typeof localStorage === "undefined" || !localStorage) return null;
			return localStorage.getItem(panelViewKey());
		} catch (e) { return null; }
	};
	const viewCacheSet = (topic, mod) => {
		try {
			if (typeof localStorage === "undefined" || !localStorage) return;
			localStorage.setItem(panelViewKey(), panelViewSerialize(topic, mod));
		} catch (e) { /* 记不住也能用 */ }
	};

	/** 本机权限预设目录（一页只读一次；读不到就 `null`，按最坏情况处理）。 */
	let permCatalog = null;
	let permCatalogDone = false;
	const permissionCatalog = () => {
		if (permCatalogDone) return Promise.resolve(permCatalog);
		return safeCall("permissionPresets.catalog", () => ctx.remote.permissionPresets.catalog()).then((r) => {
			permCatalogDone = true;
			permCatalog = r && r.ok ? r.value : null;
			return permCatalog;
		});
	};

	/** 建完就把新工作区 / 新会话并进**客户端 store**（否则侧边栏要按 F5 才看得见）。 */
	const syncSidebarStores = async (path) => {
		const workspacesSvc = svc(ctx, "workspaces");
		const sessionsSvc = svc(ctx, "sessions");
		const plan = planSidebarSync({
			path: path || "",
			services: {
				workspaces: !!(workspacesSvc && typeof workspacesSvc.create === "function"),
				sessions: !!(sessionsSvc && typeof sessionsSvc.refresh === "function")
			}
		});
		const notes = plan.notes.slice();
		if (!sidebarSyncNeeded(plan)) return { plan: plan, notes: notes };
		const tryCall = async (name, fn) => {
			try { return { name: name, ok: true, value: await fn() }; }
			catch (e) { return { name: name, ok: false, error: { message: String((e && e.message) || e) } }; }
		};
		for (const step of plan.steps) {
			if (step === "workspaces.create") {
				const r = await tryCall("workspaces.create", () => workspacesSvc.create({ path: plan.resolvePath }));
				if (!r.ok) notes.push("工作区分组没能即时并进侧边栏（" + humanError(r) + "）。");
			} else {
				const r = await tryCall("sessions.refresh", () => sessionsSvc.refresh());
				if (!r.ok) notes.push("会话行没能即时并进侧边栏（" + humanError(r) + "）。");
			}
		}
		return { plan: plan, notes: notes };
	};

	/**
	 * 按 `root` 建一条带可识别标题的会话（**唯一的建会话出口**）。
	 * 坑只留一处：`session.create` 的 `workspaceId` 与 `cwd` **互斥** ——
	 * 拿不到 workspaceId 时才退回给 cwd（会话落进「未分组」，但可用）。
	 */
	const createSessionAt = async (root, title, preset, opts) => {
		const o = opts || {};
		const note = [];
		const port = portOf("");
		const ws = await port.ensureWorkspace(root);
		const wsId = ws.ok ? idText(ws.value && ws.value.workspace ? ws.value.workspace.workspaceId : (ws.value && ws.value.workspaceId)) : "";
		if (!ws.ok) note.push("按路径登记工作区失败（改用 cwd 建会话）：" + humanError(ws));
		/**
		 * 建会话时带「策划模式」预设（`agentPreset`）。
		 *
		 * ★ 它随 **bundle 的 patch** 分发 ⇒ 只有包在 profile 的 `dsh.profile.bundles` 里才存在。
		 *   万一没挂上（有人只手写插件行、没把包加进 bundles），host 会拒绝这个预设 ——
		 *   那时**退一步建一条不带预设的会话**并如实说清"这条会话没有决策记录契约"，
		 *   总好过让「新建功能」停在半个目录上（决策靠 skill 侧的写入规范仍然管得住）。
		 */
		const withPreset = preset || PLAN_PRESET;
		const reqOf = (p) => (wsId
			? (p ? { workspaceId: wsId, agentPreset: p } : { workspaceId: wsId })
			: (p ? { cwd: root, agentPreset: p } : { cwd: root }));
		let cr = await port.createSession(reqOf(withPreset));
		if (!cr.ok && withPreset) {
			const retry = await port.createSession(reqOf(""));
			if (retry.ok) {
				note.push("「策划模式」预设没挂上（`agentPreset: " + withPreset + "` 被拒：" + humanError(cr) + "）—— " +
					"这条会话用的是 **profile 的默认预设**，**决策记录契约不在它的上下文里**（其余照常）。" +
					"原因多半是包没进 profile 的 `dsh.profile.bundles`（预设只能随 bundle 的 patch 分发）：补上后重建这条会话即可。");
				cr = retry;
			}
		}
		if (!cr.ok) return { sid: "", error: humanError(cr), note: note, wsId: wsId };
		const sid = idText(cr.value && (cr.value.sessionId || cr.value));
		if (!sid) return { sid: "", error: "会话已创建，但拿不到 sessionId。", note: note, wsId: wsId };
		if (title) {
			const rn = await port.renameSession(sid, title);
			if (!rn.ok) note.push("会话建好了但改名失败（下次按缓存认回来）：" + humanError(rn));
		}
		if (o.fullAccess) {
			const plan = permissionPlanOf(await permissionCatalog());
			if (plan.needed) {
				const ex = await port.execCommand(sid, permissionCommandLine(plan.preset));
				const back = await listSessions(o.signal);
				const row = back.ok ? rowsFromList(back.value).filter((r) => r.id === sid)[0] : null;
				note.push(permissionResultNote(
					!!(ex && ex.ok),
					ex && ex.ok ? ((ex.value && (ex.value.text || ex.value.kind)) || "") : humanError(ex),
					row ? row.preset : ""
				));
			} else if (plan.note) {
				note.push(plan.note);
			}
		}
		const sync = await syncSidebarStores(root);
		for (const n of sync.notes) note.push(n);
		return { sid: sid, error: "", note: note, title: title || "", wsId: wsId };
	};

	/**
	 * ═══ 解析「读通道」：索引会话 ═══
	 *   1. 先借一条**任何可用**的会话，只为读 sr 配置（`read` 不受工作区限制）；
	 *   2. 按候选根读 `config.local.json` → 绝对锚点 `sr_workspace`；
	 *   3. **正式认领**：只认**面板自己的**（标题前缀 / 自己写的缓存），且必须能列出 root；
	 *   4. 认不着就新建。
	 */
	/**
	 * 配置向导的落地动作之一：**把值交给会话去写，然后回读核对**（面板不写盘）。
	 * @returns `{ ok, path?, error? }` —— 成功时给出配置的绝对路径。
	 */
	const saveConfigTo = async (o) => {
		const values = (o && o.values) || {};
		const roots = ((o && o.roots) || []).slice();
		const hint = String((o && o.configPathHint) || "");
		const signal = o && o.signal;
		const rows0 = await sessionRowsNow(signal);
		const borrow = pickIndexSession(rows0, "", { borrow: true });
		let sid = borrow ? borrow.id : "";
		if (!sid) {
			const cr = await ctx.remote.session.create({ cwd: String(values.sr_workspace || "").trim() });
			if (!cr || cr.ok !== true) return { ok: false, error: "没有可用会话，且新建会话失败：" + humanError(cr) };
			sid = idText(cr.value && (cr.value.sessionId || cr.value));
		}
		const inst = buildConfigInstruction({
			values: values,
			configPathHint: hint,
			pointerPaths: pointerCandidates(roots, values.sr_workspace),
			stamp: todayCompact()
		});
		const pr = await ctx.remote.session.prompt({
			requestId: "wb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
			sessionId: sid, mode: "queue", content: [{ type: "text", text: inst }]
		});
		if (!pr || pr.ok !== true) return { ok: false, error: "把指令发给会话失败：" + humanError(pr) };

		// 回读核对：先读指针（配置被写到哪了），再读那份配置，比对必填字段
		const want = String(values.sr_workspace || "").trim().replace(/[\\/]+$/, "").toLowerCase();
		for (let i = 0; i < 30; i++) {
			await new Promise((r) => setTimeout(r, 2000));
			const cands2 = [];
			for (const p of pointerCandidates(roots, values.sr_workspace)) {
				try {
					const r = await read(sid, p, { offset: 1, limit: 5 }, signal);
					if (r && r.ok === true && r.value && typeof r.value.text === "string" && r.value.text.trim() !== "") {
						cands2.push(r.value.text.trim().split(/\r?\n/)[0].trim());
					}
				} catch (e) { /* 还没写指针 */ }
			}
			if (hint) cands2.push(hint);
			for (const p of cands2) {
				try {
					const r = await read(sid, p, { offset: 1, limit: 200 }, signal);
					if (!r || r.ok !== true || !r.value || typeof r.value.text !== "string") continue;
					const obj = JSON.parse(r.value.text);
					if (obj && String(obj.sr_workspace || "").replace(/[\\/]+$/, "").toLowerCase() === want) {
						return { ok: true, path: p, cfg: obj, sid: sid };
					}
				} catch (e) { /* 换下一个 */ }
			}
		}
		return { ok: false, error: "回读没核对上（等了 60 秒）—— 去会话里看它跑到哪了", sid: sid };
	};

	/** 落地动作之二：把 `/sr-askme` 发进会话（边问边写），并让它写指针文件。 */
	const runAskme = async (o) => {
		const roots = ((o && o.roots) || []).slice();
		const signal = o && o.signal;
		const rows0 = await sessionRowsNow(signal);
		const borrow = pickIndexSession(rows0, "", { borrow: true });
		let sid = borrow ? borrow.id : "";
		if (!sid) {
			const cr = await ctx.remote.session.create({});
			if (!cr || cr.ok !== true) return { ok: false, error: "没有可用会话，且新建会话失败：" + humanError(cr) };
			sid = idText(cr.value && (cr.value.sessionId || cr.value));
		}
		const lines = ["/sr-askme 引导我配置这台机器的 sr 路径。", "", "规矩（面板要靠它认路）：",
			"· 配置写到 $env:USERPROFILE\\.dsh\\sr-workbench\\config.local.json（本机私有，别放进技能目录）；",
			"· 写完后把配置的绝对路径（一行）写进下面这些指针文件（目录不存在先建）："];
		for (const p of pointerCandidates(roots, (o && o.srWorkspace) || "")) lines.push("  " + p);
		lines.push("· 跑完只回报一行 OK <配置绝对路径> 或 FAILED <原因>。");
		const pr = await ctx.remote.session.prompt({
			requestId: "wb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
			sessionId: sid, mode: "queue", content: [{ type: "text", text: lines.join("\n") }]
		});
		if (!pr || pr.ok !== true) return { ok: false, error: "把指令发给会话失败：" + humanError(pr) };
		return { ok: true, sid: sid };
	};

	/** 现取一次会话行（向导动作要用；不等 store 的那份快照）。 */
	const sessionRowsNow = async (signal) => {
		const L = await listSessions(signal);
		return L.ok ? rowsFromList(L.value) : [];
	};

	const resolveIndexSession = async (o) => {
		const note = [];
		const signal = o.signal;
		let rows = (o.rows || []).filter((r) => r && r.id);
		if (rows.length === 0) {
			const L = await listSessions(signal);
			if (L.ok) rows = rowsFromList(L.value);
			else note.push("会话列表读取失败：" + humanError(L));
		}
		const arch = { ids: o.archived === undefined ? null : o.archived };
		if (arch.ids === null) note.push(NO_ARCHIVE_INFO_NOTE);

		const cached = indexCacheParse(cacheRaw());
		const cachedMine = indexCacheOwned(cached);
		if (cached && !cachedMine) note.push(FOREIGN_CACHE_NOTE);
		const cachedSid = cached && cached.sid ? String(cached.sid) : "";
		const cachedArchived = isArchivedId(arch.ids, cachedSid);
		if (cachedMine && cachedArchived) note.push(ARCHIVED_CACHED_NOTE);
		const ownCachedSid = cachedMine && !cachedArchived ? cachedSid : "";

		const roots = [];
		if (cfg.projectRoot) roots.push(cfg.projectRoot);
		for (const p of (o.wsPaths || [])) roots.push(p);
		for (const r of rows) if (r.cwd) roots.push(r.cwd);
		roots.push(DEFAULT_ROOT);

		// 1) 借一条能读文件的会话（这一步不排除归档：它只被 read 用）
		const boot = pickIndexSession(rows, "", { cachedId: cachedArchived ? "" : cachedSid, borrow: true });
		if (!boot) {
			return { ok: false, error: "一条会话都没有 —— 先在左侧建一条会话（任意工作区），面板要用它读文件。", note: note };
		}

		// 2) 读 sr 配置 → 绝对锚点
		const cands = [];
		if (cfg.configPath) cands.push(cfg.configPath);
		for (const p of configPathCandidates(roots)) cands.push(p);
		let cfgPath = "";
		let cfgObj = null;
		/**
		 * ★ **指针文件**（用户口径 A 方案）：配置的正经落点是用户目录，但**浏览器拿不到家目录**，
		 *   所以会话写完配置后会把"配置在哪"写进 `<工作区根>\.dsh\sr-workbench.path`（一行文本）。
		 *   这里先读指针、再去读它指的那份配置 —— 新机器上第一次配完，面板就能自己认路。
		 */
		for (const p of pointerCandidates(roots)) {
			try {
				const r = await read(boot.id, p, { offset: 1, limit: 5 }, signal);
				if (!r || r.ok !== true || !r.value || typeof r.value.text !== "string") continue;
				const pointed = r.value.text.trim().split(/\r?\n/)[0].trim();
				if (pointed !== "" && cands.indexOf(pointed) < 0) cands.unshift(pointed);
			} catch (e) { /* 没指针就算了 */ }
		}
		for (const p of cands) {
			try {
				const r = await read(boot.id, p, { offset: 1, limit: 200 }, signal);
				if (!r || r.ok !== true || !r.value || typeof r.value.text !== "string") continue;
				const parsed = JSON.parse(r.value.text);
				if (parsed && parsed.sr_workspace) { cfgObj = parsed; cfgPath = p; break; }
			} catch (e) { /* 换下一个候选 */ }
		}
		const srWs = cfgObj ? String(cfgObj.sr_workspace).replace(/[\\/]+$/, "") : "";
		const root = srWs || cfg.projectRoot || DEFAULT_ROOT;
		/**
		 * ★ 读不到配置（或必填字段不齐）⇒ 返回 `needConfig` 让面板进**配置向导**，
		 *   而不是只说一句"先跑 /sr-askme"。同时把**试过哪些候选**如实带出去 ——
		 *   向导里要显示它（用户据此判断是不是路径不对）。
		 */
		/**
		 * ★ **只有工作区锚点缺失**才进配置向导（面板干活全靠它）。
		 *   配置在、只是别的必填字段（`sr_project` 之类）缺 —— 那是**技能侧**的要求，
		 *   面板照常干活，只提示一句（2026-10-09 实测：把它当硬条件会把新建功能一起挡掉）。
		 */
		if (!cfgObj || workspaceMissing(cfgObj)) {
			note.push(cfgObj
				? "本机配置在 `" + cfgPath + "`，但**工作区锚点 `sr_workspace` 是空的** —— 在配置向导里补上。"
				: "没读到 sr 配置（试过 " + cands.length + " 个候选路径）。");
			return {
				ok: true, sid: boot.id, root: root, srWs: srWs, configFile: cfgPath, source: "need-config", needConfig: true,
				cfgObj: cfgObj, triedPaths: cands.slice(), note: note
			};
		}
		const softMissing = CONFIG_FIELDS.filter((f) => f.required && !String((cfgObj || {})[f.key] || "").trim()).map((f) => f.key);
		if (softMissing.length > 0) {
			note.push("本机配置缺 " + softMissing.join("、") + "（技能会问；补了更省事）—— 配置在 `" + cfgPath + "`。");
		}
		srWsCache = srWs;

		// 3) 正式认领（先 store 行 → 认不着就拉一次列表 → 再认）
		const pickOwn = () => pickIndexSession(rows, root, { cachedId: ownCachedSid, archived: arch.ids });
		let hit = pickOwn();
		if (!hit) {
			const L = await listSessions(signal);
			if (L.ok) { rows = mergeRows(rows, rowsFromList(L.value)); hit = pickOwn(); }
		}
		if (hit) {
			/**
			 * ★ 这里**不再**提示"侧边栏里有 N 条索引会话"（用户口径：不额外占位置）。
			 *   那是**整理建议**，不是故障：面板照旧用最近更新的那条、照旧写缓存，功能一点不受影响。
			 *   真需要清理时，去侧边栏把多余的那条归档即可（一次性动作）。
			 *   保留 `hit.others` 这个事实（`pickIndexSession` 还会算它），只是不再往界面上顶一行。
			 */
			cacheWrite(root, hit.id, titleOf(hit.row));
			return { ok: true, sid: hit.id, root: root, srWs: srWs, configFile: cfgPath, source: hit.source, note: note };
		}

		// 4) 新建（索引会话只读，不切权限）
		const title = indexTitleFor(root);
		const made = await singleFlight("index:" + normPath(root), () => createSessionAt(root, title, PLAN_PRESET, { fullAccess: false, signal: signal }));
		for (const n of made.note) note.push(n);
		if (made.error) return { ok: false, error: "无法创建索引会话：" + made.error, note: note };
		cacheWrite(root, made.sid, title);
		return { ok: true, sid: made.sid, root: root, srWs: srWs, configFile: cfgPath, source: "created", note: note };
	};

	/**
	 * 建那 5 个目录（`features\` + 功能目录 + 4 个桶）。**三条路按能力退** —— 理由见 `createFeature` 的注释。
	 * @returns `{ ok, done: string[], message, next }` —— 失败时 message/next 直接给用户看。
	 */
	const scaffoldDirs = async (port, base, topic, buckets, indexSid, signal, notes, wait) => {
		const root = featureRootFor(base, topic);
		const done = [];
		const uw = svc(ctx, "uiWorkspace");

		/** ① 宿主目录原语（**只有 browse 后端才有**） */
		if (uw && typeof uw.createDirectory === "function") {
			const mk = async (parent, name) => {
				try {
					await uw.createDirectory(parent, name);
					return { ok: true, code: "", message: "" };
				} catch (e) {
					const code = String((e && (e.code || (e.details && e.details.code))) || "");
					return { ok: false, code: code, message: String((e && e.message) || e) };
				}
			};
			let bad = null;
			const mkFeatures = await mk(base, "features");
			if (!mkFeatures.ok && mkFeatures.code !== "directory-exists") bad = { what: "features\\", r: mkFeatures };
			if (!bad) {
				done.push("features\\");
				const mkRoot = await mk(base + "\\features", topic);
				if (!mkRoot.ok && mkRoot.code !== "directory-exists") {
					bad = { what: topic + "\\", r: mkRoot };
				} else {
					done.push(topic + "\\");
					for (const b of buckets) {
						const rb = await mk(root, b);
						if (!rb.ok && rb.code !== "directory-exists") { bad = { what: b + "\\", r: rb }; break; }
						done.push(b + "\\");
					}
				}
			}
			if (!bad) {
				notes.push("目录是**本机直接建**的（宿主目录原语 `createDirectory` 可用）。");
				return { ok: true, done: done, message: "", next: "" };
			}
			// 能力不可用 ⇒ 退到②；别的硬失败（权限 / 占用 / 名字）⇒ 如实报，别装能救
			const capMissing = /directory-picker\/unavailable|needs the browse capability|serves\s*"native"/i.test(bad.r.message + " " + bad.r.code);
			if (!capMissing) {
				return {
					ok: false, done: done, root: root,
					message: createPartialNotice(topic, root, done, bad.what, bad.r.message + "（" + bad.r.code + "）"),
					next: "面板只建不删 —— 缺的请手工补建（命令见下），或删掉整个目录重新新建。\n" + manualScaffoldCommand(base, topic)
				};
			}
			notes.push("本机目录选择器只有 **native**（`createDirectory` 只存在于 browse 后端）⇒ 改让**索引会话**跑一条 PowerShell 建目录。");
		} else {
			notes.push("拿不到 `uiWorkspace.createDirectory` ⇒ 改让**索引会话**跑一条 PowerShell 建目录。");
		}

		/** ② 让索引会话建（Go 通用路径），面板**回读核对** */
		if (!indexSid) {
			return {
				ok: false, done: done, root: root,
				message: "没有可用的会话来建目录（面板要借一条 cwd 覆盖 SR 工作区的会话跑这条命令）。",
				next: "先在左侧随便建一条会话，或手工建目录：\n" + manualScaffoldCommand(base, topic)
			};
		}
		const pr = await port.prompt(indexSid, buildScaffoldInstruction(base, topic));
		if (!pr.ok) {
			return {
				ok: false, done: done, root: root,
				message: "把建目录的指令发给索引会话失败：" + humanError(pr),
				next: "手工建目录（复制即用；建完再点一次〔建立〕，面板会认出它接着往下走）：\n" + manualScaffoldCommand(base, topic)
			};
		}
		const verified = await waitForScaffold(port, root, buckets, wait);
		if (!verified.ok) {
			return {
				ok: false, done: done, root: root,
				message: "已让索引会话去建目录，但**回读没核对上**：" + verified.why +
					"（目录现在" + (verified.exists ? "在，但缺：" + verified.missing.join("、") : "还不存在") + "）",
				next: "① 打开那条索引会话看它跑到哪了；② 或直接手工建（复制即用），建完再点一次〔建立〕：\n" +
					manualScaffoldCommand(base, topic)
			};
		}
		notes.push("目录由**索引会话**跑 PowerShell 建的（面板不写盘），已回读核对到 " + verified.entries.length + " 个条目。");
		return { ok: true, done: ["features\\", topic + "\\"].concat(verified.entries.map((n) => n + "\\")), message: "", next: "" };
	};

	/**
	 * 轮询等"那几个桶真的出现了"（给会话里的 agent 一点时间）。
	 * ★ **回读是唯一判据** —— 会话说"建好了"不算，`listDir` 看得到才算。
	 * ★ 预算：真机上会话要跑一次 LLM 往返，给一分钟；用例里用 `scaffoldWait` 压到毫秒级。
	 */
	const SCAFFOLD_WAIT = { tries: 40, delayMs: 1500 };
	const waitForScaffold = async (port, root, buckets, wait) => {
		const w = Object.assign({}, SCAFFOLD_WAIT, wait || {});
		const need = buckets.map((b) => String(b).toLowerCase());
		let last = { exists: false, missing: need };
		for (let i = 0; i < w.tries; i++) {
			const st = await inspectFeatureDir(port, root);
			const have = new Set(st.entries.map((e) => String(e.name).toLowerCase()));
			const missing = need.filter((b) => !have.has(b));
			last = { exists: st.exists, missing: missing };
			if (st.exists && missing.length === 0) {
				return { ok: true, entries: st.entries.map((e) => e.name), exists: true, missing: [], why: "" };
			}
			await new Promise((r) => setTimeout(r, w.delayMs));
		}
		return { ok: false, entries: [], exists: last.exists, missing: last.missing, why: "等了 " + Math.round((w.tries * w.delayMs) / 1000) + " 秒还没建齐" };
	};

	/**
	 * ═══ 新建功能（v5 的机制核心）═══
	 * 建目录 → 4 个桶 → 专属工作区 → 工作会话（策划模式）。
	 *
	 * ★ 建目录有**三条路**，按能力退（2026-10-09 实测缺陷换来的）：
	 *   ① `uiWorkspace.createDirectory` —— 只在目录选择器的 **browse** 后端存在；
	 *   ② 让**索引会话**跑一条 PowerShell（`New-Item -Force` 幂等）+ 面板回读核对 —— 通用；
	 *   ③ 都不行 ⇒ 把逐字命令给用户，他建完再点一次〔建立〕（面板认出"空脚手架"就接着往下走）。
	 *   为什么 Windows 上①必然没有：`directory-picker-auto` 的规则里 `win32 → native`，
	 *   而 `createDirectory` 在宿主侧被 `requireCapability("browse", …)` 挡着。
	 *   判据与理由写在 `pure/createfeature.ts` 的"建目录：三条路"那一节。
	 */
	const createFeature = async (topic, o) => {
		const opts = o || {};
		const port = portOf(opts.sid || "");
		const facts = await loadCreateFacts(port, { srWs: srWsCache });
		const base = String(srWsCache).replace(/[\\/]+$/, "");
		const root = featureRootFor(base, String(topic == null ? "" : topic));

		/**
		 * 「目录已经在」的两种情形要分开：
		 *   · **空脚手架**（只有几个桶、一个文件都没有，含"建到一半"）⇒ 接着往下建工作区与会话；
		 *   · **有内容** ⇒ 是真功能，照旧拒绝重名（`planNewFeature` 的 `dir-exists`）。
		 */
		const state = await inspectFeatureDir(port, root, opts.signal);
		const resumeOnScaffold = state.exists && state.bare;

		const plan = planNewFeature(topic, { dirNames: resumeOnScaffold ? [] : facts.dirNames, wsPaths: opts.wsPaths || [], srWs: base });
		if (facts.note) plan.message = facts.note + " " + plan.message;
		if (!plan.ok) return { ok: false, message: plan.message, next: plan.next, plan: plan };

		const notes = [];
		const done = [];
		if (resumeOnScaffold) {
			notes.push("这个功能目录已经在（里面**只有桶、没有任何文件**）—— 按现成的接着建工作区与会话，不重复建目录。");
			for (const e of state.entries) done.push(e.name + "\\");
		} else {
			const scaffold = await scaffoldDirs(port, base, plan.topic, plan.buckets, opts.sid, opts.signal, notes, opts.scaffoldWait);
			if (!scaffold.ok) {
				return {
					ok: false, plan: plan, root: plan.root, topic: plan.topic, notes: notes,
					message: scaffold.message,
					next: scaffold.next
				};
			}
			for (const d of scaffold.done) done.push(d);
		}

		// ④ 专属工作区 + ⑤ 工作会话（策划模式）
		const made = await createSessionAt(plan.root, sessionTitleFor(plan.topic), PLAN_PRESET, { fullAccess: true, signal: opts.signal });
		for (const n of made.note) notes.push(n);
		if (made.error) {
			return {
				ok: false, plan: plan, root: plan.root, topic: plan.topic, notes: notes,
				message: "目录建好了（" + done.join("、") + "），但工作区 / 工作会话没建起来：" + made.error,
				next: "目录已经能用（刷新看板就能看到卡片）；工作会话会在你点「交给工作会话」时自动重试。"
			};
		}
		if (made.sid) {
			workCacheSet(plan.root, made.sid);
			WORK_SESSION.set(normPath(plan.root), made.sid);
		}
		return {
			ok: true, topic: plan.topic, root: plan.root, sid: made.sid, notes: notes,
			doneText: createDoneNotice(plan.topic, plan.root, made.sid)
		};
	};

	// ── 工作会话（每个功能一条；认领凭据 = 标题前缀 + 自己写的缓存）────
	const WORK_SESSION = new Map();

	const ensureWorkSession = async (root, o) => {
		const opts = o || {};
		const key = normPath(root);
		if (key === "") return { ok: false, error: "算不出这个功能的工作目录。" };
		return singleFlight("work:" + key, async () => {
			const note = [];
			const memory = WORK_SESSION.get(key) || "";
			if (memory) return { ok: true, sid: memory, source: "memory", note: note, title: workTitleFor(root) };
			const cached = workCacheGet(workCacheRaw(), root);
			const L = await listSessions(opts.signal);
			const rows = L.ok ? rowsFromList(L.value) : [];
			if (!L.ok) note.push("会话列表读取失败：" + humanError(L));
			const hit = pickWorkSession(rows, root, { cachedId: cached, archived: opts.archived });
			if (hit) {
				WORK_SESSION.set(key, hit.id);
				workCacheSet(root, hit.id);
				if (needsFullAccess(hit.row.preset)) {
					const plan = permissionPlanOf(await permissionCatalog());
					if (plan.needed) {
						const ex = await portOf("").execCommand(hit.id, permissionCommandLine(plan.preset));
						if (!ex.ok) note.push("这条工作会话的权限没能切成完全权限：" + humanError(ex) + "（功能目录之外的产出可能被拦）。");
					}
				}
				return { ok: true, sid: hit.id, source: hit.source, note: note, title: workTitleFor(root) };
			}
			const title = workTitleFor(root);
			const made = await createSessionAt(root, title, PLAN_PRESET, { fullAccess: true, signal: opts.signal });
			for (const n of made.note) note.push(n);
			if (made.error) return { ok: false, error: made.error, note: note };
			WORK_SESSION.set(key, made.sid);
			workCacheSet(root, made.sid);
			return { ok: true, sid: made.sid, source: "created", note: note, title: title };
		});
	};

	/** 头脑风暴四入口**唯一**的出口：认领工作会话 → 把指令发进去。 */
	const sendToWorkSession = async (root, text, signal) => {
		const got = await ensureWorkSession(root, { signal: signal });
		if (!got.ok) {
			return {
				ok: false, error: got.error || "拿不到工作会话。",
				next: "看左侧有没有一条标题以「策划工作台·工作」开头的会话；没有就再点一次。"
			};
		}
		const r = await portOf("").prompt(got.sid, text);
		if (!r.ok) {
			return { ok: false, error: humanError(r), next: "打开那条工作会话看看它是不是在跑；在跑的话指令会排队，不会丢。" };
		}
		return { ok: true, sid: got.sid, source: got.source, notes: got.note || [] };
	};

	/** 打开一个文件（默认应用 → 文件管理器 reveal）。 */
	const openAbs = async (abs) => {
		const ns = ctx.remote && ctx.remote.session;
		if (!ns || typeof ns.openWorkspacePath !== "function") {
			return { ok: false, error: { message: "remote.session.openWorkspacePath 不可用 —— 请手工打开：" + abs } };
		}
		const r = await safeCall("openWorkspacePath", () => ns.openWorkspacePath({ path: abs }, new AbortController().signal));
		if (r.ok) return { ok: true };
		const r2 = await safeCall("openWorkspacePath.reveal", () => ns.openWorkspacePath({ path: abs, action: "reveal" }, new AbortController().signal));
		if (r2.ok) return { ok: true };
		return { ok: false, error: { message: humanError(r) + "　｜　换 reveal 也失败：" + humanError(r2) } };
	};

	/** 跳到某条会话（DSH 自己的 uiWorkspace 服务；会把中栏切回对话）。 */
	const openSession = (sid) => {
		try {
			const uw = svc(ctx, "uiWorkspace");
			if (!uw || typeof uw.openSession !== "function") return { ok: false, error: { message: "uiWorkspace 服务不可用" } };
			uw.openSession(sid);
			return { ok: true };
		} catch (e) {
			return { ok: false, error: { message: String((e && e.message) || e) } };
		}
	};

	// ── 给面板的加载器（组合根是唯一知道 ctx 的地方）──────────────────
	const dashboardLoader = async (idx, signal) => {
		const d = await loadDashboard(portOf(idx.sid), { configPath: idx.configFile || "", signal: signal });
		if (d.srWs) srWsCache = d.srWs;
		return d;
	};
	const featureLoader = (idx, root, signal) => loadFeatureDetail(portOf(idx.sid), { root: root, signal: signal });
	const createFactsRunner = (idx, srWs) => loadCreateFacts(portOf(idx.sid), { srWs: srWs || idx.srWs });

	function PanelBound(props) {
		return h(PanelErrorBoundary, null,
			h(Panel, Object.assign({}, props, {
				__index: resolveIndexSession,
			__saveConfig: saveConfigTo,
			__askmeConfig: runAskme,
			/** 面板配好的配置路径（浏览器拿不到家目录，认路全靠它 + 工作区根下的指针文件）。 */
			__configPath: String((cfg && cfg.configPath) || ""),
			/** 系统目录选择框（native 后端才有；拿不到就返回空串，界面提示手打）。 */
			__pickDirectory: async () => {
				const uw = svc(ctx, "uiWorkspace");
				if (!uw || typeof uw.pickDirectory !== "function") return "";
				try {
					const picked = await uw.pickDirectory();
					return typeof picked === "string" ? picked : (picked && (picked.path || picked.directory)) || "";
				} catch (e) { return ""; }
			},
				__dashboard: dashboardLoader,
				__feature: featureLoader,
				__createFacts: createFactsRunner,
				__createFeature: createFeature,
				__sendBrainstorm: (root, text) => sendToWorkSession(root, text),
				__workSessionOf: (root) => WORK_SESSION.get(normPath(root)) || workCacheGet(workCacheRaw(), root) || "",
				/** 上次打开的状态：面板第一帧读它、动视图时写它（见 `pure/panelview.ts`）。 */
				__viewCacheRaw: viewCacheRaw,
				__viewCacheSet: viewCacheSet,
				__open: openAbs,
				__openSession: openSession
			})));
	}

	ctx.slots.inject("main", function* () {
		yield ctx.slots.register({ name: "main", key: "sr-workbench" }, PanelBound);
	});
	ctx.slots.inject("sidebar.panellist", function* () {
		yield ctx.slots.register(
			{ name: "sidebar.panellist", id: "sr-workbench", order: 100, label: "策划工作台" },
			function Glyph() { return h("span", { style: { fontSize: FONT.card } }, "▤"); }
		);
	});
}
