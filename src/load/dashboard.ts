/**
 * 看板加载器（v5）—— 扫 `features\` → **功能卡片**列表。
 *
 * ★ 功能 = 目录：**只认 `<SR 工作区>\features\<主题>\`**，目录存在就是功能（哪怕它是空的）。
 *   代码里零兼容、零猜测：没有身份声明要读（v5 起 `feature.json` 退休了，目录名就是身份），
 *   没有配置表要挂（配置表不进工作台），没有旧结构要统计。
 * ★ 卡片上给的是**人一眼要的那几个数**：头脑风暴几件、成稿几份、定稿几份、宣讲几份、
 *   决策几条、最近一条决策是什么时候。
 * ★ 这一层**只吃 port**：端口之外没有任何 ctx / remote / window。
 */

import { outputGroupOf } from "../pure/buckets.ts";
import type { WorkspacePort } from "../port/types.ts";
import { decisionPathOf, lastDecisionAt, scanFeature } from "./feature.ts";
import { loadSrPaths } from "./paths.ts";
import { listDirs, readAllText } from "./read.ts";
import { parseDecisionLog } from "../pure/decisions.ts";
import { dateOf } from "../pure/topic.ts";

export interface DashboardOptions {
	/** 当前会话的 cwd —— 只在读不到 sr 配置时用于如实标注 */
	cwd?: string;
	/** sr 配置文件的绝对路径（profile 里给的 configPath；浏览器半侧收不到 config，留空） */
	configPath?: string;
	signal?: AbortSignal;
}

/** 一张功能卡片（界面直接吃这个对象，不自己算数）。 */
export interface FeatureCard {
	topic: string;
	root: string;
	counts: Record<string, number>;
	/** 决策记录里最近一条的时间戳（空 = 还没有决策）。 */
	lastDecisionAt: string;
	/** 产物文件名里最新的日期（`YYYYMMDD`）。 */
	latestDate: string;
	/** 走到哪一步：`empty` / `brainstorm` / `draft` / `final`。 */
	stage: string;
	/** 卡片上那一行人话。 */
	line: string;
	/** 那一行人话的语气：`new` / `ok` / `muted` / `warn`。 */
	tone: string;
	/** 缺了哪几个桶（空数组 = 4 个桶齐）。 */
	missing: string[];
}

/** 卡片上那一行人话（**只有这一份实现**，界面不另写话术）。 */
export function cardLineOf(c: {
	counts: Record<string, number>;
	missing: string[];
	lastDecisionAt: string;
	latestDate: string;
}): { line: string; tone: string; stage: string } {
	const n = c.counts || {};
	const brainstorm = n.brainstorm || 0;
	const draft = n.draft || 0;
	const final = n.final || 0;
	const speech = n.speech || 0;
	const decisions = n.decisions || 0;
	const anything = brainstorm + draft + final + speech + (n.other || 0) + (n.evidence || 0);

	if (c.missing.length > 0) {
		return {
			line: "桶没建全：缺 " + c.missing.join("、") + " —— 补建这几个目录，或删掉这个功能目录重建",
			tone: "warn",
			stage: "empty"
		};
	}
	if (final > 0 && speech > 0) return { line: "已定稿 · 宣讲稿也在", tone: "ok", stage: "final" };
	if (final > 0) return { line: "已定稿" + (c.latestDate ? "（" + c.latestDate + "）" : "") + " · 可以交程序", tone: "ok", stage: "final" };
	if (draft > 0) return { line: "有成稿 " + draft + " 份 · 还没定稿", tone: "muted", stage: "draft" };
	if (brainstorm > 0) return { line: "头脑风暴有 " + brainstorm + " 件产物 · 还没出成稿", tone: "muted", stage: "brainstorm" };
	if (decisions > 0) return { line: "记了 " + decisions + " 条决策 · 还没有产物", tone: "muted", stage: "empty" };
	if (anything > 0) return { line: "有原料 · 还没跑头脑风暴", tone: "muted", stage: "empty" };
	return { line: "新的 —— 还没有任何产物，从「头脑风暴」开始", tone: "new", stage: "empty" };
}

/**
 * 扫工作区 → 功能卡片列表。
 * ★ 先从 sr 配置拿**绝对路径**锚点，不跟着当前会话的工作区走。
 */
export async function loadDashboard(port: WorkspacePort, options: DashboardOptions = {}): Promise<any> {
	const P = await loadSrPaths(port, options.configPath || "", options.signal);
	const srWs = P.srWs || "";
	if (!P.srWs) {
		return {
			srWs: "",
			configFile: P.configFile,
			cwd: options.cwd || "",
			pathNote: "没读到 sr 配置（试过 " + P.configFile + "）—— 工作区锚点未知，先跑 `/sr-askme` 或确认 `.agents\\skills\\sr-askme\\config.local.json`。",
			features: [],
			counts: { features: 0 }
		};
	}

	const out = await loadDashboardInner(port, srWs, options.signal);
	out.srWs = srWs;
	out.configRoot = P.configRoot;
	out.configFile = P.configFile;
	out.cwd = options.cwd || "";
	return out;
}

/** 扫 `<srWs>\features\` 下的每一个目录 → 卡片。 */
export async function loadDashboardInner(port: WorkspacePort, srWs: string, signal?: AbortSignal): Promise<any> {
	const featuresDir = String(srWs).replace(/[\\/]+$/, "") + "\\features";
	let topics: string[] = [];
	let note = "";
	try {
		topics = (await listDirs(port, featuresDir, signal, false)).slice().sort();
	} catch (e) {
		// 全新工作区（还没有 features\）与"列不出来"要分清：根列得出来 ⇒ 只是还没有功能目录
		let rootOk = false;
		try {
			await port.listDir(String(srWs).replace(/[\\/]+$/, ""), signal);
			rootOk = true;
		} catch (e2) {
			rootOk = false;
		}
		note = rootOk
			? "`features\\` 还没有建（工作台建第一个功能时会自动建）。"
			: "读不到 SR 工作区（列不出 " + srWs + "）—— 看板给不了功能列表。";
	}

	const features: FeatureCard[] = [];
	for (const t of topics) {
		const root = featuresDir + "\\" + t;
		const scan = await scanFeature(port, root, signal);

		// 决策：只读这一份文件（一个功能一个文件，读一次就知道全部）
		const text = await readAllText(port, decisionPathOf(root), signal, 20000);
		const log = parseDecisionLog(text === null ? "" : text);

		/**
		 * 卡片的计数**必须与详情页同源** —— 走同一个 `outputGroupOf`。
		 *
		 * ★ 真踩过（2026-10-09）：这里原来自己数（`analysis` 桶文件数 + `gddKindOf`），
		 *   结果 `gdd\CS-20261009-001_读回验收报告.md`（无后缀的 `.md`）被 `gddKindOf` 判成 `draft`，
		 *   卡片就写「有成稿 **2** 份」——而详情页只有 1 份。用户一眼就看出来了。
		 *   判据两份 ⇒ 同一个东西两个数，这是本仓库最忌的一类 bug。
		 */
		const allFiles: Array<{ dir: string; name: string }> = [];
		for (const dir of ["analysis", "gdd"]) {
			const d = scan.dirs[dir];
			for (const n of d.files) allFiles.push({ dir: dir, name: n });
			for (const k of Object.keys(d.nested)) for (const n of d.nested[k]) allFiles.push({ dir: dir, name: n });
		}
		/**
		 * ★ `trace`（过程留痕）也数进来：卡片上**不展示**它（留痕不是产物），
		 *   但计数必须与详情页同源 —— `load-dashboard-counts` 那条回归钉子盯的就是这件事。
		 */
		const groups: Record<string, number> = { brainstorm: 0, draft: 0, final: 0, ue: 0, speech: 0, config: 0, other: 0, trace: 0 };
		for (const f of allFiles) {
			const g = outputGroupOf(f.dir, f.name);
			groups[g] = (groups[g] || 0) + 1;
		}
		let evidence = scan.dirs.evidence.files.length;
		for (const k of Object.keys(scan.dirs.evidence.nested)) evidence += scan.dirs.evidence.nested[k].length;

		const gddFiles = scan.dirs.gdd.files.concat(
			Object.keys(scan.dirs.gdd.nested).reduce<Array<string>>((a, k) => a.concat(scan.dirs.gdd.nested[k]), []));

		const counts: Record<string, number> = {
			brainstorm: groups.brainstorm, draft: groups.draft, final: groups.final, ue: groups.ue, speech: groups.speech,
			config: groups.config, other: groups.other, trace: groups.trace,
			evidence: evidence, decisions: log.entries.length
		};
		const latestDate = gddFiles.reduce((best, n) => (dateOf(n) > best ? dateOf(n) : best), "");
		const at = lastDecisionAt(log);
		const l = cardLineOf({ counts: counts, missing: scan.missing, lastDecisionAt: at, latestDate: latestDate });

		features.push({
			topic: t,
			root: root,
			counts: counts,
			lastDecisionAt: at,
			latestDate: latestDate,
			stage: l.stage,
			line: l.line,
			tone: l.tone,
			missing: scan.missing
		});
	}

	// 排序：最近有决策的在前 → 文件名日期新的在前 → 目录名
	features.sort((a, b) => {
		if (a.lastDecisionAt !== b.lastDecisionAt) return a.lastDecisionAt < b.lastDecisionAt ? 1 : -1;
		if (a.latestDate !== b.latestDate) return a.latestDate < b.latestDate ? 1 : -1;
		return a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0;
	});

	return { features: features, note: note, counts: { features: features.length } };
}
