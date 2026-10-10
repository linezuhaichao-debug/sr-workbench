/**
 * 技能用法弹窗的**纯解析**（零 IO）：把 `sr-askme` 的教学素材解析成面板能直接渲染的形状。
 *
 * ── 内容只有一个来源 ─────────────────────────────────────────────────────
 *   全部来自包内 `skills/sr-askme/`：`SKILL.md` 的「二、使用教学」那一节 + `references/teaching/*.md`。
 *   面板**不复制**任何一句教学文字 —— 技能改了，重开弹窗就变。
 *
 * ── 解析不出来怎么办 ─────────────────────────────────────────────────────
 *   **如实说**：能解析多少给多少，解析不出的进 `problems`（点名是哪一块）。
 *   绝不"猜一个"补位 —— 那是这个仓库最忌的事。
 */

export interface TeachingStep {
	/** 主线里的序号（1 起）。 */
	n: number;
	/** 加粗的小标题（如「成稿」）。 */
	title: string;
	/** 该项的正文（标题之后的原文，保留换行与子项）。 */
	text: string;
}

export interface TeachingRoute {
	/** 「你想做什么」那一列。 */
	want: string;
	/** 「用哪个」那一列（保留 `/sr-xxx` 原样，可能带括号说明）。 */
	skill: string;
}

export interface TeachingRule {
	title: string;
	body: string;
}

export interface TeachingCard {
	/** 技能名（文件名去 `.md`）。 */
	id: string;
	/** 文件里的第一个 `# ` 标题；没有就用 id。 */
	title: string;
	/** 卡片正文（markdown 原文）。 */
	body: string;
	rel: string;
}

export interface TeachingModel {
	ok: boolean;
	/** 主线：askme 里那串编号项。 */
	steps: TeachingStep[];
	/** 「独立技能」那一句（原文，可能为空串）。 */
	standalone: string;
	/** 速查表。 */
	routes: TeachingRoute[];
	/** 两个规则节（产出落盘 / 数值铁律）。 */
	rules: TeachingRule[];
	/** 使用卡（按文件名排序）。 */
	cards: TeachingCard[];
	problems: string[];
}

/** 取某一节（`## 二、使用教学` 这类二级标题）的正文；取不到返回空串。 */
export function sectionOf(md: string, heading: string): string {
	const lines = String(md || "").split(/\r?\n/);
	const start = lines.findIndex((l) => l.trim() === heading.trim());
	if (start < 0) return "";
	const lvl = (lines[start].match(/^#+/) || ["##"])[0].length;
	const out: string[] = [];
	for (let i = start + 1; i < lines.length; i++) {
		const m = lines[i].match(/^(#+)\s/);
		if (m && m[1].length <= lvl) break;
		out.push(lines[i]);
	}
	return out.join("\n").trim();
}

/** 取三级标题（`### 速查表…`）的正文。 */
function subSectionOf(md: string, prefix: string): string {
	const lines = String(md || "").split(/\r?\n/);
	const start = lines.findIndex((l) => l.startsWith("### ") && l.slice(4).trim().startsWith(prefix));
	if (start < 0) return "";
	const out: string[] = [];
	for (let i = start + 1; i < lines.length; i++) {
		if (/^#{1,3}\s/.test(lines[i])) break;
		out.push(lines[i]);
	}
	return out.join("\n").trim();
}

/** 解析主线：`**主线**：…` 之后那串 `1. **标题**：正文`（正文可续行，直到下一个编号项）。 */
export function parseSteps(section: string): TeachingStep[] {
	const lines = String(section || "").split(/\r?\n/);
	const at = lines.findIndex((l) => /^\*\*主线\*\*/.test(l.trim()));
	if (at < 0) return [];
	const out: TeachingStep[] = [];
	let cur: TeachingStep | null = null;
	for (let i = at + 1; i < lines.length; i++) {
		const line = lines[i];
		const m = /^(\d+)\.\s+\*\*(.+?)\*\*\s*[：:]?\s*(.*)$/.exec(line.trim());
		if (m) {
			if (cur) out.push({ n: cur.n, title: cur.title, text: cur.text.trim() });
			cur = { n: Number(m[1]), title: m[2].trim(), text: m[3] };
			continue;
		}
		// 编号串结束：遇到别的加粗小标题（**独立技能** 等）或空行后的非缩进行就收尾
		if (cur === null) continue;
		if (/^\*\*[^*]+\*\*/.test(line.trim()) && !/^\s{2,}/.test(line)) break;
		if (line.trim() === "" && (lines[i + 1] || "").trim() !== "" && !/^\s{2,}/.test(lines[i + 1] || "") && !/^[-*\d]/.test((lines[i + 1] || "").trim())) break;
		cur.text += "\n" + line;
	}
	if (cur) out.push({ n: cur.n, title: cur.title, text: cur.text.trim() });
	return out;
}

/** 解析「skill 一览」：`| skill | 干什么 | 关键产出 |` 的数据行（第一列技能名去反引号）。 */
export function parseRoutes(section: string): TeachingRoute[] {
	const out: TeachingRoute[] = [];
	for (const line of String(section || "").split(/\r?\n/)) {
		const t = line.trim();
		if (!t.startsWith("|")) continue;
		const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
		if (cells.length < 2) continue;
		const skill = cells[0].replace(/`/g, "").trim();
		const what = cells[1] || "";
		const outCol = cells[2] || "";
		if (skill === "" || what === "" || /^-+$/.test(skill) || /^-+$/.test(what)) continue;   // 表头 / 分隔行
		if (skill === "skill") continue;                                                          // 表头
		out.push({ skill: skill, what: what, out: outCol });
	}
	return out;
}

/** 解析「独立技能」那一句（原文，供界面照抄）。 */
export function parseStandalone(section: string): string {
	for (const line of String(section || "").split(/\r?\n/)) {
		if (/^\*\*独立技能\*\*/.test(line.trim())) return line.trim();
	}
	return "";
}

/** 从一张教学卡里取标题（第一个 `# `）。 */
export function cardTitleOf(text: string, fallback: string): string {
	for (const line of String(text || "").split(/\r?\n/)) {
		const m = /^#\s+(.+)$/.exec(line.trim());
		if (m) return m[1].trim();
	}
	return fallback;
}

/** 总入口：把 SKILL.md 正文 + 教学卡列表解析成模型。 */
export function parseTeaching(input: { skillMd: string; cards?: Array<{ rel: string; text: string }> }): TeachingModel {
	const md = String((input || {}).skillMd || "");
	const problems: string[] = [];
	const teach = sectionOf(md, "## 二、使用教学");
	if (teach === "") problems.push("SKILL.md 里找不到「## 二、使用教学」这一节");
	const steps = parseSteps(teach);
	if (steps.length === 0) problems.push("主线那串编号项解析不出来（在「推荐用法」小标题之后）");
	const routesSec = subSectionOf(md, "skill 一览");
	const routes = parseRoutes(routesSec);
	if (routes.length === 0) problems.push("「skill 一览」解析不出来（### skill 一览… 下面的表格）");
	const rules: TeachingRule[] = [];
	const deposit = subSectionOf(md, "产出落盘位置");
	if (deposit !== "") rules.push({ title: "产出落盘位置", body: deposit });
	else problems.push("找不到「产出落盘位置」这一节");
	const iron = subSectionOf(md, "数值铁律");
	if (iron !== "") rules.push({ title: "数值铁律", body: iron });
	else problems.push("找不到「数值铁律」这一节");
	const cards: TeachingCard[] = (input.cards || []).map((c) => {
		const id = String(c.rel || "").replace(/^.*[\\/]/, "").replace(/\.md$/i, "");
		return { id: id, title: cardTitleOf(c.text, id), body: String(c.text || ""), rel: String(c.rel || "") };
	}).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	if (cards.length === 0) problems.push("一张教学卡都没读到（references/teaching/*.md）");
	return {
		ok: steps.length > 0 && routes.length > 0,
		steps: steps,
		standalone: parseStandalone(teach),
		routes: routes,
		rules: rules,
		cards: cards,
		problems: problems
	};
}
