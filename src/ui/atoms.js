/**
 * 官方 UI 原子库的**唯一引入点**（薄封装）—— `@deepseek-ai/dsh-client-ui-primitives`。
 *
 * ── 为什么要有这一层 ────────────────────────────────────────────────────────
 *   ① **一处引入**：整个插件只有这个文件认识 primitives。它是 `0.2.0-rc.2`（rc 版），
 *      DSH 升级可能改 API —— 换版只改这一个文件，面板各处不用动。
 *   ② **守卫式取用**：用 `typeof require === "function"` + `try/catch` 拿，**拿不到就退回自绘**。
 *      绝不能因为"宿主没给这个包"就让整个面板加载失败（那是白屏级别的事故）。
 *      官方插件是直接 `import` 的（`dsh-client-ui-plan` 就写着
 *      `require("@deepseek-ai/dsh-client-ui-primitives")`）—— 它们的包与宿主同批发布，
 *      而我们是**第三方插件**，所以按"可选依赖"处理。
 *   ③ 拿不到时**如实记下原因**（`PRIMITIVES_WHY`），供诊断与冒烟断言用。
 *
 * ── 这个 require 为什么能跑通 ───────────────────────────────────────────────
 *   产物是 CJS，外壳是 `window.__ModuleLoader__.load({ factory: (require) => { … } })` ——
 *   `require` 是**外壳传进来的参数**，指向宿主的模块表。所以这份源码里的 `require("…")`
 *   在运行期真能取到宿主自己那份 primitives（与 `require("react")` 同一条路）。
 *   ★ 不要在这里写 `import`：静态 import 会让"包不在"变成**加载期抛错**，整个插件装不上。
 *
 * ── 拿到之后能用什么（2026-10-09 读 `lib/index.js` 与 `lib/*.module.css` 得知）──────
 *   · `Button { variant: "primary"|"ghost", size: "sm"|"md", icon, … }`
 *   · `Tag { tone }` · `Pill { active, onClick }` · `StateDot { state }`
 *   · `SegmentedTabs { items:[{value,id,label}], value, onChange, label }`（键盘与 ARIA 都在里面）
 *   · `DisclosureRow` · `HoverCard` · `Tooltip` · `Modal` · `Toast` · `Input`
 *   · `MarkdownText { text, variant:"body" }` · `CodeBlock` · `JsonBlock` / `JsonTree`
 *   · `PathLabel { path }` · `FileTypeIcon` · `ImageLightbox` · `Icon*`（约 150 个，Medium/Regular 两档）
 *   · 工具：`writeClipboard` · `relativeTime` · `fileSizeText`
 */

/**
 * 取一次（**只取一次**：模块表在一个页面里不会变）。
 * ★ 写成"返回一个带 why 的对象"而不是"先声明后赋值"：后者会被 rolldown 当成死存储删掉
 *   （实测：`if (primitives === null) why = …` 被 DCE 成了 `if (primitives === null);`），
 *   于是诊断信息莫名其妙丢了。
 */
function load() {
	try {
		if (typeof require !== "function") {
			return { mod: null, why: "这个环境里没有 require（不在 ModuleLoader 外壳里跑）" };
		}
		const mod = require("@deepseek-ai/dsh-client-ui-primitives") || null;
		return { mod: mod, why: mod === null ? "模块表里没有这个包（require 返回空）" : "" };
	} catch (e) {
		return { mod: null, why: "require 抛错：" + String((e && e.message) || e) };
	}
}
const loaded = load();

/** 宿主那份 primitives 模块（拿不到就是 `null`）。**只有这个文件该碰它。** */
export const PRIMITIVES = loaded.mod;

/** 拿不到的原因（拿得到时是空串）—— 诊断与冒烟断言用。 */
export const PRIMITIVES_WHY = loaded.why;

/**
 * 这个值能不能当组件渲染。
 *
 * ★ **真踩过**（插件 5.1.0 → 5.1.1）：`Button` 是 `forwardRef(...)` 的产物、`MarkdownText` 是
 *   `memo(...)` 的产物 —— 两者都是**对象**（`{ $$typeof: Symbol(react.forward_ref), render }`），
 *   **不是函数**。第一版判据只认 `typeof === "function"`，于是真机上明明 require 到了 primitives，
 *   却被判成"没拿到"、整片退回自绘 —— 界面底部那行还写着"未知原因"（因为 `why` 只在真失败时才有）。
 */
export function isComponent(v) {
	if (typeof v === "function") return true;
	if (v === null || typeof v !== "object") return false;
	// React 的 forwardRef / memo / lazy 都带 `$$typeof`（symbol）—— 认这个，别认"随便一个对象"
	return typeof v.$$typeof === "symbol";
}

/** 关键组件齐不齐（只认我们真会用的那几个；缺一个就整体退回自绘）。 */
export const HAS_PRIMITIVES = !!(
	PRIMITIVES &&
	isComponent(PRIMITIVES.Button) &&
	isComponent(PRIMITIVES.Tag) &&
	isComponent(PRIMITIVES.MarkdownText)
);

/** 给人看的一句话（面板底部/诊断用）。 */
export function primitivesNote() {
	return HAS_PRIMITIVES ? "UI：宿主组件库（官方 primitives）" : "UI：自绘控件（拿不到宿主组件库 —— " + (PRIMITIVES_WHY || "未知原因") + "）";
}
