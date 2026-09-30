/**
 * 文档生成工作面（工单 24）—— 「文档生成」这一阶段的两件事，**纯函数、零 IO**：
 *
 *   ① **配置支线走到哪**（设计 §4.5 → spec.md:51-52 / Out of Scope:212）：
 *      `parseConfigContract` 读定稿 §6 的**字段行**（与 §6.5 的缺口表分开），
 *      `configBranchState` 把「有没有配置契约、走到哪一步」算成**一句话 + 一串事实**。
 *   ② **这一阶段的动作**：`buildDraftInstruction` 组装三段式——**改哪儿 / 现状原文 / 影响范围**，
 *      与 `instruction.ts`（定稿修订）、`intake.ts`（头脑风暴）**同一套口径**，不是第三套协议。
 *
 * ── 口径的出处（逐条引原文，不自己编）────────────────────────────────────────
 *   · `gdd-pipeline.md` §一·三份产出：「配置相关内容：成稿 = **零**——规则里不出现字段名、表名、
 *     『对应哪个字段』式中文字；配置表 = 全部；定稿 = 全部（§6 配置契约）」。
 *     ⇒ 「配置支线」的契约载体是**定稿 §6**，成稿里根本不该有它 —— 所以这一屏只报**走到哪**。
 *   · `gdd-pipeline.md` §一：「方向是规则优先：`/sr-config` 从成稿的规则**派生**配置字段与记录」。
 *   · `gdd-pipeline.md` §二 的章节对应表：
 *       §6 范围门 → 定稿 §8 · §11 数值待定项 → 「能在配置表里读到的标 `表名.字段名`，未落表的标"待配表"」·
 *       「— → §6 配置契约  从配置表读回：中文字段 / 英文字段 / 结构 / 含义 / **状态（已有、新增、新增命名待定、待配表）**」。
 *   · `sr-gdd-human/SKILL.md` §产出规范：产出 `proposals\<主题>_<日期>.md`（本工作区为 `gdd\`），
 *     形态基准 `resources/templates/feature-gdd-human.md`；「结果章 §1–§12 只有纯规则与设计」。
 *   · spec.md:212（Out of Scope）：「**Excel / 配置表编辑**——配置表在 `sr-config` 与 Unreal/Excel 侧；
 *     面板**只显示配置支线走到哪**」。
 *
 * ── 两个刻意的"不"──────────────────────────────────────────────────────────
 *   · **不重做 Excel**：这里不解析任何工作簿。配置表的**存在性**由既有通道给（看板的 `configs`，
 *     按主题挂上来的真实文件名），字段/记录级的一切都在 skill 与配置表工具侧。
 *   · **不猜**：读不到、认不出、缺件，一律如实报（`unknown` / `missing` / `notes`），
 *     不把"没看到"写成"没有"（那条纪律在 23 的 `unreadable` 上已经立过一次）。
 */

import { parseFinalGdd } from "./finalgdd.ts";

// ════════════════════════════════════════════════════════════════
// 一、定稿 §6 · 配置契约的**读取**（纯函数，输入是文本）
// ════════════════════════════════════════════════════════════════

export interface ConfigFieldRow {
	/** 1-based 行号（与编辑器一致） */
	line: number;
	/** 组标题（`### 6.2 BOSS表（A079-联盟悬赏.xlsx，…）` → `6.2 BOSS表（…）`） */
	group: string;
	/** 中文字段 */
	cn: string;
	/** 英文字段（反引号里的那个；列名无英文字段时为空串） */
	field: string;
	/** 状态列原文（`已有` / `已有（**引用缺口**：…）` / `新增` / `待配表` / `待确认：…`） */
	status: string;
	/** 状态列里出现「待配表」 */
	pending: boolean;
	/** 这一行的 markdown 原文（**现状原文**：行号会漂，原文不会） */
	text: string;
}

export interface ConfigContract {
	/** 定稿里有没有 `## 6. 配置契约` 这一章 */
	present: boolean;
	/** 该章标题所在行号（没有就是 0） */
	line: number;
	/** 章引言里提到的**工作簿**（`A079-联盟悬赏.xlsx` …，去重、按出现顺序） */
	workbooks: string[];
	/** 字段行（§6.1–§6.4 这种"表格 + 第二列是英文字段"的行；§6.5 的缺口表不算） */
	fields: ConfigFieldRow[];
	/** 状态列里带「待配表」的字段行 */
	pending: ConfigFieldRow[];
	/**
	 * **不是字段行、但状态列写着「待配表」**的行（真实数据：`### 6.5 掉落引用与缺口` 那张三列表）。
	 * ★ 它与 `pending` 分开：混进 `fields` 会把"字段数"算虚（那张表的中文字段名是"活动周期/排行过滤门槛/展示上限"，
	 *   不是字段）；但**缺口必须报**——否则面板会说"配置字段全部落地"，而磁盘上明明还挂着两行待配表。
	 */
	notedGaps: Array<{ line: number; group: string; cn: string; status: string; text: string }>;
	/** 认得出但没解析的行（如实报数，不静默丢） */
	otherRows: number;
}

/** `A079-联盟悬赏.xlsx` / `A006-掉落表.xlsx` 这种工作簿名（配置表命名的既有形状） */
const WORKBOOK_RE = /[A-Za-z]\d{2,4}-[^\s`，,、）)]+\.xlsx?m?/g;
/** 反引号里的英文字段名（`clearDropId` / `alliBossDailyAttackCount`） */
const FIELD_RE = /`([A-Za-z_][A-Za-z0-9_.]*)`/;
/** 配置契约的组标题（`### 6.2 BOSS表（…）`）；后面的 `6.5 掉落引用与缺口` 也是这个形状 */
const CONFIG_GROUP_RE = /^###\s+(\d+(?:\.\d+)*)\s*(.*)$/;

/**
 * 从定稿全文里读 §6 的**配置契约**（设计 §4.5 / `gdd-pipeline.md` §二的章节对应）。
 *
 * ★ 只认**字段表**：表头是「中文字段 | 英文字段 | 数据结构 | 含义 | 状态」，第二列是反引号英文字段名。
 *   §6.5 的缺口表（表头「掉落段 | 记录 | 状态」）没有英文字段列 ⇒ 不进 `fields`，只进 `otherRows`——
 *   它不是字段契约，是**缺口的说明**，混进来会把"字段数"算虚。
 * ★ 行号是 1-based，与 `parseFinalGdd` / `finaltree` 同一口径（定位卡的"原文（L###）"要能对上）。
 */
export function parseConfigContract(text: unknown): ConfigContract {
	const src = String(text == null ? "" : text);
	const lines = src.split(/\r?\n/);
	const out: ConfigContract = { present: false, line: 0, workbooks: [], fields: [], pending: [], notedGaps: [], otherRows: 0 };
	if (src === "") return out;

	// 用既有解析器拿"章的边界"——不在这一层重写一份章标题正则（工单 24：「复用定稿那套解析能力」）
	const doc = parseFinalGdd(src);
	const ch = (doc.outline || []).filter((c) => String(c.no) === "6")[0];
	if (!ch) return out;
	out.present = true;
	out.line = Number(ch.line) || 0;

	const blocks = doc.blocks || [];
	const cur = blocks[Number(ch.idx)];
	if (cur && typeof cur.text === "string") {
		const seen: Record<string, boolean> = {};
		const found = cur.text.match(WORKBOOK_RE) || [];
		for (const w of found) {
			if (w === "xlsx" || w === "xlsm") continue;
			if (seen[w]) continue;
			seen[w] = true;
			out.workbooks.push(w);
		}
	}

	// 章的正文范围：从章标题行到**下一个章标题**（§7）之前。用 blocks 的行号推，不用再扫一遍全文。
	let endLine = lines.length + 1;
	for (const b of blocks) {
		const bl = Number(b.line) || 0;
		if (bl > out.line && b.level === 2) { endLine = bl; break; }
	}

	let group = "";
	for (let i = out.line; i < endLine && i <= lines.length; i++) {
		const raw = lines[i - 1];
		const gm = CONFIG_GROUP_RE.exec(raw);
		if (gm) { group = (gm[1] + " " + (gm[2] || "")).trim(); continue; }
		if (!/^\s*\|/.test(raw)) continue;
		const cells = raw.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((s) => s.trim());
		if (cells.length < 3) continue;
		const first = cells[0] || "";
		if (/^:?-{2,}:?$/.test(first.replace(/\s/g, ""))) continue;      // 分隔行
		if (first === "中文字段") continue;                              // 表头
		const fm = FIELD_RE.exec(cells[1] || "");
		if (!fm) {
			// 没有英文字段列 ⇒ 不是字段行（§6.5 的缺口表）。但状态列若写着「待配表」，那是**真缺口**，要报。
			out.otherRows += 1;
			const st = cells[cells.length - 1] || "";
			if (/待配表/.test(st)) out.notedGaps.push({ line: i, group: group, cn: first, status: st, text: raw.trim() });
			continue;
		}
		const status = cells[cells.length - 1] || "";
		const row: ConfigFieldRow = {
			line: i, group: group, cn: first, field: fm[1], status: status,
			pending: /待配表/.test(status), text: raw.trim()
		};
		out.fields.push(row);
		if (row.pending) out.pending.push(row);
	}
	return out;
}

// ════════════════════════════════════════════════════════════════
// 二、配置支线**走到哪**（`gdd-pipeline.md` §一的四步链路 → 一句话 + 事实）
// ════════════════════════════════════════════════════════════════

/** 读取回执（`evidence\readback_<表>_<主题>_<日期>.md`）——「有没有读回验收」的唯一凭据 */
export interface ReadbackRecord {
	name: string;
	/** 相对功能根的路径（正斜杠） */
	rel: string;
	/** 文件名里的日期（`YYYYMMDD`；认不出就是空串） */
	date: string;
}

export type ConfigStage =
	| "before-draft"    // 成稿还没有定稿可读 —— 配置支线都还没开始
	| "rules-ready"     // 成稿门已过（或成稿已归档）—— /sr-config 可以从 §4 的规则派生字段了
	| "integrating"     // 有定稿但还没有 §6 配置契约 —— 整合这一步没做完
	| "missing-pending" // §6 有字段，但还有「待配表」的缺口没闭
	| "missing-nofields"
	| "landed";         // §6 字段齐 + 无待配表缺口

export interface ConfigBranchFacts {
	/** 成稿在盘上的情形（用来判"这条支线该不该开始"） */
	draft: { exists: boolean; name: string; status: string; docType: string; line: number; archived: boolean };
	/** 定稿在盘上的情形 */
	final: { exists: boolean; name: string; status: string; docType: string; line: number };
	/** §6 配置契约 */
	contract: ConfigContract;
	/** 定稿 §6 引用到的工作簿里，有哪些在配置目录里**没有同名文件** */
	referencedMissing: string[];
	/** 读回验收回执（`evidence\` 里的 `readback_*`） */
	readbacks: ReadbackRecord[];
	/** 面板能拿到的、按主题挂上来的配置表文件名（既有通道；不做匹配、不猜归属） */
	configFiles: string[];
}

export interface ConfigBranch {
	stage: ConfigStage;
	/** 面板上那一句话（结论） */
	label: string;
	/** 为什么是这个结论（依据，逐条可核对） */
	reason: string;
	/** 「走到哪」的四步，每步 `done` + 证据句 */
	steps: Array<{ key: string; label: string; done: boolean; evidence: string }>;
	/** 缺口 / 缺件（如实列出，不静默） */
	missing: string[];
	facts: ConfigBranchFacts;
}

/** 读回验收回执的文件名判据（`sr-config` 的产出：`evidence\readback_<表>_<主题>_<日期>.md`） */
export const READBACK_RE = /^readback_/i;

/**
 * 读回验收回执 ← `evidence\` 的文件名（**只按文件名**，与其余桶的归类口径一致）。
 */
export function readbacksOf(names: unknown[], relOf?: (n: string) => string): ReadbackRecord[] {
	const out: ReadbackRecord[] = [];
	for (const n of (Array.isArray(names) ? names : [])) {
		const name = String(n || "");
		if (!READBACK_RE.test(name)) continue;
		const m = /_(\d{8})(?:\.md)?$/i.exec(name);
		out.push({ name: name, rel: relOf ? String(relOf(name)) : "evidence/" + name, date: m ? m[1] : "" });
	}
	return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.name < b.name ? -1 : 1)));
}

/** 判据串（面板与测试都读它，不各写一份） */
const STEP_KEYS = [
	{ key: "draft", label: "成稿（纯规则，零配置指代）" },
	{ key: "contract", label: "配置表派生（/sr-config 从 §4 规则派生字段与记录）" },
	{ key: "readback", label: "读回验收（evidence\\readback_*）" },
	{ key: "final", label: "整合定稿（§6 配置契约）" }
];

/**
 * 四步链路 → 「走到哪」。
 *
 * ★ 判据只有两处来源：**盘上的成稿/定稿头部**（`doc_type` / `status`，`gdd-pipeline.md` §一·补的口径）
 *   与**定稿 §6 的字段行**。面板不猜中间过程（那过程在会话里，面板看不见就如实说看不见）。
 * ★ 「读回验收」这一步**只认事实**：有没有 `evidence\readback_*`。没有就是没有 ——
 *   它不等于"没验收过"（回执可能还没落盘），所以 `missing` 里的措辞是"没有回执"，不是"没验收"。
 */
export function configBranchState(facts: ConfigBranchFacts): ConfigBranch {
	const f = facts || ({} as ConfigBranchFacts);
	const draft = f.draft || { exists: false, name: "", status: "", docType: "", line: 0, archived: false };
	const fin = f.final || { exists: false, name: "", status: "", docType: "", line: 0 };
	const c = f.contract || { present: false, line: 0, workbooks: [], fields: [], pending: [], notedGaps: [], otherRows: 0 };
	const rbs = f.readbacks || [];
	const missingFiles = f.referencedMissing || [];
	const cfgFiles = f.configFiles || [];
	const pendingFields: ConfigFieldRow[] = c.pending || [];
	const notedGaps: Array<{ line: number; group: string; cn: string; status: string }> = c.notedGaps || [];
	const gapCount = pendingFields.length + notedGaps.length;

	const draftDone = !!draft.exists;
	const readbackDone = rbs.length > 0;
	const finalDone = !!fin.exists && !!c.present;

	let stage: ConfigStage = "before-draft";
	let label = "";
	let reason = "";
	if (!draftDone && !fin.exists) {
		stage = "before-draft";
		label = "还没开始 —— 成稿还没写出来（这一屏的第一个动作就是写它）";
		reason = "功能目录 `gdd\\` 里没有成稿（`doc_type: draft_gdd`）。配置支线的输入端是成稿 §4 的规则，规则还没落纸 ⇒ 派生无从谈起。";
	} else if (!fin.exists) {
		stage = "rules-ready";
		label = draft.archived
			? "等配置表 —— 成稿已归档，定稿尚未产出（配置字段应由 /sr-config 从 §4 规则派生）"
			: "规则就绪 —— 定稿还没产出；/sr-config 现在可以从 §4 的规则派生字段与记录了";
		reason = "成稿 `" + draft.name + "`（doc_type " + (draft.docType || "?") + " / status " + (draft.status || "?") + "）在盘上；" +
			"功能目录里还没有定稿，所以还没有 §6 配置契约可读。";
	} else if (!c.present) {
		stage = "integrating";
		label = "整合中 —— 有定稿，但它还没有 §6 配置契约";
		reason = "定稿 `" + fin.name + "`（status " + (fin.status || "?") + "）里没有 `## 6. 配置契约` 这一章 ⇒ 配置与规则的整合这一步没做完。";
	} else if (gapCount > 0) {
		stage = "missing-pending";
		label = "配置表已派生，还有 " + gapCount + " 处「待配表」缺口没闭 —— 交程序前应闭掉或明确列为待办";
		reason = "§6 共 " + c.fields.length + " 个字段行、" + c.workbooks.length + " 个工作簿；" +
			(pendingFields.length ? "其中 " + pendingFields.length + " 个字段行的状态是**待配表**" : "") +
			(pendingFields.length && notedGaps.length ? "；" : "") +
			(notedGaps.length ? "另有 " + notedGaps.length + " 行缺口说明写着**待配表**（" + notedGaps.map((g) => "L" + g.line + " " + g.cn).join(" / ") + "）" : "") +
			"。（`gdd-pipeline.md` §二：§11 数值待定项里未落表的标「待配表」。）";
	} else if (c.fields.length === 0) {
		stage = "missing-nofields";
		label = "配置契约是空的 —— §6 有章没有字段行";
		reason = "定稿 `" + fin.name + "` 有 §6（L" + c.line + "）但解析不出字段行（认得出却没解析的行 " + c.otherRows + " 条）⇒ 要么还没写，要么格式与契约表的形状不一致。";
	} else {
		stage = "landed";
		label = "配置字段全部落地（§6 " + c.fields.length + " 个字段行 / " + c.workbooks.length + " 个工作簿，无待配表缺口）";
		reason = "定稿 `" + fin.name + "` 的 §6 里每一行的状态都不是「待配表」。";
	}

	const steps = [
		{
			key: STEP_KEYS[0].key, label: STEP_KEYS[0].label, done: draftDone,
			evidence: draftDone
				? draft.name + "　L" + draft.line + "　" + (draft.docType || "?") + " / " + (draft.status || "?")
				: "gdd\\ 里没有成稿（`<主题>_<日期>.md`）"
		},
		{
			key: STEP_KEYS[1].key, label: STEP_KEYS[1].label, done: c.fields.length > 0,
			evidence: c.fields.length > 0
				? "§6 字段行 " + c.fields.length + " 个；工作簿 " + (c.workbooks.length ? c.workbooks.join(" / ") : "（章引言里没写工作簿名）")
				: (c.present ? "§6 存在但还没有字段行" : "还没有 §6 配置契约（定稿侧读不到）")
		},
		{
			key: STEP_KEYS[2].key, label: STEP_KEYS[2].label, done: readbackDone,
			evidence: readbackDone
				? rbs.length + " 份回执：`" + rbs.map((r) => r.name).join("` / `") + "`"
				: "evidence\\ 里没有 `readback_*` 回执"
		},
		{
			key: STEP_KEYS[3].key, label: STEP_KEYS[3].label, done: finalDone,
			evidence: fin.exists
				? fin.name + "　L" + fin.line + "　" + (fin.docType || "?") + " / " + (fin.status || "?") +
					(c.present ? "　§6 在 L" + c.line : "　（没有 §6）")
				: "gdd\\ 里没有定稿（`<主题>_<日期>_定稿.md`）"
		}
	];

	// ── 缺口（逐条如实；缺什么写什么，不写"一切都好"）────────────────────
	const missing: string[] = [];
	for (const r of pendingFields) missing.push("待配表（字段行）：L" + r.line + " " + r.group + " · " + r.cn + "（" + r.status + "）");
	for (const g of notedGaps) missing.push("待配表（缺口说明）：L" + g.line + " " + g.group + " · " + g.cn + "（" + g.status + "）");
	for (const w of missingFiles) missing.push("§6 引用的工作簿在配置目录里没有同名文件：" + w + "（面板按文件名核，不解析工作簿）");
	if (fin.exists && c.present && !readbackDone) missing.push("没有读回验收回执（`evidence\\readback_*` 一份都没有）—— 不代表「没验收过」，只代表**面板看不到回执**");
	if (fin.exists && !c.present) missing.push("定稿里没有 `## 6. 配置契约` —— 配置字段与规则的对应还没落纸");
	if (!fin.exists) missing.push("还没有定稿 —— 配置契约的载体是定稿 §6（成稿里按契约口径**不含任何配置内容**）");
	if (cfgFiles.length === 0 && c.fields.length > 0) missing.push("按主题挂上来的配置表文件 0 个（命名对不上？）—— 这里只显示存在性，不改表");

	return { stage: stage, label: label, reason: reason, steps: steps, missing: missing, facts: f };
}

// ════════════════════════════════════════════════════════════════
// 三、这一阶段的三个动作 → 指令（三段式：**改哪儿 / 现状原文 / 影响范围**）
// ════════════════════════════════════════════════════════════════

/**
 * 三个动作 —— 顺序即面板上的顺序。**不并排、有先后**（与头脑风暴四入口相反）：
 * `gdd-pipeline.md` §一·三份产出是一条链（成稿 → 配置表 → 定稿），不是四条并列的路。
 *
 * `hint` 是"跑什么"，`needs` 是前置（缺了就在界面上说缺，不发指令），`output` 是产出落点。
 */
const DRAFT_ACTIONS = [
	{
		id: "create",
		label: "写成稿",
		hint: "跑 /sr-gdd-human",
		needs: "主题 + 上游材料（sr-concept 设计稿 / sr-analysis 复刻规格 / 旧案）",
		output: "gdd\\<主题>_<日期>.md（`doc_type: draft_gdd` / `status: draft`；结果章 §1–§12 只有纯规则，决策留痕在附录 A）",
		handoff: "阶段交给了 skill：成稿门（approve / approve_with_conditions / revise / reject）由你在那个会话里拍板"
	},
	{
		id: "revise",
		label: "改成稿",
		hint: "就着现状原文定向修订",
		needs: "成稿在盘上 + 你要改的那一条（建议带上它在成稿里的章 / 组号）",
		output: "就地改成稿（不改配置表；改到规则就走这条）",
		handoff: "阶段交给了 skill：它按撰写纪律闭合影响面，成稿门由你在那个会话里拍板"
	},
	{
		id: "integrate",
		label: "发起整合定稿",
		hint: "跑 /sr-gdd-ai",
		needs: "成稿已过门（规则不再变）+ 配置表已派生（缺的字段有「待配表」结论也行，但要你知道缺在哪）",
		output: "gdd\\<主题>_<日期>_定稿.md（`doc_type: final_gdd` / `status: pending` → `active`；§6 配置契约 + §7 多语言文本）",
		handoff: "阶段交给了 skill：sr-gdd-ai 第 5 步先跑 /sr-gdd-review 出审查报告，再呈定稿门——合流结果由工单 25 承接"
	}
];

export interface DraftActionDef {
	id: string;
	label: string;
	hint: string;
	needs: string;
	output: string;
	handoff: string;
}

/** 三个动作（**表只有这一份**：面板的卡、指令的前置、"这一步产出什么"都读它） */
export const DRAFT_ACTIONS_TABLE: DraftActionDef[] = DRAFT_ACTIONS;

export interface DraftInstructionInput {
	/** 动作 id：`create` / `revise` / `integrate` */
	action: string;
	/** 功能根（`…\features\<主题>`），指令里写出来的目录一律由它派生 */
	root?: unknown;
	/** 主题（功能标签；给模板的标题位） */
	topic?: unknown;
	/** 成稿的绝对路径（`create` 时可空 —— 它还没生成） */
	draftPath?: unknown;
	/** 现状原文（`revise` 的第三段：**逐字**，行号会漂、原文不会） */
	before?: unknown;
	/** 改哪儿（条目引用 / 章组号，如 `§4 R6 奖励` 或 `§5`；`revise` 必填） */
	where?: unknown;
	/** 要改成什么（一句话） */
	intent?: unknown;
	/** 连线图 / 参考材料（有就给路径） */
	materials?: unknown[];
	/** 配置支线的一句话结论 + 缺口（`integrating` 动作的第三段；直接搬 `configBranchState` 的输出） */
	configLabel?: unknown;
	configMissing?: unknown[];
	/** `date` 由调用方给（面板用今天）—— 纯函数不吃时钟，测试才能逐字断言 */
	date?: unknown;
}

/** 一个输入项 → 单行文本（去掉换行与多余空白） */
function oneLine(v: unknown): string {
	return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
}

/** 路径显示统一成 `\`（只改显示的字符串；与 `client.js` 的 `winPath` 同口径） */
function winOf(p: unknown): string {
	return String(p == null ? "" : p).replace(/[\\/]+$/, "").replace(/\//g, "\\");
}

/**
 * 文档生成工作面的指令组装（三段式，逐字：**改哪儿 → 现状 → 要改成什么 → 连带影响**）。
 *
 * ★ **为什么是这三段**（与 `instruction.ts` / `intake.ts` 同一条产品契约）：
 *   面板不写文件，它只把意图说到 agent 不用再找的程度 —— 改哪儿（章 / 组号或绝对路径）、
 *   现状原文（行号会漂，原文不会）、连带影响（面板扫得出的那部分）。语义影响留给 skill。
 * ★ **缺前提不静默**：`blocked` + `next` 两个字段一起给，界面照原样显示，**不发指令**。
 * ★ 产出落点由 `root` 派生（`gdd\`），不在两处各写一份路径。
 */
export function buildDraftInstruction(input: DraftInstructionInput): { instruction: string; blocked: string; next: string } {
	const inp = input || ({} as DraftInstructionInput);
	const a = DRAFT_ACTIONS.filter((x) => x.id === inp.action)[0];
	if (!a) {
		return { instruction: "", blocked: "未知的文档生成动作：" + String(inp.action), next: "三个动作是：写成稿 / 改成稿 / 发起整合定稿。" };
	}
	const root = winOf(inp.root);
	if (root === "") {
		return {
			instruction: "",
			blocked: "拿不到这个功能的功能目录（`features\\<主题>\\`）。",
			next: "从「功能详情 › 文档生成」进来再发一次 —— 指令要发给该功能的专属工作会话（cwd = 功能目录）。"
		};
	}
	const topic = oneLine(inp.topic);
	const date = oneLine(inp.date);
	const gddDir = root + "\\gdd";
	const tail = "阶段交给了 skill：" + a.handoff.replace(/^阶段交给了 skill：?/, "") + " —— 有决策门就停下来等我拍板，不要自己往下走。";

	if (a.id === "create") {
		const mats = (Array.isArray(inp.materials) ? inp.materials : []).map(oneLine).filter((x) => x !== "");
		const seed = oneLine(inp.intent);
		if (topic === "" && seed === "") {
			return {
				instruction: "",
				blocked: "「写成稿」需要主题，或者至少一句要写什么。",
				next: "在「主题」里写功能名（比如：联盟悬赏），再在「要写成什么」里写一句方向；有上游材料就把路径一并粘上。"
			};
		}
		const L = [
			"【文档生成 · 写成稿】请执行 `/sr-gdd-human`（走 `/sr-gdd-human <主题或材料路径>` 的正常调用，不要改动该 skill）。",
			"主题：" + (topic || "（未指定 —— 按上游材料推导）"),
			"要写成什么（我的意图；没写就按上游材料与 VOI 门现场确认）：" + (seed || "（未指定）")
		];
		L.push(mats.length ? "上游材料（有就给路径）：" : "上游材料：没有（那就以主题与我的意图为准，缺到会改变决策再问我）。");
		for (const m of mats) L.push("  · " + m);
		L.push(
			"产出：" + gddDir + "\\" + (topic || "<主题>") + "_" + (date || "<YYYYMMDD>") + ".md",
			"格式：以 `resources/templates/feature-gdd-human.md` 为形态基准；顶部 `doc_type: draft_gdd` + `status: draft`；结果章 §1–§12 在前、附录 A 在后。",
			"硬口径：**结果章只有纯规则与设计** —— 不出现字段名、表名、\"对应哪个字段\"式中文字（配置内容一律不进成稿）；数值一律写成机制表述或\"（参考值 X，待定）\"，未定数值集中在 §11；决策留痕全在附录 A。",
			"上游含 sr-gdd-handoff_*.json / 功能设计稿 / 复刻规格时：其中已拍板的取舍直接作为既定口径（不重新问、不写拍板过程）；其\"配置项预测\"**不进本成稿**。",
			tail
		);
		return { instruction: L.join("\n"), blocked: "", next: "" };
	}

	if (a.id === "revise") {
		const where = oneLine(inp.where);
		const before = String(inp.before == null ? "" : inp.before).trim();
		const intent = oneLine(inp.intent);
		const path = winOf(inp.draftPath);
		if (path === "") {
			return {
				instruction: "",
				blocked: "「改成稿」需要成稿的路径 —— 但盘上还没有成稿，没有可改的现状原文。",
				next: "先走「写成稿」把这份成稿写出来；或者把要改的那一条的**现状原文**粘进「现状原文」框（面板会照它组装）。"
			};
		}
		if (where === "" && before === "") {
			return {
				instruction: "",
				blocked: "「改成稿」需要知道改哪儿：条目引用 / 章组号，或那一条的现状原文。",
				next: "在「改哪儿」里写条目引用（比如 §4 R6 奖励 / §5 UI-M1），或在左树上点一条把它的原文带进来。"
			};
		}
		if (intent === "") {
			return {
				instruction: "",
				blocked: "「改成稿」需要知道要改成什么。",
				next: "在「要改成什么」里写一句话（比如：终结奖励与通关奖励合并为一个宝箱入口）。"
			};
		}
		const L = [
			"/sr-gdd-human " + path,
			"改 " + (where || "（未给条目引用 —— 按下面的现状原文定位）") + "。",
			"现状：" + (before || "（面板没拿到这一条的原文 —— 请在成稿里按上面的条目引用定位）"),
			"要改成：" + intent
		];
		if (before && before.indexOf("|") === 0) {
			L.push("（现状那一行是表格行，请按表格口径整行替换；编号/列序不要顺手改。）");
		}
		const miss = (Array.isArray(inp.configMissing) ? inp.configMissing : []).map(oneLine).filter((x) => x !== "");
		if (oneLine(inp.configLabel) || miss.length) {
			L.push("留意（配置支线的现状，面板只报状态、不改表）：");
			if (oneLine(inp.configLabel)) L.push("  · " + oneLine(inp.configLabel));
			for (const m of miss.slice(0, 8)) L.push("  · " + m);
			L.push("  —— 若这次改动牵动规则，配置字段的重新派生由 /sr-config 承接（面板不重做 Excel）。");
		}
		L.push("连带影响（工作台只报**结构引用**扫得出的那部分；语义影响请按撰写纪律的影响面闭合自行扫全）：");
		L.push("  · 成稿的 §4 规则 / §5 界面流程 / §9 验收标准 三处要一起看（改一条规则通常牵到界面与验收）。");
		L.push(tail);
		return { instruction: L.join("\n"), blocked: "", next: "" };
	}

	// integrate
	const label = oneLine(inp.configLabel);
	const miss = (Array.isArray(inp.configMissing) ? inp.configMissing : []).map(oneLine).filter((x) => x !== "");
	if (topic === "" && winOf(inp.draftPath) === "") {
		return {
			instruction: "",
			blocked: "「发起整合定稿」需要成稿 —— 主题与成稿路径都拿不到。",
			next: "先走「写成稿」，或在「主题」里写功能名。"
		};
	}
	const L = [
		"【文档生成 · 发起整合定稿】请执行 `/sr-gdd-ai`（走 `/sr-gdd-ai` 的正常调用，不要改动该 skill）。",
		"主题：" + (topic || "（按成稿推导）"),
		"成稿（整合的规则侧；这份是设计内容的撰写地）：" + (winOf(inp.draftPath) || (gddDir + "\\" + (topic || "<主题>") + "_*（按日期取最新）")),
		"现状（配置支线走到哪 —— 面板读自定稿 §6，只报状态）：" + (label || "（面板没读到定稿 §6：还没有定稿，或定稿里没有配置契约）")
	];
	if (miss.length) {
		L.push("配置侧的缺口（整合时要一并处置或明确列为待办）：");
		for (const m of miss.slice(0, 10)) L.push("  · " + m);
	}
	L.push(
		"整合要求（`gdd-pipeline.md` §二的章节对应）：",
		"  · §4 保留成稿的规则与组号，把每条规则**对应到配置表里实际落地的字段/记录**（整合结果，不是另写一套规则）。",
		"  · §5 界面流程按成稿口径搬；§6 范围门 → §8、§7 埋点 → §9、§9 验收 → §10、§10 交接 → §11。",
		"  · 新增 §6 配置契约：从配置表**读回**（中文字段 / 英文字段 / 结构 / 含义 / 状态：已有、新增、新增命名待定、待配表）。",
		"  · 新增 §7 多语言文本：据定稿列出**普通文本**条目（键 + 中文文案 + 状态）；文本表的增删改由用户自行发起，本步不落表。",
		"  · §8 验证计划与 §12 已废弃口径**不进定稿**（只留在成稿）。",
		"  · 产出顶部 `doc_type: final_gdd` + `status: pending`；第 5 步先调 `/sr-gdd-review` 出审查报告，再呈定稿门（审查是质量意见，不是通过凭证）。",
		tail
	);
	return { instruction: L.join("\n"), blocked: "", next: "" };
}

