/**
 * ⑤ 线框图替换（工单 27）—— **纯函数层**（零 IO、零时钟、零全局）。
 *
 * 设计出处：`策划工作台-设计定稿.md` §4.3.5 表格第 ⑤ 格「**线框图替换**：用交付的图替换 §5 的 ASCII 图」（L279）
 * 与 §4.2 的支线 B（`draftstep.ts:718` 的手动入口：「手动提交线框图，替换 §5 的 ASCII 图」）。
 *
 * ── 这一票把"替换"落到可核对的四件事上 ───────────────────────────────────────
 *   ① **两个入口共用同一能力**：本模块只做"算**哪些组要换成哪张图**"，
 *      正文一律交给 `draftstep.buildDraftInstruction({action:"wireframe"})` ——
 *      交付包入口（`ueIntakeRows.wireframe`）与「文档生成 › 线框图」手动入口走的是**同一处组装**。
 *   ② **替换 = 改真定稿 §5**：交付包入口的目标文件是**当前有效定稿**（`gdd\<定稿>.md`），
 *      图落在**功能目录内**（`gdd\UI\`）—— 图跟着定稿走，不散落在别处。
 *   ③ **替换前后可对照**：`before` 是现状原文（ASCII 占位块 + 行号，或已有的图 + 行号），
 *      `after` 是要变成什么（哪张图 + 落到哪个相对路径 + alt）—— 两边都逐字给，界面上直接摆。
 *   ④ **不破结构**：`hold` 是这一轮**不许动**的东西（§5.x 组号 / UI-M* / UE* 条目），
 *      指令里写死；替换后仍要能过「定稿修订」工作面（左树行号 / 条目引用 / 六类边）。
 *
 * ── 三条降级纪律（与 `derived.ts` / `ueintake.ts` 同一条产品契约）────────────────
 *   · 读不到成稿 / 定稿 / 图 ⇒ 如实降级成 `unknown`，**绝不假装"已经换好了"**；
 *   · **认不出就不猜**：组里那张图与交付截图对不上时，报"对不上"并点名缺什么，
 *     不替用户挑一张（`status = "unmatched"`）；
 *   · `blocked` + `next` 一起给：缺前提时**不发指令**，界面照原样显示。
 *
 * ★ 面板**不写盘**（`CONTEXT.md`「面板只读 / agent 执行」）：替换由**指令让 agent 改**，
 *   用户在面板上点；本模块只算"改成什么样"与"怎么改才可回滚"。
 */

import { draftDocOf } from "./drafttree.ts";
import { parseFinalGdd } from "./finalgdd.ts";

// ════════════════════════════════════════════════════════════════
// 〇、小工具（与 ueintake.ts / derived.ts 同口径）
// ════════════════════════════════════════════════════════════════

function oneLine(v: unknown): string {
	return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
}

function winOf(p: unknown): string {
	return String(p == null ? "" : p).replace(/[\\/]+$/, "").replace(/\//g, "\\");
}

/** 文件名（不带目录、去扩展名）—— 图与图比对一律用它 */
function stemOf(p: unknown): string {
	const s = winOf(p);
	const i = s.lastIndexOf("\\");
	return (i >= 0 ? s.slice(i + 1) : s).replace(/\.[a-z0-9]+$/i, "");
}

/** 相对路径里的文件名（保留扩展名） */
function fileOf(p: unknown): string {
	const s = winOf(p);
	const i = s.lastIndexOf("\\");
	return i >= 0 ? s.slice(i + 1) : s;
}

// ════════════════════════════════════════════════════════════════
// 一、§5 的现状：ASCII 占位（成稿/定稿都可能还有）与已有的图
// ════════════════════════════════════════════════════════════════

/** §5 里**已有的一张图**（定稿侧：`<img src>` 所在组的块） */
export interface UiImage {
	/** 所属界面组（`UI-M1`） */
	id: string;
	/** 组号（`5.1`） */
	no: string;
	/** 组标题 */
	title: string;
	/** 1-based 行号（那张 `<img>` 所在行） */
	line: number;
	/** `<img src>` 原文（定稿里那一串，逐字） */
	src: string;
	/** `alt` 原文（拿不到给空串） */
	alt: string;
	/** 文件名（`UI-M1 联盟悬赏主面板 · 常规难度.png`） */
	file: string;
}

/** 从一份 md 全文里抠出 §5.x UI-M* 组**自己**的图（组头 → 下一个组头/章头之间的 `<img>`） */
export function uiImagesOf(text: unknown): UiImage[] {
	const src = String(text == null ? "" : text);
	if (src === "") return [];
	const lines = src.split(/\r?\n/);
	const out: UiImage[] = [];
	let cur: { id: string; no: string; title: string; line: number } | null = null;
	for (let i = 0; i < lines.length; i++) {
		const m = /^###\s+(\d+\.\d+)\s+(UI-M\d+)\s*(.*)$/i.exec(lines[i]);
		if (m) {
			cur = { id: m[2].toUpperCase(), no: m[1], title: oneLine(m[3] || m[2]), line: i + 1 };
			continue;
		}
		if (/^#{2,3}\s+/.test(lines[i])) { cur = null; continue; }
		if (!cur) continue;
		const re = /<img\s+[^>]*?src\s*=\s*["']([^"']+)["'][^>]*?\/?>/gi;
		let mm: RegExpExecArray | null;
		while ((mm = re.exec(lines[i])) !== null) {
			const alt = /alt\s*=\s*["']([^"']*)["']/i.exec(mm[0]);
			out.push({
				id: cur.id, no: cur.no, title: cur.title, line: i + 1,
				src: mm[1], alt: alt ? alt[1] : "", file: fileOf(mm[1])
			});
		}
	}
	return out;
}

// ════════════════════════════════════════════════════════════════
// 二、替换计划
// ════════════════════════════════════════════════════════════════

/**
 * §5 里的一处 ASCII 占位，按**它在哪个界面组名下**取（只认 level-3 `### 5.x UI-M*` 的组）。
 * ★ 为什么不直接用 `drafttree.asciiOf` 的条目：那是**整章**的形状（含 `§5.4 界面流程` 那种没有组标识的），
 *   而「这一组要不要换图」必须落到**具体界面组**上。所以按最后见到的组头归属，一个组只记第一处。
 */
function asciiByGroup(lines: string[]): Array<{ no: string; id: string; line: number; lines: number }> {
	const out: Array<{ no: string; id: string; line: number; lines: number }> = [];
	let cur: { no: string; id: string } | null = null;
	let inFence = false, fenceStart = 0, startGroup: { no: string; id: string } | null = null;
	for (let i = 0; i < lines.length; i++) {
		const h = /^###\s+(5\.\d+)\s+(UI-M\d+)/i.exec(lines[i]);
		if (!inFence && h) { cur = { no: h[1], id: h[2].toUpperCase() }; continue; }
		if (!inFence && /^#{2,3}\s+/.test(lines[i])) { cur = null; continue; }
		if (!inFence && /^\s*```text/.test(lines[i])) { inFence = true; fenceStart = i + 1; startGroup = cur; continue; }
		if (inFence && /^\s*```\s*$/.test(lines[i])) {
			inFence = false;
			if (startGroup && !out.some((x) => x.id === startGroup.id)) {
				let n = 0;
				for (let k = fenceStart; k < i; k++) if (lines[k].trim() !== "") n++;
				out.push({ no: startGroup.no, id: startGroup.id, line: fenceStart, lines: n });
			}
			startGroup = null;
			continue;
		}
	}
	return out;
}

/**
 * 一张图 / 一处占位在 §5 里的一行（**替换前后对照的那一行**）。
 *
 * ★ `kind` 先把两件事分开（实测踩过）：`§5.x UI-M*` 是**界面组**（要换的是它的界面图）；
 *   `§5.5 界面流程` 那种**没有组标识**的 ASCII 是**流程图**（它本来就是 ASCII，不是"等真图的占位"）。
 *   不分的话会把流程图的 1 处数进"还有 N 处 ASCII 占位要换"，把"几处"算虚。
 *
 * `action` 四档：`keep` 已就位（或流程图，不换）· `replace` 要换 ·
 * `unmatched` 对不上（**如实报，不替它挑一张**）· `none` 没图也没源。
 */
export interface SwapGroup {
	/** 界面组（`UI-M1`）；流程图那种没有标识的给空串 */
	id: string;
	/** 组号（`5.1` / `5.5`） */
	no: string;
	/** 组标题 */
	title: string;
	/** 组头行号（1-based） */
	line: number;
	/** `ui` 界面组 · `flow` 没有组标识的 ASCII（界面流程那种） */
	kind: "ui" | "flow";
	action: "keep" | "replace" | "unmatched" | "none";
	/** ★ 替换前：§5 里**现在**是什么（逐字原文 + 行号） */
	before: Array<{ line: number; src: string; alt: string; file: string }>;
	/** ★ 替换后：要变成什么（图源绝对路径 + 落到哪儿的相对路径 + alt） */
	after: Array<{ from: string; rel: string; alt: string; file: string }>;
	/** 对不上时缺什么（空串 = 没缺口） */
	miss: string;
	/** 认这一行的依据（人话） */
	why: string;
}

export interface SwapPlan {
	/** 目标定稿（要改的那一份）的绝对路径 */
	finalPath: string;
	/** 目标定稿的文件名 */
	finalName: string;
	/** 主题（功能身份名 / 目录名） */
	topic: string;
	/**
	 * 改哪儿（**两种口径都在**）：
	 *   · `blocks` = §5 里的 ASCII 占位（`drafttree.asciiOf` 的形状；`uiAscii` 才是"要换成图的占位"）；
	 *   · `groups` = 逐组的换图对照（定稿侧）。
	 */
	blocks: Array<{ no: string; id: string; title: string; line: number; lines: number }>;
	groups: SwapGroup[];
	/** 图源（交付包 `截图\` 或用户手动提交的图；绝对路径） */
	sources: Array<{ path: string; file: string; exists: boolean; note: string }>;
	/** 备份落点（**改之前先备份原定稿**） */
	backup: { path: string; how: string };
	/** 一句话结论（人话） */
	summary: string;
	/** 机读计数 */
	counts: {
		/** §5 里的 ASCII 围栏处数（含流程图） */
		ascii: number;
		/** 其中**界面组**的（= 要换成图的那种占位） */
		uiAscii: number;
		/** 其中**流程图**那种没有组标识的（不是"等真图"的占位） */
		flowAscii: number;
		keep: number; replace: number; unmatched: number; none: number;
		sources: number; missingSources: number;
	};
	/** 如实标注 */
	notes: string[];
	/** 缺前提时不发指令的理由（空串 = 可以发） */
	blocked: string;
	/** 缺前提时的下一步 */
	next: string;
}

/** ★ 备份落点（同目录、同扩展名的兄弟文件；**可逐字回滚**） */
function backupOf(finalPath: string, stamp: string): { path: string; how: string } {
	const p = winOf(finalPath);
	if (p === "") return { path: "", how: "" };
	const st = oneLine(stamp).replace(/[^0-9]/g, "").slice(0, 14) || "<YYYYMMDDHHMMSS>";
	const path = p + ".bak-工单27-" + st;
	return {
		path: path,
		how: "改之前先把原定稿**整份复制**成 `" + path + "`（同目录同扩展名，别只留 diff）；" +
			"回滚 = 把它复制回去覆盖定稿，再核一遍字节数与 `status: active`（见指令末尾的「回滚」那一段）。"
	};
}

/**
 * ⑤ 的**替换计划**（纯函数：调用方把读到的原文都传进来）。
 *
 * @param input.finalText   目标定稿全文（`null` / 空 = 读不到 ⇒ `blocked`）
 * @param input.finalPath   目标定稿绝对路径
 * @param input.topic       主题
 * @param input.shots      交付包 `截图\` 的绝对路径（图源之一）
 * @param input.manual     用户**手动提交**的图路径（图源之二；两个入口共用这一张表）
 * @param input.uiDir      图要落的目录（`<功能根>\gdd\UI`）
 * @param input.present    哪些图源**真的在盘上**（调用方 stat 过的文件名/绝对路径；空 = 没查）
 * @param input.draftText  成稿全文（**成稿侧**的 ASCII 现状；不传就看定稿自己）
 * @param input.draftPath  成稿绝对路径（手动入口的落点；交付包入口的落点是定稿）
 * @param input.stamp      面板给的时间戳（纯函数不吃时钟）
 */
export function buildSwapPlan(input: {
	finalText?: unknown;
	finalPath?: unknown;
	topic?: unknown;
	shots?: unknown[];
	manual?: unknown[];
	uiDir?: unknown;
	present?: unknown[];
	draftText?: unknown;
	draftPath?: unknown;
	stamp?: unknown;
}): SwapPlan {
	const inp = input || {};
	const finalPath = winOf(inp.finalPath);
	const finalName = fileOf(finalPath);
	const topic = oneLine(inp.topic);
	const finalText = String(inp.finalText == null ? "" : inp.finalText);
	const notes: string[] = [];
	const backup = backupOf(finalPath, inp.stamp);
	void topic;

	// ── 图源：交付包的 `截图\` + 用户手动提交的图（**同一张表**，两个入口共用）──
	const presentSet = (Array.isArray(inp.present) ? inp.present : []).map((x) => winOf(x).toLowerCase()).filter((x) => x !== "");
	const seen: Record<string, boolean> = {};
	const sources: SwapPlan["sources"] = [];
	const addSrc = (p: unknown, note: string) => {
		const w = winOf(p);
		if (w === "" || seen[w.toLowerCase()]) return;
		seen[w.toLowerCase()] = true;
		const exists = presentSet.length === 0
			? true                                   // 调用方没查盘 ⇒ 不冒充「在」/「不在」
			: presentSet.some((x) => x === w.toLowerCase() || x.endsWith("\\" + fileOf(w).toLowerCase()));
		sources.push({ path: w, file: fileOf(w), exists: exists, note: note });
	};
	for (const s of (Array.isArray(inp.shots) ? inp.shots : [])) addSrc(s, "交付包的 `截图\\`");
	for (const s of (Array.isArray(inp.manual) ? inp.manual : [])) addSrc(s, "手动提交");

	const missingSources = sources.filter((s) => !s.exists).length;

	// ── ASCII 占位（现有一个算一个）─────────────────────────────────
	//   ★ **舞台那一边**（`blocks`）：`draftText` 给的是"这条支线该改的那一份"的 §5 现状原文
	//     （交付包入口 = 成稿；定稿已经全是真图时它照样把成稿的占位摆出来给线框图用）。
	//   ★ **定稿那一边**（`finalAscii` / `uiAsciiInFinal`）：⑤ 要改的是**定稿**，
	//     所以"定稿自己还有几处界面组的 ASCII 占位"必须单独量 —— 不然会拿成稿的处数去说定稿的现状（实测踩过）。
	const finalLines = finalText.split(/\r?\n/);
	const uiAsciiInFinal = asciiByGroup(finalLines);
	const finalAscii = { fences: (finalText.match(/```text/g) || []).length, uiHeads: uiAsciiInFinal.length };
	const asciiSrc = String(inp.draftText == null || inp.draftText === "" ? finalText : inp.draftText);
	const doc = draftDocOf(asciiSrc);
	const blocks = (doc.ascii || []).slice();

	// ── 逐组：定稿侧现有的图 vs 图源 ───────────────────────────────
	const uiDir = winOf(inp.uiDir);
	const imgs = uiImagesOf(finalText);
	/**
	 * 组的清单 = 定稿 §5.x 的组头（`UI-M*` 是**界面组**；`5.4 界面流程` / `5.5 界面流程` 那种没有
	 * 组标识的是**流程图**）。没有图也照样列出来 —— 「这个组还没图」也是事实。
	 */
	const groupsInDoc: Array<{ id: string; no: string; title: string; line: number; kind: "ui" | "flow" }> = [];
	{
		const lines = finalText.split(/\r?\n/);
		// ★ 只认 §5 章里的组（`### 5.x …`）—— 写成 `\d+\.\d+` 会把 §6.1/§7 那些「表名」也当组收进来（实测踩过）
		for (let i = 0; i < lines.length; i++) {
			const m = /^###\s+(5\.\d+)\s+(.*)$/.exec(lines[i]);
			if (!m) continue;
			const um = /(UI-M\d+)\s*(.*)$/i.exec(m[2]);
			if (um) groupsInDoc.push({ id: um[1].toUpperCase(), no: m[1], title: oneLine(um[2] || um[1]), line: i + 1, kind: "ui" });
			else groupsInDoc.push({ id: "", no: m[1], title: oneLine(m[2]), line: i + 1, kind: "flow" });
		}
	}
	const groups: SwapGroup[] = [];
	/**
	 * 图源里"这一组的新版图"是哪几张。
	 * ★ 判据只能用**文件名**（面板拿不到二进制）：`UI-M1` 这种组号是图名里唯一稳定的标识 ⇒
	 *   只认 stem **以组号开头**（`UI-M1 主面板（新版）.png`）或 **stem 里带组号**（`开局·UI-M1 主面板.png`）。
	 *   实测踩过：第一版拿 `<img src>` 的相对路径（`UI/UI-M1 …`）去比 `indexOf("UI-M1") === 0`，
	 *   永远不成立 ⇒ 四个组全被判成"对不上"。
	 */
	const candOf = (gid: string) => {
		const up = gid.toUpperCase();
		return sources.filter((s) => {
			const t = stemOf(s.file).toUpperCase();
			return t.indexOf(up) === 0 || t.indexOf(up) > 0;
		});
	};
	for (const g of groupsInDoc) {
		const mine = g.id === "" ? [] : imgs.filter((x) => x.id === g.id);
		/** 这一张现有的图，能不能用图源里的某一张顶上（**同 stem** 才算"就是这一张"） */
		const pickFor = (cur: UiImage) => {
			const stem = stemOf(cur.src);
			const same = sources.filter((s) => stemOf(s.file).toLowerCase() === stem.toLowerCase());
			if (same.length) return same[0];
			return null;
		};
		const before = mine.map((x) => ({ line: x.line, src: x.src, alt: x.alt, file: x.file }));
		const after: SwapGroup["after"] = [];
		let action: SwapGroup["action"] = "none";
		let miss = "";
		let why = "";

		if (g.kind === "flow") {
			// 流程图：它本来就是 ASCII（`§5.5 界面流程` 那种），**不是**"等真图的占位" ⇒ 不换
			const blk = blocks.filter((b) => b.no === g.no && !b.id)[0] || null;
			action = blk ? "keep" : "none";
			why = blk
				? "`§" + g.no + " " + g.title + "` 的 ASCII（L" + blk.line + "，约 " + blk.lines + " 行）是**界面流程**，不是界面图占位 ⇒ **不换**（面板不把流程图算进「要换成图」的处数）"
				: "`§" + g.no + " " + g.title + "` 名下没有图也没有 ASCII 占位 ⇒ 面板看不出这一组要不要图（不猜）";
		} else if (!mine.length) {
			// 该组名下现在**没有图** ⇒ 若定稿 §5 里还有它的 ASCII 占位，这就是「要换成图」的那些组
			const blk = uiAsciiInFinal.filter((b) => b.id === g.id)[0] || null;
			action = blk ? "replace" : "none";
			why = blk
				? "`§" + g.no + " " + g.id + "` 现在是 **ASCII 占位**（**定稿里**那一处 ```text，L" + blk.line + "，约 " + blk.lines + " 行）⇒ 要整段换成图"
				: "`§" + g.no + " " + g.id + "` 名下**没有图**，定稿 §5 里也没有它的 ASCII 占位 ⇒ 面板看不出这一组要不要图（不猜）";
			const cand = candOf(g.id);
			if (action === "replace" && cand.length) {
				for (const c of cand) after.push({ from: c.path, rel: (uiDir ? uiDir + "\\" : "") + c.file, alt: g.id + " " + g.title, file: c.file });
			} else if (action === "replace") {
				action = "unmatched";
				miss = "图源里**没有**文件名带 `" + g.id + "` 的图（只有 " + sources.length + " 张：" +
					sources.slice(0, 3).map((s) => "`" + s.file + "`").join(" / ") + (sources.length > 3 ? " …" : "") + "）—— 面板不替这一组挑图";
			}
		} else {
			/**
			 * 该组名下有图 ⇒ 先把**同名**的挑出来（幂等的基础），剩下的才走"退一档"。
			 * ★ 三层，逐层都按文件名（面板拿不到二进制，文件名是唯一判据）：
			 *   ① 图源里有**同名**的那一张 ⇒ 这一张就换成它（`replace` 或 `keep` 由"名字变没变"定）；
			 *   ② 没有同名的 ⇒ 退一档：图源里有没有「这一组的新版图」（文件名带 `UI-M*`）；
			 *   ③ 连那个也没有 ⇒ `unmatched`（**如实报，不替它挑**）。
			 * ★ "同名"要**逐张独立**判、而且要**先把同名的全部配掉**再走退一档 ——
			 *   一锅端会让"两张现状里只有一张同名"的情况把另一张也算成要换（实测踩过）。
			 */
			const pairs: Array<{ cur: UiImage; hit: (typeof sources)[number] | null }> =
				mine.map((cur) => ({ cur: cur, hit: pickFor(cur) }));
			const unmatchedCurs = pairs.filter((p) => !p.hit).map((p) => p.cur);
			let anyUnmatched = false;
			// ① 同名的那些：图源里就是这一张 ⇒ 落点用图源的文件名（名字一样，`keep` 就看它）
			for (const p of pairs) {
				if (!p.hit) continue;
				after.push({
					from: p.hit.path, rel: (uiDir ? uiDir + "\\" : "") + p.hit.file,
					alt: p.cur.alt || (g.id + " " + g.title), file: p.hit.file
				});
			}
			for (const cur of unmatchedCurs) {
				const cand = candOf(g.id);
				if (cand.length) {
					for (const c of cand) after.push({ from: c.path, rel: (uiDir ? uiDir + "\\" : "") + c.file, alt: cur.alt || (g.id + " " + g.title), file: c.file });
				} else {
					anyUnmatched = true;
					if (!miss) {
						miss = "图源里**没有**与现状 `" + cur.file + "` 同名、也没有文件名带 `" + g.id + "` 的图 ⇒ 这一张换不了" +
							"（要换就先把图放进图源，或用「文档生成 › 线框图」的手动入口把路径写进去）";
					}
				}
			}
			if (anyUnmatched) {
				action = "unmatched";
				why = "现状有图，但图源里没有能顶上的那一张 ⇒ 如实报「对不上」，**不默认已经换好了**";
			} else {
				// 同名的那几张：`after` 与 `before` 的文件名逐个比，全一致就是 already-in-place
				const changed = after.length !== before.length ||
					after.some((a, i) => fileOf(a.file).toLowerCase() !== fileOf(before[i] ? before[i].file : "").toLowerCase());
				action = changed ? "replace" : "keep";
				why = changed
					? "现状那 " + before.length + " 张图与图源**不一致**（文件名对不上）⇒ 要换"
					: "现状那 " + before.length + " 张图与图源**文件名一致** ⇒ 已经就位（面板不重复换）";
			}
		}
		groups.push({
			id: g.id, no: g.no, title: g.title, line: g.line, kind: g.kind, action: action,
			before: before, after: after, miss: miss, why: why
		});
	}

	/** §5 里 ASCII 围栏的处数（含流程图）；`uiAscii` 才是"要换成图的占位" */
	const uiAscii = uiAsciiInFinal.length;
	const counts = {
		ascii: finalAscii.fences, uiAscii: uiAscii, flowAscii: Math.max(0, finalAscii.fences - uiAscii),
		keep: 0, replace: 0, unmatched: 0, none: 0, sources: sources.length, missingSources: missingSources
	};
	for (const g of groups) {
		// 流程图那一档不进 keep/none 的"界面组"计数（它不是界面组）
		if (g.kind === "flow") continue;
		counts[g.action] += 1;
	}

	// ── blocked / next（缺前提不静默）──────────────────────────────
	let blocked = "", next = "";
	if (finalPath === "" || finalText.trim() === "") {
		blocked = "⑤ 替换要改的是**当前有效定稿**，但面板读不到它的正文（或这个功能还没有定稿）。";
		next = "从「功能详情 › 产物」进来（面板会带上当前有效定稿的路径与正文）；没有定稿就先走「整合定稿」。";
	} else if (sources.length === 0) {
		blocked = "⑤ 替换需要**图源** —— 交付包的 `截图\\` 或你手动提交的图，一个都没有拿到。";
		next = "先把交付包归档（面板读回 `截图\\`），或在「文档生成 › 线框图」的手动入口里粘一条图路径（两个入口共用同一处组装）。";
	} else if (missingSources === sources.length && presentSet.length > 0) {
		blocked = "图源路径都在盘上**找不到**（" + sources.length + " 条全部缺失）—— 面板不拿不存在的图去换。";
		next = "先确认交付包真的归位了（`source\\UE交付_<日期>\\截图\\` 那 13 张 PNG 要在），或把图的真实路径贴进手动入口。";
	}

	const uiGroups = groups.filter((g) => g.kind === "ui");
	const summary = "⑤ 线框图替换：" + finalName + " 的 §5 里，" +
		(counts.uiAscii
			? "**还有 " + counts.uiAscii + " 处界面组的 ASCII 占位**（要换成图）"
			: "**界面组已经全是图引用**（§5 里认不出界面组的 ASCII 占位）") +
		(counts.flowAscii ? "；另有 " + counts.flowAscii + " 处**流程图** ASCII（那不是等真图的占位，不换）" : "") +
		" ｜ 界面组 " + uiGroups.length + " 个：" +
		"已就位 " + counts.keep + " · 要换 " + counts.replace + " · 对不上 " + counts.unmatched + " · 没图没源 " + counts.none +
		" ｜ 图源 " + counts.sources + " 张" + (missingSources ? "（其中 **" + missingSources + " 张盘上找不到**）" : "") +
		"　（这一份 §5 里实有 " + finalAscii.fences + " 处 ```text（含流程图）、" + imgs.length + " 处 `<img>`；" +
		"上面的现状原文另取自" + (String(inp.draftText == null || inp.draftText === "" ? "定稿自己" : "成稿/定稿（由调用方给的那一份）")) + "）";

	if (counts.uiAscii === 0 && counts.unmatched === 0) {
		notes.push("**" + finalName + " 的 §5 里认不出界面组（§5.x UI-M*）的 ASCII 占位了** —— 它现在用的是真图（" + imgs.length + " 处 `<img>`）。" +
			"面板不假装还有东西要换：④ 的三方映射就是这一版的**核对依据**。");
	} else if (counts.uiAscii === 0) {
		notes.push("**" + finalName + " 的 §5 里**已经没有界面组的 ASCII 占位了 —— 那几个界面组现在用的是真图（" + imgs.length +
			" 处 `<img>`）；**面板这一轮没有东西可换**，只把「§5 里现在是什么」与「图源里有什么」摆出来对照。");
	}
	if (counts.uiAscii === 0 && uiGroups.some((g) => g.action === "none")) {
		notes.push("有界面组既没有图、也没有 ASCII 占位（" + uiGroups.filter((g) => g.action === "none").map((g) => g.id).join(" / ") +
			"）—— 面板**看不出这一组要不要图**，请你自己判（不猜）。");
	}
	if (counts.unmatched) {
		notes.push("★ 有 " + counts.unmatched + " 个界面组**对不上**（图源里没有能顶上那一组的图）—— 面板不替它挑一张，" +
			"缺什么写在那一行的 `miss` 里。把图放进图源（或写进手动入口）再回来。");
	}
	notes.push("图**跟着定稿走**：落点是 `" + (uiDir || "<功能根>\\gdd\\UI") + "`（功能目录内），不是包里的 `截图\\` —— 包是原料，图是定稿的一部分。");
	notes.push("面板**不写盘**：替换是**指令让 agent 改**、用户点出来的；面板只算「改成什么样」与「怎么回滚」，改完再读回判定。");

	return {
		finalPath: finalPath, finalName: finalName, topic: topic, blocks: blocks, groups: groups,
		sources: sources, backup: backup, summary: summary, counts: counts, notes: notes,
		blocked: blocked, next: next
	};
}

// ════════════════════════════════════════════════════════════════
// 三、替换指令（三段式：改哪儿 / 现状原文 / 要改成什么 + 备份 + 回滚 + 结构复核）
// ════════════════════════════════════════════════════════════════

/**
 * ⑤ 的**替换指令**（逐字给 agent；用户在面板上点）。
 *
 * ★ 不变量（工单 27 的验收明写的三条，一条都不能少）：
 *   ① **先备份**：改之前把原定稿整份复制到 `plan.backup.path`，并**逐字**报出备份路径；
 *   ② **改完把改动贴回来**：逐处报「原行号 + 原原文 → 新行号 + 新原文 + 图片相对路径」；
 *   ③ 备份落点仍是**功能目录内**（同目录兄弟文件）—— 目录名不许带点（`.bak` 会被列举器当成"非文件"）。
 */
export function buildSwapInstruction(plan: SwapPlan): { instruction: string; blocked: string; next: string } {
	const p = plan || ({} as SwapPlan);
	if (p.blocked) return { instruction: "", blocked: p.blocked, next: p.next || "" };

	const L: string[] = [];
	L.push("【工单 27 · ⑤ 线框图替换】把 `" + p.finalName + "` 的 **§5 里那些 ASCII 占位换成真图**（或按下面的对照换掉已有的图），" +
		"**不要动任何别的章**。");
	L.push("主题：" + (p.topic || "（按定稿推导）"));
	L.push("改哪儿（要改的那一份 = **当前有效定稿**）：" + (p.finalPath || "（面板拿不到路径）"));

	// ── 现状原文（替换前）─────────────────────────────────────────
	L.push("现状原文（**替换前**，面板读出来的；行号会漂、原文不会）：");
	const uiBlocks = p.blocks.filter((b) => (b.id || "") !== "");
	const flowBlocks = p.blocks.filter((b) => (b.id || "") === "");
	if (uiBlocks.length) {
		for (const b of uiBlocks) {
			L.push("  · §" + b.no + " " + b.id + " " + b.title + "　L" + b.line + "　（**界面组的 ASCII 占位**，约 " + b.lines + " 行 —— 要换成图）");
		}
		L.push("  · 这些是 ```text 围栏 —— 替换时**整段换掉**，不要把 ASCII 留在下面当备份。");
	} else {
		L.push("  · （§5 里**认不出界面组的 ASCII 占位** —— 那几个界面组现在已经是 `<img>` 引用了。那就按下面的对照换图，**不要**重排 §5 的组与条目。）");
	}
	if (flowBlocks.length) {
		for (const b of flowBlocks) {
			L.push("  · §" + b.no + " " + b.title + "　L" + b.line + "　（**界面流程**的 ASCII，约 " + b.lines + " 行 —— 它本来就是 ASCII，**不换**，别顺手改它）");
		}
	}
	for (const g of p.groups) {
		const label = "`§" + g.no + " " + (g.id || g.title) + "`";
		if (g.before.length) {
			for (const b of g.before) L.push("  · " + label + " L" + b.line + " 现有图：`" + b.src + "`（alt `" + b.alt + "`）");
		} else if (g.kind === "ui") {
			L.push("  · " + label + " 名下**现在没有图**" + (g.action === "replace" ? "（要新增一张）" : ""));
		}
	}

	// ── 要换成什么（替换后）───────────────────────────────────────
	L.push("要换成什么（**替换后**，逐组给对照：图源 → 落点 → alt）：");
	const swapGroups = p.groups.filter((g) => g.kind === "ui" && g.after.length);
	if (!swapGroups.length) {
		L.push("  · （面板这一轮**自动对不上**要换哪张图 —— 那就按下面「对不上的」那几条与这段手工步骤做，别自己猜对应关系。）");
	}
	for (const g of swapGroups) {
		L.push("  · `" + g.id + "`（" + g.action + "）：" + g.why);
		for (const a of g.after) {
			L.push("      - 图源：" + a.from);
			L.push("      - 落点：`" + a.rel + "`（**相对 §5 里 `<img src>` 的口径**；图要真的复制/移动到那儿）");
			L.push("      - alt：" + a.alt);
		}
	}
	const unmatched = p.groups.filter((g) => g.kind === "ui" && (g.action === "unmatched" || !g.after.length));
	if (unmatched.length) {
		L.push("★ **对不上的**（面板不替它挑图；这一组请按现状原样留着，并在回报里点名）：");
		for (const g of unmatched) L.push("  · `§" + g.no + " " + g.id + "`：" + (g.miss || "图源里没有能顶上这一组的图"));
		// ★ 对不上时的**手工步骤**（面板把该说的说完，用户在预览里核，agent 落纸）——
		//   没有这一段，对不上就等于"这条支线到此为止"，实际是把活推回给用户（工单 27 第 3 条要的对照就白做了）。
		L.push("★ **对不上时的手工步骤**（面板**不替它挑**，但把该说的说完；对应关系由用户在会话里核过再落纸）：");
		L.push("  1) 从图源里**人工选定**这一组对应的那张图（图源清单在下面「图源」那一节；面板不判「像不像」）。");
		L.push("  2) 把它**复制进** `" + (p.groups.filter((g) => g.kind === "ui" && g.after.length)[0]
			? winOf(p.groups.filter((g) => g.kind === "ui" && g.after.length)[0].after[0].rel).replace(/\\[^\\]*$/, "")
			: "<功能根>\\gdd\\UI") + "`（图跟着定稿走；文件名照原样，别改名）。");
		L.push("  3) 把那一组 §5 里现有的 `<img src>` **改成** `<img src=\"UI/<刚放进去的文件名>\" alt=\"…\" width=\"420\" />`；");
		L.push("     若是 ASCII 占位，就把整段围栏换成这一行（围栏一起删掉）。");
		L.push("  4) 逐处照第 ④ 条**把改动贴回来**（原行号 + 原原文 → 新行号 + 新原文 + 图片相对路径），并说明你按什么判断「这张对得上这一组」。");
	}
	// ── 图源清单（对不上时的选择面；也给用户核"到底有哪些图可选"）──────
	if (p.sources.length) {
		L.push("图源（**逐条列出**；面板只列它读到的东西，不动手挑）：");
		for (const s of p.sources) L.push("  · " + s.path + (s.exists ? "" : "　★ **盘上找不到**") + "　（" + s.note + "）");
	}

	// ── 硬规矩：备份 / 落点 / 回滚 / 结构复核 ─────────────────────
	L.push("★ 硬规矩（**一条都不能省**）：");
	L.push("  ① **先备份原定稿**（改之前，第一步就做）：把 `" + p.finalPath + "` 整份复制成");
	L.push("     `" + p.backup.path + "`（同目录、同扩展名；**别只留 diff**，也**不要**用带点的目录名 —— 面板的列举器会跳过点开头的名字）。");
	L.push("     备份完先回报一句「已备份到 <路径>（<字节数> 字节）」，再动手改。");
	L.push("  ② **图落到功能目录内**：`" + (p.groups.length && p.groups[0].after.length ? winOf(p.groups[0].after[0].rel).replace(/\\[^\\]*$/, "") : "<功能根>\\gdd\\UI") + "`" +
		"（图跟着定稿走；**不要**把 `source\\UE交付_*\\截图\\` 里的图直接引到定稿里 —— 那是原料桶，不是定稿的一部分）。");
	L.push("  ③ **只改 §5**：保留原有的 `§5.x` 组号、`UI-M*` 标识与 `UE*` 条目编号与列序 —— 不许顺手改编号、不许重排、不许删条目。");
	L.push("     ASCII 占位**整段替换**（围栏一起删掉）；`<img>` 用现有写法：`<img src=\"<相对路径>\" alt=\"<alt>\" width=\"420\" />`。");
	L.push("  ④ **改完把改动贴回来**（面板要拿它做替换前后对照）：逐处报「§5.x 组号 + 原行号 + 原原文（前 80 字） → 新行号 + 新原文 + 图片相对路径」；");
	L.push("     并对每一处说明「条目与图对不对得上」（哪条 UE 说的和图上不一致就逐条列出来，**不要自己顺手改规则**）。");
	L.push("  ⑤ **结构复核**：改完自己过一遍 —— §5 的界面组数、`UE*` 条目数、`§5.5 界面流程` 与 `§9/§10` 的引用是否仍能定位（左树 / 条目引用都不许断）。");
	L.push("     有断的当场说明断在哪；`<img>` 的 `src` 里**不要**出现空格以外的控制字符，路径用 `\\` 相对写法（与现有那几张一致）。");
	L.push("  ⑥ **回滚口径**（你回报里要带上这一段，用户要能照着做）：把 `" + p.backup.path + "` 复制回去覆盖 `" + p.finalPath + "`，");
	L.push("     然后确认字节数与改之前一致、头部 `status: active` 还在；回滚后请回报「已回滚 + 字节数」（面板会重读判定）。");
	L.push("  ⑦ 面板**不写盘**：它只把「现状原文 + 图源 + 落点 + 回滚口径」说到不用再找，落纸与对账都在这个会话里。");
	L.push("  ⑧ 若图里有面板看不清的东西（缺状态、缺文案、缺边界），**先问我**，不要自己猜着补。");

	return { instruction: L.join("\n"), blocked: "", next: "" };
}

/** 给调用方复用（`draftdoc`/解析只在纯层用，这里再导一次免得别处重写） */
export { parseFinalGdd };
