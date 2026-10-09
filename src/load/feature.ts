/**
 * 功能详情加载器（v5）—— 一个功能的**三块**数据，一次读齐。
 *
 * 面板点进一张功能卡片只看三块（用户口径）：
 *   ① 头脑风暴 —— `analysis\`（已有结论）+ 四入口（四入口的**指令组装**在 `pure/intake.ts`）
 *   ② 决策记录 —— `decisions\决策记录.md`（解析在 `pure/decisions.ts`）
 *   ③ 最终产物 —— 头脑风暴的产物 / 成稿 / 定稿 / HTML 宣讲稿（分组在 `pure/artifacts.ts`）
 *
 * 这一层**只吃 port、只读**；目录列举深度=2（桶 → 再下一层，如 `gdd\UI\`）。
 * 磁盘上有什么就列什么：**一个文件都不许静默丢**（不属四类的进「其它」组）。
 */

import { annotateFinals, featureArtifacts } from "../pure/artifacts.ts";
import { BUCKETS, BUCKET_LABEL, BUCKET_MEANING, configArtifactOf } from "../pure/buckets.ts";
import { DECISION_REL, parseDecisionLog, type DecisionLog } from "../pure/decisions.ts";
import type { WorkspacePort } from "../port/types.ts";
import { loadBrainstorm } from "./brainstorm.ts";
import { listDirs, listFiles, readAllText } from "./read.ts";

/** 一个目录的扫描结果。 */
export interface DirScan {
	/** 直接文件名。 */
	files: string[];
	/** 子目录名。 */
	subdirs: string[];
	/** 子目录名 → 里面的文件名（只展开一层）。 */
	nested: Record<string, string[]>;
}

export interface FeatureScan {
	root: string;
	topic: string;
	/** 桶名 → 扫描结果（缺的桶也在，`absent:true`）。 */
	dirs: Record<string, DirScan & { absent: boolean }>;
	/** 缺了哪几个桶（**目录存在就是功能**，但缺桶要如实说）。 */
	missing: string[];
	/** 不是 4 个桶的目录（如实列出，不丢）。 */
	strangerDirs: string[];
	/** 功能根下的散文件。 */
	rootFiles: string[];
}

/** 一层深度的展开上限（防一个桶里堆了几百个子目录把面板拖死）。 */
const MAX_SUBDIRS = 12;

function emptyScan(): DirScan {
	return { files: [], subdirs: [], nested: {} };
}

/**
 * 扫一个功能目录：4 个桶 + 每个桶再下**一层**。
 * 列举失败一律降级成"空 + absent"，绝不抛给界面（缺桶是常态，不是异常）。
 */
export async function scanFeature(port: WorkspacePort, root: string, signal?: AbortSignal): Promise<FeatureScan> {
	const r = String(root || "").replace(/[\\/]+$/, "");
	const topic = r.split(/[\\/]/).pop() || "";
	const dirs: FeatureScan["dirs"] = {};
	const missing: string[] = [];

	const rootDirs = await listDirs(port, r, signal, true);
	const have = new Set(rootDirs.map((d) => String(d).toLowerCase()));

	for (const b of BUCKETS) {
		if (!have.has(b)) {
			dirs[b] = Object.assign(emptyScan(), { absent: true });
			missing.push(b);
			continue;
		}
		const d = Object.assign(emptyScan(), { absent: false });
		d.files = (await listFiles(port, r + "/" + b, signal, true)).slice().sort();
		d.subdirs = (await listDirs(port, r + "/" + b, signal, true)).slice().sort();
		for (const sub of d.subdirs.slice(0, MAX_SUBDIRS)) {
			d.nested[sub] = (await listFiles(port, r + "/" + b + "/" + sub, signal, true)).slice().sort();
		}
		dirs[b] = d;
	}

	const rootFiles = (await listFiles(port, r, signal, true)).slice().sort();
	/**
	 * 不是 4 个桶的目录 —— 如实列出，但**跳过 `.` 开头的工具目录**（`.dsh` / `.git` / `.svn` …）。
	 * 判据：它们不是"内容"，是工具与版本控制的痕迹；面板自己也会在工作区根下建 `.dsh` 放指针文件
	 * （用户问过"这个 .dsh 有必要吗" —— 指针有必要，但不该出现在功能目录里：
	 *  指针只写工作区根，见 `pure/configentry.ts` 的 `looksFeatureDir`）。
	 * ★ 桶本身缺了照旧如实报（`missing`），这条只管"多出来的东西"。
	 */
	const strangerDirs = rootDirs
		.filter((d) => String(d).startsWith(".") === false)
		.filter((d) => !(BUCKETS as readonly string[]).some((b) => b.toLowerCase() === String(d).toLowerCase()))
		.sort();

	return { root: r, topic: topic, dirs: dirs, missing: missing, strangerDirs: strangerDirs, rootFiles: rootFiles };
}

/** 决策记录文件的位置（**唯一出处**：面板、加载器、操作文档都引 `pure/decisions.ts`）。 */
export function decisionPathOf(root: string): string {
	return String(root || "").replace(/[\\/]+$/, "") + "\\" + DECISION_REL.replace(/\//g, "\\");
}

/**
 * 读决策记录。**读不到 ≠ 没有**：文件不存在是"还没记过决策"（正常），
 * 读失败是"读不到"（要如实说）—— 两种情况分开报。
 */
export async function loadDecisionLog(
	port: WorkspacePort,
	root: string,
	signal?: AbortSignal,
): Promise<{ rel: string; abs: string; log: DecisionLog; readError: string }> {
	const abs = decisionPathOf(root);
	const text = await readAllText(port, abs, signal, 20000);
	if (text === null) return { rel: DECISION_REL, abs: abs, readError: "", log: parseDecisionLog("") };
	return { rel: DECISION_REL, abs: abs, readError: "", log: parseDecisionLog(text) };
}

export interface FeatureDetail {
	root: string;
	topic: string;
	missing: string[];
	strangerDirs: string[];
	rootFiles: string[];
	/** 桶概览（界面上的"4 个桶"一行）。 */
	buckets: Array<{ key: string; label: string; meaning: string; files: number; subdirs: number; absent: boolean }>;
	/** ① 头脑风暴（四入口的已有结论 + 两种固定格式的解析）。 */
	brainstorm: any;
	/** ② 决策记录（解析后的账本 + 原始文本）。 */
	decisions: { rel: string; abs: string; readError: string; log: DecisionLog };
	/** ③ 最终产物（四类 + 其它）。 */
	outputs: ReturnType<typeof featureArtifacts>;
	/** 计数（卡片与页签上的数字，界面不自己数）。 */
	counts: Record<string, number>;
}

/**
 * 读一个功能的全部三块。
 * @param options.root 功能根（绝对路径）
 */
export async function loadFeatureDetail(
	port: WorkspacePort,
	options: { root: string; signal?: AbortSignal; maxDocs?: number },
): Promise<FeatureDetail> {
	const signal = options.signal;
	const scan = await scanFeature(port, options.root, signal);

	// ① 头脑风暴：文件清单来自这一次扫描（**不重新列目录**，两处列举结果就不会打架）
	/**
	 * 交给头脑风暴读通道的 `analysis\` 文件。
	 *
	 * ★ **配置表那条线的文件要剔掉**：`CS-*.yaml` 变更集、`*_读回验收报告.md`、`.xlsx/.xlsm/.csv`
	 *   是配置交付物（口径：**只落 `gdd\`**，`analysis\` 只放头脑风暴产物），它们不是四个入口的产物 ——
	 *   混进来会让"四入口分组的总数"对不上，也会在头脑风暴里冒出一张不相干的表。
	 *   判据用**同一份** `configArtifactOf`（不在这里另判一次）。
	 */
	const analysisFiles: Array<{ name: string; rel: string; subdir: string }> = [];
	const pushAnalysis = (n: string, sub: string) => {
		if (configArtifactOf(n)) return;
		analysisFiles.push({ name: n, rel: sub ? "analysis/" + sub + "/" + n : "analysis/" + n, subdir: sub });
	};
	for (const n of scan.dirs.analysis.files) pushAnalysis(n, "");
	for (const sub of Object.keys(scan.dirs.analysis.nested).sort()) {
		for (const n of scan.dirs.analysis.nested[sub]) pushAnalysis(n, sub);
	}
	const brainstorm = await loadBrainstorm(port, {
		root: scan.root,
		files: analysisFiles,
		signal: signal,
		maxDocs: options.maxDocs
	});

	// ② 决策记录
	const decisions = await loadDecisionLog(port, scan.root, signal);

	// ③ 最终产物：analysis + gdd 两个桶的列举 → 四类分组
	const outputs = featureArtifacts({
		analysis: { files: scan.dirs.analysis.files, nested: scan.dirs.analysis.nested },
		gdd: { files: scan.dirs.gdd.files, nested: scan.dirs.gdd.nested }
	});
	annotateFinals(outputs.groups);

	let evidence = scan.dirs.evidence.files.length;
	for (const k of Object.keys(scan.dirs.evidence.nested)) evidence += scan.dirs.evidence.nested[k].length;

	const counts: Record<string, number> = {
		brainstorm: outputs.counts.brainstorm || 0,
		draft: outputs.counts.draft || 0,
		final: outputs.counts.final || 0,
		speech: outputs.counts.speech || 0,
		other: outputs.counts.other || 0,
		evidence: evidence,
		decisions: decisions.log.entries.length,
		total: outputs.total
	};

	return {
		root: scan.root,
		topic: scan.topic,
		missing: scan.missing,
		strangerDirs: scan.strangerDirs,
		rootFiles: scan.rootFiles,
		buckets: BUCKETS.map((b) => ({
			key: b,
			label: BUCKET_LABEL[b] || b,
			meaning: BUCKET_MEANING[b] || "",
			files: scan.dirs[b].files.length,
			subdirs: scan.dirs[b].subdirs.length,
			absent: scan.dirs[b].absent
		})),
		brainstorm: brainstorm,
		decisions: decisions,
		outputs: outputs,
		counts: counts
	};
}

/** 决策记录里最近一条的时间戳（没有就是空串）—— 卡片上那一行用它。 */
export function lastDecisionAt(log: DecisionLog): string {
	let best = "";
	let bestKey = "";
	for (const e of log.entries) {
		const k = String(e.at).replace(/[-: ]/g, "");
		if (k > bestKey) {
			bestKey = k;
			best = e.at;
		}
	}
	return best;
}
