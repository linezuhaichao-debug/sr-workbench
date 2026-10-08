/**
 * 外部输入合入 ①②③（工单 26）—— **纯函数层**（零 IO、零时钟、零全局）。
 *
 * 设计出处：`策划工作台-设计定稿.md` §4.3.5「UE 交互交付物的合入」（L262–286）。逐字要点：
 *   · UE 交付物是**外部输入（zip）**，不在 sr skill 的 workspace 里；
 *   · 真实结构（两份实测）：`01_宣讲会交付.html · 02_交互回写文档.md · 03_图例索引.html · manifest.json · 截图\ · 流程图\`
 *   · 五个区域：① 包识别 ② **基线校验（★）** ③ 回写清单 ④ 三方映射 ⑤ 线框图替换 —— 本票只做 ①②③；
 *   · **归档位**：`features\<主题>\source\UE交付_<日期>\`。
 *
 * ── ★ 基线校验的必要性（设计里的实测案例，逐字）────────────────────────────────
 *   「联盟讨伐交付物声明基线是 `正式AI读版_联盟悬赏_v1.0`（09-23），但它是 09-28 交付的；
 *    `WB-001` 已于 09-23 13:40 发布 v1.1（`candidate_sha256` == `formal_sha256`），
 *    且 `WB-001-C2` **已经删掉了** `alli_boss_ultimate_settle_hint`，而交付物的回写清单**还在要求改它**。
 *    → **不校验基线就直接合入，会把已删的东西改回来。**」
 *   本模块把这句话拆成**两条可核对的判定**：
 *     ① `baselineState()` —— 交付物自己声明的那一版，与**当前有效定稿**是不是同一版（版本号 + 日期 + 文件名）；
 *     ② `writebackRows()` —— 回写清单里那些「要删 / 要撤」的文本键，**在当前定稿里已经不在**了 ⇒
 *        `danger`：这一条照单执行就是**把它改回来**。
 *   两条都由**面板读到的原文 + 宿主 `stat` 的指纹**推出，没有任何一条靠猜。
 *
 * ── 判据口径（不许自己发明）────────────────────────────────────────────────
 *   · **版本指纹** = 宿主 `stat` 的 `version` 原文（`dev:ino:size:mtimeNs:ctimeNs`），只做**等值比对**、
 *     不解析 —— 与 `derived.ts` / `finalgate.ts` / 工单 25 的实测同一条口径（见 `fsstamp.ts` 文件头）。
 *   · **条目引用** = `refgraph.refOf` 的键、行号 = `finaltree` 的 1-based 行号、定位串 = 引用图里的 `where`。
 *     本模块**不自己拼**引用串（拼错一个空格查图就是空集，界面上还看不出为什么）。
 *   · **§5 的 ASCII 占位** = `drafttree.asciiOf` 的形状（原样进出，不在这里重解析成稿）。
 *
 * ── 三条降级纪律（承 `derived.ts`）──────────────────────────────────────────
 *   · 读不到 manifest / 读不到回写文档 / 拿不到当前定稿的指纹 ⇒ 一律 `unknown`，
 *     界面上写"面板看不到依据"，**绝不把"看不到"显示成"没问题"**；
 *   · **认不出就不猜**：包名不匹配、没有 `manifest.json`、功能对不上 ⇒ `isDelivery=false` +
 *     `need`（下一步做什么），不静默挑一个功能；
 *   · `blocked` + `next` 一起给：缺前提时**不发指令**，界面照原样显示。
 */

import { parseFinalGdd } from "./finalgdd.ts";
import { TEXTKEY_RE, buildFinalTree } from "./finaltree.ts";
import { buildRefGraph } from "./refgraph.ts";
import { asciiOf } from "./drafttree.ts";
import { buildDraftInstruction } from "./draftstep.ts";
import { stampOf } from "./fsstamp.ts";

// ════════════════════════════════════════════════════════════════
// 〇、小工具（与 derived.ts / draftstep.ts 同口径）
// ════════════════════════════════════════════════════════════════

/** 一行文本（去换行与多余空白） */
function oneLine(v: unknown): string {
	return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
}

/** 路径显示统一成 `\`（只改显示的字符串） */
function winOf(p: unknown): string {
	return String(p == null ? "" : p).replace(/[\\/]+$/, "").replace(/\//g, "\\");
}

/** 日期：只留 8 位数字（面板给今天；**纯函数不吃时钟**） */
function compactOf(v: unknown): string {
	const s = String(v == null ? "" : v).replace(/[^0-9]/g, "");
	return s.length >= 8 ? s.slice(0, 8) : "";
}

/** `20260928` → `2026-09-28`（拿不到就给原样） */
function dashedOf(compact: unknown): string {
	const s = compactOf(compact);
	return s === "" ? "" : s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
}

// ════════════════════════════════════════════════════════════════
// 一、① 包识别 —— 这是什么、对着哪个功能、**依据是什么**
// ════════════════════════════════════════════════════════════════

/**
 * UE 交互交付包的**文件名形状**（实测两份都长这样）：
 *   `SR_联盟讨伐_交互交付物_20260928_1510.zip`
 *   `SR_神话宝库_交互交付物_20260910_1409.zip`
 *   `SR_联盟讨伐_交互交付物_20260928_1510(1).zip`   ← 浏览器重复下载，**要能认出来**
 * 判据只有这一条（外加下面的 manifest 内容判据）—— **不按"像不像"猜**。
 */
const DELIVERY_ZIP_RE = /^(.*)_交互交付物_(\d{8})(?:_(\d{4}))?(?:\((\d+)\))?$/;

/** 包内的**结构判据**（设计 §4.3.5 的"真实结构"，两份实测） */
const STRUCT_PROBE = [
	{ key: "speech", label: "01_宣讲会交付.html", re: /^01[_-].*宣讲会交付.*\.html?$/i, dir: "" },
	{ key: "writeback", label: "02_交互回写文档.md", re: /^02[_-].*交互回写文档.*\.(md|markdown)$/i, dir: "" },
	{ key: "legend", label: "03_图例索引.html", re: /^03[_-].*图例索引.*\.html?$/i, dir: "" },
	{ key: "manifest", label: "manifest.json", re: /^manifest\.json$/i, dir: "" },
	{ key: "shots", label: "截图\\", re: /^截图[\\/]/, dir: "截图" },
	{ key: "flow", label: "流程图\\", re: /^流程图[\\/]/, dir: "流程图" }
];

/** 一条**判定依据**（界面上逐条显示 —— "绝不静默猜测"就靠它） */
export interface EvidenceItem {
	/** 稳定的机器可读 id（DOM 属性 / 测试断言都用它） */
	id: string;
	/** 这一条是什么（人话小标题） */
	label: string;
	/** 结论原文（逐字给出读到的东西） */
	value: string;
}

export interface ManifestLite {
	/** `manifest.json` 的 `delivery` 字段（包的正式名） */
	delivery: string;
	project: string;
	system: string;
	/** `task_goal`（`正式交付` / …） */
	goal: string;
	/** 回写文档 / 规则说明的版本标记（`v1.7（R7）`） */
	mdVersion: string;
	/** 已确认决策条数（`confirmations` 的长度） */
	confirmations: number;
	/** 声明的文本键条数（`text_ids_count`；真实包里是 43） */
	textIds: number;
	/** 截图条数 */
	screenshots: number;
	/** 截图相对路径（`截图/01_….png`）—— ⑤ 线框图替换的图源 */
	shotPaths: string[];
	/** ★ 工单 27 ④：Figma 源文件名（`L_联盟讨伐`，`figma_source.file`） */
	figmaFile: string;
	/** ★ 工单 27 ④：Figma Page ID（`0:1`） */
	pageId: string;
	/** ★ 工单 27 ④：Page 名（`Page 1`） */
	pageName: string;
	/** ★ 工单 27 ④：Figma 规则节点（第一写入点，`78:480`） */
	ruleNode: string;
	/** ★ 工单 27 ④：规则节点版本标记（`R1（2026-09-28 15:02 写入并复核…）`） */
	ruleVersion: string;
	/** ★ 工单 27 ④：逐条截图台账（13 张，原样） */
	shots: ManifestShot[];
}

/**
 * `manifest.json` 里**一条截图台账**（工单 27 的 ④ 用；设计 §4.3.5 的「截图 ↔ 文档章节 ↔ Figma 节点」）。
 * 四个字段都是**包里写着的原文**，面板一个都不自己发明（`rule_section` 是交付物自己的节号）。
 */
export interface ManifestShot {
	/** 包内相对路径（`截图/01_活动界面_常规难度.png`） */
	file: string;
	/** 交付物自己的节号（`2.1` / `2.1a` / `2.4`） */
	section: string;
	/** 来源 Frame 名（`活动界面（难度12+按钮/信息）`） */
	frame: string;
	/** Figma 节点 ID（`59:619` / `39:741`） */
	node: string;
}

/** `manifest.json` 文本 → 简化结构（**认不出来给 `null`**，不猜） */
export function parseManifest(text: unknown): ManifestLite | null {
	if (text === null || text === undefined) return null;
	const s = String(text).trim();
	if (s === "") return null;
	let j: any = null;
	try { j = JSON.parse(s); } catch (e) { return null; }
	if (!j || typeof j !== "object" || Array.isArray(j)) return null;
	const shots = Array.isArray(j.screenshots) ? j.screenshots : [];
	const src = (j.figma_source || {}) as any;
	const rule = ((j.rules || {}) as any).figma_rule_node || {};
	return {
		delivery: oneLine(j.delivery),
		project: oneLine(j.project),
		system: oneLine(j.system),
		goal: oneLine(j.task_goal),
		mdVersion: oneLine(j.rules && j.rules.md_version),
		confirmations: Array.isArray(j.confirmations) ? j.confirmations.length : 0,
		textIds: Number(j.text_ids_count) || 0,
		screenshots: shots.length,
		shotPaths: shots.map((x: any) => oneLine(x && x.file)).filter((x: string) => x !== ""),
		// ── 工单 27：④ 三方映射要用的两处台账原文 ──────────────────
		/** Figma 源（`{ file: "L_联盟讨伐", page_id: "0:1", page_name: "Page 1" }`） */
		figmaFile: oneLine(src.file),
		pageId: oneLine(src.page_id),
		pageName: oneLine(src.page_name),
		/** 规则节点（第一写入点） */
		ruleNode: oneLine(rule.node_id),
		ruleVersion: oneLine(rule.rule_version),
		/** 逐条截图台账（`file` / `rule_section` / `source_frame` / `node_id`） */
		shots: shots.map((x: any) => ({
			file: oneLine(x && x.file),
			section: oneLine(x && x.rule_section),
			frame: oneLine(x && x.source_frame),
			node: oneLine(x && x.node_id)
		})).filter((x: ManifestShot) => x.file !== "")
	};
}

/**
 * 功能清单里的一项（**由调用方从看板/详情给** —— 本模块不读盘）。
 * `name` / `aliases` 来自身份声明（`feature.json`）；`topic` 是目录名。
 */
export interface FeatureRef {
	topic: string;
	name?: string;
	aliases?: string[];
}

/** 功能锚定结果 */
export interface FeatureHit {
	/** 认定对着哪个功能（空串 = 没认出来） */
	topic: string;
	/** 认它的依据（人话，逐条） */
	why: string[];
	/** 候选（全称/别名命中的功能；多个 = 撞了，**不静默挑一个**） */
	candidates: string[];
	/** 没认出来时的下一步 */
	need: string;
}

export interface IdentifyResult {
	/** ① 这是不是一类 UE 交互交付包（**名称形状 + 包内结构**两条判据） */
	isDelivery: boolean;
	/** 原始文件名（含 `(1)` 这类重复下载后缀） */
	file: string;
	/** 去掉重复下载后缀的规范名 */
	canonical: string;
	/** 主题段（`SR_联盟讨伐_交互交付物_…` → `联盟讨伐`） */
	topic: string;
	/** 交付日期（`YYYYMMDD`；拿不到空串） */
	date: string;
	/** 时间（`HHMM`；没有空串） */
	time: string;
	/** 重复下载标记（`(1)` → `"1"`；没有空串） */
	dupMark: string;
	/** 认成一类交付物的依据（逐条） */
	evidence: EvidenceItem[];
	/** 没认出来时的下一步 */
	need: string;
	/** 对着哪个功能 */
	feature: FeatureHit;
}

/**
 * ① 包识别。**只吃已读到的事实**（zip 文件名 + 包内条目名 + manifest 文本 + 功能清单）。
 *
 * @param input.zipFile    zip 的文件名（不含目录）
 * @param input.entries    包内条目名（`manifest.json` / `截图/01_….png`；**空数组 = 还没解开**）
 * @param input.manifest   `manifest.json` 文本（`null` = 没读到）
 * @param input.features   功能清单（看板给）
 */
export function identify(input: {
	zipFile?: unknown;
	entries?: unknown[];
	manifest?: unknown;
	features?: FeatureRef[];
}): IdentifyResult {
	const inp = input || {};
	const file = oneLine(inp.zipFile);
	const base = file.replace(/\.zip$/i, "");
	const m = DELIVERY_ZIP_RE.exec(base);
	const entries = (Array.isArray(inp.entries) ? inp.entries : []).map((x) => String(x == null ? "" : x));
	const man = parseManifest(inp.manifest);
	/**
	 * ★ 目录探针（`截图\` / `流程图\`）在这一层要**从条目名推**"这个目录在不在"：
	 *   面板列的是**文件**（`listFiles`），归档位那一层的目录名顶多作为前缀出现在 `截图/01_….png` 里；
	 *   而设计 §4.3.5 的实测结构（`manifest.json` 的 zip 条目）里目录是带尾斜杠的一条。
	 *   ⇒ 两种形状都要认：**带尾斜杠的目录条目**，或**以 `<目录>/` 开头的文件条目**。
	 */
	const dirIn = (name: string) => entries.some((e) => {
		const norm = e.replace(/\\/g, "/").replace(/\/+$/, "");
		const parts = norm.split("/");
		return parts.indexOf(name) >= 0;
	});

	const evidence: EvidenceItem[] = [];
	const evidenceOf = (id: string, label: string, value: string) => {
		if (value !== "") evidence.push({ id: id, label: label, value: value });
	};

	// 判据 ① 名称形状
	const topic = m ? oneLine(m[1]).replace(/^SR[_-]?/i, "") : "";
	const date = m ? compactOf(m[2]) : "";
	const time = m && m[3] ? m[3] : "";
	const dupMark = m && m[4] ? m[4] : "";
	evidenceOf("name", "名称形状（`<主题>_交互交付物_<YYYYMMDD>[_<HHMM>].zip`）",
		m ? "命中：主题段 `" + oneLine(m[1]) + "` · 交付日期 " + dashedOf(date) + (time ? " " + time.slice(0, 2) + ":" + time.slice(2) : "") : "**没命中**（文件名不是这个形状）");

	// 判据 ② 包内结构（设计 §4.3.5 的"真实结构"，六个探针逐个报在不在）
	//   ★ 探针既试**整条**也试**尾段**：包内条目带不带外层包名那一层都要认得出
	//     （列举给的是条目全名；两种形状都实测过）。
	const probes: string[] = [];
	const miss: string[] = [];
	for (const p of STRUCT_PROBE) {
		// 目录探针（`截图\` / `流程图\`）按"条目路径里有没有这一段"判；文件探针按整条 / 尾段 / 末两段判
		const hit = p.dir !== ""
			? dirIn(p.dir)
			: entries.some((e) => {
				const norm = e.replace(/\\/g, "/");
				const tail = norm.replace(/\/+$/, "").split("/").pop() || "";
				const tail2 = norm.replace(/\/+$/, "").split("/").slice(-2).join("/");
				return p.re.test(norm) || p.re.test(tail) || p.re.test(tail2);
			});
		if (hit) probes.push(p.label); else miss.push(p.label);
	}
	if (entries.length) {
		evidenceOf("structure", "包内结构（六个探针）",
			probes.length + "/" + STRUCT_PROBE.length + " 命中：" + (probes.join(" · ") || "一个都没命中") +
			(miss.length ? "　｜　没命中：" + miss.join(" · ") : ""));
	} else {
		evidenceOf("structure", "包内结构（六个探针）", "**还没解开这个 zip** —— 面板看不到包内条目（下一步：让 agent 解压到归档位）");
	}

	// 判据 ③ manifest 里写了什么
	const manProbe = entries.some((e) => /(^|[\\/])manifest\.json$/i.test(e));
	if (man) {
		evidenceOf("manifest", "`manifest.json`（包的台账）",
			"delivery `" + (man.delivery || "（空）") + "` · project `" + (man.project || "（空）") + "` · system `" +
			(man.system || "（空）") + "` · task_goal `" + (man.goal || "（空）") + "` · " +
			"确认 " + man.confirmations + " 条 · 文本键 " + man.textIds + " · 截图 " + man.screenshots + " 张" +
			(man.mdVersion ? " · 回写文档 " + man.mdVersion : ""));
	} else if (manProbe || !entries.length) {
		evidenceOf("manifest", "`manifest.json`（包的台账）", "**没读到** —— 面板拿不到包自己声明的台账（解压到归档位之后再看一次）");
	}

	// 判据 ④ 别名匹配（对着哪个功能）
	const feats = (Array.isArray(inp.features) ? inp.features : []);
	const cands: string[] = [];
	const why: string[] = [];
	if (topic !== "") {
		for (const f of feats) {
			const t = oneLine(f && f.topic);
			if (t === "") continue;
			const nm = oneLine(f && f.name);
			const al = (Array.isArray(f && f.aliases) ? (f.aliases as string[]) : []).map(oneLine).filter((x) => x !== "");
			const hitAlias = al.indexOf(topic) >= 0;
			if (t === topic) { if (cands.indexOf(t) < 0) { cands.push(t); why.push("功能目录名就是 `" + topic + "`"); } continue; }
			if (nm === topic) { if (cands.indexOf(t) < 0) { cands.push(t); why.push("身份名 `" + nm + "` = 包的主题段 `" + topic + "`"); } continue; }
			if (hitAlias) { if (cands.indexOf(t) < 0) { cands.push(t); why.push("旧名/别名命中：`" + topic + "` 在 `" + t + "` 的 aliases 里"); } }
		}
	}
	const feature: FeatureHit = cands.length === 1
		? { topic: cands[0], why: why, candidates: cands, need: "" }
		: cands.length > 1
			? { topic: "", why: why, candidates: cands, need: "包的主题段 `" + topic + "` 同时命中 " + cands.length + " 个功能（" + cands.join(" / ") + "）—— 面板**不替你挑**：请确认它对着哪一个。" }
			: { topic: "", why: why, candidates: [], need: topic === "" ? "包名里没读出主题段 —— 先确认这个 zip 是不是 UE 交互交付包。" : "功能列表里没有能对上 `" + topic + "` 的（按目录名、身份名、aliases 三条都比过了）—— 要么建这个功能，要么确认包里写的系统名。" };
	if (topic !== "" && cands.length === 1) {
		evidenceOf("feature", "别名匹配（对着哪个功能）", "`" + topic + "` → 功能 `" + cands[0] + "`（" + why.join("；") + "）");
	} else if (topic !== "") {
		evidenceOf("feature", "别名匹配（对着哪个功能）", "**没定下来**（" + feature.need + "）");
	}

	const isDelivery = !!m && (entries.length === 0 ? true : probes.length >= 4);
	return {
		isDelivery: isDelivery,
		file: file,
		canonical: base.replace(/\(\d+\)$/, "") + ".zip",
		topic: topic,
		date: date,
		time: time,
		dupMark: dupMark,
		evidence: evidence,
		need: isDelivery
			? (entries.length === 0 ? "让 agent 按归档指令解压到 `source\\UE交付_" + (date || "<日期>") + "\\`（**不带外层包名那一层**），面板随后读回包内条目与 manifest。" : "")
			: "名称形状不匹配，或包内结构与 UE 交互交付包（01 宣讲会交付 / 02 交互回写文档 / 03 图例索引 / manifest.json / 截图 / 流程图）对不上 —— 先确认它是哪一类交付物。",
		feature: feature
	};
}

// ════════════════════════════════════════════════════════════════
// 二、② 基线校验（★）
// ════════════════════════════════════════════════════════════════

/**
 * 交付物自己声明的基线（**从交付物正文里读出来，不是面板编的**）。
 * **优先 `02_交互回写文档.md`**（它写着"策划案基线：…"），`manifest.json` 里没有这一项（实测两份）。
 */
export interface DeclaredBaseline {
	/** 声明原文（人话：`正式AI读版_联盟悬赏_v1.0（2026-09-23）`） */
	text: string;
	/** 它点名的那份文件（`正式AI读版_联盟悬赏_v1.0`） */
	doc: string;
	/** 基线日期（`20260923`；读不到空串） */
	date: string;
	/** 声明出现在哪一行（1-based；`refgraph.where` 那一侧用它显示"读自哪一行"） */
	line: number;
	/** 读到它的文件名 */
	from: string;
}

/**
 * 声明行的形状（实测：`> 策划案基线：正式AI读版_联盟悬赏_v1.0（2026-09-23）`）。
 * 只认**带"基线"二字的引用行**，其余一律不当声明 —— 认不出来就说认不出来。
 */
const BASELINE_RE = /^[>\s]*[^|\n]*基线[^：:]*[：:]\s*(.+?)\s*$/;
/** 声明串里的日期（`2026-09-23` / `2026/09/23` / `20260923`） */
const DATE_RE = /(\d{4})[-/.]?(\d{2})[-/.]?(\d{2})/;

/** 交付物正文 → 声明基线（读不到给 `null`） */
export function declaredBaselineOf(text: unknown, fileName?: unknown): DeclaredBaseline | null {
	if (text === null || text === undefined) return null;
	const lines = String(text).split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const m = BASELINE_RE.exec(lines[i]);
		if (!m) continue;
		const raw = oneLine(m[1]).replace(/^[`「]+|[`」]+$/g, "").trim();
		if (raw === "") continue;
		// 文件名 = 声明串里"（日期）"之前的那一段；日期 = 括号里的（或串里第一个日期）
		const dm = DATE_RE.exec(raw);
		const date = dm ? compactOf(dm[1] + dm[2] + dm[3]) : "";
		let doc = raw;
		const paren = /^(.*?)\s*[（(]\s*\d{4}[-/.]?\d{2}[-/.]?\d{2}\s*[）)]?\s*$/.exec(raw);
		if (paren) doc = oneLine(paren[1]);
		else doc = oneLine(raw.replace(DATE_RE, "").replace(/[（(]\s*[）)]/g, ""));
		return { text: raw, doc: doc.replace(/[（(]\s*$/, "").trim(), date: date, line: i + 1, from: oneLine(fileName) };
	}
	return null;
}

/** 当前有效定稿的"这一版"（**由调用方从 `loadFeatureDetail` 给**） */
export interface CurrentFinalRef {
	/** 文件名 */
	name: string;
	/** 绝对路径 */
	path: string;
	/** ★ 版本指纹原文（宿主 `stat` 的 `version`） */
	version: string;
	/** 认它的依据：`active` / `date` */
	from: string;
	/** ★ 同时标了 active 的**所有**份（>1 ⇒ V1 告警，基线校验必须把这一条也说出来） */
	actives?: string[];
}

/** 基线校验的结论档（与 `derived.ts` 的 `DerivedState` 同一套语感） */
export type BaselineState = "fresh" | "stale" | "unknown";

export interface BaselineRow {
	state: BaselineState;
	/** 首屏那一句人话 */
	text: string;
	/** 排障用的短理由（进详情） */
	why: string;
	/** 交付物声明的原文 */
	declared: DeclaredBaseline | null;
	/** 当前有效定稿 */
	current: { name: string; version: string; from: string; actives: string[] };
	/** 逐条依据（界面「详情」折里显示） */
	evidence: EvidenceItem[];
	/**
	 * ★ 基线校验**为什么必须拦**（设计 §4.3.5 的实测案例）：
	 *   非空 = 这一版之后已经有了更晚的发布/修订，照单执行有明确风险。
	 *   面板把这一句直接显示出来，不静默接受。
	 */
	block: string;
}

/**
 * 名字形状的家族键：去掉版本号 / 扩展名 / `归档`·`候选稿` 这类尾巴，**保留日期** ——
 *   留日期是刻意的：真实交付物声明的是 `正式AI读版_联盟悬赏_v1.0`（AI 读版的产物体），
 *   与定稿 `联盟悬赏_20260923_定稿.md` 本来就不是同一份东西，拿家族去判过期是假结论（实测踩过）。
 *   而"另一份**定稿**"（`联盟悬赏_20260921_定稿.md`）要能与当前这份区分开 —— 所以日期留着。
 */
export function familyOf(name: unknown): string {
	return oneLine(name)
		.replace(/\.[A-Za-z0-9]+$/, "")
		.replace(/[（(]\s*(?:归档|候选稿)?\s*[）)]/g, "")
		.replace(/[_\-]?(?:v|V)\d+(?:\.\d+)*/g, "")
		.replace(/[_\-]?(?:归档|候选稿|定稿|审查)$/g, "")
		.replace(/[_\-\s]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase();
}

/** 声明里的版本号（`正式AI读版_联盟悬赏_v1.0` → `v1.0`；没有空串） */
function versionOfName(name: unknown): string {
	const m = /(?:^|[_\-\s])(v\d+(?:\.\d+)*)/i.exec(String(name == null ? "" : name));
	return m ? m[1].toLowerCase() : "";
}

/**
 * ★ ② 基线校验：交付物声明"基于某版定稿"，**核对它是否已过期**。
 *
 * 判据（三条，逐条给依据 —— **认不出来就是认不出来**）：
 *   ① **版本号**（决定性）：声明里的 `v1.0` 与"当前这一版实际发布到的版本"（`published`，由调用方从交付台账给）比；
 *   ② **声明点名的那份文件**：与当前有效定稿是不是同一份（只在两者"同类"时才当判据）；
 *   ③ **日期**：声明里的日期与当前有效定稿的日期（文件名里的 8 位）比，并算出"包比声明晚几天交付"。
 *      ★ 真实数据里声明点的是 `正式AI读版_联盟悬赏_v1.0`（AI 读版的产物体），与定稿 `联盟悬赏_20260923_定稿.md`
 *        **不是同一份东西** —— 拿"家族对不上"判过期会编出一个假结论（实测踩过），
 *        所以这一条降级成如实标注，只在②那个条件下才升格成判据。
 *
 * ★ 为什么"版本号"这一条是决定性的：设计里的实测案例就是它 ——
 *   交付声明 `v1.0`，而 `WB-001` 已在 **09-23 13:40** 发布 `v1.1`
 *   （`candidate_sha256` == `formal_sha256`，见 `下游发布状态.json`），交付却是 **09-28** 做的。
 *   面板据此判 **过期**，并在 `block` 里写明"这一版之后发生了什么"。
 *
 * ★ 当前有效定稿的**版本指纹**（宿主 `stat` 的 `version`，工单 25 口径）在这里的角色：
 *   它是"这一版是不是同一份内容"的权威判据 —— 指纹**拿不到**时面板不许说"最新"
 *   （`unknown` 那一支把这一条写进依据），与 `derived.ts` 的过期判定同一条纪律。
 */
export function baselineState(input: {
	declared?: DeclaredBaseline | null;
	final?: CurrentFinalRef | null;
	/** 交付台账里**当前已发布**的版本（`v1.1`）；调用方给，拿不到给空串 */
	published?: unknown;
	/** 已发布版本的时间（人话 `2026-09-23 13:40`）；拿不到给空串 */
	publishedAt?: unknown;
	/** 台账里那条"这一版做了什么改动"的一句话（人话）；拿不到给空串 */
	publishedNote?: unknown;
	/** 包是**哪天交付**的（`20260928`）——"声明早于交付"这一条靠它 */
	deliveredAt?: unknown;
}): BaselineRow {
	const inp = input || {};
	const decl = inp.declared || null;
	const fin = inp.final || null;
	const published = oneLine(inp.published);
	const publishedAt = oneLine(inp.publishedAt);
	const publishedNote = oneLine(inp.publishedNote);
	const deliveredAt = compactOf(inp.deliveredAt);
	const evidence: EvidenceItem[] = [];

	const cur = {
		name: fin ? oneLine(fin.name) : "",
		version: fin ? String(fin.version == null ? "" : fin.version) : "",
		from: fin ? oneLine(fin.from) : "",
		actives: (fin && Array.isArray(fin.actives)) ? (fin.actives as string[]).map(oneLine).filter((x) => x !== "") : []
	};

	// 声明这一侧
	if (!decl) {
		return {
			state: "unknown", declared: null, current: cur, block: "",
			text: "面板看不到依据（交付物里没有读到基线声明）—— 不默认它是最新的",
			why: "交付物的回写文档与 manifest 里都没有「…基线：…」这一行 ⇒ 无法判断它基于哪一版。",
			evidence: [{ id: "declared", label: "交付物声明的基线", value: "**没读到**（`02_交互回写文档.md` / `manifest.json` 里都没有这一行）" }]
		};
	}
	evidence.push({ id: "declared", label: "交付物声明的基线", value: decl.text + "（读自 `" + decl.from + "` L" + decl.line + "）" });

	// 当前这一侧
	if (!fin || cur.name === "") {
		return {
			state: "unknown", declared: decl, current: cur, block: "",
			text: "面板看不到依据（这个功能现在没有有效定稿）—— 不默认它是最新的",
			why: "没有 active 定稿（或一份都没标），也就没有「这一版」可比。",
			evidence: evidence.concat([{ id: "current", label: "当前有效定稿", value: "**没有**（`gdd\\` 里没有 `_定稿.md`，或没有一份标 `status: active`）" }])
		};
	}
	evidence.push({
		id: "current", label: "当前有效定稿",
		value: "`" + cur.name + "`（" + (cur.from === "active" ? "头部标了 `status: active`" : "没有 active，按日期取最新") + "）"
	});
	if (cur.actives.length > 1) {
		evidence.push({
			id: "v1", label: "★ 多份 active（V1）",
			value: cur.actives.length + " 份同时标了 `status: active`（" + cur.actives.join(" / ") + "）—— 文件自身没有 archived 标记，取代关系是派生的，基线比对因此**不是唯一解**"
		});
	}
	if (cur.version === "" || stampOf(cur.version) === null) {
		evidence.push({ id: "fingerprint", label: "当前定稿的版本指纹", value: "**拿不到**（宿主 `stat` 没给出 `dev:ino:size:mtimeNs:ctimeNs` 形状的版本串）" });
	}

	const declVer = versionOfName(decl.doc);
	const declDate = decl.date;
	const curDate = compactOf(cur.name.replace(/[^0-9]/g, ""));
	const sameFamily = familyOf(decl.doc) === familyOf(cur.name);
	/**
	 * ★ 声明点名的**是不是当前有效定稿本体**（而不是它派生出来/另起名字的兄弟件）：
	 *   真实数据里声明点的是 `正式AI读版_联盟悬赏_v1.0`（`plan-doc-ai-version` 的产物名），
	 *   而当前有效定稿叫 `联盟悬赏_20260923_定稿.md` —— **家族永远对不上，那不是过期信号**。
	 *   所以家族这一条只在**两个名字是同一类东西**时才当判据；否则降成一条如实标注。
	 */
	const declIsFinalNamed = sameFamily || /定稿/.test(decl.doc);

	// ── ① 版本号 ──────────────────────────────────────────────
	//   声明的版本 vs **当前已发布**的版本（交付台账给的）。两个都拿得到才比。
	const verBad = declVer !== "" && published !== "" && declVer !== published.toLowerCase();
	const verComparable = declVer !== "" && published !== "";
	evidence.push({
		id: "version", label: "① 版本号（声明 vs 交付台账里当前已发布）",
		value: "交付物声明 `" + (declVer || "（没写版本号）") + "`　｜　交付台账里**当前已发布** " + (published || "（面板看不到发布台账）") +
			(publishedAt ? "（" + publishedAt + "）" : "") + (declIsFinalNamed ? "" : "　｜　（这一条是**决定性**判据）") +
			(verComparable ? (verBad ? "　⇒ **不是同一版**" : "　⇒ 同一版") : "　⇒ **比不了**（缺一边）")
	});
	// ── ② 声明点名的那份文件 ─────────────────────────────────
	//   标签沿用历史顺序（③ 在日期那一条之前），编号以**判据顺序**为准：这一条是第 ② 条判据。
	evidence.splice(2, 0, {
		id: "family", label: "② 声明点名的文件",
		value: "声明 `" + decl.doc + "`　｜　当前有效定稿 `" + cur.name + "`" +
			(sameFamily ? "　⇒ 同一份东西" : (declIsFinalNamed
				? "　⇒ **对不上**（它基于的是另一份定稿）"
				: "　⇒ 名字对不上，但那是**同一份定稿派生出来的兄弟件**（定稿本体是上面那一份）—— 这一条不作为过期判据"))
	});
	// ── ③ 日期 ───────────────────────────────────────────────
	evidence.push({
		id: "date", label: "③ 日期",
		value: "声明 " + (dashedOf(declDate) || "（没写日期）") + "　｜　当前定稿 " + (dashedOf(curDate) || "（文件名里没读出日期）") +
			(deliveredAt ? "　｜　包是 " + dashedOf(deliveredAt) + " 交付的" : "") +
			(deliveredAt && declDate ? (declDate < deliveredAt ? "　⇒ 包比声明晚 " + daysBetween(declDate, deliveredAt) + " 天交付" : "　⇒ 声明与交付同一天") : "")
	});

	// ── 结论 ─────────────────────────────────────────────────
	//   ★ 判定顺序（**决定性判据在前**）：
	//     ① 版本号不一致（设计里的实测案例就是它）→ ② 声明点名的是另一份**定稿** → ③ 日期不一致 → ④ 判不了 → ⑤ 最新
	if (verBad) {
		const gap = (declDate && deliveredAt && declDate < deliveredAt) ? "，而包是 " + dashedOf(deliveredAt) + " 才交付的" : "";
		const block = "**拦下**：交付物声明基于 `" + declVer + "`" + gap + "，但这一版之后已经发布到 `" + published + "`" +
			(publishedAt ? "（" + publishedAt + "）" : "") +
			(publishedNote ? "：" + publishedNote : "") +
			" —— 回写清单是按 `" + declVer + "` 那份写的，**不能照单全收**。";
		return {
			state: "stale", declared: decl, current: cur, block: block, evidence: evidence,
			text: "**已过期** —— 它声明基于 `" + declVer + "`（" + (dashedOf(declDate) || "日期没写") + "），而这一版之后已经发布到 `" + published + "`" +
				(publishedAt ? "（" + publishedAt + "）" : ""),
			why: "baseline-version-mismatch：声明里的版本号与交付台账里当前已发布的版本号不一致。"
		};
	}
	if (!sameFamily && declIsFinalNamed) {
		return {
			state: "stale", declared: decl, current: cur,
			block: "**拦下**：交付物基于的是另一份定稿（`" + decl.doc + "`），不是当前有效定稿 `" + cur.name + "` —— 对不上就不能照单改。",
			text: "**已过期** —— 它声明基于另一份定稿 `" + decl.doc + "`，当前有效定稿是 `" + cur.name + "`（" + dashedOf(curDate) + "）",
			why: "baseline-other-final：声明点名的定稿与当前有效定稿不是同一份。",
			evidence: evidence
		};
	}
	if (declDate !== "" && curDate !== "" && declDate !== curDate) {
		const earlier = declDate < curDate;
		return {
			state: "stale", declared: decl, current: cur,
			block: "**拦下**：交付物声明基于 " + dashedOf(declDate) + " 那一版，当前有效定稿是 " + dashedOf(curDate) +
				" —— 中间隔了" + (earlier ? "一次改版" : "一份更早的版本") + "，回写清单的现状原文可能已经漂了。",
			text: "**已过期** —— 它声明基于 " + dashedOf(declDate) + " 那一版，当前定稿是 " + dashedOf(curDate),
			why: "baseline-date-mismatch：声明日期与当前有效定稿的日期不一致。",
			evidence: evidence
		};
	}
	// 版本号比不了（台账看不到 / 声明没写版本号）⇒ 只能说"对得上"，不能说"没问题"
	if (!verComparable) {
		return {
			state: "unknown", declared: decl, current: cur, block: "",
			text: "对得上，但**面板判不了死**（" + (declVer === "" ? "交付物没写版本号" : "交付台账里没有已发布版本") + "）—— 不默认它没问题",
			why: "无法完成版本号比对：声明或发布台账缺一边。",
			evidence: evidence
		};
	}
	return {
		state: "fresh", declared: decl, current: cur, block: "",
		text: "**已是最新** —— 声明基于 `" + declVer + "`，与交付台账里当前已发布的 `" + published + "` 是同一版（" + dashedOf(declDate || curDate) + "）",
		why: "版本号 + 日期两条都对上，且声明点名的不是另一份定稿。",
		evidence: evidence
	};
}

/** 两个 `YYYYMMDD` 之间差几天（算不出来给空串） */
function daysBetween(a: string, b: string): string {
	const pa = compactOf(a), pb = compactOf(b);
	if (pa === "" || pb === "") return "";
	const ms = (x: string) => Date.UTC(Number(x.slice(0, 4)), Number(x.slice(4, 6)) - 1, Number(x.slice(6, 8)));
	const d = Math.round((ms(pb) - ms(pa)) / 86400000);
	return Number.isFinite(d) ? String(d) : "";
}

// ════════════════════════════════════════════════════════════════
// 三、③ 回写清单
// ════════════════════════════════════════════════════════════════

/** 回写清单里的一条（**每条能定位回定稿**） */
export interface WritebackRow {
	/** 交付物写的"策划案条目"原文（第一列） */
	target: string;
	/** 回写动作（第二列） */
	action: string;
	/** 依据（第三列：`C07` / `C02（R7 修正）`） */
	basis: string;
	/** 交付物里的行号（`02_交互回写文档.md`） */
	srcLine: number;
	/**
	 * 档：
	 *   · `ok`      —— 定稿里有这条，参照条目引用 + 行号改；
	 *   · `danger`  —— ★ 这一条要**删/撤**的文本键，在当前定稿里**已经不在**（或要改的条目已经不在）⇒ 照单执行就是"把它改回来"；
	 *   · `missing` —— 交付物点名的条目/键在定稿里找不到（可能是它基于的那一版才有）；
	 *   · `note`    —— 只是说明行，没有可定位的条目。
	 */
	status: "ok" | "danger" | "missing" | "note";
	/** 定稿里的条目引用串（`§5 UI-M17 UE17` / `§7 alli_boss_dmg_actual`） */
	refs: string[];
	/** 引用 → 行号（定稿里，1-based） */
	lines: Array<{ ref: string; line: number; where: string }>;
	/** 这一条点名、但定稿里已经不在的**文本键** */
	goneKeys: string[];
	/** 这一条点名、定稿里在的文本键 */
	foundKeys: string[];
	/** 这一条点名、定稿里没声明过的键（可能是"新增"） */
	newKeys: string[];
	/** ★ 危险句（`status === "danger"` 时非空）—— 面板**逐字**显示它 */
	warn: string;
	/** 判定依据（人话，逐条；进「详情」） */
	evidence: string[];
}

/** 定稿侧的一件事实（由调用方用 `parseFinalGdd` / `buildFinalTree` / `buildRefGraph` 建好） */
export interface FinalIndex {
	/** 键文本 → 1-based 行号（§7 声明的那些） */
	keys: Record<string, number>;
	/** 引用串 → `{ where, line }`（`buildRefGraph` 的 byRef） */
	refs: Record<string, { where: string; line: number }>;
	/** ★ 条目编号（`UE3a` / `UI-M1` / `AC14`，大写）→ **唯一的那个引用串**（§5 / §10 里） */
	tok: Record<string, { ref: string; where: string; line: number }>;
	/** UE* → 行号 */
	ues: Record<string, number>;
	/** §5 界面组（`UI-M1`）→ 行号 */
	uis: Record<string, number>;
	/** AC* → 行号 */
	acs: Record<string, number>;
}

/** 一条可引用的边：`{ ref, where, line }`（`byRef` 的叶子） */
interface RefLeaf {
	ref: string;
	where: string;
	line: number;
}

/** 可作"条目引用"的串：`§5 UI-M1 UE3` / `§10 AC8`（§4 R* 与 §7 键不在这条路上） */
const FINAL_REF_RE = /^§(?:5|10)\s+\S/;

/**
 * 从定稿全文建索引（**调用方给文本，这里只解析**）。
 *
 * ★ 引用串一律取自 `buildRefGraph` 的 `byRef` **键**（那是 `refOf` 的唯一产出地）——
 *   本模块**不自己拼**引用串（拼错一个空格查图就是空集，界面上还看不出为什么）。
 * ★ `tok` 是"条目编号 → 引用串"的**唯一解**：真实数据里 `UE3a` 只属于 `§5 UI-M4`，
 *   但 `UE3a` 这三个字在 §4 的规则组里也会被提到 —— 拿"提到它的那一行"当引用地址
 *   会给出一个**错的行号**（实测踩过：`UE14` 被指到 §4 R7 的 L160）。所以这里只认
 *   §5 界面组名下的 UE*、§10 的 AC*、以及 §5 的界面组本身。
 */
export function finalIndexOf(text: unknown): FinalIndex {
	const src = String(text == null ? "" : text);
	const doc = parseFinalGdd(src);
	const graph = buildRefGraph(doc);
	const tree = buildFinalTree(doc, graph);
	const keys: Record<string, number> = {};
	const ues: Record<string, number> = {};
	const uis: Record<string, number> = {};
	const acs: Record<string, number> = {};
	const refs: Record<string, { where: string; line: number }> = {};
	const tok: Record<string, RefLeaf> = {};
	for (const ch of (tree.chapters || [])) {
		for (const it of (ch.items || [])) {
			if (String(ch.no) === "7" && TEXTKEY_RE.test(it.label)) keys[it.label] = it.line;
			if (/^AC\d+$/.test(it.label)) acs[it.label] = it.line;
		}
		for (const g of (ch.groups || [])) {
			if (String(ch.no) === "5" && /^UI-M\d+$/i.test(g.id)) uis[g.id.toUpperCase()] = g.line;
			for (const it of (g.items || [])) {
				if (/^UE\d+[a-z]?$/.test(it.label)) ues[it.label] = it.line;
			}
		}
	}
	const byRef = (graph && graph.byRef) || new Map();
	for (const kv of byRef) {
		const key = String(kv[0] || "");
		const e = (kv[1] || {}) as any;
		if (!FINAL_REF_RE.test(key)) continue;
		const hit = (Array.isArray(e.hits) ? e.hits : []).filter((h: any) => h && Number(h.line) > 0)[0] || null;
		refs[key] = { where: hit ? String(hit.where || "") : "", line: hit ? Number(hit.line) || 0 : 0 };
	}
	/**
	 * ★ `tok`（条目编号 → 引用串 + **它自己的定义行**）由**树**给，不从 `byRef.hits[0]` 拿：
	 *   `hits` 的第一条常常是"别的章里提到它"（实测：`§5 UI-M2 UE14` 的第一条命中是 §4 的
	 *   L160「见 §5 UE12/UE14」）—— 拿它当引用地址会给出**错的行号**。
	 *   树上的 `item.ref` 本来就是 `refOf` 的产出（唯一构造口径），`item.line` 就是定义行。
	 */
	for (const ch of (tree.chapters || [])) {
		const no = String(ch.no || "");
		for (const it of (ch.items || [])) {
			if (/^AC\d+$/.test(String(it.label)) && it.ref && !tok[String(it.label).toUpperCase()]) {
				tok[String(it.label).toUpperCase()] = { ref: it.ref, where: "§" + no + " " + String(ch.title || ""), line: it.line };
			}
		}
		for (const g of (ch.groups || [])) {
			for (const it of (g.items || [])) {
				const lb = String(it.label || "").toUpperCase();
				if (!/^UE\d+[A-Z]?$/.test(lb) || !it.ref || tok[lb]) continue;
				tok[lb] = { ref: it.ref, where: "§" + no + " " + String(g.id || g.no || "") + " " + String(g.title || ""), line: it.line };
			}
			// 界面组本身（`UI-M1`）也要能当引用
			const gid = String(g.id || "").toUpperCase();
			if (/^UI-M\d+$/.test(gid) && g.ref && !tok[gid]) {
				tok[gid] = { ref: g.ref, where: "§" + no + " " + gid + " " + String(g.title || ""), line: g.line };
			}
		}
	}
	return { keys: keys, refs: refs, tok: tok, ues: ues, uis: uis, acs: acs };
}

/** 一行里的条目编号 token（`UE17a` / `AC14` / `UI-M3`；大写去重保序） */
const REF_TOKEN_RE = /(UE\d+[a-z]?|AC\d+|UI-M\d+)/g;
/**
 * 一行里的**文本键** token。
 * ★ 比 `refgraph` 的词表严一档：那边扫的是整份定稿（误报无所谓），这边是**逐条报给人看**，
 *   把英文普通词（`info` / `tips`）或半个文件名当键会让清单变成噪音（实测踩过）。
 *   判据（三条择一）：
 *     · 带**至少两个下划线**（`alli_boss_settle_blank_exit`）—— 英文普通词不可能长这样；
 *     · 交付物写的**通配族** `clear_chest_*`（结尾 `*`，前缀里有一个下划线）；
 *     · 定了前缀的那几个已知族（`alli_boss_` / `clear_chest_` / `clear_preview_`）。
 *   ★ 只带一个下划线的裸前缀（`clear_preview`）**不算键** —— 真实文档里它出现在
 *     「clear_chest_* 与 clear_preview_* 同义重复」这种说明里，报出来是假报警（实测踩过）。
 */
const KEY_TOKEN_RE = /[a-z][a-z0-9]*_[a-z0-9]+_[a-z0-9_]*[a-z0-9]\*?|(?:alli_boss|clear_chest|clear_preview)_[a-z0-9_]*[a-z0-9]\*?/g;
/** 「删 / 撤 / 去掉」这一族的词 —— 只有它们才配"照单执行会把东西改回来"这句判据 */
const REMOVE_RE = /删除|删掉|撤销|撤掉|去掉|移除|废弃/;
/** 「新增」这一族 */
const ADD_RE = /新增|待添加/;

/**
 * 一行里的文本键 token（去重保序）。
 * ★ 交付物写 `clear_chest_*` 这种**通配族**时，把结尾的 `*` 去掉并记进 `wild` ——
 *   通配才允许"前缀命中"；写实的键名一律**精确**比（否则 `clear_preview` 会被
 *   `clear_preview_alliance` 前缀吃掉，一条真"已删"就被漏掉 —— 实测踩过）。
 */
export function keysOf(line: string): { keys: string[]; wild: Record<string, boolean> } {
	const keys: string[] = [];
	const wild: Record<string, boolean> = {};
	let m: RegExpExecArray | null;
	KEY_TOKEN_RE.lastIndex = 0;
	while ((m = KEY_TOKEN_RE.exec(line)) !== null) {
		const raw = m[0];
		const isWild = /\*$/.test(raw);
		const k = raw.replace(/[*_]+$/, "");
		if (k === "") continue;
		if (keys.indexOf(k) < 0) keys.push(k);
		if (isWild) wild[k] = true;
	}
	return { keys: keys, wild: wild };
}

/** 一行里的文本键名（去重保序） */
function keysIn(line: string): string[] {
	return keysOf(line).keys;
}

/** 一行里的条目编号 token（去重保序、大写） */
function toksIn(line: string): string[] {
	const out: string[] = [];
	let m: RegExpExecArray | null;
	REF_TOKEN_RE.lastIndex = 0;
	while ((m = REF_TOKEN_RE.exec(line)) !== null) {
		const t = m[0].toUpperCase();
		if (out.indexOf(t) < 0) out.push(t);
	}
	return out;
}

/** 交付文档里那张"回写清单"表的表头（实测：`| 策划案条目 | 回写动作 | 依据 |`） */
const WRITEBACK_HEAD_RE = /^\|\s*策划案条目\s*\|\s*回写动作\s*\|\s*依据\s*\|/;
/**
 * 交付文档在"文本ID完整清单"之后的那一段**明确宣告**：
 * 「**不落入终稿的策划键（见第四节回写清单）**：alli_boss_dmg_calculated（C04 撤销）、…」
 * ★ 这一段是"已删条目"最硬的证据 —— 交付物**自己**说这些键不进终稿。
 */
const NOT_IN_FINAL_RE = /不落入(?:终稿|定稿)的策划键/;

/**
 * ★ ③ 回写清单：交付物要求改哪些 **UE 条目 / 文本键**，**每条能定位回定稿**。
 *
 * @param docText    `02_交互回写文档.md` 的全文
 * @param index      当前有效定稿的索引（`finalIndexOf` 的结论）
 * @param opts.docName 回写文档的文件名（依据里写清"读自哪一份"）
 *
 * 判据（逐条都给依据，界面上可核对）：
 *   ① 只认**那张表**（表头逐字：`策划案条目 | 回写动作 | 依据`）；
 *   ② 每条里的 `UE*` / `AC*` / `UI-M*` 一律按 `refOf` 拼成引用串去**当前定稿**里查；
 *   ③ 每条里的文本键分三类：**定稿里有** / **定稿里没有但交付物说它是新增** / **定稿里没有而交付物说要删**；
 *   ④ ★ 第 ③ 类里"说要删、而定稿里已经不在"的那些 ⇒ `status = danger` + `warn`
 *      —— 这一条照单执行就是**把已删的东西改回来**（设计 §4.3.5 的实测案例）。
 */
export function writebackRows(docText: unknown, index: FinalIndex, opts?: { docName?: unknown }): WritebackRow[] {
	const src = String(docText == null ? "" : docText);
	if (src === "") return [];
	const lines = src.split(/\r?\n/);
	const idx = index || finalIndexOf("");
	const docName = oneLine(opts && opts.docName) || "02_交互回写文档.md";

	// ① 定位那张表
	let start = -1;
	for (let i = 0; i < lines.length; i++) {
		if (WRITEBACK_HEAD_RE.test(lines[i])) { start = i + 2; break; }   // 跳过表头与分隔行
	}
	const rows: WritebackRow[] = [];
	if (start >= 0) {
		for (let i = start; i < lines.length; i++) {
			const raw = lines[i];
			if (!/^\s*\|/.test(raw)) break;
			const cells = raw.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((s) => s.trim());
			if (cells.length < 3) break;
			if (/^:?-{2,}:?$/.test((cells[0] || "").replace(/\s/g, ""))) continue;
			rows.push(rowOf(cells[0], cells[1], cells[2], i + 1, idx, docName));
		}
	}

	// ★ 「不落入终稿的策划键」那一段：**交付物自己宣告**的"不进终稿的键"。
	//   即便它们不在那张表里，也要作为独立的危险条目报出来 —— 设计里的实测案例
	//   （`alli_boss_ultimate_settle_hint`）在这张表里只以「删除键 X」的形式出现一次，
	//   但"它在当前定稿里已经不在"这个事实只有与当前定稿比过才知道。
	const declared: Array<{ key: string; why: string; line: number }> = [];
	for (let i = 0; i < lines.length; i++) {
		if (!NOT_IN_FINAL_RE.test(lines[i])) continue;
		const seg = lines[i];
		const body = seg.slice(seg.indexOf("：") >= 0 ? seg.indexOf("：") + 1 : 0);
		for (const part of body.split(/[、,，]/)) {
			const kb2 = keysOf(part);
			if (!kb2.keys.length) continue;
			for (const k of kb2.keys) declared.push({ key: k, why: oneLine(part), line: i + 1 });
		}
	}
	for (const d of declared) {
		// ★ 精确比：交付物自己宣告"不落入终稿"的那些键，只要定稿里**同名**在，就不是"已删"
		if (Object.prototype.hasOwnProperty.call(idx.keys, d.key)) continue;
		/**
		 * ★ 它是不是**现存的某个键的前缀**（`clear_preview` 之于 `clear_preview_alliance`）：
		 *   是 ⇒ 说明交付物写的是"这一族"，而族里活着的键明白写着"合并保留 …"，
		 *   把它报成"已删"是**假报警**。真正被删的那一族（`clear_chest_*`）不带 `*` 写不出这种巧合 ——
		 *   而它下面 `clear_chest_*` 那一项会以 `clear_chest` 单列，同样被这一条挡住？
		 *   不：挡住的前提是**前缀命中**。所以这里再要一层：前缀命中的**至少两个**键才算"族"。
		 */
		const prefixed = Object.keys(idx.keys).filter((x) => x.indexOf(d.key + "_") === 0);
		if (prefixed.length >= 2) continue;
		/**
		 * ★ "表里已经报过"这条要**精确比**，不能用"键名出现在行文本里"：
		 *   真实数据的第 7 行文本里既有 `alli_boss_dmg_actual`（要改的）也有 `alli_boss_dmg_calculated`（要点名删的）
		 *   —— 拿"子串出现在行里"当去重判据，会把这条**真·已删**悄悄吞掉（实测踩过）。
		 *   所以比的是**这一行收集到的键名集合**（`keysIn(t + " " + a)`），逐个精确相等。
		 */
		if (rows.some((r) => keysIn(r.target + " " + r.action).indexOf(d.key) >= 0)) continue;
		rows.push({
			target: d.key, action: "（交付物自己宣告：这个键不落入终稿）", basis: "见交付文档该行", srcLine: d.line,
			status: "note", refs: [], lines: [], goneKeys: [d.key], foundKeys: [], newKeys: [],
			warn: "",
			evidence: ["读自 `" + docName + "` L" + d.line + "：「不落入终稿的策划键」那一段点名了 `" + d.key + "`",
				"当前定稿 §7 里**没有** `" + d.key + "` ⇒ 这一条不是「要改」，而是「**已经不在**」—— 别把它当成待办清单照单重加"]
		});
	}
	return rows;
}

/** 表里的一行 → 判定 */
function rowOf(target: string, action: string, basis: string, line: number, idx: FinalIndex, docName: string): WritebackRow {
	const t = oneLine(target);
	const a = oneLine(action);
	const b = oneLine(basis);
	const all = t + " " + a + " " + b;
	const evidence: string[] = ["读自 `" + docName + "` L" + line + "：`" + t + "` → `" + a + "`（依据 " + (b || "没写") + "）"];

	// 条目引用：token → `refOf` 的引用串 → 去当前定稿里查
	const toks = toksIn(t + " " + a);
	const refs: string[] = [];
	const found: Array<{ ref: string; line: number; where: string }> = [];
	const missingToks: string[] = [];
	for (const tk of toks) {
		// ★ 只查 `idx.tok`（"条目编号 → 唯一那个引用串"，见 `finalIndexOf`）——
		//   不扫 `idx.refs` 的键：那会把"§4 里提到过这个编号"当成引用地址，给出错的行号（实测踩过）。
		const leaf = idx.tok[tk];
		if (leaf && leaf.line > 0) {
			refs.push(leaf.ref);
			found.push({ ref: leaf.ref, line: leaf.line, where: leaf.where });
		} else {
			missingToks.push(tk);
		}
	}
	if (found.length) {
		evidence.push("定位回定稿：" + found.map((f) => "`" + f.ref + "` L" + f.line).join(" · "));
	}
	if (missingToks.length) {
		evidence.push((found.length ? "另有" : "") + "**当前定稿里没找到**这些条目：" + missingToks.join(" / "));
	}

	// 文本键：定稿里有 / 没有但声明新增 / 没有而这一行在说删
	const kb = keysOf(all);
	const ks = kb.keys;
	const hasKey = (k: string) =>
		Object.prototype.hasOwnProperty.call(idx.keys, k) ||
		// `clear_chest_*` 这种**通配族**：交付物自己写了 `*`，才允许"同前缀的键都算它在"
		(!!kb.wild[k] && Object.keys(idx.keys).some((x) => x.indexOf(k + "_") === 0));
	const goneKeys = ks.filter((k) => !hasKey(k));
	const foundKeys = ks.filter(hasKey);
	/**
	 * ★ 「已删条目」只认**在说删的那一小段里**点名的键：
	 *   一行里常常同时有"删除 X"和"新增 Y"（实测真实清单的第 8 行就是这样）——
	 *   按整行判会把 Y 也算进"已删"，把一个正常的"新增"报成"会改回来"（假报警）。
	 *   所以先把这一行按 `；` / `，` 切开，只取**含删/撤动词**的那些段里的键。
	 */
	const removeSegs = (t + "；" + a + "；" + b).split(/[；;。]/).filter((s) => REMOVE_RE.test(s));
	const goneByRemoval = goneKeys.filter((k) => removeSegs.some((s) => keysIn(s).indexOf(k) >= 0));
	const newKeys = goneKeys.filter((k) => goneByRemoval.indexOf(k) < 0);

	if (foundKeys.length) evidence.push("定稿 §7 里有：" + foundKeys.map((k) => "`" + k + "`（L" + idx.keys[k] + "）").join(" · "));

	// ★ 危险判定：这一条**说要删**，而它点名的那个键**在当前定稿里已经不在**
	let status: WritebackRow["status"] = "note";
	let warn = "";
	if (goneByRemoval.length) {
		status = "danger";
		warn = "**这会把它改回来** —— 交付清单要求「" + REMOVE_RE.exec(removeSegs.join("；"))![0] + "」 " +
			goneByRemoval.map((k) => "`" + k + "`").join(" / ") +
			"，但**当前有效定稿里已经没有它了**（§7 的键表里查不到）⇒ 照单执行等于把**已经删掉的条目重新加回去**。" +
			"　请先核对：它是不是在交付物声明的基线之后（更晚的定稿 / 修订里）已经被删掉了。";
		evidence.push("★ 危险：" + goneByRemoval.map((k) => "`" + k + "`").join(" / ") + " 不在当前定稿 §7 的键表里，而这一行要求删/撤它 ⇒ 照单执行会**改回来**");
	} else if (found.length || foundKeys.length || newKeys.length) {
		status = "ok";
	} else if (toks.length) {
		status = "missing";
		evidence.push("这一条点名的条目在当前定稿里一个都没找到 —— 它可能基于的是**另一版**（或条目号已经变过）");
	}
	if (status === "ok" && newKeys.length) {
		evidence.push("`" + newKeys.join("` / `") + "` 在定稿里**没有**，而这一行说的是「" + (ADD_RE.test(all) ? "新增" : "改动") + "」 ⇒ 按**新增键**处理");
	}

	return {
		target: t, action: a, basis: b, srcLine: line, status: status,
		refs: refs, lines: found, goneKeys: goneByRemoval, foundKeys: foundKeys, newKeys: newKeys,
		warn: warn, evidence: evidence
	};
}

// ════════════════════════════════════════════════════════════════
// 三·五、④ 三方映射 —— 截图 ↔ 文档章节 ↔ 设计工具节点（工单 27）
// ════════════════════════════════════════════════════════════════
//
// 设计 §4.3.5 的第 ④ 格：「三方映射：截图 ↔ 文档章节 ↔ Figma 节点」，优先级**次之**。
// 工单 27 第 1 条把它拆成可验收的一句话：「三者的对应关系**可见、可核对**」。
//
// ── ★ 判据（一条都不许猜；下面每一条都能在界面上对着原文核）──────────────────
//   三条边 = 三份原文，各自独立可核：
//   · **截图 → 文档章节**：`manifest.json` 的 `screenshots[].rule_section`（交付物自己的节号）
//     ↔ `02_交互回写文档.md` 里 `### <节号> <标题>` 那一行（标题与行号一起给）。
//     ★ 这一条是"交付物自己说的"，**不是**面板推的 —— 推的话就连"它自己写错了"都发现不了。
//   · **截图 → 设计工具节点**：`manifest.json` 的 `screenshots[].node_id`（原样引用）。
//     ★ 复核判据：`03_图例索引.html` 每张图的 caption 里也写了 `Frame <node>`；
//       两份**不一致**时如实标 `agree=false`（不取其一当真）。
//       （`01_宣讲会交付.html` 的 caption 里也有 `原型 Frame <node>` —— 同一份台账的第三次复述。）
//   · **截图 → 定稿 §5**：`02_交互回写文档.md` 里**引用这张图**的那个块（`### 2.x`）的**块头**
//     有没有点名 `UI-M*`（真实案例：`### 2.2 通用排行榜弹窗（UI-M2，Figma 50:1816）`）。
//     ★ 实测：13 张里只有 4 张的块头点名了 `UI-M*`（`2.1` → UI-M1、`2.2` → UI-M2、`2.3` → UI-M3、
//       `2.5` → UI-M4）—— 其余（`2.1a`–`2.1e` 那几张状态图/特写、`2.4 战斗统计弹窗`）
//       **交付物自己没写它属于哪个界面组** ⇒ 面板如实报「推不出」，**不猜**。
//     然后拿这个归属去当前定稿的 §5 里查：那个组**自己有没有图**、图是不是这一张（**按文件名比**）。
//     ★ 一个节点可以横跨两个界面组（真实案例：`2.1 活动界面` 的 `59:619` 同时喂 UE1–UE9 的 UI-M1
//       与 UE10/UE11 的 UI-M2）—— 所以归属是**一对多**，面板如实把两条都列出来，不做"唯一化"。
//   · **对不上就说对不上**：`status` 四档 + `miss`（缺什么，空串 = 没缺口）：
//       `ok` 三边齐全、两份节点一致、且那张图在 §5 里**文件名一致**；
//       `agree` 同上但两份节点依据不一致（图例索引 vs manifest）；
//       `partial` 有一边缺（章节没这一段 / 推不出界面组 / §5 里文件名不同）；
//       `unmapped` 只有截图本身（文档章节与界面组两边都推不出）。

/** `03_图例索引.html` 里一条图例（caption 原文：`01 活动界面 · 常规难度` + `截图/x.png · Frame 59:619`） */
export interface LegendRow {
	/** 图内标题（caption 的 `<b>`） */
	caption: string;
	/** caption 第二行里的文件路径（`截图/01_活动界面_常规难度.png`） */
	file: string;
	/** caption 第二行里的 `Frame <node>`（含 `（39:741/39:749）` 这种特写注记，**原样**） */
	frame: string;
	/** 从 `frame` 里抠出来的**主节点**（`39:741`；抠不出给空串） */
	node: string;
}

/**
 * `03_图例索引.html` → 逐条图例。**认不出来就给空数组**（不猜）。
 * 只认这张文件的固定形状：`<figcaption><b>标题</b><span>截图/….png · Frame xx:yy</span></figcaption>`。
 */
export function parseLegendHtml(text: unknown): LegendRow[] {
	const s = String(text == null ? "" : text);
	if (s === "") return [];
	const out: LegendRow[] = [];
	// ★ caption 的两种写法都要认（同一份交付物里两份实测）：
	//   `… · Frame 59:619`（常规）与 `… · Frame 59:619（39:741/39:749）`（特写裁切，**括号那一截也要原样留着**）
	const re = /<figcaption>([\s\S]*?)<\/figcaption>/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(s)) !== null) {
		const inner = m[1] || "";
		const b = /<b[^>]*>([\s\S]*?)<\/b>/i.exec(inner);
		const sp = /<span[^>]*>([\s\S]*?)<\/span>/i.exec(inner);
		const caption = plainText(b ? b[1] : "");
		const line = plainText(sp ? sp[1] : "");
		const fm = /Frame\s*([0-9]+:[0-9]+(?:（[^）]*）|\([^)]*\))?(?:\s*\/\s*[0-9]+:[0-9]+)*)[）)]?/i.exec(line);
		const fileM = /([^\s·]+\.png)/i.exec(line);
		const frame = fm ? fm[1].replace(/\s+/g, "") : "";
		out.push({
			caption: caption,
			file: fileM ? fileM[1].trim() : "",
			frame: frame,
			// ★ 主节点 = 冒号数字对的第一处（特写那种 `59:619（39:741/39:749）` 里第一个才是 Frame）
			node: frame === "" ? "" : frame.split(/[/（(/]/)[0].trim()
		});
	}
	return out;
}

/** 去掉 HTML 标签与实体（caption 是给人看的，标签不该混进判定） */
function plainText(v: unknown): string {
	return oneLine(String(v == null ? "" : v).replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&"));
}

/** 一张截图在 ④ 里的一行（**每一格都带原文**，界面上可逐格核对） */
export interface MapRow {
	/** 截图序号（取文件名开头的两位数字；拿不到给空串） */
	no: string;
	/** 包内相对路径（`截图/01_活动界面_常规难度.png`） */
	file: string;
	/** 归档位下的绝对路径（读不到给空串 —— 图没归位时就是空） */
	abs: string;
	/** ★ 边 1：文档章节 —— 交付物自己写的节号 + 回写文档里那一行的标题与行号 */
	doc: { section: string; title: string; line: number; matched: boolean };
	/** ★ 边 2：设计工具节点 —— manifest 写的 node + 图例索引写的 node（两份对照） */
	node: {
		manifest: string;
		legend: string;
		/** 两份是否一致（`legend` 为空 = 图例索引里没有它 ⇒ 也标不一致但不算「对不上」） */
		agree: boolean;
		/** 这一张的**来源 Frame 名**（`活动界面（难度12+按钮/信息）`，manifest 原样） */
		frame: string;
		/** 图例索引 caption 里那一串 `Frame …` 原文（含特写注记 `59:619（39:741/39:749）`；读不到给空串） */
		legendFrame: string;
		/** Figma 源文件名 + Page（`L_联盟讨伐 Page 1（0:1）`） */
		page: string;
	};
	/** ★ 边 3：定稿 §5 —— 交付物认定的归属（按图引用所在的**块头**推），与 §5 现状逐个对照 */
	docs: Array<{
		/** 归属到哪个界面组（`§5 UI-M1`；推不出给空串） */
		ref: string;
		/** 定稿 §5 里该组**自己**的图（相对路径，可能多张） */
		images: string[];
		/** 该组里有没有**这一张**（按文件名比） */
		has: boolean;
		/** 怎么归属的（人话，带依据） */
		why: string;
	}>;
	/** `ok` / `agree` / `partial` / `unmapped`（见 `buildMap` 文件头那一节的三条边口径） */
	status: "ok" | "partial" | "unmapped" | "agree";
	/** 缺什么 / 对不上什么（空串 = 没缺口，**这句直接显示在界面上**） */
	miss: string;
	/** 逐格依据（界面上逐条显示） */
	evidence: string[];
}

export interface MapResult {
	rows: MapRow[];
	/** Figma 源与规则节点（④ 的"图"那一侧的公共前缀） */
	figma: { file: string; pageId: string; pageName: string; ruleNode: string; ruleVersion: string };
	/** 一句话结论（人话；含"几张对得上 / 几张对不上"） */
	summary: string;
	/** 机读计数 */
	counts: { total: number; ok: number; partial: number; unmapped: number; nodeDisagree: number; inFinal: number };
	/** 如实标注 */
	notes: string[];
}

/** 一行/一段文本里的 token（**大写去重保序**；每次新建正则，免得带 `g` 的 `lastIndex` 串味） */
function toksOf(text: unknown, re: RegExp): string[] {
	const src = String(text == null ? "" : text);
	const out: string[] = [];
	const r = new RegExp(re.source, re.flags.indexOf("g") >= 0 ? re.flags : re.flags + "g");
	let m: RegExpExecArray | null;
	while ((m = r.exec(src)) !== null) {
		const v = m[0].toUpperCase();
		if (out.indexOf(v) < 0) out.push(v);
	}
	return out;
}

/** 文件名（不带目录、去扩展名）—— 图与图比对一律用它，不比整串路径 */
function baseNameOf(p: unknown): string {
	const s = winOf(p);
	const i = s.lastIndexOf("\\");
	return (i >= 0 ? s.slice(i + 1) : s).replace(/\.[a-z0-9]+$/i, "");
}

/** 图引用相对路径的**尾段**（`UI/UI-M1 x.png` → `UI-M1 x`），用于与 §5 里的引用比 */
function imgKeyOf(src: unknown): string {
	return baseNameOf(src).toLowerCase();
}

/**
 * ④ 三方映射（**纯函数**：manifest 文本 + 图例索引文本 + 回写文档全文 + 当前定稿全文 → 逐行映射）。
 *
 * @param input.manifest  `manifest.json` 全文（`null` = 读不到 ⇒ 节点那一列如实空）
 * @param input.legend    `03_图例索引.html` 全文（`null` = 读不到 ⇒ 复核列空，但不影响 node 那一列）
 * @param input.doc       `02_交互回写文档.md` 全文（`null` = 读不到 ⇒ 章节那一列只剩节号）
 * @param input.finalText 当前有效定稿全文（`null` = 读不到 ⇒ 定稿那一列只剩"没读到定稿"）
 * @param input.pkgDir    归档位绝对路径（拼 `abs`）
 * @param input.archiveDir 归档位（兜底；与 `pkgDir` 二选一）
 */
export function buildMap(input: {
	manifest?: unknown;
	legend?: unknown;
	doc?: unknown;
	finalText?: unknown;
	pkgDir?: unknown;
	archiveDir?: unknown;
}): MapResult {
	const inp = input || {};
	const man = parseManifest(inp.manifest);
	const legend = parseLegendHtml(inp.legend);
	const docText = String(inp.doc == null ? "" : inp.doc);
	const dir = winOf(inp.pkgDir) || winOf(inp.archiveDir);
	const notes: string[] = [];
	const figma = {
		file: man ? man.figmaFile : "",
		pageId: man ? man.pageId : "",
		pageName: man ? man.pageName : "",
		ruleNode: man ? man.ruleNode : "",
		ruleVersion: man ? man.ruleVersion : ""
	};

	if (!man) {
		notes.push("**读不到 `manifest.json`** —— ④ 的三条边里「设计工具节点」那一条没有任何依据（面板不编节点号）。先让 agent 按归档指令把包归位。");
		return {
			rows: [], figma: figma, summary: "④ 三方映射：**读不到 `manifest.json`** —— 这一块做不了（节点那一列没有依据）。",
			counts: { total: 0, ok: 0, partial: 0, unmapped: 0, nodeDisagree: 0, inFinal: 0 }, notes: notes
		};
	}
	if (!legend.length) {
		notes.push("**读不到 `03_图例索引.html` 的图例**（或它不是那张固定形状的索引页）—— 节点那一列只剩 `manifest.json` 一份，" +
			"「两份是否一致」这一条复核做不了。");
	}

	// ── 回写文档：节号 → 标题 + 行号；一个 `![…](…)` 引用落在哪个块里 ────────────
	const docLines = docText === "" ? [] : docText.split(/\r?\n/);
	const secIdx: Record<string, { title: string; line: number }> = {};
	for (let i = 0; i < docLines.length; i++) {
		const m = /^###\s+(\d+(?:\.\d+)*[a-z]?)\s+(.*)$/.exec(docLines[i]);
		if (m && !secIdx[m[1]]) secIdx[m[1]] = { title: oneLine(m[2]), line: i + 1 };
	}
	/**
	 * 图引用 → 它所在的**块**（level-3 `### …`，正文到下一个 `###` / level-2 `##` 为止）。
	 *
	 * ★ 归属的两条依据，按硬度排序（都写进 `evidence`，界面上可核）：
	 *   ① 块头点名了 `Figma <node>` ⇒ 那就是**交付物认定的归属**（真实案例：`### 2.2 通用排行榜弹窗（UI-M2，Figma 50:1816）`）；
	 *   ② 否则按**条目行**里第一个 `UI-M*` 归（真实案例：`2.1b 血条区` 的条目写着「血条右侧通关奖励宝箱…」，
	 *      **整块**一个 `UI-M*` 都没点名 ⇒ 推不出，如实报，不猜）。
	 *
	 * ★ 块的范围口径（第一版写错过的坑）：`###` 走到**下一个 `###` 或 level-2 `##`** 为止 ——
	 *   写成"下一个 `##` 开头的行"会把 `###` 也算成 `##`，块被截成一行，`UI-M*` 就永远扫不到。
	 */
	const imgBlock = (file: string) => {
		const key = baseNameOf(file).toLowerCase();
		for (let i = 0; i < docLines.length; i++) {
			const line = docLines[i];
			if (line.indexOf("![") < 0 || line.indexOf("](") < 0) continue;
			if (baseNameOf(oneLine((/\]\(([^)]+)\)/.exec(line) || [])[1] || "")).toLowerCase() !== key) continue;
			let head = "", headLine = 0;
			for (let j = i; j >= 0; j--) {
				if (/^#{2,3}\s+/.test(docLines[j])) { head = oneLine(docLines[j].replace(/^#{2,3}\s+/, "")); headLine = j + 1; break; }
			}
			// 块的范围：块头 → 下一个 `###` 或 level-2 `##`
			let end = docLines.length;
			for (let j = headLine; j < docLines.length; j++) {
				if (/^###\s+/.test(docLines[j]) || /^##\s+[^#]/.test(docLines[j])) { end = j; break; }
			}
			const body = docLines.slice(headLine - 1, end).join("\n");
			const nodeM = /Figma\s+([0-9]+:[0-9]+)/.exec(head) || /Figma\s+([0-9]+:[0-9]+)/.exec(body);
			// ① 块头里的 `UI-M*`
			const headUis = toksOf(head, /UI-M\d+/gi);
			// ② 条目行里的（块头没有时用第一个）—— 列表项那种行（`- …` / `↳ 子节点 …` / `|` 表格行）
			const itemUis: string[] = [];
			for (let j = headLine; j < end; j++) {
				const t = docLines[j];
				if (!/^\s*(?:[-*|>]\s*|↳)/.test(t)) continue;
				for (const u of toksOf(t, /UI-M\d+/gi)) if (itemUis.indexOf(u) < 0) itemUis.push(u);
			}
			return { head: head, headLine: headLine, node: nodeM ? nodeM[1] : "", headUis: headUis, itemUis: itemUis };
		}
		return { head: "", headLine: 0, node: "", headUis: [] as string[], itemUis: [] as string[] };
	};

	// ── 定稿 §5：界面组 → 它名下的图引用（`<img src>`）────────────────────────
	//   ★ 只认 §5.x UI-M* 那些组**自己**的块（组头 → 下一个组头/章头之间的 `<img>`）——
	//     "别处提到这个组"不算（与 `finaltree` 的"定义行"口径一致）。
	const finLines = String(inp.finalText == null ? "" : inp.finalText).split(/\r?\n/);
	const groupImgs: Record<string, { images: string[]; line: number; title: string }> = {};
	{
		let cur = "";
		let holder: { images: string[]; line: number; title: string } | null = null;
		for (let i = 0; i < finLines.length; i++) {
			const m = /^###\s+(\d+\.\d+)\s+(UI-M\d+)\s*(.*)$/i.exec(finLines[i]);
			if (m) {
				if (holder && cur) groupImgs[cur] = holder;
				cur = m[2].toUpperCase();
				holder = { images: [], line: i + 1, title: oneLine(m[3] || m[2]) };
				continue;
			}
			if (/^##\s+/.test(finLines[i]) || /^###\s+/.test(finLines[i])) {
				if (holder && cur) groupImgs[cur] = holder;
				cur = ""; holder = null;
				continue;
			}
			if (!holder) continue;
			const im = /<img\s+[^>]*?src\s*=\s*["']([^"']+)["']/gi;
			let mm: RegExpExecArray | null;
			while ((mm = im.exec(finLines[i])) !== null) holder.images.push(mm[1]);
		}
		if (holder && cur) groupImgs[cur] = holder;
	}

	const rows: MapRow[] = [];
	let nodeDisagree = 0, inFinal = 0;
	for (const s of man.shots) {
		const ev: string[] = [];
		const no = (/^(\d{1,2})[_-]/.exec(oneLine(s.file).replace(/^.*[\\/]/, "")) || [])[1] || "";
		const sec = secIdx[s.section] || null;
		const blk = imgBlock(s.file);
		const leg = legend.filter((x) => baseNameOf(x.file).toLowerCase() === baseNameOf(s.file).toLowerCase())[0] || null;

		// ── 边 1：章节
		if (sec) ev.push("文档章节：`02_交互回写文档.md` L" + sec.line + " `### " + s.section + " " + sec.title + "`（交付物在 manifest 里写的 `rule_section` = `" + s.section + "`）");
		else if (docText === "") ev.push("文档章节：**读不到 `02_交互回写文档.md`** —— 只剩 manifest 里那个节号 `" + s.section + "`（面板不编标题）");
		else ev.push("文档章节：回写文档里**没有** `### " + s.section + "` 这一段（manifest 写了 `rule_section = " + s.section + "`）—— 对不上");

		// ── 边 2：节点（两份对照）
		const agree = leg ? (leg.node === s.node || leg.frame.indexOf(s.node) >= 0 || s.node === "") : false;
		if (leg) ev.push("设计节点：manifest 写 `" + s.node + "`｜图例索引 caption 写 `Frame " + leg.frame + "`（「" + leg.caption + "」）⇒ " + (agree ? "两份一致" : "**两份不一致**"));
		else ev.push("设计节点：manifest 写 `" + s.node + "`｜图例索引里**没有这一张** ⇒ 只有一份依据");
		if (!agree && leg) nodeDisagree++;

		// ── 边 3：定稿 §5
		const docs: MapRow["docs"] = [];
		// 归属：块头点名的 `UI-M*` 最硬；块头没有才退到**条目行**里第一个（`子节点 ↳ 父节点` 那种）
		const want = blk.headUis.length ? blk.headUis : blk.itemUis;
		const how = blk.headUis.length
			? "块头（L" + blk.headLine + "「" + blk.head + "」）**点名**了 `" + blk.headUis.join("` / `") + "`"
			: ("块头没点名 `UI-M*`，但条目行里写着 `" + blk.itemUis.join("` / `") + "`");
		if (want.length) {
			for (const u of want) {
				const g = groupImgs[u] || null;
				const has = !!(g && g.images.some((x) => imgKeyOf(x) === imgKeyOf(s.file)));
				if (g) {
					docs.push({
						ref: "§5 " + u, images: g.images.slice(), has: has,
						why: "归属依据：" + how + "；" +
							(blk.node ? "这一块写着 `Figma " + blk.node + "`（= 这一张的节点号），" : "") +
							"⇒ 这一张是 `§5 " + u + "`（L" + g.line + " " + g.title + "）的图源"
					});
				} else {
					docs.push({
						ref: "§5 " + u, images: [], has: false,
						why: "归属依据：" + how + "；但当前定稿 §5 里**没有 `" + u + "` 这个界面组**（或定稿读不到）⇒ 落地位置对不上"
					});
				}
				if (has) inFinal++;
			}
		} else if (blk.head) {
			ev.push("定稿 §5：这张图在回写文档里落在 L" + blk.headLine + " 的块「" + blk.head + "」，但块头与条目行里**都没点名 `UI-M*`** ⇒ 面板推不出它属于哪个界面组（不猜）");
		}

		// ── status + miss（四档：三边齐全且两份节点一致 = ok；齐全但不一致 = agree；缺 = partial/unmapped）
		const m: string[] = [];
		if (!sec) m.push("回写文档里没有 `### " + s.section + "` 这一段");
		if (!docs.length) m.push("推不出它该落到哪个界面组");
		if (docs.length && !docs.some((d) => d.has)) m.push("§5 里那" + (docs.length > 1 ? "些" : "个") + "界面组的图与该截图**文件名都不同**（文件名一致才算「就是这一张」；面板不判「像不像」）");
		const status: MapRow["status"] = m.length
			? ((!sec && !docs.length) ? "unmapped" : "partial")
			: ((!agree && leg) ? "agree" : "ok");
		const miss = m.length ? m.join("；") : "";

		rows.push({
			no: no, file: s.file, abs: dir === "" ? "" : dir + "\\" + winOf(s.file),
			doc: { section: s.section, title: sec ? sec.title : "", line: sec ? sec.line : 0, matched: !!sec },
			node: {
				manifest: s.node, legend: leg ? leg.node : "", agree: agree, frame: s.frame,
				legendFrame: leg ? leg.frame : "",
				page: (man.figmaFile || "") + (man.pageName ? " " + man.pageName : "") + (man.pageId ? "（" + man.pageId + "）" : "")
			},
			docs: docs, status: status, miss: miss, evidence: ev
		});
	}
	rows.sort((a, b) => (a.no < b.no ? -1 : (a.no > b.no ? 1 : 0)));

	const counts = { total: rows.length, ok: 0, partial: 0, unmapped: 0, nodeDisagree: nodeDisagree, inFinal: inFinal };
	for (const r of rows) counts[r.status === "agree" ? "ok" : r.status] += 1;
	const inFinalRows = rows.filter((r) => r.docs.some((d) => d.has)).length;
	const summary = "④ 三方映射：" + rows.length + " 张截图 ｜ 三边齐全 " + (rows.length - counts.partial - counts.unmapped) +
		" 张（其中 " + inFinalRows + " 张的图**已经在 §5 里就位**）｜ 缺一边 " + counts.partial + " 张 ｜ 只有截图本身 " + counts.unmapped + " 张" +
		(nodeDisagree ? " ｜ ★ " + nodeDisagree + " 张的节点号两份依据**不一致**（图例索引 vs manifest）" : "") +
		" ｜ 源：" + (figma.file || "（manifest 没写 Figma 源）") + (figma.pageId ? " Page " + figma.pageId : "") +
		(figma.ruleNode ? " · 规则节点 " + figma.ruleNode : "");
	notes.push("节点那一列**原样引用** `manifest.json` 的 `screenshots[].node_id`；图例索引 caption 里那一份只用来**复核**（两份不一致就如实标，不取其一当真）。");
	notes.push("「已经在 §5 里就位」= 定稿 §5 那个界面组里的 `<img src>` 与这一张**文件名相同**；不同就是不同（面板不判'像不像'）。");

	return { rows: rows, figma: figma, summary: summary, counts: counts, notes: notes };
}

// ════════════════════════════════════════════════════════════════
// 四、归档位（`source\UE交付_<日期>\`）—— 指令由面板给，**落盘由 agent 做**
// ════════════════════════════════════════════════════════════════

/** 归档目录名（设计的归档位口径：`features\<主题>\source\UE交付_<日期>\`） */
export function archiveDirNameOf(date: unknown): string {
	const d = compactOf(date);
	return "UE交付_" + (d || "<日期>");
}

export interface ArchivePlan {
	/** `source\UE交付_<日期>` 的绝对路径 */
	dir: string;
	/** 目录名 */
	name: string;
	/** 包本体该落的绝对路径（`…\source\UE交付_<日期>\<包名>.zip`） */
	zipDest: string;
	/** 已经在归档位了（面板读到了那个 zip 或包内文件） */
	archived: boolean;
	/** 判断依据（人话） */
	why: string;
}

/**
 * 归档位的**判定**（面板只读、只判定；落盘由 agent 按指令做）。
 * `present` = 归档位里已经读到的文件名（空数组 = 归档位不存在或还是空的）。
 */
export function archivePlan(input: {
	root?: unknown;
	zipFile?: unknown;
	date?: unknown;
	present?: unknown[];
	/** 工作区根上 zip 的绝对路径（由调用方给；拿不到就是空串） */
	zipAtWs?: unknown;
}): ArchivePlan {
	const inp = input || {};
	const root = winOf(inp.root);
	const dir = root === "" ? "" : root + "\\source\\" + archiveDirNameOf(inp.date);
	const file = oneLine(inp.zipFile);
	const zipDest = dir === "" || file === "" ? "" : dir + "\\" + file;
	const present = (Array.isArray(inp.present) ? inp.present : []).map((x) => oneLine(x)).filter((x) => x !== "");
	const here = present.some((n) => n.toLowerCase() === file.toLowerCase()) ||
		present.some((n) => /manifest\.json$/i.test(n)) ||
		present.some((n) => /交互回写文档/i.test(n));
	return {
		dir: dir, name: archiveDirNameOf(inp.date), zipDest: zipDest, archived: here,
		why: here
			? "归档位里读到了这个包的 `manifest.json` / 回写文档" + (present.some((n) => n.toLowerCase() === file.toLowerCase()) ? " / 包本体" : "") + " ⇒ 已经归位了"
			: (root === ""
				? "拿不到这个功能的功能目录 ⇒ 归档位拼不出来"
				: "归档位 `" + dir + "` 里还没读到这个包的 `manifest.json` / 回写文档 ⇒ 包还不在归档位" +
					(oneLine(inp.zipAtWs) ? "（工作区根上那份还在：" + winOf(inp.zipAtWs) + "）" : ""))
	};
}

/**
 * 组装**归档指令**（三段式：改哪儿 / 现状原文 / 要做什么）。
 *
 * ★ 三条纪律（与 `derived.ts` / `createfeature.ts` 的指令同一条产品契约）：
 *   ① 面板**不写盘**（Remote 只有读 + 指令侧五法）⇒ 解压与归位由 agent 做，面板随后**读回并判定**；
 *   ② **不带外层包名那一层** —— 面板只列到"桶 / 子目录"两层，多套一层就读不到包内文件（实测过）；
 *   ③ 双重留痕：包本体 `<包名>.zip` **与**解出来的内容都留在同一个归档位（用户点出来的东西不许丢）。
 *
 * ★ 缺前提不静默：`blocked` + `next` 一起给，界面照原样显示，**不发指令**。
 */
export function buildArchiveInstruction(input: {
	plan?: ArchivePlan;
	zipAtWs?: unknown;
	/** 包内条目数（用于"要解出什么"那一句；未知给 0） */
	entries?: unknown;
}): { instruction: string; blocked: string; next: string } {
	const inp = input || {};
	const plan = inp.plan || archivePlan({});
	const src = winOf(inp.zipAtWs);
	if (src === "") {
		return {
			instruction: "",
			blocked: "面板拿不到这个包在工作区根上的绝对路径。",
			next: "确认包就在索引会话的工作区根下（面板是按文件名在工作区根那一层认它的）；找不到就手动把路径贴在会话里。"
		};
	}
	if (plan.dir === "") {
		return {
			instruction: "",
			blocked: "拿不到这个功能的功能目录（`features\\<主题>\\`），归档位拼不出来。",
			next: "从「功能详情 › 产物」进来再发一次 —— 指令要发给该功能的专属工作会话（cwd = 功能目录），归档位由功能根派生。"
		};
	}
	const n = Number(inp.entries) || 0;
	const L: string[] = [];
	L.push("【外部输入 · UE 交互交付包归档】把工作区根上的这一个交付包解压归位到该功能的**原料桶**里（设计 §4.3.5 的归档位），**不要改包内任何文件的内容**。");
	L.push("· 包（现状原文，工作区根上）：" + src);
	L.push("· 归档位（要建的目录）：" + plan.dir);
	L.push("· 包本体也要留一份：" + plan.zipDest + "（复制/移动都行 —— 归档位里要能同时看到包**与**它的内容）");
	L.push("· 要解出来的内容" + (n ? "（包内 " + n + " 个条目）" : "") + "：");
	L.push("  `01_宣讲会交付.html` · `02_交互回写文档.md` · `03_图例索引.html` · `manifest.json` · `截图\\` · `流程图\\`");
	L.push("· ★ **不要带外层包名那一层**：解出来的文件要直接躺在 " + plan.dir + " 下（即 " + plan.dir + "\\manifest.json），");
	L.push("  不要把包名目录再套一层 —— 面板只列到「桶 / 子目录」两层，多套一层就读不到包内文件，①②③ 全做不了。");
	L.push("· ★ 包里的 HTML 内嵌了截图（单文件 7~8 MB 是正常的）；`截图\\` 里那 13 张 PNG 要**照原样**解出来，它们是 ⑤ 线框图替换的图源。");
	L.push("· 不改内容：不解压之后重写、不改文件名、不改 manifest、不动任何 skill、不动定稿。");
	L.push("· 完成后回报：归档位绝对路径 + 解出来的文件清单（逐个列）+ 包内条目数 + 你实际用的解压命令。");
	return { instruction: L.join("\n"), blocked: "", next: "" };
}

// ════════════════════════════════════════════════════════════════
// 五、⑤ 线框图替换 —— 与手动入口**共用同一处组装**
// ════════════════════════════════════════════════════════════════
//
// ★ 工单 26 第 5 条「线框图替换的**手动入口**与交付包入口**共用同一能力**，不许各写一份」：
//   两个入口**都**只做一件事 —— 把各自的输入塞进这一个 `buildDraftInstruction({action:"wireframe"})`
//   （`draftstep.ts` 里那一份，也是「文档生成」工作面手动线框图用的那一份）。
//   本函数是那个"塞"的唯一实现：它不生成正文，正文永远由 `draftstep.buildDraftInstruction` 拼。

export interface WireframeRequestInput {
	/** 功能根（绝对路径） */
	root?: unknown;
	topic?: unknown;
	/** 成稿的绝对路径（拿不到给空串 —— 组装器会给"按日期取最新"的占位） */
	draftPath?: unknown;
	/** 改哪儿（条目引用 / 章组号；拿不到给空串，组装器会按 ASCII 现状自己写） */
	where?: unknown;
	/** 界面图路径（**手动入口 = 用户粘的/挑的；交付包入口 = 包里的 `截图\`**） */
	images?: unknown[];
	/** §5 里的 ASCII 占位（`drafttree.asciiOf` 的形状，原样进出） */
	ascii?: unknown[];
}

/**
 * 线框图替换的**唯一入口组装**（两个入口共用）→ 交给 `draftstep.buildDraftInstruction`。
 * @returns `{ instruction, blocked, next }` —— 与手动线框图逐字同源。
 */
export function buildWireframeRequest(input: WireframeRequestInput): { instruction: string; blocked: string; next: string } {
	const inp = input || {};
	return buildDraftInstruction({
		action: "wireframe",
		root: inp.root,
		topic: inp.topic,
		draftPath: inp.draftPath,
		where: inp.where || "",
		images: (Array.isArray(inp.images) ? inp.images : []).filter((x) => oneLine(x) !== ""),
		ascii: (Array.isArray(inp.ascii) ? inp.ascii : []) as any
	});
}

/** 成稿全文 → §5 的 ASCII 占位（交付包入口不重新实现一遍解析） */
export function asciiOfDraft(text: unknown): Array<{ no: string; id: string; title: string; line: number; lines: number }> {
	if (text === null || text === undefined || String(text) === "") return [];
	// 与 `drafttree.draftDocOf` 内部那条完全同源：`parseFinalGdd` → `asciiOf`（不另写判据）
	return (asciiOf(parseFinalGdd(String(text))) || []) as any;
}

// ════════════════════════════════════════════════════════════════
// 六、回写清单 ↔ 基线危险：合成那一句"这会把它改回来"
// ════════════════════════════════════════════════════════════════

/**
 * ★ 工单 26 第 4 条那条死规矩的**唯一成形地**：把"基线已过期"与"清单里有已删条目"两件事
 * 合成一句**必须显示**的话。空串 = 这两件事都没发生。
 *
 * @param rows  `writebackRows` 的结论
 * @param base  `baselineState` 的结论
 */
export function revertWarning(rows: WritebackRow[], base: BaselineRow | null): string {
	const danger = (Array.isArray(rows) ? rows : []).filter((r) => r && r.status === "danger" && r.goneKeys.length);
	if (!danger.length) return "";
	const keys = danger.map((r) => r.goneKeys[0]);
	const head = "★ 回写清单里有 " + danger.length + " 条要**删/撤**的文本条目，而**当前有效定稿里已经没有它们了**：" +
		keys.map((k) => "`" + k + "`").join(" / ") + " —— 照单执行就是**这会把它改回来**（把已经删掉的条目重新加回去）。";
	const tail = (base && base.block) ? "　" + base.block : "";
	return head + tail;
}

// ════════════════════════════════════════════════════════════════
// 七、整块视图模型
// ════════════════════════════════════════════════════════════════

export interface UeIntakeRows {
	/** ① 包识别 */
	identify: IdentifyResult;
	/** ② 基线校验 */
	baseline: BaselineRow | null;
	/** ③ 回写清单 */
	rows: WritebackRow[];
	/** 归档位 */
	archive: ArchivePlan;
	/** 归档指令（预览 = 发出去的） */
	archiveInstruction: string;
	/** 缺前提时的理由（非空 ⇒ 界面不发这条指令） */
	archiveBlocked: string;
	archiveNext: string;
	/** ★ 那条死规矩的合成句（空串 = 没有已删条目） */
	revertWarning: string;
	/** 回写清单的统计（面上一行小字） */
	counts: { total: number; ok: number; danger: number; missing: number; note: number };
	/** 如实标注（都是真数据里存在的情形） */
	notes: string[];
	/** ★ 线框图替换（⑤）的请求组装 —— **与手动入口共用 `draftstep.buildDraftInstruction`** */
	wireframe: {
		instruction: string;
		blocked: string;
		next: string;
		/** §5 里的 ASCII 占位（现状原文；面板拿它核对"要换掉的是哪几处"） */
		ascii: Array<{ no: string; id: string; title: string; line: number; lines: number }>;
		/** 这一轮要用的图（绝对路径；来自包里的 `截图\`） */
		images: string[];
		/** 组装进去的成稿路径（面板不重读盘） */
		draftPath: string;
		/** 改哪儿（空 = 由组装器按 ASCII 现状写） */
		where: string;
	};
}

/**
 * ①②③ 的整块视图模型（**纯函数**：调用方把"读到的原文"与"当前状态"都传进来）。
 * 所有降级都如实写进 `notes` —— 界面上看得见"面板看不到什么"。
 */
export function ueIntakeRows(input: {
	zipFile?: unknown;
	zipAtWs?: unknown;
	entries?: unknown[];
	manifest?: unknown;
	/** `02_交互回写文档.md` 全文（`null` = 读不到） */
	doc?: unknown;
	docName?: unknown;
	/** 当前有效定稿全文（`null` = 这个功能没有有效定稿 / 读不到） */
	finalText?: unknown;
	final?: CurrentFinalRef | null;
	features?: FeatureRef[];
	root?: unknown;
	published?: unknown;
	publishedAt?: unknown;
	publishedNote?: unknown;
	present?: unknown[];
	/** 成稿全文（⑤ 的 ASCII 现状；拿不到给空串 —— 组装器会如实说"没认出 ASCII 占位"） */
	draftText?: unknown;
	draftPath?: unknown;
	/** ⑤ 的改哪儿（条目引用 / 章组号；默认空 —— 由组装器按 ASCII 现状写） */
	where?: unknown;
	/** 面板给的今天（`YYYYMMDD`，纯函数不吃时钟） */
	compact?: unknown;
}): UeIntakeRows {
	const inp = input || {};
	const identify = identifyResult(inp);
	const index = finalIndexOf(inp.finalText === null || inp.finalText === undefined ? "" : inp.finalText);
	const declared = declaredBaselineOf(inp.doc, inp.docName);
	const baseline = baselineState({
		declared: declared,
		final: inp.final || null,
		published: inp.published,
		publishedAt: inp.publishedAt,
		publishedNote: inp.publishedNote,
		deliveredAt: identify.date
	});
	const rows = writebackRows(inp.doc, index, { docName: inp.docName });
	const archive = archivePlan({
		root: inp.root, zipFile: inp.zipFile, date: identify.date, present: inp.present, zipAtWs: inp.zipAtWs
	});
	const built = buildArchiveInstruction({ plan: archive, zipAtWs: inp.zipAtWs, entries: (inp.entries || []).length });

	const counts = { total: rows.length, ok: 0, danger: 0, missing: 0, note: 0 };
	for (const r of rows) counts[r.status] += 1;

	const man = parseManifest(inp.manifest);
	const scanRoot = dirOfAbs(inp.zipAtWs);
	const wireImages = (man && man.shotPaths) || [];
	const wirePaths = wireImages.map((rel) => archive.dir === ""
		? rel
		: winOf(archive.dir) + "\\" + winOf(rel));
	const wireAscii = asciiOfDraft(inp.draftText);
	const wireWhere = oneLine(inp.where);
	const wireframeBuilt = buildWireframeRequest({
		root: inp.root,
		topic: identify.topic,
		draftPath: inp.draftPath,
		where: wireWhere,
		images: wirePaths,
		ascii: wireAscii
	});
	const wireframe = Object.assign({}, wireframeBuilt, {
		ascii: wireAscii, images: wirePaths, draftPath: winOf(inp.draftPath), where: wireWhere
	});

	// ── 如实标注 ───────────────────────────────────────────────
	const notes: string[] = [];
	if (String(inp.doc === null || inp.doc === undefined ? "" : inp.doc) === "") {
		if (!archive.archived) {
			notes.push("**包还没归位到 `source\\" + archive.name + "\\`** —— 面板读不到包里的 `02_交互回写文档.md` 与 `manifest.json`" +
				"（zip 是压缩流，面板读不了它内部；设计的归档位就是给这件事准备的）。先发归档指令，面板再读回包内文件。");
		}
		notes.push("**读不到 `02_交互回写文档.md`** —— ② 与 ③ 都做不了（基线声明与回写清单都在它里面）。" +
			(archive.archived ? "归档位里有目录但读不到这份文件 —— 核一下包内结构与文件名。" : "先让 agent 按归档指令解压归位。"));
	}
	if (!identify.isDelivery) {
		notes.push("这个 zip **没被认成 UE 交互交付包**（判据见上面的依据逐条）—— 面板不猜它是哪一类。");
	}
	if (identify.feature.topic === "") {
		notes.push("**没定下来对着哪个功能**：" + (identify.feature.need || "依据不足"));
	}
	if (identify.dupMark) {
		notes.push("这个文件名带 `(" + identify.dupMark + ")` —— 是浏览器**重复下载**留下的后缀（同一个包的副本）。归档时按规范名 `" + identify.canonical + "` 留一份就够，别把两份都当包。");
	}
	if (identify.date !== "" && compactOf(inp.compact) !== "" && identify.date > compactOf(inp.compact)) {
		notes.push("包的交付日期比「今天的日期」还晚 —— 文件名里的日期可能不是交付日期，核一下。");
	}
	if (baseline.state === "unknown") {
		notes.push("**基线判不了**（" + baseline.why + "）—— 面板不默认它是最新的。");
	}
	if (baseline.state === "stale" && baseline.block) {
		notes.push(baseline.block);
	}
	const rw = revertWarning(rows, baseline);
	if (rw) notes.push(rw);
	if (!archive.archived) notes.push(archive.why + " ⇒ 先发归档指令，面板再读回包内文件（①②③ 都还看不到依据）。");
	if (scanRoot !== "") notes.push("包是在工作区根那一层按文件名认出来的（" + scanRoot + "）—— 面板只列一层，包在别处就列不到。");
	notes.push("这一屏只做 ①②③（包识别 / 基线校验 / 回写清单）。**④ 三方映射与 ⑤ 线框图替换是工单 27** —— 上面那颗〔按交付包换线框图〕只是把两个入口接到**同一处组装**（`draftstep.buildDraftInstruction`），不是 ⑤ 的完整落地。");

	return {
		identify: identify, baseline: baseline, rows: rows, archive: archive,
		archiveInstruction: built.instruction, archiveBlocked: built.blocked, archiveNext: built.next,
		revertWarning: rw, counts: counts, notes: notes, wireframe: wireframe
	};
}

/** 一个绝对路径的**上一级目录**（"包是在哪一层认出来的"要用它；拿不到给空串） */
function dirOfAbs(zipAtWs: unknown): string {
	const s = winOf(zipAtWs);
	if (s === "") return "";
	const parts = s.split("\\");
	return parts.length >= 2 ? parts.slice(0, -1).join("\\") : s;
}

/** `identify` 的薄封装（保持 `ueIntakeRows` 里可读） */
function identifyResult(inp: any): IdentifyResult {
	return identify({
		zipFile: inp.zipFile, entries: inp.entries, manifest: inp.manifest, features: inp.features
	});
}

export { buildDraftInstruction };
