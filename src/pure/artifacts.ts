/**
 * 功能详情 · 产物清单（工单 12）
 *
 * 口径（工单 12 逐条）：
 *   ① **只认子目录、不猜文件名**：桶由"文件在哪个子目录下"决定（`DIR_BUCKET`），
 *      唯一允许按文件名细分的地方是 `gdd\`（一个混装目录：成稿 / 定稿 / 审查 / 修订点 / 定稿 HTML）。
 *   ② `gdd\` 的细分与 `artifactBucket` **同源**（`buckets.gddKindOf`），不另写一套判据。
 *   ③ `mdSpecOf`（`./mdspec.ts`，工单 32 已接的模块）用来给**分析类 md** 标注产出规范名
 *      （体验报告 / 复刻规格 / 设计核三角报告 …）。★ 它**只作标注，不作过滤**：
 *      认不出来也照样列出（否则又变成"猜文件名"）。
 *      实测：它的六种规范里没有一种匹配 `gdd\` 的文件（`mdSpecOf("联盟悬赏_20260923_定稿.md") === null`），
 *      所以 gdd 的细分用 `gddKindOf`——两件事不要混。
 *   ④ 三个含义（`MEANINGS`）来自 `CONTEXT.md` 的产物桶定义：进 = 原料；出 = 产物；过程留痕。
 *   ⑤ **一个文件都不许静默丢**：不是桶的目录、功能根下的散文件，都如实出现在 `未归桶` 组里。
 *      这条是"详情页列出的产物与磁盘实际一致"（工单 12 的验收句）的前提。
 *   ⑥ 三阶段进度用设计 §4.2 的口径（有无分析产物 / 有无成稿 / 有无定稿），阶段名取自
 *      `./ledger.ts` 的 `LEDGER_STAGES`（台账的同一组阶段名，不另起名字）。
 *
 * 纯函数、零 IO：目录列举由调用方（`src/load/feature.ts`）读进来。
 */

import { DIR_BUCKET, GDD_KIND_LABEL, gddKindOf } from "./buckets.ts";
import { LEDGER_STAGES } from "./ledger.ts";
import { mdSpecOf } from "./mdspec.ts";
import { dateOf } from "./topic.ts";

/** 桶的三个含义 + 「未归桶」兜底（顺序即面板上的显示顺序） */
const MEANINGS = [
	{ key: "in", label: "进 · 原料" },
	{ key: "out", label: "出 · 产物" },
	{ key: "trace", label: "过程留痕" },
	{ key: "other", label: "未归桶（如实列出，不丢）" }
];

/** 六个标准桶 → 面板分组（`dir` 必须与 `DIR_BUCKET` 的键一致） */
const BUCKET_GROUPS = [
	{ dir: "source", label: "原料", meaning: "in", note: "喂进去的源文件（截图 / 录屏 / 旧文档原件 / UE 交付物）" },
	{ dir: "analysis", label: "分析产出", meaning: "out", note: "头脑风暴产物（体验报告 / 问题卡 / 复刻规格 / 概念 / 交接 JSON …）" },
	{ dir: "gdd", label: "文档（gdd）", meaning: "out", note: "成稿 / 定稿 / 审查 / 修订点 —— 这一层按文件名再细分" },
	{ dir: "delivery", label: "交付", meaning: "out", note: "对外产出（宣讲 HTML / AI 读版 …）" },
	{ dir: "decisions", label: "决策记录", meaning: "trace", note: "Human Gate 的结构化留痕（审计面）" },
	{ dir: "evidence", label: "证据", meaning: "trace", note: "分析产出的证据（抽帧 / 索引 / 时间戳账本 / 校准流水）" }
];

/** gdd 组内的显示顺序（定稿最前——它是"现在能用吗"的答案） */
const GDD_ORDER = ["final", "finalHtml", "review", "fixpoints", "draft", "ui", "nested", "others"];

/** 一个条目：相对功能根的子目录（正斜杠）；`""` = 功能根 */
interface BucketListing {
	/** 该目录下的**直接**文件名（listDir 的结果，不做任何过滤） */
	files?: string[];
	/** 该目录下的子目录名 → 里面的文件名（再下一层；`gdd/UI`、`evidence/<包名>`） */
	nested?: Record<string, string[]>;
}

interface FeatureListing {
	/** 功能根下的直接文件名（不在任何桶里 —— 如 `设计台账.md`） */
	rootFiles?: string[];
	/** 子目录名 → 该目录的内容（键 = `listDirs(功能根)` 的结果，一个都不许漏） */
	dirs?: Record<string, BucketListing>;
	/** 列举深度只有两层；更深的子目录如实报出来（不许静默丢） */
	deepDirs?: string[];
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** 一个条目 → 视图模型（含 gdd 细分 kind 与规范名标注） */
function fileOf(dir: string, name: string, sub: string) {
	const inGdd = dir === "gdd";
	let kind = "file";
	if (inGdd) {
		kind = sub ? (/^ui$/i.test(sub) ? "ui" : "nested") : gddKindOf(name);
	} else if (sub) {
		kind = "nested";
	}
	const spec = mdSpecOf(name);
	const labelOf = () => {
		if (inGdd) return (sub ? (kind === "ui" ? "界面图" : "子目录") : (GDD_KIND_LABEL[kind] || "其它"));
		if (sub) return "子目录";
		return "";
	};
	const rel = dir ? (sub ? dir + "/" + sub + "/" + name : dir + "/" + name) : name;   // 功能根散文件没有前缀
	return {
		name: name,
		rel: rel,
		dir: dir,
		subdir: sub || "",
		kind: kind,
		kindLabel: labelOf(),
		spec: spec ? String(spec.name || "") : "",   // md 规范名（认不出来就是空串，照样列出）
		note: ""
	};
}

/** 组内排序：gdd 按细分顺序（定稿在前），定稿之间按**文件名日期倒序**（最新在前），其余按文件名 */
function sortFiles(key: string, files: any[]) {
	if (key === "gdd") {
		files.sort((a, b) => {
			const d = GDD_ORDER.indexOf(a.kind) - GDD_ORDER.indexOf(b.kind);
			if (d !== 0) return d;
			if (a.kind === "final" && b.kind === "final") {
				const da = dateOf(a.name), db = dateOf(b.name);
				if (da !== db) return da < db ? 1 : -1;      // 新的在前（与看板的"最终版"口径一致）
			}
			return cmp(a.name, b.name);
		});
	} else {
		files.sort((a, b) => cmp(a.rel, b.rel));
	}
	return files;
}

/**
 * 产物清单 → 按桶分组（详情页「产物」页签的数据源）。
 *
 * @returns `groups`（含空桶，空桶也要显示"0"，否则人以为漏了）、`allPaths`（对账用：
 *   "面板会列出的清单" 就是它，可拿去与磁盘递归列举逐条 diff）、`counts`。
 */
function featureArtifacts(input: FeatureListing) {
	const inp = input || {};
	const dirs = inp.dirs || {};
	const groups: any[] = [];

	const pushGroup = (g: any) => {
		const files = g.files || [];
		groups.push({
			key: g.key, dir: g.dir, label: g.label,
			meaning: g.meaning, meaningLabel: (MEANINGS.find((m) => m.key === g.meaning) || {}).label || "",
			note: g.note || "", knowledge: !!g.knowledge,
			count: files.length, files: files
		});
	};

	for (const g of BUCKET_GROUPS) {
		const d = dirs[g.dir] || {};
		const files: any[] = [];
		for (const n of (d.files || [])) files.push(fileOf(g.dir, n, ""));
		for (const sub of Object.keys(d.nested || {}).sort()) {
			for (const n of (d.nested || {})[sub]) files.push(fileOf(g.dir, n, sub));
		}
		pushGroup({ key: g.dir, dir: g.dir, label: g.label, meaning: g.meaning, note: g.note, knowledge: true, files: sortFiles(g.dir, files) });
	}

	// 不是桶的目录 —— 如实成组（"说不清装什么的先不要"是建目录的判据，不是显示时丢数据的理由）
	for (const dir of Object.keys(dirs).filter((x) => !DIR_BUCKET[x]).sort()) {
		const d = dirs[dir] || {};
		const files: any[] = [];
		for (const n of (d.files || [])) files.push(fileOf(dir, n, ""));
		for (const sub of Object.keys(d.nested || {}).sort()) {
			for (const n of (d.nested || {})[sub]) files.push(fileOf(dir, n, sub));
		}
		pushGroup({ key: dir, dir: dir, label: dir, meaning: "other", note: "这个目录不是标准产物桶", files: sortFiles(dir, files) });
	}

	// 功能根下的散文件
	const rootFiles = (inp.rootFiles || []).slice().sort();
	if (rootFiles.length) {
		pushGroup({
			key: "root", dir: "", label: "功能根（散文件）", meaning: "other",
			note: "不在任何桶里 —— 如功能身份文件 / 设计台账",
			files: rootFiles.map((n) => fileOf("", n, ""))
		});
	}

	const allPaths: string[] = [];
	const counts: Record<string, number> = { in: 0, out: 0, trace: 0, other: 0 };
	for (const g of groups) {
		counts[g.meaning] = (counts[g.meaning] || 0) + g.count;
		for (const f of g.files) allPaths.push(f.rel);
	}
	const total = allPaths.length;

	return {
		groups: groups,
		meanings: MEANINGS,
		counts: counts,
		total: total,
		allPaths: allPaths,
		/** 如实声明列举深度：更深层的子目录没有展开（有就报出来，不假装列全了） */
		notes: ((inp.deepDirs || []) as string[]).map((d) => "未展开更深一层：" + d),
		/** 只列**已有内容**的组（面板默认渲染这些；空桶在摘要行里用 0 表示） */
		nonEmpty: groups.filter((g) => g.count > 0).map((g) => g.key)
	};
}

/** 从产物清单取"某桶有几个文件"（0 也如实返回） */
function countOf(artifacts: any, dir: string): number {
	const g = ((artifacts && artifacts.groups) || []).find((x: any) => x.key === dir);
	return g ? g.count : 0;
}

/** 某桶里细分 kind 的个数（如 gdd 里几份定稿） */
function countKind(artifacts: any, dir: string, kind: string): number {
	const g = ((artifacts && artifacts.groups) || []).find((x: any) => x.key === dir);
	if (!g) return 0;
	return g.files.filter((f: any) => f.kind === kind).length;
}

/**
 * 三阶段进度（设计 §4.2「走到哪了」：有无分析产物 / 有无成稿 / 有无定稿）。
 * 阶段名与设计台账同一组（`LEDGER_STAGES`），免得两个页面对"阶段一"的理解不一样。
 */
function stageProgress(artifacts: any) {
	const analysis = countOf(artifacts, "analysis");
	const source = countOf(artifacts, "source");
	const draft = countKind(artifacts, "gdd", "draft");
	const finals = countKind(artifacts, "gdd", "final");
	const reviews = countKind(artifacts, "gdd", "review");
	const fixpoints = countKind(artifacts, "gdd", "fixpoints");
	const stageList = [
		{ key: "brainstorm", label: LEDGER_STAGES[0], done: analysis > 0, evidence: "分析产物 " + analysis + " 件" },
		{ key: "draft", label: LEDGER_STAGES[1], done: draft + finals > 0, evidence: "成稿 " + draft + " · 定稿 " + finals },
		{ key: "review", label: LEDGER_STAGES[2], done: finals > 0, evidence: "定稿 " + finals + " · 审查 " + reviews + (fixpoints ? " · 修订点 " + fixpoints : "") }
	];
	const done = stageList.filter((s) => s.done).length;
	// 出口判据（设计 §4.3）：analysis 空但 source 有料 ⇒ 提示先跑一次分析。这是**提示**，不是错误。
	const note = (analysis === 0 && source > 0)
		? "source 里有 " + source + " 个源文件，但 analysis 还是空的 —— 建议先跑一次分析（原始素材不能直接当结论用）"
		: "";
	return { stages: stageList, done: done, total: stageList.length, note: note };
}

/**
 * 把"当前有效定稿"标到 gdd 组里的定稿条目上 —— 面板不用自己判（判据只在 `checkFinals` 里）。
 * 三个标注：当前有效 / 也标 active（未归档）/ 历史版本。
 */
function annotateFinals(artifacts: any, finalCheck: any) {
	const cur = finalCheck && finalCheck.current;
	const actives = new Set(((finalCheck && finalCheck.actives) || []) as string[]);
	for (const g of ((artifacts && artifacts.groups) || [])) {
		if (g.key !== "gdd") continue;
		for (const f of g.files) {
			if (f.kind !== "final") continue;
			if (cur && f.name === cur) {
				f.note = finalCheck.currentFrom === "active" ? "当前有效（active）" : "当前有效（按日期取最新；没有 active）";
			} else if (actives.has(f.name)) {
				f.note = "也标 active —— 未归档，取代关系只是派生的";
			} else {
				f.note = "历史版本";
			}
		}
	}
	return artifacts;
}

export {
	MEANINGS, BUCKET_GROUPS, GDD_ORDER,
	featureArtifacts, annotateFinals, countOf, countKind, stageProgress
};
