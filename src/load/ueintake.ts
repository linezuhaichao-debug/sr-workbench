/**
 * 外部输入合入 ①②③ 的**加载器**（工单 26）—— **只吃 port**，只读。
 *
 * 它只做 IO 与编排，判定全在 `../pure/ueintake.ts`（有测试）：
 *   ① 工作区根那一层列 zip（面板按**文件名**认交付包；`cwd` = 索引会话的 SR 工作区根）；
 *   ② 该功能的 `source\` 桶里列归档位（`UE交付_<日期>` 子目录 + 它里面的文件；**只列两层**，
 *      所以归档指令里明写"不要带外层包名那一层"）；
 *   ③ 读三份原文：`manifest.json` · `02_交互回写文档.md` · 当前有效定稿全文；
 *   ④ 交付台账里那两个小 JSON（`包契约档案_*.json` / `下游发布状态.json`）—— ② 的
 *      "当前已发布到哪一版"就来自它们（设计 §4.3.5 的实测案例：`v1.1` / 09-23 13:40）。
 *
 * ★ 面板**不写盘**（`CONTEXT.md`「面板只读 / agent 执行」）：解压与归位是 agent 按归档指令做的，
 *   这一层永远只读它。读不到就是读不到 —— 如实交给纯函数判成 `unknown`，不猜、不默认最新。
 * ★ 台账读不到**不阻塞**：② 会降级成 `unknown`（"面板看不到依据"），而不是编一个"最新"。
 */

import {
	archiveDirNameOf, ueIntakeRows
} from "../pure/ueintake.ts";
import type { CurrentFinalRef, FeatureRef, UeIntakeRows } from "../pure/ueintake.ts";
import type { WorkspacePort } from "../port/types.ts";
import { listDirs, listFiles, readAllText } from "./read.ts";

export interface UeIntakeOptions {
	/** 功能根（绝对路径） */
	root: string;
	/** 功能主题（目录名） */
	topic?: string;
	/** 功能身份（看板给；别名匹配用） */
	features?: FeatureRef[];
	/** 看板给的全部功能（用于"这个包对着谁"，与 `features` 二选一） */
	allFeatures?: FeatureRef[];
	/** 当前有效定稿（`loadFeatureDetail` 的 `final` + `finalCheck.actives`） */
	final?: CurrentFinalRef | null;
	/** **索引会话**的 cwd（= SR 工作区根）；列 zip 就列它 */
	srWs?: string;
	/** 面板给的今天（`YYYYMMDD`） */
	compact?: string;
	signal?: AbortSignal;
}

/** 读文本（拿不到给 `null` —— **同一个 `null` 表示"读不到"**，与纯函数的约定一致） */
async function readText(port: WorkspacePort, abs: string, signal?: AbortSignal, cap = 20000): Promise<string | null> {
	try {
		return await readAllText(port, abs, signal, cap);
	} catch (e) {
		return null;
	}
}

/** 从 JSON 文本里取一个字段（读不到 / 不是 JSON 给空串） */
function fieldOf(text: string | null, key: string): string {
	if (!text) return "";
	try {
		const j = JSON.parse(text);
		return String((j && j[key]) || "");
	} catch (e) {
		return "";
	}
}

/** 把台账里的 `published_at`（ISO）拼成人话 `2026-09-23 13:40`；给不进来就空串 */
function humanAt(publishedAt: string): string {
	if (publishedAt) {
		const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(publishedAt);
		if (m) return m[1] + "-" + m[2] + "-" + m[3] + " " + m[4] + ":" + m[5];
		return publishedAt;
	}
	return "";
}

/** 包名里的主题段（`SR_联盟讨伐_交互交付物_20260928_1510.zip` → `联盟讨伐`；认不出来给空串） */
function zipTopicOf(zip: string): string {
	const m = /^(.*)_交互交付物_/.exec(String(zip).replace(/\.zip$/i, ""));
	return m ? oneLineOf(m[1]).replace(/^SR[_-]?/i, "") : "";
}

/** 去掉首尾空白（本地小工具，避免为一行引一个模块） */
function oneLineOf(v: unknown): string {
	return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
}

/** 功能的名字与别名（看板给的身份） */
function aliasesOf(f: FeatureRef | undefined): string[] {
	if (!f) return [];
	const out: string[] = [];
	const nm = oneLineOf(f.name);
	if (nm !== "") out.push(nm);
	for (const a of (Array.isArray(f.aliases) ? f.aliases : [])) {
		const v = oneLineOf(a);
		if (v !== "" && out.indexOf(v) < 0) out.push(v);
	}
	return out;
}

/**
 * 加载 ①②③ 的行视图。
 *
 * @returns `ueIntakeRows(...)` 的结果（`identify` / `baseline` / `rows` / `archive` / `notes` …）
 *   · `identify.isDelivery` —— 是不是一类 UE 交互交付包（名称形状 + 包内结构两条判据）
 *   · `baseline.state` —— `fresh` / `stale` / `unknown`（`unknown` = 面板看不到依据）
 *   · `rows[].status` —— `ok` / `danger`（★ 已删条目：照单执行会改回来）/ `missing` / `note`
 */
export async function loadUeIntake(port: WorkspacePort, options: UeIntakeOptions): Promise<UeIntakeRows & { root: string; zipAtWs: string; pkgDir: string }> {
	const root = String(options.root || "").replace(/[\\/]+$/, "");
	const signal = options.signal;
	const srWs = String(options.srWs || "").replace(/[\\/]+$/, "");

	// ── ① 工作区根那一层列 zip（这一屏只认**对着本功能**的那一个）─────
	//   ★ 真机上工作区根**同时躺着两个包**（联盟讨伐 / 神话宝库），所以不能拿"第一个"当答案：
	//     按"包名的主题段 ∈ 本功能的名字/别名/目录名"筛；筛不出唯一一个就**如实降级**
	//     （`identify` 会报"还要你定"），并且**绝不静默挑一个**。
	const topic = String(options.topic || "");
	const me = (options.features || []).filter((f) => String(f && f.topic) === topic)[0];
	const names = [topic].concat(aliasesOf(me)).filter((x) => x !== "");
	let zipsAll: string[] = [];
	let listNote = "";
	if (srWs !== "") {
		try {
			zipsAll = (await listFiles(port, srWs, signal, true)).filter((n) => /\.zip$/i.test(n));
		} catch (e) {
			listNote = "列不出来工作区根 `" + srWs + "`：" + String((e && e.message) || e);
		}
	} else {
		listNote = "面板拿不到 SR 工作区根（索引会话的 cwd）—— 工作区根那一层列不到。";
	}
	// 交付包形状的优先（`*_交互交付物_*`）；再按"主题段 = 本功能的名字/别名/目录名"筛
	const shaped = zipsAll.filter((n) => /_交互交付物_/.test(n));
	const mine = shaped.filter((n) => names.indexOf(zipTopicOf(n)) >= 0);
	const zips = (mine.length ? mine : shaped).slice().sort();
	const chosen = zips[0] || "";

	// ── ② 该功能的 `source\` 桶：归档位（`UE交付_<日期>`）与它里面的文件 ──
	//   ★ 归档位里还有**再下一层**（`截图\` / `流程图\`）；面板的列举是"桶 → 子目录"两层，
	//     所以这里对归档位逐个再列一层 —— 不列的话看不出包里有没有截图（⑥ 的图源就在那儿）。
	let sourceSubs: string[] = [];
	let nested: Record<string, string[]> = {};
	const nestedDirs: Record<string, string[]> = {};
	if (root !== "") {
		sourceSubs = (await listDirs(port, root + "/source", signal, true)).filter((n) => /^UE交付_/i.test(n));
		for (const sub of sourceSubs) {
			nested[sub] = await listFiles(port, root + "/source/" + sub, signal, true);
			const subdirs = await listDirs(port, root + "/source/" + sub, signal, true);
			nestedDirs[sub] = subdirs;
			for (const sd of subdirs) {
				// 再下一层的**文件名**也要，但不必再往下（设计的包结构就到这一层）
				const files = await listFiles(port, root + "/source/" + sub + "/" + sd, signal, true);
				for (const f of files) nested[sub].push(sd + "/" + f);
			}
		}
	}

	/**
	 * ★ 交给判定的"包内条目"要把**目录也算进去**（`截图/` 这样的目录名不会出现在文件名里）——
	 *   设计 §4.3.5 的六探针有两条是目录（`截图\` / `流程图\`），只喂文件名那一层是认不出来的（实测踩过）。
	 *   做法：每个文件条目补上它的**各级父目录**（`<归档位>/截图/01_x.png` → 再加 `<归档位>/截图`）。
	 *   这样面板看到的"包内结构"与真交付包里的形状一致，而不是"我以为的形状"。
	 */
	const dateInZip = (/(\d{8})/.exec(chosen.replace(/^.*_交互交付物_/, "")) || [])[1] || "";
	const wantName = dateInZip ? archiveDirNameOf(dateInZip) : "";
	const pick = (wantName && sourceSubs.indexOf(wantName) >= 0)
		? wantName
		: (sourceSubs.length ? sourceSubs.slice().sort().reverse()[0] : "");

	// ── ③ 三份原文 ────────────────────────────────────────────
	const pkgDir = pick !== "" ? root + "/source/" + pick : "";
	const pkgFiles = pick !== "" ? (nested[pick] || []) : [];
	/**
	 * ★ 交给判定的"包内条目"要把**目录也算进去**（`截图/` 这样的目录名不会出现在文件名里）——
	 *   设计 §4.3.5 的六探针有两条是目录（`截图\` / `流程图\`），只喂文件名那一层是认不出来的（实测踩过）。
	 *   做法：每个文件条目补上它的**各级父目录**（`<归档位>/截图/01_x.png` → 再加 `<归档位>/截图`）。
	 *   这样面板看到的"包内结构"与真交付包里的形状一致，而不是"我以为的形状"。
	 */
	const entriesWithDirs = (() => {
		const out: string[] = [];
		const add = (s: string) => { if (s !== "" && out.indexOf(s) < 0) out.push(s); };
		for (const sd of (nestedDirs[pick] || [])) add((pick ? pick + "/" : "") + sd);   // 目录本身（`截图`）
		for (const n of pkgFiles) {
			const rel = (pick ? pick + "/" : "") + n;
			add(rel);
			const parts = rel.split("/");
			for (let i = 1; i < parts.length; i++) add(parts.slice(0, i).join("/"));
		}
		return out;
	})();
	const manifestText = pick !== "" ? await readText(port, pkgDir + "/manifest.json", signal, 600) : null;
	const docName = pkgFiles.filter((n) => /交互回写文档/i.test(n))[0] || "02_交互回写文档.md";
	const docText = pick !== "" ? await readText(port, pkgDir + "/" + docName, signal, 900) : null;

	// 当前有效定稿全文（没有定稿就不读）
	const fin = options.final || null;
	const finalText = (fin && fin.name) ? await readText(port, root + "/gdd/" + fin.name, signal, 6000) : null;

	// ── ④ 交付台账（"当前已发布到哪一版"）───────────────────────
	/**
	 * ★ 台账目录用的是**交付时的功能名**，而那可能是**旧名/别名**：
	 *   实测 `running 包` 目录叫 `运行包_联盟悬赏`，而功能现在已经改成 `讨伐`（身份名 `联盟讨伐`）
	 *   —— 只按身份名找会直接判"看不到台账"（② 就永远比不了版本号，那条 ★ 判据等于作废）。
	 *   所以候选名按「身份名 → 目录名 → 别名」逐个试，**并且验一下那个目录真的存在**
	 *   （`下游发布状态.json` 读得到才算）—— 不猜、不编。
	 */
	const candNames: string[] = [];
	const nameOfFeature = (me && me.name) ? oneLineOf(me.name) : topic;
	for (const n of [nameOfFeature, topic].concat(aliasesOf(me))) {
		const v = oneLineOf(n);
		if (v !== "" && candNames.indexOf(v) < 0) candNames.push(v);
	}
	let pkgRoot = "";
	let pubText: string | null = null;
	let ledgerTried: string[] = [];
	if (srWs !== "") {
		for (const n of candNames) {
			const cand = srWs + "/运行包_" + n;
			ledgerTried.push(cand);
			const t = await readText(port, cand + "/下游发布状态.json", signal, 200);
			if (t !== null) { pkgRoot = cand; pubText = t; break; }
		}
	}
	let published = "";
	let publishedAt = "";
	let publishedNote = "";
	let ledgerNote = "";
	if (pkgRoot === "" && ledgerTried.length) {
		ledgerNote = "读不到交付台账（试过 " + ledgerTried.join(" / ") + " 下的 `下游发布状态.json`）—— " +
			"「当前已发布到哪一版」这一条判不了（② 会降级成「面板看不到依据」）。";
	}
	if (pkgRoot !== "") {
		published = fieldOf(pubText, "version");
		publishedAt = fieldOf(pubText, "published_at");
		const files = await listFiles(port, pkgRoot + "/03_AI过程档案_策划通常无需处理", signal, true);
		const wb = files.filter((n) => /^写回事件_/.test(n))[0] || "";
		if (wb) {
			const wbText = await readText(port, pkgRoot + "/03_AI过程档案_策划通常无需处理/" + wb, signal, 200);
			const chs = (() => {
				try {
					const j = JSON.parse(wbText || "{}");
					return (Array.isArray(j && j.changes) ? j.changes : []).map((c: any) => String((c && c.id) || "") + " " + String((c && c.section) || "")).filter((x: string) => x.trim() !== "");
				} catch (e) { return []; }
			})();
			if (chs.length) publishedNote = wb.replace(/\.json$/i, "") + "（" + chs.join(" + ") + "）";
		}
	}

	// ── ⑤ 成稿全文（⑤ 线框图替换的 §5 ASCII 现状）───────────────
	//   只看 `gdd\` 顶层里名字带日期的 md，取日期最新的那一份 —— 与 `load/draft` 同一条口径。
	let draftPath = "";
	let draftText: string | null = null;
	if (root !== "") {
		const gddFiles = await listFiles(port, root + "/gdd", signal, true);
		const cands = gddFiles.filter((n) => /\.md$/i.test(n) && !/定稿|审查/.test(n))
			.map((n) => ({ n: n, d: (/(\d{8})/.exec(n) || [])[1] || "" }))
			.filter((x) => x.d !== "")
			.sort((a, b) => (a.d < b.d ? 1 : -1));
		if (cands.length) {
			draftPath = root + "/gdd/" + cands[0].n;
			draftText = await readText(port, draftPath, signal, 3000);
		}
	}

	// ── 组装 ─────────────────────────────────────────────────
	const rows = ueIntakeRows({
		zipFile: chosen,
		zipAtWs: (srWs !== "" && chosen) ? srWs + "\\" + chosen : "",
		entries: entriesWithDirs,
		manifest: manifestText,
		doc: docText,
		docName: docName,
		finalText: finalText,
		final: fin,
		features: options.allFeatures || options.features || [],
		root: root,
		published: published,
		publishedAt: humanAt(publishedAt),
		publishedNote: publishedNote,
		present: pkgFiles,
		draftText: draftText || "",
		draftPath: draftPath,
		compact: options.compact
	});

	const notes = rows.notes.slice();
	if (listNote) notes.push(listNote);
	if (ledgerNote) notes.push(ledgerNote);
	if (zipsAll.length === 0) {
		notes.push("工作区根那一层**没列到任何 zip**" + (srWs ? "（列的是 " + srWs + "）" : "") +
			" —— 交付包不在那一层，或它已经归位到 `source\\` 里了（那就看「归档位」那一栏）。");
	} else if (shaped.length === 0) {
		notes.push("工作区根上有 " + zipsAll.length + " 个 zip，但**没有一个**长成交付包的样子（`<主题>_交互交付物_<日期>.zip`）：" + zipsAll.join(" · "));
	} else if (mine.length === 0) {
		notes.push("工作区根上的交付包**没有一个对着本功能**（按名字/别名/目录名比过）：" + shaped.join(" · ") +
			" —— 面板不替你挑；先确认这一包是给哪个功能的。");
	}
	if (zips.length > 1) {
		notes.push("对着本功能的交付包有 " + zips.length + " 个（" + zips.join(" · ") + "）—— 一号位 `" + chosen +
			"`" + (zips.length > 1 && /\(\d+\)\.zip$/i.test(zips[1]) ? "；带 `(1)` 的那个是浏览器重复下载的副本" : "") + "。");
	}
	if (sourceSubs.length && pick !== "") {
		notes.push("归档位读到 " + sourceSubs.length + " 个 `UE交付_*` 目录，这一屏看的是 `" + pick + "`（" + pkgFiles.length + " 个文件）。");
	}
	if (finalText === null && fin && fin.name) {
		notes.push("当前有效定稿 `" + fin.name + "` **读不到正文** —— ③ 的条目定位与「已删条目」判定本轮都做不了（② 的部分依据仍在）。");
	}

	return Object.assign({}, rows, {
		notes: notes, root: root, zipAtWs: (srWs !== "" && chosen) ? srWs + "\\" + chosen : "", pkgDir: pkgDir
	});
}
