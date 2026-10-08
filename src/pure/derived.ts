/**
 * 派生物与过期检测（工单 28）—— **纯函数层**（零 IO、零时钟、零全局）。
 *
 * ── 这一层要回答的问题 ────────────────────────────────────────────────────────
 *   ① 交付桶（`delivery\`）里的哪个文件是哪一类**派生物**（宣讲 HTML / AI 读版 / 侧车 / 其它）；
 *   ② 一份派生物**基于哪一版定稿**（读侧车里的 `basedOn` / `basedOnVersion`）；
 *   ③ 它**是不是过期了** —— 拿侧车记的指纹与**当前定稿的指纹**比；
 *   ④ 发出去让 agent 生成派生物的那条指令（含要原样落盘的侧车 JSON）。
 *
 * ── 判据口径（不许自己发明，引工单 25 的实测）────────────────────────────────
 * **版本指纹 = 宿主 `stat` 返回的那一串 `version` 原文**，形状
 * `dev:ino:size:mtimeNs:ctimeNs`（`dsh-fs-local` 的 `versionOf`；第 4 段 = mtime 纳秒）。
 * 实测链在 `src/pure/fsstamp.ts` 的文件头（工单 25 · `_25-stat-evidence.txt`）：
 * 面板**不解析**它来判新旧（工单 16 立的纪律不变），**只拿它做"是不是同一份内容"的等值比对** ——
 * 这正是 `WorkspaceFileStat.version` 自己的语义，也是定稿门判"审查报告是不是比定稿旧"用的同一套口径。
 *
 * ── 三条降级纪律（本票第 5 条）────────────────────────────────────────────────
 *   · **读不到侧车 / 侧车不是 JSON / 侧车里没记指纹 / 当前定稿的指纹拿不到** ⇒ 一律
 *     `unknown`，界面上写"面板看不到依据 —— 不默认它是最新的"；
 *   · **没有 active 定稿**（真实数据：诸神降临、英雄圣物）⇒ 同上，并且**不发**生成指令
 *     （没有源定稿可派生 —— 给出去路，不硬跑）；
 *   · 绝不把 `unknown` 显示成"已是最新"。宁可说"不知道"，不说假的"没问题"。
 */

import { atText, mtimeOf, stampOf } from "./fsstamp.ts";

// ════════════════════════════════════════════════════════════════
// 一、两类派生物（skill / 命名 / 落点）
// ════════════════════════════════════════════════════════════════

/**
 * 侧车（provenance）的 schema 名。机器可读的第一件事就是它能被认出来 ——
 * 面板只认这个串；形状对不上一律当"看不到依据"（不猜）。
 */
export const DERIVED_PROVENANCE_SCHEMA = "sr-workbench/derived-provenance@1";

/** 侧车后缀（与产物同基名：`X.html` → `X.provenance.json`） */
export const SIDECAR_SUFFIX = ".provenance.json";

export interface DerivedKindDef {
	/** 稳定 id（DOM 属性 / 侧车字段都用它） */
	id: "speech" | "aiv";
	/** 界面上的名字 */
	label: string;
	/** 还没有产物时按钮上的话 */
	button: string;
	/** 已经有产物时按钮上的话（过没过期都是这一颗 —— 动作同一个） */
	again: string;
	/** 干这件事的 skill */
	tool: string;
	/** skill 目录名（拼盘上那份 SKILL.md 的路径用） */
	dir: string;
	/** 产物扩展名 */
	ext: string;
	/** 首屏那一行人话里的一句说明 */
	note: string;
}

/**
 * ★ **哪个动作跑哪个 skill，以规格与现有技能为准**（本票开工前逐个核过）：
 *
 *   · **宣讲 HTML → `sr-gdd-html`** —— 规格 §3.3 的产出表逐字写着
 *     「**`sr-gdd-html`** | 宣讲 HTML + `.content.json` | `delivery\`」；
 *     该 skill 自己的正文第一句是"把一份功能 GDD **定稿**重排成评审会/宣讲会用的单文件自包含 HTML"，
 *     产出规范 `proposals\<主题>_宣讲_<日期>.html` + `.content.json`（真数据里两份都在，见报告）。
 *   · **AI 读版 → `plan-doc-ai-version`** —— 本机唯一产出"**正式AI读版**"的 skill
 *     （`SKILL.md`: "Turn a human-readable design document into a downstream-agent-ready
 *     **正式AI读版策划案**"；产物命名 `正式AI读版_<功能名>_v<版本>.md`，真数据在
 *     `<SR>\\运行包_联盟悬赏\\04_AI输出_策划审核\\03_正式交付\\`）。
 *   · `plan-doc-human-review`（策划审核版 HTML）**不是**这两个动作中的任何一个：它的产出是
 *     `<功能名>_人读版策划案.html`，是"从想法/材料写成一份可读策划案"的**写作**流程，
 *     不是"把已有定稿重排成宣讲页"的呈现层工具。核过它的 Non-Negotiable Rules 第 9 条。
 */
export const DERIVED_KINDS: DerivedKindDef[] = [
	{
		id: "speech", label: "宣讲 HTML", button: "出宣讲 HTML", again: "重新生成宣讲 HTML",
		tool: "sr-gdd-html", dir: "sr-gdd-html", ext: ".html",
		note: "评审会/宣讲会用，单文件自包含（截图 base64 内嵌、零外链），可直接投屏、可直接外发"
	},
	{
		id: "aiv", label: "AI 读版", button: "出 AI 读版", again: "重新生成 AI 读版",
		tool: "plan-doc-ai-version", dir: "plan-doc-ai-version", ext: ".md",
		note: "给下游 agent 读的正式语义源（人读版 → AI 读版），交付桶里的那一份"
	}
];

export function kindDefOf(id: unknown): DerivedKindDef | null {
	const k = String(id == null ? "" : id);
	return DERIVED_KINDS.filter((x) => x.id === k)[0] || null;
}

// ════════════════════════════════════════════════════════════════
// 二、命名（产物 / 侧车）与交付桶里的文件分类
// ════════════════════════════════════════════════════════════════

/** 一行文本（去换行与多余空白） */
function oneLine(v: unknown): string {
	return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
}

/** 路径显示统一成 `\`（只改显示的字符串；与 `client.js` 的 `winPath` 同口径） */
function winOf(p: unknown): string {
	return String(p == null ? "" : p).replace(/[\\/]+$/, "").replace(/\//g, "\\");
}

/** 日期：只留 8 位数字（面板给今天；**纯函数不吃时钟**，测试才能逐字断言） */
function compactOf(v: unknown): string {
	const s = String(v == null ? "" : v).replace(/[^0-9]/g, "");
	return s.length >= 8 ? s.slice(0, 8) : "";
}

/**
 * 产物文件名。
 *   · 宣讲：`<主题>_宣讲_<YYYYMMDD>.html` —— 与 `sr-gdd-html` 的产出规范（真数据里那两份）同形；
 *   · AI 读版：`正式AI读版_<主题>_<YYYYMMDD>.md` —— 沿用该 skill 的 `正式AI读版_<功能名>_…`
 *     口径，只把版本段换成面板这一侧统一的日期（面板不认识它的 `v1.1` 版本号，不编）。
 * 拿不到主题/日期时给占位串 —— 界面上一眼能看出"这两个字段没给"，而不是拼出半个名字。
 */
export function artifactNameOf(kindId: unknown, topic: unknown, compact: unknown): string {
	const k = kindDefOf(kindId);
	if (!k) return "";
	const t = oneLine(topic) || "<主题>";
	const d = compactOf(compact) || "<YYYYMMDD>";
	return k.id === "speech" ? t + "_宣讲_" + d + ".html" : "正式AI读版_" + t + "_" + d + ".md";
}

/** 产物名 → 侧车名（同基名；`X.html` → `X.provenance.json`） */
export function sidecarNameOf(artifactName: unknown): string {
	const n = oneLine(artifactName);
	if (n === "") return "";
	// 只砍**最后一个**扩展名：`X.content.json` 那种不该进来（它是宣讲的可复跑源，不是派生物本体）
	return n.replace(/\.[A-Za-z0-9]+$/, "") + SIDECAR_SUFFIX;
}

/** 交付桶里的一个文件属于哪一类 */
export type DeliveryKind = "speech" | "speechSrc" | "aiv" | "sidecar" | "other";

/**
 * 交付桶里的文件名 → 类别。**判据只看文件名**，与 `buckets.ts` 的 `gddKindOf` 同一套写法
 * （那个模块只认 `gdd\` 内部，这里是 `delivery\` 这一桶）。
 *   · `X_宣讲_<日期>.content.json` —— 宣讲的**可复跑源**，随 HTML 留档，**不单独判过期**
 *     （它俩是一份派生物的两半）；
 *   · `X.provenance.json` —— 侧车，不是派生物本体；
 *   · 其余落 `other`（例如 `历史归档说明_*.md`、UE 交付包），面板不把它当派生物显示。
 */
export function kindOfDeliveryFile(name: unknown): DeliveryKind {
	const n = oneLine(name);
	if (n === "") return "other";
	if (n.toLowerCase().endsWith(SIDECAR_SUFFIX)) return "sidecar";
	if (/_宣讲_.*\.content\.json$/i.test(n)) return "speechSrc";
	if (/_宣讲_.*\.html?$/i.test(n)) return "speech";
	if (/^(正式)?AI读版.*\.(md|html?)$/i.test(n)) return "aiv";
	if (/_AI读版_.*\.(md|html?)$/i.test(n)) return "aiv";
	return "other";
}

// ════════════════════════════════════════════════════════════════
// 三、侧车（provenance）
// ════════════════════════════════════════════════════════════════

export interface Provenance {
	schema: string;
	kind: string;
	artifact: string;
	tool: string;
	/** 基于哪份定稿（文件名） */
	basedOn: string;
	/** 那份定稿的绝对路径（可读性用；判定不依赖它） */
	basedOnPath: string;
	/** ★ 那份定稿的**版本指纹**（宿主 `version` 原文，工单 25 的 `versionOf` 口径） */
	basedOnVersion: string;
	/** 生成时间（agent 落盘时自己填；面板只显示，不拿它判新旧） */
	generatedAt: string;
}

export interface ParsedProvenance {
	ok: boolean;
	data: Provenance | null;
	/** 不 ok 时的原因（人话，界面直接显示） */
	why: string;
}

/**
 * 解析侧车文本。
 * ★ `text === null` 表示**这个文件读不到**（不存在 / 没权限）—— 与"读到了但不是 JSON"分开说，
 *   因为用户要做的下一步不同（前者：让 agent 重生成；后者：侧车被改坏了）。
 */
export function parseProvenance(text: unknown): ParsedProvenance {
	if (text === null || text === undefined) return { ok: false, data: null, why: "侧车读不到（这个文件不在）" };
	const s = String(text).trim();
	if (s === "") return { ok: false, data: null, why: "侧车是空文件" };
	let j: any = null;
	try {
		j = JSON.parse(s);
	} catch (e) {
		return { ok: false, data: null, why: "侧车不是合法 JSON（" + oneLine(String((e && e.message) || e)).slice(0, 80) + "）" };
	}
	if (!j || typeof j !== "object" || Array.isArray(j)) return { ok: false, data: null, why: "侧车不是 JSON 对象" };
	const g = (k: string) => oneLine(j[k]);
	return {
		ok: true,
		why: "",
		data: {
			schema: g("schema"), kind: g("kind"), artifact: g("artifact"), tool: g("tool"),
			basedOn: g("basedOn"), basedOnPath: g("basedOnPath"),
			basedOnVersion: String(j.basedOnVersion == null ? "" : j.basedOnVersion).trim(),
			generatedAt: g("generatedAt")
		}
	};
}

// ════════════════════════════════════════════════════════════════
// 四、过期判定
// ════════════════════════════════════════════════════════════════

/** 当前有效定稿（面板认出"这一版"的全部信息） */
export interface CurrentFinal {
	/** 文件名（`gdd\` 里的那一份） */
	name: string;
	/** 绝对路径 */
	path: string;
	/** ★ 版本指纹（宿主 `stat` 的 `version` 原文）；空串 = 面板拿不到 */
	version: string;
	/** 认它的依据：`active`（头部标了 active）/ `date`（没 active，按日期取最新） */
	from: string;
}

export type DerivedState = "none" | "fresh" | "stale" | "unknown";

export interface Verdict {
	state: DerivedState;
	/** 界面上那一句人话（**一句**，机器口径进「详情」折） */
	text: string;
	/** 排障用的短理由（进详情） */
	why: string;
	/** 侧车里记的指纹（可能空） */
	recorded: string;
	/** 当前定稿的指纹（可能空） */
	current: string;
}

/** 版本指纹 → 人类时间（认不出来给空串，**不编时间**） */
export function stampText(version: unknown): string {
	return atText(mtimeOf(version));
}

/** 指纹短串（展示用：`mtime` 人话 + 纳秒尾 6 位；认不出来就原样前 24 字） */
export function shortVersion(version: unknown): string {
	const s = String(version == null ? "" : version);
	if (s === "") return "——";
	const st = stampOf(s);
	if (st) return atText(st.ms) + " · …" + st.ns.slice(-6);
	return s.slice(0, 24) + (s.length > 24 ? "…" : "");
}

/**
 * 判定一份派生物。
 *
 * @param final  当前有效定稿（`null` = 这个功能**没有**可派生的定稿）
 * @param prov   侧车解析结果
 * @param artifact 产物文件名（只用于人话里点名）
 */
export function judgeArtifact(o: { final: CurrentFinal | null; prov: ParsedProvenance; artifact: unknown }): Verdict {
	const artifact = oneLine(o.artifact) || "（这份派生物）";
	const prov = o.prov || { ok: false, data: null, why: "侧车读不到" };
	const fin = o.final;

	// ① 没有当前定稿 ⇒ 没有可比的基准（真实数据：诸神降临 / 英雄圣物）
	if (!fin) {
		return {
			state: "unknown", recorded: prov.ok && prov.data ? prov.data.basedOnVersion : "", current: "",
			text: "面板看不到依据（这个功能现在没有可派生的定稿）—— 不默认它是最新的",
			why: "`" + artifact + "`：没有 active 定稿，也就没有「这一版」可比；它是不是过期判不了。"
		};
	}
	// ② 侧车这一侧：读不到 / 坏 JSON / 没记指纹
	if (!prov.ok || !prov.data) {
		return {
			state: "unknown", recorded: "", current: fin.version,
			text: "面板看不到依据（" + (prov.why || "侧车读不到") + "）—— 不默认它是最新的",
			why: "`" + artifact + "`：没有可用的 provenance 侧车，无法判断它基于哪一版。"
		};
	}
	const rec = prov.data.basedOnVersion;
	if (rec === "") {
		return {
			state: "unknown", recorded: "", current: fin.version,
			text: "面板看不到依据（侧车里没记 `basedOnVersion`）—— 不默认它是最新的",
			why: "`" + artifact + "` 的侧车存在，但没有版本指纹字段。"
		};
	}
	// ③ 当前定稿这一侧：指纹拿不到（空串 = 宿主没给；形状不认识 = 口径变了）
	//   ★ 形状与工单 25 同一条纪律（`fsstamp.ts`）：只认严格 5 段 `dev:ino:size:mtimeNs:ctimeNs`，
	//     认不出来就**判不了** —— 绝不拿半个串去比出一个假的"已是最新"。
	if (String(fin.version) === "" || stampOf(fin.version) === null) {
		return {
			state: "unknown", recorded: rec, current: String(fin.version),
			text: "面板看不到依据（拿不到当前定稿的版本指纹）—— 不默认它是最新的",
			why: "`" + artifact + "`：宿主 `stat` 没给出 `dev:ino:size:mtimeNs:ctimeNs` 形状的版本串，过期判定做不了。"
		};
	}
	// ③' 侧车里记的那一串也得是同一个形状 —— 不是就说明侧车被改过（agent 只该逐字落盘面板给的那串）
	if (stampOf(rec) === null) {
		return {
			state: "unknown", recorded: rec, current: String(fin.version),
			text: "面板看不到依据（侧车里记的指纹不是宿主版本串的形状）—— 不默认它是最新的",
			why: "`" + artifact + "`：`basedOnVersion` = `" + String(rec).slice(0, 40) + "`，不是 5 段版本串 ⇒ 不接受为比对依据。"
		};
	}
	// ④ 基于的是**另一份**定稿（例如换了当前有效的那一版）
	if (prov.data.basedOn !== "" && prov.data.basedOn !== fin.name) {
		return {
			state: "stale", recorded: rec, current: fin.version,
			text: "已过期 —— 它基于 `" + prov.data.basedOn + "`，当前这份是 `" + fin.name + "`",
			why: "`" + artifact + "`：based-on-other —— 侧车记的定稿文件名与当前有效定稿不一致。"
		};
	}
	// ⑤ 同一份定稿：比指纹（**等值比对**，不解析）
	if (rec === fin.version) {
		return {
			state: "fresh", recorded: rec, current: fin.version,
			text: "已是最新（基于 `" + fin.name + "`" + (stampText(rec) ? "，改于 " + stampText(rec) : "") + "）",
			why: "`" + artifact + "`：指纹一致 —— 侧车里记的那一版就是当前这一版。"
		};
	}
	return {
		state: "stale", recorded: rec, current: fin.version,
		text: "已过期 —— 定稿改过（派生物基于 " + (stampText(rec) || "记录的那一版") +
			"，定稿现在是 " + (stampText(fin.version) || "另一个版本") + "）",
		why: "`" + artifact + "`：指纹不一致 —— 定稿在派生物生成之后被改过（" + shortVersion(rec) + " → " + shortVersion(fin.version) + "）。"
	};
}

// ════════════════════════════════════════════════════════════════
// 五、行视图（交付桶 → 界面要的那几行）
// ════════════════════════════════════════════════════════════════

export interface ArtifactRow {
	/** 产物文件名 */
	name: string;
	/** 它的可复跑源（宣讲的 `.content.json`；没有就是空串） */
	srcName: string;
	/** 侧车文件名 */
	sidecar: string;
	/** 侧车读到了没有 */
	sidecarFound: boolean;
	verdict: Verdict;
	/** 侧车里写的生成时间（可能空） */
	generatedAt: string;
}

export interface KindRow {
	kind: string;
	label: string;
	tool: string;
	/** 这一类是干什么的一句话（界面上的小字） */
	note: string;
	/** skill 正文的绝对路径（拿不到技能根时给相对提示） */
	toolPath: string;
	/** 这一类现在的结论（多份里取"最需要用户注意"的那一档：过期 > 看不到依据 > 最新） */
	state: DerivedState;
	/** 首屏那一句人话 */
	text: string;
	/** 每一份产物的明细（进「详情」） */
	artifacts: ArtifactRow[];
	/** 首屏按钮文字（有产物 → 重新生成；没有 → 出…） */
	button: string;
	/** 这一轮会生成的名字（今天的日期） */
	plan: { artifact: string; sidecar: string };
	/** 缺前提时：不发的理由（非空 ⇒ 界面不发指令） */
	blocked: string;
	/** 缺前提时的下一步 */
	next: string;
	/** 指令正文（预览 = 发出去的） */
	instruction: string;
	/** 侧车 JSON（指令里逐字嵌的那一段；排障时也看得见） */
	sidecarJson: string;
}

export interface DerivedRows {
	kinds: KindRow[];
	current: {
		name: string; path: string; version: string; from: string;
		/** 人话：`联盟悬赏_20260923_定稿.md`（active 定稿 · 改于 …） */
		text: string;
	};
	notes: string[];
	counts: { speech: number; aiv: number; other: number; sidecar: number; noSidecar: number };
}

/** 一档结论的"轻重"（多份产物时取最重的那一档显示） */
const STATE_RANK: Record<DerivedState, number> = { none: 0, fresh: 1, unknown: 2, stale: 3 };

function worstOf(states: DerivedState[]): DerivedState {
	let out: DerivedState = "none";
	for (const s of states) if (STATE_RANK[s] > STATE_RANK[out]) out = s;
	return out;
}

export interface DerivedRowsInput {
	/** 交付桶里的文件名（可含 `子目录/文件名` 这种相对路径） */
	files: unknown[];
	/** 侧车名 → 文本（`null` = 读不到）；由加载器读来 */
	sidecars?: Record<string, string | null>;
	/** 当前有效定稿；`null` = 这个功能没有可派生的定稿 */
	final?: CurrentFinal | null;
	root: unknown;
	topic: unknown;
	/** 面板给的今天（`YYYYMMDD`）—— 纯函数不吃时钟 */
	compact: unknown;
	skillsRoot?: unknown;
	/** 界图目录与张数（宣讲页要用的图源；没有就说没有） */
	uiDir?: unknown;
	uiCount?: unknown;
	/** `gdd\` 里那些 `_定稿.html`（放错桶的既有派生物 —— 面板如实报一句，不判它新旧） */
	gddFinalHtml?: unknown[];
}

/**
 * 交付桶 → 界面要的行。
 * ★ 每一类**永远**给一行（没有产物也给）—— "还没有"是一个结论，不是"这一行不存在"。
 */
export function derivedRows(input: DerivedRowsInput): DerivedRows {
	const inp = input || ({} as DerivedRowsInput);
	const root = winOf(inp.root);
	const topic = oneLine(inp.topic);
	const compact = compactOf(inp.compact);
	const skillsRoot = winOf(inp.skillsRoot);
	const sidecars = inp.sidecars || {};
	/**
	 * ★ 「没有可派生的定稿」有两种长相，**都得当成没有**：
	 *   · `final === null`（调用方直接说没有）；
	 *   · `final` **在**但 `name` 是空串 —— 这是 `loadFeatureDetail` 的真实形状
	 *     （`finalCheck.current` 没有 active 时给 `null`，于是面板那一层拼出来的是
	 *      `{name:"", path:"", version:"", from:"date"}`）。当成"有定稿"会拼出
	 *     「基于 （按日期取的最新一份）」这种鬼话，判定也会错到"侧车看不到"那一支 ——
	 *     真实数据里诸神降临 / 英雄圣物就是这一支。
	 */
	const finalRaw = inp.final || null;
	const final = (finalRaw && oneLine((finalRaw as CurrentFinal).name) !== "") ? finalRaw : null;

	const files = (Array.isArray(inp.files) ? inp.files : []).map(oneLine).filter((x) => x !== "");
	const artifactsOf: Record<string, string[]> = { speech: [], aiv: [] };
	let otherCount = 0;
	let sidecarCount = 0;
	for (const f of files) {
		const k = kindOfDeliveryFile(f);
		if (k === "speech") artifactsOf.speech.push(f);
		else if (k === "aiv") artifactsOf.aiv.push(f);
		else if (k === "sidecar") sidecarCount += 1;
		else if (k === "speechSrc") { /* 宣讲的可复跑源：跟着它的 HTML 走，不单独成行 */ }
		else otherCount += 1;
	}

	const kinds: KindRow[] = [];
	let noSidecar = 0;

	for (const def of DERIVED_KINDS) {
		const plan = {
			artifact: artifactNameOf(def.id, topic, compact),
			sidecar: sidecarNameOf(artifactNameOf(def.id, topic, compact))
		};
		const toolPath = skillsRoot !== ""
			? skillsRoot + "\\" + def.dir + "\\SKILL.md"
			: "<技能根>\\.agents\\skills\\" + def.dir + "\\SKILL.md";

		const rows: ArtifactRow[] = [];
		for (const name of artifactsOf[def.id].slice().sort()) {
			const sc = sidecarNameOf(name);
			const text = Object.prototype.hasOwnProperty.call(sidecars, sc) ? sidecars[sc] : null;
			const parsed = parseProvenance(text === undefined ? null : text);
			const found = text !== null && text !== undefined;
			if (!found) noSidecar += 1;
			// 宣讲的可复跑源：同一基名的 `.content.json`
			const srcName = files.filter((f) => kindOfDeliveryFile(f) === "speechSrc" &&
				f.replace(/\.content\.json$/i, "") === name.replace(/\.html?$/i, ""))[0] || "";
			rows.push({
				name: name, srcName: srcName, sidecar: sc, sidecarFound: found,
				verdict: judgeArtifact({ final: final, prov: parsed, artifact: name }),
				generatedAt: parsed.ok && parsed.data ? parsed.data.generatedAt : ""
			});
		}

		// 这一类现在的结论：多份里取最重的；一份都没有 ⇒ `none`
		const state: DerivedState = rows.length === 0 ? "none" : worstOf(rows.map((r) => r.verdict.state));
		const lead = rows.filter((r) => r.verdict.state === state)[0] || rows[0] || null;
		let text: string;
		if (state === "none") {
			text = final
				? "还没有（基于当前定稿出过一份之后，这里会说它是不是最新）"
				: "还没有 —— 这个功能也还没有可派生的定稿";
		} else if (lead) {
			text = lead.verdict.text;
		} else {
			text = "面板看不到依据 —— 不默认它是最新的";
		}
		/**
		 * ★ 有多份产物时**不能只报最重的那一份** —— 那会把"其实已经有一份是最新的"藏起来
		 *   （真实数据里就会同时出现：面板新出的那份最新、以前手工出的那份没有侧车）。
		 *   所以结论句后面补一句分布：`（这一类一共 2 份：1 份已是最新 · 1 份看不到依据，逐份明细见「详情」）`。
		 */
		if (rows.length > 1) {
			const dist: string[] = [];
			const cnt: Record<string, number> = {};
			for (const r of rows) cnt[r.verdict.state] = (cnt[r.verdict.state] || 0) + 1;
			for (const k of ["fresh", "stale", "unknown"]) {
				if (!cnt[k]) continue;
				dist.push(cnt[k] + " 份" + (k === "fresh" ? "已是最新" : (k === "stale" ? "已过期" : "看不到依据")));
			}
			text += "（这一类一共 " + rows.length + " 份：" + dist.join(" · ") + "，逐份明细见「详情」）";
		}

		const built = buildDerivedInstruction({
			root: root, topic: topic, compact: compact, kindId: def.id,
			finalName: final ? final.name : "", finalPath: final ? final.path : "",
			finalVersion: final ? final.version : "", finalFrom: final ? final.from : "",
			skillsRoot: skillsRoot, uiDir: winOf(inp.uiDir), uiCount: inp.uiCount
		});

		kinds.push({
			kind: def.id, label: def.label, tool: def.tool, note: def.note, toolPath: toolPath,
			state: state, text: text, artifacts: rows,
			button: rows.length === 0 ? def.button : def.again,
			plan: plan,
			blocked: built.blocked, next: built.next,
			instruction: built.instruction, sidecarJson: built.sidecarJson
		});
	}

	// ── 如实标注（都是真数据里存在的情形）────────────────────────────────────
	const notes: string[] = [];
	if (!final) {
		notes.push("这个功能没有可派生的定稿（`gdd\\` 里没有 `_定稿.md`，或没有一份标 `status: active`）—— " +
			"两个动作都**不发**：先走「文档生成 › 发起整合定稿」（`/sr-gdd-ai`）出一份定稿，再回来派生。");
	} else {
		notes.push("比对基准：当前有效定稿 `" + final.name + "`（" +
			(final.from === "active" ? "头部标了 `status: active`" : "没有 active，按日期取最新的一份") + "" +
			(stampText(final.version) ? " · 改于 " + stampText(final.version) : " · 时间看不到") + "）。" +
			"指纹口径 = 宿主 `stat` 的 `version` 原文（`dev:ino:size:mtimeNs:ctimeNs`，工单 25 实测），**只做等值比对**。");
	}
	const selfKinds = kinds.filter((k) => k.artifacts.some((a) => a.name === k.plan.artifact)).map((k) => k.label);
	notes.push("派生物**不参与设计流程**：生成它不产生校准记录、不进设计台账 —— 指令里逐字写明了这一条" +
		"（决策记录在 `decisions\\`、校准流水在 `evidence\\calibration_*.jsonl`，两处都不许新增）。");
	if (noSidecar > 0) {
		notes.push("交付桶里有 " + noSidecar + " 份派生物**没有 provenance 侧车**（面板看不到依据）—— " +
			"它们是这份面板之前手工出的，重新生成一次就会带上下依据。");
	}
	const stray = (Array.isArray(inp.gddFinalHtml) ? inp.gddFinalHtml : []).map(oneLine).filter((x) => x !== "");
	if (stray.length) {
		notes.push("`gdd\\` 里另有 " + stray.length + " 份定稿派生的 HTML（" + stray.join("、") + "）—— " +
			"按规格派生物应落 `delivery\\`；面板不判它新旧（它也不在交付桶里，没有侧车）。");
	}
	if (selfKinds.length) notes.push("今天这个名字已经有过产物了：" + selfKinds.join("、") + " —— 重生成会覆盖同一份。");

	return {
		kinds: kinds,
		current: {
			name: final ? final.name : "", path: final ? final.path : "",
			version: final ? final.version : "", from: final ? final.from : "",
			text: final
				? final.name + "（" + (final.from === "active" ? "active 定稿" : "按日期取的最新一份") +
					(stampText(final.version) ? " · 改于 " + stampText(final.version) : " · 时间看不到") + "）"
				: "没有可派生的定稿"
		},
		notes: notes,
		counts: {
			speech: artifactsOf.speech.length, aiv: artifactsOf.aiv.length,
			other: otherCount, sidecar: sidecarCount, noSidecar: noSidecar
		}
	};
}

// ════════════════════════════════════════════════════════════════
// 六、指令组装（预览 = 发出去的那一段）
// ════════════════════════════════════════════════════════════════

export interface DerivedInstructionInput {
	root?: unknown;
	topic?: unknown;
	/** 面板给的今天（`YYYYMMDD`） */
	compact?: unknown;
	kindId?: unknown;
	finalName?: unknown;
	finalPath?: unknown;
	finalVersion?: unknown;
	finalFrom?: unknown;
	skillsRoot?: unknown;
	uiDir?: unknown;
	uiCount?: unknown;
}

export interface DerivedInstruction {
	instruction: string;
	blocked: string;
	next: string;
	artifact: string;
	sidecar: string;
	/** 指令里逐字嵌的那段侧车 JSON */
	sidecarJson: string;
}

/**
 * 组装"出一份派生物"的指令。
 *
 * ★ **三段式，与 `instruction.ts` / `intake.ts` / `draftstep.ts` 同一条产品契约**：
 *   面板不写文件，它只把意图说到 agent 不用再找的程度 —— 源定稿（哪一版）、产物落点（叫什么名）、
 *   按哪个 skill（连它正文在哪都写出来）、以及**侧车的逐字内容**（面板已经把版本指纹算好了，
 *   agent 不需要、也不许自己编一个）。
 * ★ **缺前提不静默**：`blocked` + `next` 一起给，界面照原样显示，**不发指令**。
 * ★ **纪律写进指令正文**：这是输出工具，不产生校准记录、不进设计台账（本票第 4 条）。
 */
export function buildDerivedInstruction(input: DerivedInstructionInput): DerivedInstruction {
	const inp = input || ({} as DerivedInstructionInput);
	const def = kindDefOf(inp.kindId);
	const empty = { artifact: "", sidecar: "", sidecarJson: "" };
	if (!def) {
		return Object.assign({
			instruction: "", blocked: "未知的派生物类别：" + oneLine(inp.kindId),
			next: "两类派生物是：宣讲 HTML / AI 读版。"
		}, empty);
	}
	const root = winOf(inp.root);
	if (root === "") {
		return Object.assign({
			instruction: "",
			blocked: "拿不到这个功能的功能目录（`features\\<主题>\\`）。",
			next: "从「功能详情 › 定稿修订」进来再发一次 —— 指令要发给该功能的专属工作会话（cwd = 功能目录）。"
		}, empty);
	}
	const finalName = oneLine(inp.finalName);
	const finalPath = winOf(inp.finalPath);
	const finalVersion = String(inp.finalVersion == null ? "" : inp.finalVersion).trim();
	if (finalName === "" || finalPath === "") {
		return Object.assign({
			instruction: "",
			blocked: "这个功能现在**没有可派生的定稿**（`gdd\\` 里没有 `_定稿.md`，或没有一份标 `status: active`）。",
			next: "先走「文档生成 › 发起整合定稿」（`/sr-gdd-ai`）出一份定稿，再回来出派生物 —— 没有源定稿就不派生。"
		}, empty);
	}
	if (finalVersion === "" || stampOf(finalVersion) === null) {
		return Object.assign({
			instruction: "",
			blocked: "面板**拿不到当前定稿的版本指纹**（宿主 `stat` 没给出 `dev:ino:size:mtimeNs:ctimeNs` 形状的版本串）。",
			next: "按「刷新」或 F5 重读一次；仍拿不到就说明这台机器上的宿主版本串形状变了 —— " +
				"那样派生物的『基于哪一版』就落不了盘，别硬发。"
		}, empty);
	}

	const topic = oneLine(inp.topic);
	const compact = compactOf(inp.compact);
	const artifact = artifactNameOf(def.id, topic, compact);
	const sidecar = sidecarNameOf(artifact);
	const skillsRoot = winOf(inp.skillsRoot);
	const toolPath = skillsRoot !== ""
		? skillsRoot + "\\" + def.dir + "\\SKILL.md"
		: "<技能根>\\.agents\\skills\\" + def.dir + "\\SKILL.md";
	const deliveryDir = root + "\\delivery";
	const from = oneLine(inp.finalFrom);

	// 侧车逐字内容（`JSON.stringify` 负责转义反斜杠；面板算好的指纹不能被 agent 改）
	const provObj = {
		schema: DERIVED_PROVENANCE_SCHEMA,
		kind: def.id,
		artifact: artifact,
		tool: def.tool,
		basedOn: finalName,
		basedOnPath: finalPath,
		basedOnVersion: finalVersion,
		generatedAt: ""
	};
	const sidecarJson = JSON.stringify(provObj, null, 2);

	const L: string[] = [];
	if (def.id === "speech") {
		L.push("【派生物 · 宣讲 HTML】给这个功能的**当前有效定稿**出一份评审宣讲 HTML" +
			"（单文件自包含、可直接投屏、可直接外发）。");
	} else {
		L.push("【派生物 · AI 读版】把**当前有效定稿**转成一份正式 AI 读版（给下游 agent 读的正式语义源）。");
	}
	L.push("· 源定稿：" + finalPath + "（本功能当前有效定稿" +
		(from === "active" ? "，头部标了 `status: active`" : (from === "date" ? "，没有 active 的那一份是按日期取的最新" : "")) +
		"）—— 只认这一版，不要顺手换成别的版本。");
	L.push("· 产物落点：" + deliveryDir + "\\" + artifact + "（就写这个名字，别改名 —— 面板按它认产物与侧车）");
	L.push("· 按技能：`/" + def.tool + "`（skill 正文在 " + toolPath +
		"）—— **读那份正文照做**：它是用户调用型/带兄弟资源的技能，随包只嵌正文，本机这份磁盘目录才是完整的；不要改动该 skill。");

	if (def.id === "speech") {
		const uiDir = winOf(inp.uiDir);
		const n = Number(inp.uiCount) || 0;
		L.push("· 图源：" + (uiDir !== "" && n > 0
			? uiDir + "（本功能已有的 " + n + " 张界面图；缺图的界面走指路占位框，**不阻塞**）"
			: "本功能没有现成界面图目录 —— 全部走指路占位框（**不要**用网络图凑数）"));
		L.push("· 内容边界：只搬运定稿里的最终规则与界面，**不新增规则、不换算数值**；" +
			"禁止出现确认编号 / 用户原话 / 「拍板」「已确认」这类过程措辞（那是决策记录的事，不进宣讲页）。");
		L.push("· 截图一律 `data:image/...;base64,` 内嵌（单文件可独立打开），禁外链图。");
	} else {
		L.push("· 本次范围：只做「定稿 → 正式 AI 读版」这一次转换，产物落上面的交付桶。" +
			"技能自带的**运行包目录体系 / 追问确认表工作簿 / 策划审核版 HTML / 下游交付包**本次都不做（面板没有对应动作）。");
		L.push("· 有 P0 未决项或缺材料就**停下来告诉我**（写清缺什么、为什么需要），不要自己拍板、不要把没定的事写成结论。");
	}
	L.push("· 基于哪一版：请把下面这段 JSON **原样**写进 " + deliveryDir + "\\" + sidecar + "：");
	L.push("  —— 只有 `generatedAt` 留给你填（填你**完成那一步**的时间，ISO 8601 带时区）；其余字段值一个字都不要改，");
	L.push("     尤其 `basedOnVersion` 是面板按宿主 `stat` 的版本串算好的指纹，改了过期判定就废了。");
	for (const line of sidecarJson.split("\n")) L.push("  " + line);
	L.push("· 这是**输出工具**、不是设计流程的一环：不要写决策记录（`decisions\\`）、不要追加校准记录" +
		"（`evidence\\calibration_*.jsonl`）、不要动设计台账（它是从已有结构化源实时派生的，没有文件可写）；" +
		"也不要改源定稿、不要改任何 skill。");
	L.push("· 完成后回报：产物路径 + 侧车路径 + 你实际做了什么自查（内容边界 / 图片内嵌 / 冒烟），以及任何如实标注的待确认项。");

	return { instruction: L.join("\n"), blocked: "", next: "", artifact: artifact, sidecar: sidecar, sidecarJson: sidecarJson };
}
