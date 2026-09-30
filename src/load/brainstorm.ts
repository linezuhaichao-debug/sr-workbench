/**
 * 头脑风暴工作面加载器（工单 23）—— 「已有的分析结论」+ 两种新格式的解析结果。
 *
 * 口径：
 *   · **只吃 port**，只读；不写任何东西（"面板只读、agent 执行"）。
 *   · 产物清单**不在这里重新列目录** —— 它由 `loadFeatureDetail`（工单 12）给，本加载器只拿
 *     `analysis` 组的文件清单做事：这样"面板列出的产物"与"工作面认出的结论"**同一份来源**，
 *     不会出现两处列举结果不一致。
 *   · 两种新格式（`legacy-analysis_*` / `human-note_*`）读**全文**再解析（原文段可能在文件末尾）；
 *     交接件 JSON 只读**开头**（只要 `source_skill` 一个字段，不把 5KB JSON 整个拉进来）。
 *   · 读不动的文件**如实报出来**（`unreadable`），不静默当成"没有"。
 *
 * 纯函数部分在 `../pure/analysisdoc.ts`（归类 / 解析 / 文件名规则），这里只做 IO 与编排。
 */

import {
	analysisDocKind,
	groupAnalyses,
	parseHumanNote,
	parseLegacyAnalysis,
	sourceSkillOf
} from "../pure/analysisdoc.ts";
import type { WorkspacePort } from "../port/types.ts";
import { readAllText, readHead } from "./read.ts";

export interface AnalysisFile {
	/** 文件名（带扩展名） */
	name: string;
	/** 相对功能根的路径（正斜杠） */
	rel?: string;
	/** gdd 之外的桶里一般是空串 */
	subdir?: string;
}

export interface BrainstormOptions {
	/** 功能根目录（绝对路径，`<sr 根>/features/<主题>`） */
	root: string;
	/** `analysis\` 里的文件（来自 `loadFeatureDetail` 的产物清单） */
	files: AnalysisFile[];
	/** 三阶段里的头脑风暴结论（`stageProgress` 的产物：`{ note }`）—— 出口判据的那句话 */
	stage?: { note?: string } | null;
	signal?: AbortSignal;
	/** 每人最多读几份新格式产物（防一个功能里堆了几十份时把面板拖慢） */
	maxDocs?: number;
}

/** 一个文件 → 绝对路径（`analysis` 组的子目录也认） */
function absOf(root: string, f: AnalysisFile): string {
	const rel = String((f && f.rel) || "").replace(/\\/g, "/");
	if (rel !== "") return root.replace(/\\+$/, "") + "/" + rel;
	const sub = String((f && f.subdir) || "");
	return root.replace(/\\+$/, "") + "/" + (sub ? sub + "/" : "") + String(f.name || "");
}

/**
 * 读一个功能的 `analysis\` → 工作面视图模型。
 *
 * @returns `{ root, groups, legacy, humannote, unreadable, notes }`
 *   · `groups` —— 按四入口分组（`groupAnalyses` 的结论：恒四组，空组也出现）
 *   · `legacy` / `humannote` —— 两种新格式的解析结果（含 `name` / `rel`，面板点开就渲染它）
 *   · `unreadable` —— 读不动的文件（如实列出，不当成"没有"）
 *   · `notes` —— 出口判据等提示（来自 `stage.note`，**不在这一层重算**）
 */
export async function loadBrainstorm(port: WorkspacePort, options: BrainstormOptions): Promise<any> {
	const root = String(options.root || "").replace(/\\+$/, "");
	const files: AnalysisFile[] = Array.isArray(options.files) ? options.files.filter((f) => f && f.name) : [];
	const maxDocs = Math.max(1, Math.trunc(Number(options.maxDocs) || 12));
	const signal = options.signal;
	const notes: string[] = [];
	const unreadable: Array<{ name: string; why: string }> = [];

	/** 交接件的 `source_skill`（只这几份：文件名前缀能认出来） */
	const skills: Record<string, string> = {};
	for (const f of files.filter((x) => /^sr-gdd-handoff_/i.test(x.name))) {
		const head = await readHead(port, absOf(root, f), signal);
		if (head === null) unreadable.push({ name: f.name, why: "读不到开头（拿不到交接件的 source_skill）" });
		else skills[f.name] = sourceSkillOf(head);
	}

	const legacy: any[] = [];
	const humannote: any[] = [];
	const docs = files.filter((f) => analysisDocKind(f.name) !== "");
	for (const f of docs.slice(0, maxDocs)) {
		const k = analysisDocKind(f.name);
		const text = await readAllText(port, absOf(root, f), signal, 4000);
		if (text === null) {
			unreadable.push({ name: f.name, why: "读不到正文" });
			continue;
		}
		const parsed = k === "legacy" ? parseLegacyAnalysis(text, f.name) : parseHumanNote(text, f.name);
		parsed.rel = String(f.rel || f.name);
		parsed.abs = absOf(root, f);
		if (k === "legacy") legacy.push(parsed);
		else humannote.push(parsed);
	}
	if (docs.length > maxDocs) notes.push("新格式产物共 " + docs.length + " 份，只解析了最新的 " + maxDocs + " 份（点文件名可打开看全文）。");

	const groups = groupAnalyses(files.map((f) => ({ name: f.name, rel: f.rel || f.name, subdir: f.subdir || "", skill: skills[f.name] || "" })));

	return {
		root: root,
		groups: groups,
		legacy: legacy,
		humannote: humannote,
		unreadable: unreadable,
		// ★ 出口判据（设计 §4.3）由 `stageProgress` 算，**这里只搬运**，不重算一遍
		notes: ((options.stage && options.stage.note) ? [options.stage.note] : []).concat(notes)
	};
}
