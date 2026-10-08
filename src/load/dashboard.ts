/**
 * 看板加载器：扫工作区 → 功能列表（视图模型）。
 *
 * ★ 功能 = 目录（设计 §3.2）：**只认 `features\<主题>\`，代码里零兼容**。
 *   旧结构（平铺的 proposals/analysis/decisions/evidence）只统计还剩多少文件——
 *   那个数字的唯一用途是提示你"可以删了"。
 * ★ 配置表只按主题**挂到已有功能上**，自己绝不创建功能。
 * ★ 这一层**只吃 port**：端口之外没有任何 ctx / remote / window。
 */

import { checkFinals, parseFrontmatter } from "../pure/finalgdd.ts";
import { BUCKET_FIELD, DIR_BUCKET, artifactBucket } from "../pure/buckets.ts";
import { BUCKET_ORDER } from "../pure/createfeature.ts";
import { identityOf } from "../pure/featureid.ts";
import { dateOf, isNoise, topicOf } from "../pure/topic.ts";
import type { WorkspacePort } from "../port/types.ts";
import { loadSrPaths } from "./paths.ts";
import { listDirs, listFiles, readHead, readIdentityText } from "./read.ts";

/** sr 工作区与配置表目录，相对会话 workspace 根（读不到 sr 配置时的兜底） */
export const SR_WS = "GameDesignOS/workspace";
export const CONFIG_DIR = "planner/策划配置";

export interface DashboardOptions {
	/** 当前会话的 cwd —— 只在读不到 sr 配置时用于如实标注 */
	cwd?: string;
	/** sr 配置文件的绝对路径（profile 里给的 configPath） */
	configPath?: string;
	signal?: AbortSignal;
}

/** 扫工作区 → 功能列表。★ 先从 sr 配置拿**绝对路径**，不跟着当前会话的工作区走。 */
export async function loadDashboard(port: WorkspacePort, options: DashboardOptions = {}): Promise<any> {
	const P = await loadSrPaths(port, options.configPath || "", options.signal);
	const srWs = P.srWs || SR_WS;
	const cfgDir = P.configRoot || CONFIG_DIR;
	if (!P.srWs) {
		const rel = await loadDashboardInner(port, { srWs: SR_WS, cfgDir: CONFIG_DIR, signal: options.signal });
		rel.pathNote = "未读到 sr 配置（试过 " + P.configFile + "），已退回相对路径 " + SR_WS;
		rel.configFile = P.configFile;
		rel.cwd = options.cwd || "";
		return rel;
	}
	const out = await loadDashboardInner(port, { srWs: srWs, cfgDir: cfgDir, signal: options.signal });
	out.srWs = srWs;
	out.configRoot = cfgDir;
	out.skillsRoot = P.skillsRoot || "";
	out.configFile = P.configFile;
	out.cwd = options.cwd || "";
	return out;
}

export async function loadDashboardInner(
	port: WorkspacePort,
	options: { srWs: string; cfgDir: string; signal?: AbortSignal },
): Promise<any> {
	const srWs = options.srWs;
	const cfgDir = options.cfgDir;
	const signal = options.signal;

	const [featDirs, configNamesRaw] = await Promise.all([
		listDirs(port, srWs + "/features", signal, true),
		listFiles(port, cfgDir, signal, true),
	]);
	/**
	 * ★ 2026-10-08（工单 28 顺带修的实测缺口）：Excel 打开工作簿时会在同目录留一个**隐藏锁文件**
	 *   `~$<原表名>.xlsm`（实测 165 字节，用户当场开着 `A002-货物道具表.xlsm`）。
	 *   它不是配置数据，却能被 `\.xlsx?m?$` 匹配上 ⇒ 看板会报"93 张配置表"、还可能按主题挂到某个功能上。
	 *   排除它（`~$` 是 Office 的临时/锁文件前缀）。**其余文件一律照列，不做别的过滤。**
	 */
	const configNames = configNamesRaw.filter((n) => n.indexOf("~$") !== 0);

	const feats: any[] = [];
	for (const t of featDirs) {
		if (isNoise(t)) continue;
		const root = srWs + "/features/" + t;
		const f: any = {
			topic: t, root: root, ledgerFile: null,
			// concept 沿用旧字段名，含义 = **全部头脑风暴产物**（6 种 analysis 产出）
			concept: [], drafts: [], finals: [], reviews: [], speeches: [],
			decisions: [], evidence: [], source: [], evPacks: [], others: 0,
		};
		// ① 七个标准子目录
		for (const sub in DIR_BUCKET) {
			const names = await listFiles(port, root + "/" + sub, signal, true);
			for (const n of names) {
				// gdd\ 里混着成稿/定稿/审查，要再细分；其余子目录直接按目录归桶
				const bucket = sub === "gdd" ? artifactBucket(n) : (DIR_BUCKET as any)[sub];
				const field = (BUCKET_FIELD as any)[bucket];
				if (field) f[field].push(n);
				else f.others += 1;
			}
		}
		// ② 功能根下的设计台账（§7.2：台账在功能根，不在任何子目录）
		const rootFiles = await listFiles(port, root, signal, true);
		f.ledgerFile = rootFiles.filter((n) => /^设计台账.*\.md$/i.test(n))[0] || null;
		// ★ 工单 22：**身份声明**（只放身份不放进度，spec.md:131-137）。
		//   本机真实数据一个都没有（迁移票 21 才补）⇒ `present:false`，界面**如实标注
		//   "没有身份声明"并按目录名认功能**（不假装有 id，也不报错）。
		f.identity = identityOf(await readIdentityText(port, root, signal), t);
		// ★ 工单 22：六个桶**建全了没有**（缺桶是真实缺陷，卡片上只说缺哪几个）
		const subdirs = await listDirs(port, root, signal, true);
		const haveSub = new Set(subdirs.map((d) => d.toLowerCase()));
		f.bucketsMissing = BUCKET_ORDER.filter((b) => !haveSub.has(b.toLowerCase()));
		// ③ 证据包（`evidence\<名字>\` 这种子目录）
		for (const d of await listDirs(port, root + "/evidence", signal, true)) {
			const inside = await listFiles(port, root + "/evidence/" + d, signal, true);
			f.evPacks.push({ dir: d, files: inside.length, sample: inside.slice(0, 6) });
		}
		feats.push(f);
	}

	// 旧结构残留统计 —— **只用于提示，不产出功能**
	let legacyLeft = 0;
	for (const d of ["proposals", "analysis", "decisions", "evidence", "inbox"]) {
		legacyLeft += (await listFiles(port, srWs + "/" + d, signal, true)).length;
	}

	// ★ 配置表只按主题**挂到已有功能上**，自己绝不创建功能
	//   （策划配置目录有 92 张表，它们不是功能，是功能的落地资源；`~$` 那种锁文件在上面已经排掉了）
	const configByTopic = new Map<string, string[]>();
	for (const n of configNames) {
		if (!/\.xlsx?m?$/i.test(n)) continue;
		const t = topicOf(n);
		if (isNoise(t)) continue;
		if (!configByTopic.has(t)) configByTopic.set(t, []);
		(configByTopic.get(t) as string[]).push(n);
	}

	const features: any[] = [];
	/** 定稿的绝对路径：**只有一种结构** —— `features\<主题>\gdd\` */
	const finalAbs = (f: any, name: string) => f.root + "/gdd/" + name;

	for (const f of feats) {
		f.finals.sort((a: string, b: string) => (dateOf(a) < dateOf(b) ? 1 : -1));
		f.reviews.sort().reverse();
		f.decisions.sort().reverse();
		const latest = f.finals[0] || null; // finals 已按日期倒序
		// ★ 定稿以**日期**定最终版（口径不变）；但为了暴露"多份 active 并存"这个真实缺陷，
		//   这里把**每一份定稿的头部**都读一遍，交给 checkFinals 判（设计 §6.1 / §8 V1）。
		const finalHeads = await Promise.all(
			f.finals.map(async (name: string) => {
				const h = parseFrontmatter(await readHead(port, finalAbs(f, name), signal));
				return { name: name, doc_type: h ? h.doc_type : null, status: h ? h.status : null };
			}),
		);
		const finalCheck = checkFinals(finalHeads);
		const head = finalHeads.length ? finalHeads[0] : null;

		features.push({
			topic: f.topic,
			root: f.root, // ★ 功能的根目录 —— 一切读取都从它出发
			ledgerFile: f.ledgerFile, // ★ 功能根下的设计台账（§7.2）
			// ★ 工单 22：身份（`feature.json`）+ 桶齐不齐 —— 卡片的诚实标注靠这两个字段
			identity: f.identity,
			bucketsMissing: f.bucketsMissing,
			docType: head ? head.doc_type : null,
			status: head ? head.status : null,
			finalCheck: finalCheck, // ★ 定稿有效性（§6.1 / §8 V1）
			latestFinal: latest,
			latestDate: latest ? dateOf(latest) : "",
			finals: f.finals.length,
			reviews: f.reviews.length,
			speeches: f.speeches.length,
			decisions: f.decisions.length,
			evidence: f.evidence.length,
			evPacks: f.evPacks,
			sources: f.source.length,
			configs: configByTopic.get(f.topic) || [],
			others: f.others,
			historyCount: Math.max(0, f.finals.length - 1),
			openPath: latest ? finalAbs(f, latest) : null,
			// ★ A3 产物：留全文件名，按阶段分组
			files: {
				concept: f.concept.slice().sort(),
				draft: f.drafts.slice().sort(),
				final: f.finals.slice(), // 已按日期倒序
				review: f.reviews.slice().sort().reverse(),
				speech: f.speeches.slice().sort().reverse(),
				config: (configByTopic.get(f.topic) || []).slice().sort(),
				decision: f.decisions.slice().sort().reverse(),
				evidence: f.evidence.slice().sort(),
				source: f.source.slice().sort(),
			},
			stageCounts: {
				concept: f.concept.length,
				draft: f.drafts.length,
				config: (configByTopic.get(f.topic) || []).length,
				final: f.finals.length,
				review: f.reviews.length,
				speech: f.speeches.length,
			},
			stages: {
				concept: f.concept.length > 0,
				draft: f.drafts.length > 0 || f.finals.length > 0,
				config: (configByTopic.get(f.topic) || []).length > 0,
				final: f.finals.length > 0,
				review: f.reviews.length > 0,
				speech: f.speeches.length > 0,
			},
		});
	}

	// ★ 不再过滤：**目录存在就是功能**（哪怕它暂时是空的）—— 这是"功能 = 目录"的直接推论
	features.sort((a, b) => (a.latestDate < b.latestDate ? 1 : -1));

	return {
		features: features,
		legacyLeft: legacyLeft, // 旧结构还剩多少文件（唯一用途：提示你"可以删了"）
		counts: { features: features.length, configs: configNames.length },
		srWs: srWs,
		configRoot: cfgDir,
	};
}
