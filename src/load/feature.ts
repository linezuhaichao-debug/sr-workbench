/**
 * 功能详情加载器（工单 12）：产物清单（按桶分组）+ 三阶段 + 定稿有效性 + V 校验清单。
 *
 * 口径：
 *   · **只吃 port**，只读；列举深度**声明为两层**（功能根 → 子目录 → 再下一层）。
 *     更深层如实报出来（`deepDirs`），不假装列全了 —— "面板列出的产物与磁盘实际一致"
 *     这条验收句靠的就是"不静默丢"。
 *   · 桶的归类、gdd 的细分、三阶段全在 `../pure/artifacts.ts`（纯函数、有测试）；
 *     这里只做 IO 与编排。
 *   · V1 定稿有效性用 `../pure/finalgdd.ts` 的 `checkFinals`；V3/V5/V6/V8/V11 + V1 汇总
 *     用 `../pure/vchecks.ts` 的 `gddChecklist`（工单 30 的能力，本票把它接进面板）。
 *
 * ★ 一处**如实声明的降级**：DSH 的两条列举通道都不提供 mtime（`WorkspaceDirectoryEntry`
 *   只有 `name` / `type` / `size?`，`stat` 只给不透明的 `version`），所以
 *   `gddChecklist` 拿不到 mtime ⇒ V11 只能判"有没有逐字匹配的审查报告"那一半，
 *   "审查报告是否比定稿旧"判不了。这不是漏做，是通道限制；面板上如实写出来。
 */

import { annotateFinals, featureArtifacts, stageProgress } from "../pure/artifacts.ts";
import { checkFinals, parseFrontmatter } from "../pure/finalgdd.ts";
import { gddChecklist } from "../pure/vchecks.ts";
import type { WorkspacePort } from "../port/types.ts";
import { listDirs, listFiles, readAllText, readHead } from "./read.ts";

export interface FeatureDetailOptions {
	/** 功能根目录（绝对路径，`<sr 根>/features/<主题>`） */
	root: string;
	signal?: AbortSignal;
}

/**
 * 扫一个功能目录 → 原始清单（**只照子目录走，不按文件名过滤**）。
 * 返回的键与 `pure/artifacts.ts` 的 `FeatureListing` 一致。
 */
export async function scanFeatureListing(port: WorkspacePort, options: FeatureDetailOptions): Promise<any> {
	const root = options.root;
	const signal = options.signal;
	const rootFiles = await listFiles(port, root, signal, true);
	const rootDirs = await listDirs(port, root, signal, true);
	const dirs: Record<string, { files: string[]; nested: Record<string, string[]> }> = {};
	const deepDirs: string[] = [];
	/** ★ 工单 16：真正**存在**的那两层目录（`gdd/UI` 这种），订阅变更时要逐个盯着它们 */
	const nestedDirs: string[] = [];
	for (const sub of rootDirs) {
		const dirPath = root + "/" + sub;
		const files = await listFiles(port, dirPath, signal, true);
		const subdirs = await listDirs(port, dirPath, signal, true);
		const nested: Record<string, string[]> = {};
		for (const sd of subdirs) {
			nested[sd] = await listFiles(port, dirPath + "/" + sd, signal, true);
			nestedDirs.push(sub + "/" + sd);
			const deeper = await listDirs(port, dirPath + "/" + sd, signal, true);
			if (deeper.length) deepDirs.push(sub + "/" + sd + "（还有 " + deeper.length + " 个子目录）");
		}
		dirs[sub] = { files: files, nested: nested };
	}
	return { rootFiles: rootFiles, dirs: dirs, nestedDirs: nestedDirs, deepDirs: deepDirs };
}

/**
 * 功能详情的完整视图模型。
 *
 * @returns `{ root, artifacts, stage, finalCheck, checklist, notes }`
 *   · `artifacts.groups` —— 按桶分组（含空桶与"未归桶"），每条带 gdd 细分 kind 与规范名标注
 *   · `artifacts.allPaths` —— **面板会列出的清单**（对账用：与磁盘递归列举逐条 diff 应为 0）
 *   · `stage` —— 三阶段进度
 *   · `finalCheck` —— `checkFinals` 原样结论（"现在能用吗"）
 *   · `checklist` —— `gddChecklist`（V1 + V3/V5/V6/V8/V11，带 level 与行号）
 */
export async function loadFeatureDetail(port: WorkspacePort, options: FeatureDetailOptions): Promise<any> {
	const root = options.root;
	const signal = options.signal;
	const listing = await scanFeatureListing(port, options);
	const artifacts = featureArtifacts(listing);
	const notes: string[] = (artifacts.notes || []).slice();

	// ① 定稿候选：只从 **gdd 组**（且不在子目录里）取 —— 与面板列的清单同源，不另做判断
	const gddGroup = artifacts.groups.find((g: any) => g.key === "gdd");
	const gddFiles: any[] = (gddGroup && gddGroup.files) || [];
	const finalFiles = gddFiles.filter((f) => !f.subdir && f.kind === "final");
	const reviewFiles = gddFiles.filter((f) => !f.subdir && f.kind === "review");

	// ② 每份定稿的 frontmatter（status 是 V1 的唯一判据）
	const heads: Array<{ name: string; doc_type: unknown; status: unknown }> = [];
	for (const f of finalFiles) {
		const head = parseFrontmatter((await readHead(port, root + "/gdd/" + f.name, signal)) || "");
		heads.push({ name: f.name, doc_type: head ? head.doc_type : null, status: head ? head.status : null });
	}
	const finalCheck = checkFinals(heads);
	annotateFinals(artifacts, finalCheck);

	// ③ 当前有效定稿的正文 → V 校验清单（没有定稿就不读，如实给空清单）
	const current: string | null = finalCheck.current || null;
	let text = "";
	if (current) {
		const t = await readAllText(port, root + "/gdd/" + current, signal, 6000);
		if (t === null) {
			notes.push("当前有效定稿 `" + current + "` 读不到正文 —— 正文类校验（V3/V5/V6/V8）本轮为空。");
			text = "";
		} else {
			text = t;
		}
	}
	const checklist = gddChecklist({
		text: text,
		finals: heads,
		// ★ 通道不给 mtime（见文件头）⇒ 只传文件名；V11 因此只判"有没有逐字匹配的审查报告"
		reviews: reviewFiles.map((f) => ({ name: f.name })),
		mtime: undefined
	});
	if (current) notes.push("V11 降级：DSH 的列举通道不提供 mtime，「审查报告是否比定稿旧」判不了，只判「有没有逐字匹配的审查报告」。");

	return {
		root: root,
		artifacts: artifacts,
		stage: stageProgress(artifacts),
		finalCheck: finalCheck,
		checklist: checklist,
		notes: notes,
		// ★ 工单 16：功能根下**确实存在**的那两层的名字（订阅变更要逐个盯）——
		//   0.2.0 的 `changes` 是目标定向 + depth 0，只订阅功能根看不见 `gdd\` 里的写入（实测）。
		dirs: Object.keys(listing.dirs),
		nestedDirs: listing.nestedDirs || []
	};
}
