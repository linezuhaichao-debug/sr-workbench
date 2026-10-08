/**
 * 文档生成工作面加载器（工单 24）—— 这一屏的全部数据，**只吃 port、只读**。
 *
 * 三件事，一件都不多：
 *   ① **读成稿**：`gdd\<主题>_<日期>.md`（`doc_type: draft_gdd`，**文件名不带 `成稿` 后缀**）
 *      → `draftDocOf`（`../pure/drafttree.ts`）给出两大部分 + 左树（章 / 组 / 条目 + 1-based 行号）。
 *   ② **配置支线走到哪**：定稿 §6 配置契约（`parseConfigContract`）+ 读回回执（`evidence\readback_*`）
 *      + 配置表存在性（看板按主题挂上来的真实文件名）→ `configBranchState` 给一句话 + 四步 + 缺口。
 *      面板**不解析任何工作簿**（spec.md:212：这里只显示状态）。
 *   ③ 缺件如实报：没有成稿 / 没有定稿 / 读不动 / 认不出两大部分 —— 全进 `notes`，不静默。
 *
 * ── 清单**不在这里重新列目录**──────────────────────────────────────────────
 *   `gdd\` 的文件清单与头部分类（`kind === "draft"` / `"final"`）由 `loadFeatureDetail`（工单 12）
 *   给，本加载器只拿它做事 —— 这样"面板列出的产物"与"工作面读的那份成稿"**同一份来源**，
 *   不会出现两处列举结果不一致（与工单 23 的 `brainstorm.ts` 同一条纪律）。
 *
 * ── 只读前 14 行拿头部 ────────────────────────────────────────────────────
 *   成稿 / 定稿的 `doc_type` / `status` 都在头部（`gdd-pipeline.md` §一·补）⇒ 用 `readHead`，
 *   不必为了两个字段把 40KB 正文拉两次。
 */

import { dateOf, topicOf } from "../pure/topic.ts";
import { parseFrontmatter } from "../pure/finalgdd.ts";
import { draftDocOf } from "../pure/drafttree.ts";
import { configBranchState, configBranchStory, parseConfigContract, readbacksOf, wireBranchStory } from "../pure/draftstep.ts";
import type { WorkspacePort } from "../port/types.ts";
import { listFiles, readAllText, readHead } from "./read.ts";

/** 产物清单里的一个文件（`loadFeatureDetail` 给的形状的子集） */
export interface GddFile {
	name: string;
	rel?: string;
	subdir?: string;
	kind?: string;
}

/** 界面图的扩展名（`gdd\UI\` 里能当"界面图"用的那些；与 `split.ts` 认的图片类型同口径） */
const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

/** 字节数 → KB 一位小数（`39495` → `38.6`；0 就是 `0.0`，不编） */
function kbOf(bytes: number): number {
	return Math.round((Number(bytes) || 0) / 1024 * 10) / 10;
}

/**
 * 文本的 **UTF-8 字节数**。
 *
 * ★ 这一层跑在**浏览器半侧**（`lib/client.js` 里那个 bundle）—— **没有 `Buffer`、没有 `node:*`**，
 *   所以既不能 `Buffer.byteLength`，也不该去 import node 的东西。优先用平台自带的 `TextEncoder`
 *   （浏览器与 Node 都有；`TextEncoder` 只吃 string，不看 BOM），拿不到时退回**数码点**：
 *   非 ASCII 按 3 字节算 —— 这是**如实标注的近似**（真实工作区里的成稿是纯中文 markdown，
 *   中文在 UTF-8 里就是 3 字节；emoji 这类 4 字节的会低估，界面上"约"的口径与它一致）。
 */
function utf8BytesOf(text: string): number {
	const s = String(text == null ? "" : text);
	try {
		const TE = (globalThis as { TextEncoder?: new () => { encode(v: string): { length: number } } }).TextEncoder;
		if (typeof TE === "function") return new TE().encode(s).length;
	} catch (e) {
		// 退化到数码点
	}
	let n = 0;
	for (const ch of s) n += ch.codePointAt(0)! < 0x80 ? 1 : 3;
	return n;
}

/** `20260918` → `2026-09-18`（认不出就原样返回，不编日期） */
function dashDate(ymd: unknown): string {
	const s = String(ymd == null ? "" : ymd);
	return /^\d{8}$/.test(s) ? s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8) : s;
}

/** 绝对路径（功能根 + 相对路径，正斜杠） */
function joinAbs(root: string, rel: string): string {
	return String(root).replace(/\\+$/, "") + "/" + String(rel).replace(/\\/g, "/");
}

export interface DraftWorkfaceOptions {
	/** 功能根（`<sr 根>/features/<主题>`） */
	root: string;
	/** `gdd\` 里的文件（来自 `loadFeatureDetail`；含成稿与定稿，本层按 kind 挑） */
	gddFiles: GddFile[];
	/** `evidence\` 里的文件（读回回执在这里） */
	evidenceFiles?: string[];
	/** 定稿有效性（`loadFeatureDetail` 的 `finalCheck`）—— "当前有效定稿"只有一个来源 */
	finalCheck?: { current?: string | null; currentFrom?: string; issues?: unknown[] } | null;
	/**
	 * ★ 工单 25 · **定稿门**（`loadFeatureDetail` 的 `gate`，原样搬过来）。
	 *   「合流 → 定稿」这一步的落点就是它：整合完之后这份定稿**能不能交程序**。
	 *   ★ 判据只有一份实现（`../pure/finalgate.ts`）—— 这里只搬，不在这一层重算。
	 */
	gate?: unknown;
	/**
	 * 配置表目录（看板给的 `configRoot`；来自 sr 配置，不是猜的）。
	 * ★ 有它就以**磁盘实际列举**为准：`§6 引用的工作簿在不在` 这件事必须看真目录 ——
	 *   看板按主题挂上来的 `configs` 只认文件名里的主题（`A012-全局变量表.xlsx` 的主题是
	 *   "全局变量表"，挂不到 `联盟悬赏` 上），拿它判存在性会**凭空报缺件**。
	 */
	configRoot?: string;
	signal?: AbortSignal;
}

const absOf = (root: string, rel: string) => String(root).replace(/\\+$/, "") + "/" + String(rel).replace(/\\/g, "/");

/** 成稿候选：`gdd\` 顶层里 `gddKindOf` 判为 `draft` 的那些（**不按文件名猜**） */
function draftsOf(files: GddFile[]): GddFile[] {
	return (Array.isArray(files) ? files : [])
		.filter((f) => f && f.name && !f.subdir && f.kind === "draft")
		.sort((a, b) => (dateOf(a.name) < dateOf(b.name) ? 1 : -1));   // 新的在前
}

/**
 * 读一个功能的成稿 → 文档生成工作面的视图模型。
 *
 * @returns `{ root, doc, path, name, head, config, configFiles, notes }`
 *   · `doc` —— `draftDocOf` 的结论（两大部分 + 左树 + 章清单）；没有成稿时为 `null`
 *   · `path` / `name` / `head` —— 当前这份成稿（面板上"读的是哪一版"要看得见）
 *   · `config` —— `configBranchState` 的结论（配置支线走到哪）
 *   · `notes` —— 缺件与降级说明（如实列出）
 */
export async function loadDraftWorkface(port: WorkspacePort, options: DraftWorkfaceOptions): Promise<any> {
	const root = String((options && options.root) || "").replace(/\\+$/, "");
	const signal = options && options.signal;
	const notes: string[] = [];
	const drafts = draftsOf((options && options.gddFiles) || []);
	const current = drafts[0] || null;

	// ── ① 当前这份成稿 ────────────────────────────────────────────
	let path = "";
	let name = "";
	let head: Record<string, unknown> | null = null;
	let doc: ReturnType<typeof draftDocOf> | null = null;
	/** 成稿全文（字节数进"人话"里的 KB；读不到就是空串） */
	let raw = "";
	if (!current) {
		notes.push("gdd\\ 里没有成稿（`<主题>_<日期>.md`，头部 `doc_type: draft_gdd`）—— 这一屏的第一个动作就是「写成稿」。");
	} else {
		name = current.name;
		path = absOf(root, String(current.rel || "gdd/" + current.name));
		const h = await readHead(port, path, signal);
		if (h === null) {
			notes.push("成稿 `" + name + "` 读不到开头（拿不到 doc_type / status）。");
		} else {
			head = parseFrontmatter(h) || null;
			if (head && head.doc_type && String(head.doc_type) !== "draft_gdd") {
				notes.push("这份文件的 `doc_type` 是 `" + String(head.doc_type) + "`，不是 `draft_gdd` —— 面板按 `gddKindOf`（文件名）把它当成了成稿，两者不一致时界面上的状态以头部字段为准。");
			}
		}
		const text = await readAllText(port, path, signal, 3000);
		if (text === null) {
			notes.push("成稿 `" + name + "` 读不动正文 —— 两大部分与左树本屏为空。");
		} else {
			raw = text;
			doc = draftDocOf(text, undefined);
			if (!doc.complete) {
				notes.push("没认出「" + doc.missingParts.join("」与「") + "」这两大部分里的全部 —— 面板按章标题关键词认，认不出来就如实说认不出来（不硬指一个章号）。");
			}
			if (drafts.length > 1) {
				notes.push("gdd\\ 里有 " + drafts.length + " 份成稿（" + drafts.map((d) => d.name).join(" / ") + "）—— 本屏读的是**日期最新**的那一份。");
			}
		}
	}

	// ── ② 定稿（配置契约的载体）────────────────────────────────────
	const finals = (Array.isArray(options && options.gddFiles) ? options.gddFiles : [])
		.filter((f) => f && f.name && !f.subdir && f.kind === "final")
		.sort((a, b) => (dateOf(a.name) < dateOf(b.name) ? 1 : -1));
	const cur = (options && options.finalCheck && options.finalCheck.current) || "";
	const finalName = cur || (finals[0] ? finals[0].name : "");
	let finalHead: Record<string, unknown> | null = null;
	let contract = parseConfigContract("");
	if (finalName) {
		const fp = absOf(root, "gdd/" + finalName);
		const fh = await readHead(port, fp, signal);
		if (fh === null) notes.push("定稿 `" + finalName + "` 读不到开头（拿不到 doc_type / status）。");
		else finalHead = parseFrontmatter(fh) || null;
		const ftext = await readAllText(port, fp, signal, 3000);
		if (ftext === null) notes.push("定稿 `" + finalName + "` 读不动正文 —— 配置支线只能报到「有定稿」为止。");
		else contract = parseConfigContract(ftext);
		if (finals.length > 1 && cur) {
			notes.push("gdd\\ 里有 " + finals.length + " 份定稿 —— 配置契约读的是**当前有效**那一份（`" + cur + "`，" +
				String((options.finalCheck && options.finalCheck.currentFrom) === "active" ? "按 active 标记判定" : "按文件名日期判定") + "）。");
		}
	}

	// ── ③ 读回回执 + 配置表存在性 ──────────────────────────────────
	const rbs = readbacksOf((options && options.evidenceFiles) || []);
	/**
	 * 配置表文件名：**以配置目录的实际列举为准**（`configRoot` 由看板从 sr 配置里取）。
	 * 列不出来时退回看板按主题挂上来的那份，并在 `notes` 里如实说明 —— 不假装核过了。
	 */
	let configFiles = ((options && options.configFiles) || []).map(String).filter((x) => x !== "");
	const cfgRoot = String((options && options.configRoot) || "").replace(/[\\/]+$/, "");
	if (cfgRoot !== "") {
		try {
			const names = await listFiles(port, cfgRoot, signal, true);
			const sheets = names.filter((n) => /\.xlsx?m?$/i.test(n));
			if (sheets.length === 0) {
				notes.push("配置目录 `" + cfgRoot + "` 里一个工作簿都没列到 —— 工作簿存在性这一项按“核不了”处理（不编缺件）。");
			} else {
				configFiles = sheets;
			}
		} catch (e) {
			notes.push("配置目录 `" + cfgRoot + "` 列举失败：" + String((e && e.message) || e) + " —— 工作簿存在性退回看板给的清单。");
		}
	}
	/** §6 引用的工作簿 → 配置目录里有没有同名文件（**只比文件名**，不解析工作簿） */
	const referencedMissing = (contract.workbooks || []).filter((w) => configFiles.indexOf(w) < 0);

	const branch = configBranchState({
		draft: {
			exists: !!doc, name: name, status: String((head && head.status) || ""),
			docType: String((head && head.doc_type) || ""), line: (doc && (doc.chapters[0] || {}).line) || 1,
			archived: String((head && head.status) || "").toLowerCase() === "archived"
		},
		final: {
			exists: !!finalName, name: finalName, status: String((finalHead && finalHead.status) || ""),
			docType: String((finalHead && finalHead.doc_type) || ""), line: contract.line || 1
		},
		contract: contract,
		referencedMissing: referencedMissing,
		readbacks: rbs,
		configFiles: configFiles
	});

	// 主题（从成稿文件名派生，用于动作里的产出命名）
	const topic = name ? topicOf(name) : "";

	// ── ④ 两条支线的**人话状态**（工单 24c）─────────────────────────────────
	// ★ 状态文字**只在这里成形一次**（`configBranchStory` / `wireBranchStory` 是纯函数、有回归网）：
	//   界面上看到的与指令里带的是同一份字符串，不存在"界面再拼一遍"。
	// ★ 界面图：`gdd\UI\` 里的真文件。**两个来源**（先看 detail 的清单，再核磁盘列举）——
	//   两处都指向同一个目录，取并集并如实说明哪个来源认的（不猜、不假装核过）。
	const storyA = configBranchStory(branch);
	let images = ((options && options.gddFiles) || [])
		.filter((f) => f && f.name && String(f.subdir || "") !== "" && /^ui$/i.test(String(f.subdir)) && IMAGE_RE.test(f.name))
		.map((f) => {
			const rel = String(f.rel || "gdd/" + f.subdir + "/" + f.name);
			return { name: String(f.name), rel: rel, abs: joinAbs(root, rel) };
		});
	let uiWhy = "";
	if (root !== "") {
		try {
			const listed = await listFiles(port, root + "/gdd/UI", signal, false);
			const imgs = listed.filter((n) => IMAGE_RE.test(n));
			if (imgs.length) {
				const have: Record<string, boolean> = {};
				for (const x of images) have[x.name] = true;
				images = images.concat(imgs.filter((n) => !have[n]).map((n) => ({
					name: n, rel: "gdd/UI/" + n, abs: joinAbs(root, "gdd/UI/" + n)
				})));
			}
		} catch (e) {
			// 列不出来**不编**：如实说明这一项没核到，并把清单来源讲清
			uiWhy = "`gdd/UI/` 这次列不出来（" + String((e && e.message) || e) + "）—— 界面图清单用的是产物清单里的那些。";
			if (images.length === 0) {
				uiWhy = "`gdd/UI/` 这次列不出来（" + String((e && e.message) || e) + "），产物清单里也没有 `gdd\\UI\\` 的图片 —— 这一项**没核到**。";
			}
		}
	}
	images = images.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
	const storyB = wireBranchStory({ ascii: (doc && doc.ascii) || [], images: images, why: uiWhy });

	return {
		root: root,
		path: path,
		name: name,
		head: head,
		topic: topic,
		doc: doc,
		/** 成稿的 1-based 行数 / 字节数 / KB（人话里的「39 KB」）与文件名里的日期（人话里的「2026-09-18」） */
		lines: (doc && doc.lines) || 0,
		bytes: utf8BytesOf(raw),
		kb: kbOf(utf8BytesOf(raw)),
		date: dashDate(dateOf(name)),
		/** ★ 两条支线的人话状态（界面直接念；`mis` 里保留机器口径供「详情」核对） */
		story: { config: storyA.story, wire: storyB.story },
		configMis: storyA.mis,
		wireLabel: storyB.label,
		/** §5 里的 ASCII 占位（支线 B 的现状原文） */
		ascii: (doc && doc.ascii) || [],
		/** `gdd\UI\` 里的界面图（支线 B 的唯一可靠输入） */
		uiImages: images,
		uiWhy: uiWhy,
		drafts: drafts.map((d) => d.name),
		finalName: finalName,
		finalHead: finalHead,
		/** ★ 工单 25 · 定稿门（能不能交程序）—— 原样来自 `loadFeatureDetail` 的 `gate` */
		gate: (options && options.gate) || null,
		config: branch,
		configFiles: configFiles,
		evidence: rbs,
		notes: notes
	};
}

