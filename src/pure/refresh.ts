/**
 * 自动刷新与版本指纹（工单 16）—— **纯函数层**（零 IO、零时钟、零全局）。
 *
 * 这一层只回答四件事，全部可对着真实帧与真实路径断言：
 *   ① 一帧是什么（`parseFrame`）
 *   ② 该盯哪些目标、为什么（`watchPlan`）
 *   ③ 这一帧要**重读哪些部件**（`planReload` / `unionParts`）
 *   ④ 屏幕上的内容是不是最新（`acceptFrame` / `fingerprintOf` / `freshnessOf` / `stalePaths`）
 *
 * ── 通道的真实形状（**2026-09-30 在真机 DSH 0.2.0-rc.2 上实测**，证据 `_16-channel-evidence.txt`）──
 * `remote.workspaceFiles.changes(sessionId, path, signal)` 在 0.2.0 是**目标定向**的：
 * 一个目标（文件或目录）一条流。宿主侧 `WorkspaceChangeFeed.follow()` → `ctx.fs.watch()` 是
 * **OS 监视**（`dsh-fs-local` 用 chokidar，`depth: 0`）⇒
 *   · 任何写入者都会产生帧：`dsh-tool-fs` 的 write/edit、会话里的 `pwsh`、外部编辑器保存、
 *     原子替换（tmp + rename）——**工单 01 在 0.1.5 上测到的"只有 tool-fs 写入才发帧"在 0.2.0 已不成立**；
 *   · 覆盖面 = **被订阅目标的直接子项**（两层深的写入不发帧）⇒ 必须**逐个桶目录订阅**，
 *     只订阅功能根是看不见 `gdd\` 里的写入的；
 *   · 一次原子替换会产生**两条**帧（目录一条、文件一条）⇒ 必须去抖合批，不能一帧一读。
 *
 * 由此得出面板能承诺什么、不能承诺什么（报告里逐字写清，这里不重复）。
 */

import { containsPath, normPath } from "./sessionpick.ts";

// ════════════════════════════════════════════════════════════════
// 一、帧
// ════════════════════════════════════════════════════════════════

/** 一条变更（`{kind:'change', change:{…}}` 里那个 `change` 的归一化形状） */
export interface ChangeNotice {
	/** 绝对路径（**就是被订阅的那个目标**，不是"某个子文件"） */
	path: string;
	/** 不透明新鲜度串（照搬，不解析） */
	version: string;
	/** 目标已经不在（`change:{absolutePath, absent:true}`） */
	absent: boolean;
}

/** 解析一帧。**认不出来就返回 null** —— 不猜、不假装。 */
export function parseFrame(raw: unknown): { kind: "ready" } | { kind: "change"; change: ChangeNotice } | null {
	const f: any = raw;
	if (!f || typeof f !== "object") return null;
	if (f.kind === "ready") return { kind: "ready" };
	if (f.kind === "change" && f.change && typeof f.change.absolutePath === "string") {
		const c = f.change;
		return {
			kind: "change",
			change: {
				path: c.absolutePath,
				version: typeof c.version === "string" ? c.version : "",
				absent: c.absent === true
			}
		};
	}
	return null;
}

// ════════════════════════════════════════════════════════════════
// 二、订阅计划（盯哪些目标）
// ════════════════════════════════════════════════════════════════

/** 一条订阅最多挂几个目标（每个目标 = 宿主侧一个 chokidar 实例） */
export const MAX_TARGETS = 14;

export interface WatchPlan {
	/** 目录目标（按传入顺序去重） */
	dirs: string[];
	/** 文件目标（当前正在看的那一个文件；没有就是空串） */
	file: string;
	/** `dirs + file`，就是实际要开的订阅 */
	targets: string[];
	/** 因为超过上限被丢掉的目标（如实报出来，不静默） */
	dropped: string[];
}

/**
 * 订阅计划。
 * ★ 目录要**逐个**给（`depth: 0` 的覆盖语义）：功能根 + 各桶 + 各桶下面那一层。
 *   只给功能根 = 看不见 `gdd\` 里的写入 —— 那是实测出来的，不是推测。
 * ★ 文件目标 = 当前正在看的那一个文件（详情里的最终版）。它在被订阅的目录里时是
 *   **冗余但有用**：内容变了能给一条只属于它的帧，且它带 version ⇒ 自激防护就靠它。
 */
export function watchPlan(opts: {
	root: unknown;
	dirs?: unknown[];
	nested?: unknown[];
	file?: unknown;
	max?: number;
}): WatchPlan {
	const o = opts || {};
	const root = String(o.root || "").replace(/[\\/]+$/, "");
	const max = Math.max(1, Math.trunc(Number(o.max) || MAX_TARGETS));
	const seen = new Set<string>();
	const cands: string[] = [];
	const push = (p: unknown) => {
		const s = String(p || "").replace(/[\\/]+$/, "");
		if (s === "") return;
		const k = normPath(s);
		if (seen.has(k)) return;
		seen.add(k);
		cands.push(s);
	};
	const under = (d: unknown) => {
		const rel = String(d || "").replace(/^[\\/]+/, "").replace(/[\\/]/g, "\\");
		if (rel === "") return "";
		return root === "" ? rel : root + "\\" + rel;
	};
	const file = String(o.file || "").replace(/[\\/]+$/, "");
	// ★ 优先级：功能根 → 当前文件 → 各桶 → 各桶下面那一层（越靠后越可能在超限时被丢）
	if (root !== "") push(root);
	if (file !== "") push(file);
	for (const d of (o.dirs || [])) push(under(d));
	for (const d of (o.nested || [])) push(under(d));

	const targets = cands.slice(0, max);
	const dropped = cands.slice(max);
	return {
		dirs: targets.filter((p) => !(file !== "" && normPath(p) === normPath(file))),
		file: file !== "" && targets.some((p) => normPath(p) === normPath(file)) ? file : "",
		targets: targets,
		dropped: dropped
	};
}

// ════════════════════════════════════════════════════════════════
// 三、一条变更 → 要重读哪些部件
// ════════════════════════════════════════════════════════════════

/** 面板上"各自有一份数据"的部件 —— 重读的最小单位 */
export type ReloadPart = "board" | "detail" | "ledger" | "brain" | "final" | "ui";

/** 全部部件（手动刷新用） */
export const RELOAD_PARTS: ReloadPart[] = ["board", "detail", "ledger", "brain", "final", "ui"];

export interface ReloadPlan {
	parts: ReloadPart[];
	/** 人话理由（显示在面板上，也是排障时唯一要看的字段） */
	reason: string;
}

/** 功能根下的七个固定桶（与 `DIR_BUCKET` 同源；这里只用来判断"改动落在哪个桶"） */
const BUCKETS = ["analysis", "gdd", "decisions", "evidence", "source", "delivery"];

/** 相对功能根的第一段（小写）；`""` = 就是功能根本身 */
function firstSeg(rel: string): string {
	const i = rel.indexOf("\\");
	const seg = i < 0 ? rel : rel.slice(0, i);
	return seg.toLowerCase();
}

/** 相对段数（`""` → 0） */
function depthOf(rel: string): number {
	if (rel === "") return 0;
	return rel.split("\\").length;
}

/**
 * 一条变更 → 要重读哪些部件（**只重读受影响的那几处**）。
 *
 * 判据只有一条：改动落在**哪个桶**里 ⇒ 那个桶参与哪几个部件。
 *   桶                 → 部件
 *   `analysis\`        → detail + brain      （头脑风暴工作面读的就是 analysis）
 *   `decisions\`       → detail + ledger     （决策台账读 decision_*.json）
 *   `evidence\`        → detail + ledger     （校准流水 calibration_*.jsonl 在台账里）
 *   `gdd\`（顶层）     → detail + final + ui （可能就是当前那份定稿；界面图来自定稿 §5）
 *   `gdd\<子目录>\`    → detail + ui         （界面图）
 *   其余桶 / 其它     → detail
 *   功能根自己（rel = ""）→ detail + board    （feature.json / 设计台账 / 新增桶会影响卡片）
 *   别的功能 / 工作区外 → board / 忽略
 */
export function planReload(notice: { path: unknown; absent?: boolean }, scope: { root: unknown; srWs?: unknown }): ReloadPlan {
	const c = scope || {};
	const root = String(c.root || "").replace(/\\+$/, "");
	const p = String((notice && notice.path) || "").replace(/\\+$/, "");
	if (root === "" || p === "") return { parts: [], reason: "拿不到功能根或路径，忽略" };
	const gone = !!(notice && notice.absent);

	if (!containsPath(root, p)) {
		const srWs = String(c.srWs || "").replace(/\\+$/, "");
		if (srWs !== "" && containsPath(srWs + "\\features", p)) {
			return { parts: ["board"], reason: gone ? "别的功能里少了东西（看板计数会变）" : "别的功能被改动（看板计数会变）" };
		}
		return { parts: [], reason: "不在 SR 工作区里，忽略" };
	}

	const rel = normPath(p) === normPath(root) ? "" : normPath(p).slice(normPath(root).length + 1);
	const suffix = gone ? "（目标已不在）" : "";
	if (rel === "") return { parts: ["detail", "board"], reason: "功能根的直接子项变了（产物桶 / 身份文件 / 台账）" + suffix };

	const seg = firstSeg(rel);
	const depth = depthOf(rel);
	if (seg === "analysis") return { parts: ["detail", "brain"], reason: "analysis 桶变了（头脑风暴工作面的来源）" + suffix };
	if (seg === "decisions" || seg === "evidence") return { parts: ["detail", "ledger"], reason: seg + " 桶变了（决策台账的来源）" + suffix };
	if (seg === "gdd") {
		// 「顶层」= `gdd` 目录自己（rel 只有一段）或 `gdd\<文件>`（两段）
		if (depth <= 2) return { parts: ["detail", "final", "ui"], reason: "gdd 顶层变了（当前定稿 / 界面图都从这儿来）" + suffix };
		return { parts: ["detail", "ui"], reason: "gdd 里的子目录变了（界面图）" + suffix };
	}
	if (BUCKETS.indexOf(seg) >= 0) return { parts: ["detail"], reason: seg + " 桶变了（只影响产物清单）" + suffix };
	return { parts: ["detail"], reason: "功能目录里的其它改动" + suffix };
}

/** 一批变更 → 部件的**并集**（保持 `RELOAD_PARTS` 的稳定顺序，方便断言与显示） */
export function unionParts(plans: ReloadPlan[]): ReloadPart[] {
	const has: Record<string, boolean> = {};
	for (const pl of (plans || [])) for (const p of ((pl && pl.parts) || [])) has[p] = true;
	return RELOAD_PARTS.filter((p) => has[p]);
}

// ════════════════════════════════════════════════════════════════
// 四、自激防护 / 指纹 / 新鲜度
// ════════════════════════════════════════════════════════════════

/**
 * 这一帧值不值得重读。
 *
 * ★ **目录目标永不按版本去重** —— DSH 的原话：目录消费者"每一次帧都要重列，
 *   因为**子项的元数据变了而目录版本可以不变**"（`types.d.ts` 的 `WorkspaceFileChange` 注释）。
 *   按版本去重目录 = 后续所有"改已有文件内容"的写入都静默看不见。
 * ★ **文件目标按版本去重**（这就是自激防护）：帧里的 `version` 等于我们**已经读到的**那个版本
 *   ⇒ 这次重读学不到任何新东西 ⇒ 丢掉。（官方 `provider.js` 也是这么做的：
 *   "holding this version already means the consumer learns nothing new"。）
 */
export function acceptFrame(frame: { path: unknown; version?: unknown; absent?: boolean }, st: {
	/** 已经读进屏幕的 路径 → version（小写路径为键） */
	applied?: Record<string, string>;
	/** 文件目标（当前正在看的那一个文件），空串 = 没有 */
	file?: unknown;
}): { accept: boolean; reason: string } {
	const s = st || {};
	const p = String((frame && frame.path) || "").replace(/\\+$/, "");
	if (p === "") return { accept: false, reason: "帧里没有路径" };
	const key = normPath(p);
	const applied = s.applied || {};
	const file = String(s.file || "");
	const isFileTarget = file !== "" && normPath(file) === key;
	if (!isFileTarget) return { accept: true, reason: "目录目标：每次重列（子项内容变了目录版本可能不变）" };

	const known = applied[key];
	if (frame && frame.absent) {
		return known === undefined
			? { accept: false, reason: "这个文件本来就没有（读不到，不必重读）" }
			: { accept: true, reason: "当前这个文件没了" };
	}
	const v = typeof frame.version === "string" ? frame.version : "";
	if (v === "") return { accept: true, reason: "帧里没有 version（照读一次）" };
	if (known !== undefined && known === v) return { accept: false, reason: "版本没变（= 自激防护：读完自己又收到同一版本）" };
	return { accept: true, reason: known === undefined ? "第一次见到这个文件" : "当前这个文件的版本变了" };
}

/** FNV-1a 32 位（无符号） */
function fnv1a(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
	}
	return h >>> 0;
}

export interface Fingerprint {
	/** 8 位小写十六进制；**一个文件都没有就是空串**（不编一个假的） */
	digest: string;
	/** 有版本的条目数 */
	known: number;
	/** 参与统计的条目数（给了 `paths` 时 = 清单长度） */
	total: number;
	/** 哪些清单里的文件还拿不到版本（最多 12 条，够看就不刷屏） */
	missing: string[];
}

/**
 * 版本指纹：路径 → version 的有序哈希。
 *
 * ★ `version` 是宿主的不透明新鲜度串（`dev:ino:size:mtime:ctime` 那种形状），**不解析**，
 *   只当"这两个东西是不是同一份内容"的判据 —— 与 `WorkspaceFileStat.version` 的口径一致。
 * ★ 传了 `paths`（= 面板正在展示的那份产物清单）就只统计清单里的文件：
 *   指纹只覆盖"屏幕上有的东西"，换个页签多读几个文件不会把指纹搅乱。
 */
export function fingerprintOf(applied: Record<string, string>, paths?: string[]): Fingerprint {
	const all = applied || {};
	let keys: string[];
	let total: number;
	let list: string[] | null = null;
	if (paths && paths.length) {
		list = paths;
		const seen: Record<string, boolean> = {};
		keys = [];
		for (const p of paths) {
			const k = normPath(p);
			if (k === "" || seen[k]) continue;
			seen[k] = true;
			if (typeof all[k] === "string" && all[k] !== "") keys.push(k);
		}
		total = Object.keys(seen).length;
	} else {
		keys = Object.keys(all).filter((k) => typeof all[k] === "string" && all[k] !== "");
		total = keys.length;
	}
	keys.sort();
	let acc = "";
	for (const k of keys) acc += k + "\t" + all[k] + "\n";
	const missing: string[] = [];
	if (list) {
		const have: Record<string, boolean> = {};
		for (const k of keys) have[k] = true;
		for (const p of list) {
			const k = normPath(p);
			if (k !== "" && !have[k] && missing.length < 12) missing.push(String(p));
		}
	}
	return { digest: keys.length ? ("00000000" + fnv1a(acc).toString(16)).slice(-8) : "", known: keys.length, total: total, missing: missing };
}

/** 指纹短串（展示用；拿不到就是 `——`） */
export function shortDigest(d: unknown): string {
	const s = String(d || "");
	return s === "" ? "——" : s;
}

export type FreshState = "off" | "down" | "stale" | "fresh" | "unknown";

export interface Freshness {
	state: FreshState;
	text: string;
	pending: number;
	digest: string;
}

/**
 * "面板现在展示的是不是最新"（一眼能看出的那一句）。
 * `pending` = 已收到但**还没并进屏幕**的变更条数（按路径去重后的批大小）。
 */
export function freshnessOf(o: { phase?: unknown; pending?: unknown; digest?: unknown; reason?: unknown }): Freshness {
	const phase = String((o && o.phase) || "off");
	const pending = Math.max(0, Math.trunc(Number(o && o.pending) || 0));
	const digest = String((o && o.digest) || "");
	if (phase === "down") {
		const why = String((o && o.reason) || "").trim();
		return { state: "down", text: "变更订阅不可用" + (why ? "：" + why : "") + " —— 面板**不会**自动跟随；点「刷新」或按 F5", pending: pending, digest: digest };
	}
	if (phase === "off" || phase === "idle") return { state: "off", text: "未订阅变更（不在功能里）", pending: pending, digest: digest };
	if (pending > 0) return { state: "stale", text: "有 " + pending + " 处新变化，正在重读…", pending: pending, digest: digest };
	if (digest === "") return { state: "unknown", text: "指纹待建立（还没有读到内容）", pending: pending, digest: digest };
	return { state: "fresh", text: "已是最新", pending: pending, digest: digest };
}

// ════════════════════════════════════════════════════════════════
// 五、去抖合批 / stat 核对
// ════════════════════════════════════════════════════════════════

/** 静默多久算"这一批写完了" */
export const FLUSH_QUIET_MS = 300;
/** 一直在写也不能无限等：到点强制落一次 */
export const FLUSH_MAX_MS = 1500;

/**
 * 现在该不该落一次重读。
 * ★ 一次原子替换会产生两条帧（目录 + 文件），连续保存会产生很多条；
 *   合批 = 只用一轮重读覆盖这一批，界面既不闪也不重复读盘。
 */
export function shouldFlush(batch: { firstAt?: unknown; lastAt?: unknown }, now: number, opts?: { quietMs?: number; maxWaitMs?: number }): boolean {
	const b = batch || {};
	const quiet = Math.max(0, Math.trunc(Number((opts && opts.quietMs) ?? FLUSH_QUIET_MS)));
	const maxWait = Math.max(quiet, Math.trunc(Number((opts && opts.maxWaitMs) ?? FLUSH_MAX_MS)));
	const first = Number(b.firstAt) || 0;
	const last = Number(b.lastAt) || 0;
	if (first === 0) return false;
	if (now - last >= quiet) return true;
	return now - first >= maxWait;
}

/**
 * stat 核对（切回面板 / 切功能 / 切页签 / 低频轮询的**正确性底线**）：
 * 返回"与屏幕上那份不一致"的路径 —— 空数组 = 屏幕上就是最新的。
 * ★ 这里**只看版本**：帧通道可能不可用（或漏了），这条是兜底；也不依赖帧里的 version。
 */
export function stalePaths(applied: Record<string, string>, current: Record<string, string> | null | undefined): string[] {
	const a = applied || {};
	const c = current || {};
	const out: string[] = [];
	for (const raw of Object.keys(c)) {
		const k = normPath(raw);
		const v = c[raw];
		if (typeof v !== "string" || v === "") continue;
		if (a[k] !== v) out.push(raw);
	}
	return out.sort();
}

/** 批量合并两个 路径 → version 表（`put` 赢；用于把读到的版本并进"已应用"） */
export function mergeApplied(applied: Record<string, string>, add: Record<string, string> | null | undefined): Record<string, string> {
	const out: Record<string, string> = {};
	for (const k of Object.keys(applied || {})) out[k] = applied[k];
	for (const raw of Object.keys(add || {})) {
		const v = (add as Record<string, string>)[raw];
		if (typeof v !== "string" || v === "") continue;
		out[normPath(raw)] = v;
	}
	return out;
}
