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
 *   · ★ 工单 25：**时间**从宿主的 `stat` 版本串里取（`../pure/fsstamp.ts`，第 4 段 = mtime 纳秒，
 *     实测见该文件头）—— 于是 V11 的"审查报告是不是比定稿旧"从**判不了**变成**判得出来**；
 *     取不到时间时**如实降级**（`finalGate` 的 `unknown-time`：判不了就不放行，不默认有效）。
 *   · 定稿门（"这份定稿能不能交程序"）由 `../pure/finalgate.ts` 给 —— 它只把上面那几条判据
 *     翻成人话，**不重算判据**。
 */

import { annotateFinals, featureArtifacts, stageProgress } from "../pure/artifacts.ts";
import { checkFinals, parseFrontmatter } from "../pure/finalgdd.ts";
import { finalGate } from "../pure/finalgate.ts";
import { mtimeOf } from "../pure/fsstamp.ts";
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
 * ★ 工单 25：拿**文件时间**（epoch ms）—— 枚举通道不给 mtime，唯一来源是宿主 `stat` 的版本串
 * （第 4 段 = mtime 纳秒；实测链见 `../pure/fsstamp.ts` 的文件头）。
 *
 * 口径：
 *   · **认不出来给 0**（= 看不到时间），绝不拿半个串猜时间；0 会让定稿门判 `unknown-time` 而不放行。
 *   · 单个文件 stat 失败**不拖垮整批**（刚好被删 / 权限），那一个就是 0 —— 界面上如实反映。
 *   · 只 stat **定稿与审查报告**这几个（真实功能里 2~5 个），不给整份产物清单每个都来一遍。
 */
async function mtimeMsOf(port: WorkspacePort, absPath: string, signal?: AbortSignal): Promise<number> {
	try {
		const st = await port.stat(absPath, signal);
		return mtimeOf(st && st.version);
	} catch (e) {
		return 0;
	}
}

/**
 * 功能详情的完整视图模型。
 *
 * @returns `{ root, artifacts, stage, finalCheck, checklist, gate, notes }`
 *   · `artifacts.groups` —— 按桶分组（含空桶与"未归桶"），每条带 gdd 细分 kind 与规范名标注
 *   · `artifacts.allPaths` —— **面板会列出的清单**（对账用：与磁盘递归列举逐条 diff 应为 0）
 *   · `stage` —— 三阶段进度
 *   · `finalCheck` —— `checkFinals` 原样结论（V1）
 *   · `checklist` —— `gddChecklist`（V1 + V3/V5/V6/V8/V11，带 level 与行号；V11 的"新旧"用真时间）
 *   · `gate` —— `finalGate`：**这份定稿能不能交程序**（人话；审查是必经一步）
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

	// ② 每份定稿的 frontmatter（status 是 V1 的唯一判据）+ **每份的时间**（工单 25）
	const heads: Array<{ name: string; doc_type: unknown; status: unknown; mtime: number }> = [];
	for (const f of finalFiles) {
		const abs = root + "/gdd/" + f.name;
		const head = parseFrontmatter((await readHead(port, abs, signal)) || "");
		heads.push({
			name: f.name, doc_type: head ? head.doc_type : null, status: head ? head.status : null,
			mtime: await mtimeMsOf(port, abs, signal)
		});
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

	// ④ 审查报告的**时间**（每份都要，因为"哪一份才对应这一版定稿"由 `checkV11` 的逐字匹配决定）
	const reviewMs: Record<string, number> = {};
	for (const f of reviewFiles) reviewMs[f.name] = await mtimeMsOf(port, root + "/gdd/" + f.name, signal);

	// ⑤ 校验清单：★ 这里把**真时间**喂进去 —— V11 因此能判"报告比定稿旧"（工单 25 第 3 条）
	const currentMs = current ? Number((heads.filter((h) => h.name === current)[0] || {}).mtime) || 0 : 0;
	const checklist = gddChecklist({
		text: text,
		finals: heads,
		reviews: reviewFiles.map((f) => ({ name: f.name, mtime: Number(reviewMs[f.name]) || 0 })),
		mtime: currentMs
	});

	// ⑥ 定稿门（能不能交程序）—— 判据搬自 finalCheck / V11 / checklist 的 error 项，**不重算**
	const gate = finalGate({
		finalCheck: finalCheck,
		v11: (checklist.checks || {}).V11,
		finalMs: currentMs,
		reviewMs: reviewMs,
		errors: (checklist.issues || []).filter((it: any) => it.level === "error")
	});

	// ⑦ 时间这一项的**如实说明**：拿到就说拿到，拿不到就说看不到（绝不含糊成"没问题"）
	if (current) {
		if (currentMs > 0) {
			notes.push("时间来源：宿主 `stat` 的版本串（`dev:ino:size:mtimeNs:ctimeNs` 的第 4 段 = mtime 纳秒）—— " +
				"V11 据此判「审查报告是否比定稿旧」，这次的结论：" + gate.review.state + "。");
		} else {
			notes.push("面板**看不到时间**（宿主 `stat` 的版本串不是预期的 5 段形状）—— " +
				"「审查报告是否比定稿旧」判不了；定稿门因此**不放行**（判不了就不当有效）。");
		}
	}

	return {
		root: root,
		artifacts: artifacts,
		stage: stageProgress(artifacts),
		finalCheck: finalCheck,
		checklist: checklist,
		gate: gate,
		notes: notes,
		// ★ 工单 16：功能根下**确实存在**的那两层的名字（订阅变更要逐个盯）——
		//   0.2.0 的 `changes` 是目标定向 + depth 0，只订阅功能根看不见 `gdd\` 里的写入（实测）。
		dirs: Object.keys(listing.dirs),
		nestedDirs: listing.nestedDirs || []
	};
}
