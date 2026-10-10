/**
 * **面板视图记忆** —— 记住"上次打开的状态"（用户口径 2026-10-10：
 * 「策划工作台希望记录一下上次打开的状态，现在每次从工作会话切工作台想进对应功能看看都要重头点」）。
 *
 * ── 症状与根因 ──────────────────────────────────────────────────────────────
 *   面板是主区里的一个槽组件：从工作会话切回工作台时它会**重挂载** ⇒ 组件内的
 *   `view` 状态回到初值（卡片墙），想接着看某个功能就得"卡片 → 模块页签"重头点一遍。
 *   所以要把这两件事写进 `localStorage`：**上次停在哪个功能** + **那个功能里看的是哪个模块**。
 *
 * ── 这里为什么不直接读 localStorage ─────────────────────────────────────────
 *   与 `indexCacheKey` / `workCacheKey` 一路：pure 层只放**键名 / 解析 / 序列化 / 容错**，
 *   真正的读写留在组合根 `src/client.js`（pure 层不许碰 `localStorage`，见 `test/seam.test.ts`）。
 *
 * ── 记多少 ──────────────────────────────────────────────────────────────────
 *   只记**最近一次**，不按功能分别记（用户要的是"切回来接着看"，不是"每个功能一个书签"）。
 *   `topic === ""` 就是"上次停在卡片墙" —— 主动点〔返回卡片墙〕也算一次状态，尊重它。
 *
 * ★ 容错口径：坏 JSON / 形状不对 / 未知模块名 / 功能后来改名或删了 —— 一律**退回卡片墙**，
 *   绝不抛、绝不假装记得（"认不出来"与"没记过"在界面上是同一件事）。
 */

/** 功能详情里的三个模块 id（与 `src/client.js` 的 `MODULES` 同源；这里只存 id）。 */
export const PANEL_MODS = ["brainstorm", "decisions", "outputs"] as const;

export type PanelViewMod = (typeof PANEL_MODS)[number];

/** 一条记忆：`topic === ""` 表示"上次停在卡片墙"。 */
export interface PanelViewMemory {
	topic: string;
	/** 只有 `topic !== ""` 时才有意义；认不出来时是空串（调用方回落到默认模块）。 */
	mod: PanelViewMod | "";
}

/** localStorage 里记"上次打开的状态"的键（只在组合根里读写）。 */
export function panelViewKey(): string {
	return "sr-wb.view.v1";
}

/** 一条空记忆（**每次新建对象**，免得调用方改到共享常量）。 */
export function panelViewEmpty(): PanelViewMemory {
	return { topic: "", mod: "" };
}

/** 这个模块名认不认：只认那三个 id，其它（含 `undefined` / 老版本写的怪值）一律空串。 */
export function panelModOf(v: unknown): PanelViewMod | "" {
	return typeof v === "string" && (PANEL_MODS as readonly string[]).indexOf(v) >= 0 ? (v as PanelViewMod) : "";
}

/** localStorage 原文 → 记忆。坏值一律当"没记过"，绝不抛。 */
export function panelViewParse(raw: unknown): PanelViewMemory {
	if (typeof raw !== "string" || raw === "") return panelViewEmpty();
	try {
		const v = JSON.parse(raw) as Record<string, unknown> | null;
		if (!v || typeof v !== "object") return panelViewEmpty();
		const topic = typeof v.topic === "string" ? v.topic.trim() : "";
		// 没有 topic 就没有"要恢复的功能" ⇒ 与"没记过"同义（模块名一并丢掉，不留半个记忆）
		if (topic === "") return panelViewEmpty();
		return { topic: topic, mod: panelModOf(v.mod) };
	} catch (e) {
		return panelViewEmpty();
	}
}

/** 记忆 → localStorage 原文（组合根负责 `setItem`）。`topic` 为空 ⇒ 写成"卡片墙"，模块一并丢掉。 */
export function panelViewSerialize(topic: unknown, mod: unknown): string {
	const t = typeof topic === "string" ? topic.trim() : "";
	if (t === "") return JSON.stringify(panelViewEmpty());
	return JSON.stringify({ topic: t, mod: panelModOf(mod) });
}
