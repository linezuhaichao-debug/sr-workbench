/**
 * 「索引会话」的选择 —— 把"面板该用哪条会话"变成**纯函数**（零依赖、零全局）。
 *
 * 为什么需要它（工单 32 · DSH 0.2.0 兼容）：
 *   · 0.1.5 的会话列表快照里有 `current`（用户当前选中的会话），面板直接拿它当 sessionId；
 *   · 0.2.0 **没有 `current` 了** —— "当前会话"改成由 `byId[id].retainedBy.mainView > 0` 表达
 *     （官方 `dsh-client-ui-layout` 与 `dsh-client-ui-workspace` 都是这么算的），
 *     于是面板永远拿不到 sessionId ⇒ 永远停在「先在左侧选一个会话…」。
 *   · 规格（ADR 0005 / 工单 07）本来就要面板**不跟随当前选中会话**：它自己认领或创建一条
 *     cwd 覆盖 SR workspace 根的「索引会话」，`list` / `read` 全走它。
 *
 * ★ 本模块只回答"从候选中挑哪一条"，**所有 IO 留在组合根**（`src/client.js`）：
 *   `remote.session.list` / `rename` / `create`、`localStorage` 都不许进 pure 层。
 *
 * ★ 为什么"cwd 覆盖 sr 根"是硬条件：`workspaceFiles.read` 可以读工作区外的文件，
 *   但 `workspaceFiles.list` 被**限定在会话的工作区内**（开发笔记坑 3）。挑一条 cwd 不覆盖
 *   sr 根的会话 ⇒ `features\` 列不出来 ⇒ 看板 0 个功能（还会静默判成"没有功能"）。
 */

/** 索引会话的标题（认领凭据；`session.rename` 设定的显式标题不会被自动标题覆盖）。 */
export const INDEX_TITLE = "策划工作台·索引";

/** 一条候选会话（store 与 remote 列表归一成同一个形状）。 */
export interface SessionRow {
	id: string;
	/** 显式/持久标题。 */
	title?: string;
	/** 展示名（0.2.0 客户端 store 的 displayTitle；标题缺失时是目录名或 id）。 */
	display?: string;
	cwd?: string;
	updatedAt?: number;
	blank?: boolean;
	/** 是不是"用户当前选中的那条"（0.1.5 的 current / 0.2.0 的 mainView）。 */
	main?: boolean;
	/**
	 * 这条会话**正在跑**（`SessionSummary.running`）。
	 * 收它是为了"工作会话忙碌时如实说一句"（用户故事 28）：指令走 `mode:"queue"` 会被
	 * 排进收件箱，不是失败 —— 但面板不能装成"它立刻就开始改了"。
	 */
	running?: boolean;
	/**
	 * 这条会话**当前的权限预设**（`permission-presets` 插件的会话投影 `permissions` 的视图
	 * `{ currentValue }`，取值见 `presetOfProjections`）。
	 *
	 * ★ 为什么收它（工单 07 第 7 条）：面板建完工作会话要把预设切到「完全权限」，
	 *   而"切没切成功"**必须能读回来**才算证据（不能只凭命令没报错）。
	 *   它是**可选**的：读不回来时如实说"读不回来"，不许当成"不动"。
	 */
	preset?: string;
}

/** 选择结果：挑了谁 + 为什么是它（"为什么"要显示给用户，不许闷着）。 */
export interface SessionPick {
	id: string;
	source: "cache" | "title" | "cwd" | "main" | "recent";
	row: SessionRow;
	/**
	 * 同一凭据下**还有几条**（不含选中的这条）——用来如实说"发现 2 条同名会话，这次用最新的那条"。
	 * `0` / `undefined` = 只有这一条（正常情况）。
	 */
	others?: number;
}

// ════════════════════════════════════════════════════════════════════════════
// 「已归档」= 侧边栏看不见（工作区层的显示过滤，**不是删除**）
// ════════════════════════════════════════════════════════════════════════════

/**
 * 侧边栏的「已归档」集（工作区 registry 的 **registry-global** 归档集）。
 *
 * ★ 为什么认领必须排除它（2026-09-30 用户实测缺陷）：
 *   归档 = **工作区层的显示过滤**，不是删除。归档的会话照样出现在 `remote.session.list` 里
 *   —— `SessionListRequest` 只有可选 `cursor`，列表**不按归档过滤**（`dsh-api-session-controller/
 *   lib/types/types.d.ts:262`）—— 只是官方侧边栏按 `archivedSessionIds` 把行藏起来了。
 *   于是"认领一条已归档的会话"会出现最坏的现象：指令**发进去了**、会话日志也有写入，
 *   但**侧边栏什么也没出现**，用户判定"面板没反应"（F5 也没用）。
 *   所以：被面板**发指令**的会话，**在界面上可见才算可用**（用户故事 27/28）。
 *
 * 取值口径：`WorkspaceSnapshot.archivedSessionIds`
 *   · 客户端形状：`dsh-api-workspace-controller/lib/types/client/model.d.ts:12`
 *     （`ClientWorkspaceModel.buildSnapshot()`，宿主叫 `WorkspaceBaseline.archivedSessionIds`）
 *   · 官方半侧就是这么用的：`dsh-client-ui-workspace/lib/client.js:801`（`reuseOrCreateBlank`
 *     挑空白会话时排除它）与 `:870`（`pinSession` 传给排序）。
 *
 * `null` / `undefined` = **拿不到**（服务没提供 / 形状变了）⇒ 如实降级，见 `NO_ARCHIVE_INFO_NOTE`；
 * `[]` = 明确知道"一条都没归档"。这两者**不是一回事**，别混（拿不到时不许装成"没有归档的"）。
 */
export type ArchivedIds = readonly string[] | ReadonlySet<string> | null | undefined;

/** 取不到归档集时的那句话（面板照实说，绝不装成"我知道它在侧边栏可见"）。 */
export const NO_ARCHIVE_INFO_NOTE =
	"取不到侧边栏的「已归档」集（官方 workspaces 快照里没有 archivedSessionIds）：" +
	"这次无法确认目标会话在侧边栏可见 —— 若发完看不到它，去侧边栏「已归档」里取消归档即可。";

/** 上次用的那条已被归档时的那句话（归档 ≠ 删除，所以要说清"它不算可用"）。 */
export const ARCHIVED_CACHED_NOTE =
	"上次用的那条会话已被你在侧边栏归档（归档 ≠ 删除，只是不显示）：它不算可用，这次没用它。";

/** 归档集合归一成查找用的 Set；**拿不到**（null / undefined / 坏形状）时返回 `null`。 */
export function archivedIdSet(archived: ArchivedIds | unknown): Set<string> | null {
	if (archived instanceof Set) {
		const out = new Set<string>();
		for (const one of archived as ReadonlySet<unknown>) {
			const s = one === null || one === undefined ? "" : String(one);
			if (s !== "") out.add(s);
		}
		return out;
	}
	if (Array.isArray(archived)) {
		const out = new Set<string>();
		for (const one of archived) {
			const s = one === null || one === undefined ? "" : String(one);
			if (s !== "") out.add(s);
		}
		return out;
	}
	return null;
}

/**
 * 这个 id 是不是已归档。
 * ★ **拿不到归档集时一律判否**（= 不排除 = 旧行为）——降级绝不静默：调用方要按
 *   `NO_ARCHIVE_INFO_NOTE` 把"我不知道"如实说出来。
 */
export function isArchivedId(archived: ArchivedIds | unknown, id: unknown): boolean {
	const set = archivedIdSet(archived);
	return set !== null && typeof id === "string" && id !== "" && set.has(id);
}

/**
 * 从候选里**剔掉**已归档的那些（它们点不出来：侧边栏不显示）。
 * ★ 拿不到归档集时**原样返回**（向后兼容：不传归档集 = 旧行为）。
 */
export function withoutArchived(rows: SessionRow[], archived: ArchivedIds | unknown): SessionRow[] {
	const list = (rows || []).filter((r) => r && r.id);
	const set = archivedIdSet(archived);
	if (set === null) return list;
	return list.filter((r) => !set.has(String(r.id)));
}

/**
 * 官方 `workspaces` 客户端服务的**快照** → 归档 id 表。
 * `null` = 这个快照里**没有**归档集（拿不到 ⇒ 调用方如实降级，别当成空表）。
 * 形状判据只有一处（这里），将来官方改字段只改这一个函数。
 */
export function archivedFromSnapshot(snap: unknown): string[] | null {
	if (!snap || typeof snap !== "object") return null;
	const raw = (snap as { archivedSessionIds?: unknown }).archivedSessionIds;
	if (!Array.isArray(raw)) return null;
	const out: string[] = [];
	for (const one of raw) {
		const s = one === null || one === undefined ? "" : String(one);
		if (s !== "") out.push(s);
	}
	return out;
}

/** 路径归一：统一成反斜杠、去掉尾部分隔符、小写（Windows 大小写不敏感）。 */
export function normPath(p: unknown): string {
	if (p === null || p === undefined) return "";
	return String(p).replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
}

/** 两个路径是不是同一个（Windows 口径）。空值一律判否。 */
export function samePath(a: unknown, b: unknown): boolean {
	const x = normPath(a);
	const y = normPath(b);
	return x !== "" && x === y;
}

/**
 * `root` 是不是 `p` 的祖先（或就是 `p` 本身）。
 * ★ 必须按分隔符判，不能 `startsWith`：`D:\TimeMachine2` 不在 `D:\TimeMachine` 里面。
 */
export function containsPath(root: unknown, p: unknown): boolean {
	const r = normPath(root);
	const t = normPath(p);
	if (r === "" || t === "") return false;
	return t === r || t.indexOf(r + "\\") === 0;
}

/** 标题是不是本工作台的索引会话（按前缀认领，允许尾部再带说明）。 */
export function isIndexTitle(t: unknown): boolean {
	return typeof t === "string" && t.indexOf(INDEX_TITLE) === 0;
}

/** 一条候选的"名字"：显式标题优先，其次展示名。 */
export function titleOf(row: SessionRow | null | undefined): string {
	if (!row) return "";
	if (typeof row.title === "string" && row.title !== "") return row.title;
	if (typeof row.display === "string" && row.display !== "") return row.display;
	return "";
}

const num = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : 0);

/**
 * 会话行 / 列表项里的**权限预设**读法 —— 形状判据只有这一处。
 *
 * 三种形状（都实测过或由官方源码推出）：
 *   · `session/list` 的行：`it.projections.values.permissions.currentValue`
 *     （投影 `permissions` 的视图是 `selectionSchema = { currentValue: string }`，
 *      见 `dsh-permission-presets/lib/index.js:187-201`）
 *   · 0.2.0 客户端 store 的行：`row.projectionValues.permissions`（**扁平**的 键→视图 表，
 *      见 `dsh-api-session-controller/lib/client.js:3511`）
 *   · 退一步：`row.permissions`（视图本体或裸字符串）
 *
 * 读不到一律返回 `""` —— 调用方要如实说"读不回来"，**不许**把空值当成"它已经不动了"。
 */
export function presetOfProjections(p: unknown): string {
	if (!p || typeof p !== "object") return "";
	const bag = p as Record<string, any>;
	const nested = bag.projections && typeof bag.projections === "object" ? (bag.projections as Record<string, any>).values : undefined;
	const views = [bag.values, bag.projectionValues, nested, bag];
	for (const v of views) {
		if (!v || typeof v !== "object") continue;
		const perm = (v as Record<string, any>).permissions;
		if (typeof perm === "string" && perm !== "") return perm;
		if (perm && typeof perm === "object") {
			const cur = (perm as Record<string, any>).currentValue;
			if (typeof cur === "string" && cur !== "") return cur;
		}
	}
	return "";
}

/** 一条候选的权限预设（读不到 → `""`）。 */
export function presetOfRow(row: SessionRow | null | undefined): string {
	if (!row) return "";
	return typeof row.preset === "string" ? row.preset : "";
}

/** 取 updatedAt 最大的一条（并列时保持原顺序，保证确定性）。 */
function newest(rows: SessionRow[]): SessionRow | null {
	let best: SessionRow | null = null;
	for (const r of rows) {
		if (!r || !r.id) continue;
		if (best === null || num(r.updatedAt) > num(best.updatedAt)) best = r;
	}
	return best;
}

/** 给定 sr 根时：cwd 与 sr 根完全相等的排在"祖先目录"前面（更贴规格里那条索引会话）。 */
function preferExactRoot(rows: SessionRow[], root: string): SessionRow[] {
	if (!root) return rows;
	const exact = rows.filter((r) => samePath(r.cwd, root));
	return exact.length > 0 ? exact : rows;
}

/**
 * 客户端 store 快照 → 候选行。**同时吃 0.1.5 与 0.2.0 两种形状**：
 *   · 0.2.0（dsh-api-session-controller client）：`{ ids, byId }`，行上是 `{id, title, displayTitle, cwd, updatedAt, blank, retainedBy}`
 *   · 0.1.5：`{ current, byId }`（甚至只有 `current`）
 */
export function rowsFromStore(state: any): SessionRow[] {
	if (!state) return [];
	const byId = state.byId || {};
	const ids: string[] = Array.isArray(state.ids) ? state.ids.map(String) : Object.keys(byId);
	const current = typeof state.current === "string" ? state.current : "";
	const out: SessionRow[] = [];
	const seen: Record<string, true> = {};
	for (const id of ids) {
		const r = byId[id] || {};
		if (!id) continue;
		seen[id] = true;
		out.push({
			id: id,
			title: typeof r.title === "string" ? r.title : undefined,
			display: typeof r.displayTitle === "string" ? r.displayTitle : undefined,
			cwd: typeof r.cwd === "string" ? r.cwd : undefined,
			updatedAt: num(r.updatedAt),
			blank: r.blank === true,
			running: r.running === true,
			preset: presetOfProjections(r),
			// ★ 0.2.0 的"当前选中"：mainView 保留计数 > 0（layout / ui-workspace 同源口径）
			main: id === current || !!(r.retainedBy && num(r.retainedBy.mainView) > 0),
		});
	}
	if (!seen[current] && current !== "") out.push({ id: current, main: true });
	return out;
}

/** `remote.session.list` 的返回 → 候选行（0.2.0：标题在 `projections.values.title` 里）。 */
export function rowsFromList(value: any): SessionRow[] {
	const items = (value && (value.items || value.sessions)) || [];
	const out: SessionRow[] = [];
	for (const it of items) {
		if (!it) continue;
		const id = it.sessionId || it.id;
		if (!id) continue;
		const pv = it.projections && it.projections.values;
		const projTitle = pv && typeof pv.title === "string" ? pv.title : undefined;
		out.push({
			id: String(id),
			title: typeof it.title === "string" && it.title !== "" ? it.title : projTitle,
			display: typeof it.displayTitle === "string" ? it.displayTitle : undefined,
			cwd: typeof it.cwd === "string" ? it.cwd : undefined,
			updatedAt: num(it.updatedAt),
			blank: it.blank === true,
			running: it.running === true,
			preset: presetOfProjections(it),
			main: false,
		});
	}
	return out;
}

/**
 * 合并两份候选（同一 id 一拍）：**先来的字段优先，先来的空字段由后来的补上**。
 *
 * ★ 为什么要"补空"而不是"先来的整条赢"：两份候选来自不同通道，各有各的缺项 ——
 *   客户端 store 行带着 `main` / `displayTitle` / `running`，但 `title` 要等 host 投影下来
 *   （`SessionSummary.title`："absent until the host projects one"）；
 *   `session/list` 的标题在 `projections.values.title` 里，却没有 `main`。
 *   若整条赢，store 的"没标题"会把列表里的标题**抹掉** ⇒ 标题认领静默失效
 *   （索引会话还有 cwd 兜底，工作会话就只有标题这一条凭据 ⇒ 每次刷新新建一条，用户故事 27）。
 */
export function mergeRows(primary: SessionRow[], extra: SessionRow[]): SessionRow[] {
	const out: SessionRow[] = [];
	const at: Record<string, number> = {};
	const fill = (dst: SessionRow, src: SessionRow): SessionRow => {
		const merged: SessionRow = { id: dst.id };
		for (const k of ["title", "display", "cwd", "updatedAt", "blank", "main", "running", "preset"] as const) {
			const d = dst[k];
			const s = src[k];
			(merged as any)[k] = d === undefined || d === "" || d === null ? s : d;
		}
		return merged;
	};
	for (const r of (primary || []).concat(extra || [])) {
		if (!r || !r.id) continue;
		if (at[r.id] === undefined) { at[r.id] = out.length; out.push(r); continue; }
		out[at[r.id]] = fill(out[at[r.id]], r);
	}
	return out;
}

/**
 * 挑一条索引会话。
 *
 * ★ 工单 07 的核心纪律：**索引会话必须是"面板自己的"**。
 *   所有权凭据只有两条（工单第 3 条：只能靠标题 + 缓存）：
 *     ① 标题以 `INDEX_TITLE` 开头（`session.rename` 设定的显式标题）；
 *     ② 缓存里那条 —— 而且必须是**面板自己写的**缓存（`mine`）。
 *   为什么要"我自己写的"这个标记：旧版本（工单 32 那一版）在"cwd 覆盖 sr 根"命中时
 *   **会把用户的会话写进缓存**（`缓存 = 借来的那条`），所以旧缓存不可信 —— 见 `IndexCache`。
 *   "cwd 覆盖 sr 根"**不再是所有权凭据**：用户自己的会话（cwd = `D:\TimeMachine`）是
 *   sr 根的祖先目录，一样"覆盖" —— 那正是本票要修的现象（面板借用户的会话当扫描口径）。
 *
 * 顺序（前一条命中就不再往下走）：
 *   ⓪ `opts.archived` —— 先剔掉已归档的那些（侧边栏看不见的会话不算可用）；
 *   ① `opts.cachedId` —— 上次用的那条，**在"自己的"里**、且（给了 root 时）cwd 覆盖 root；
 *   ② 标题认领 —— 自己的标题 + cwd 覆盖 root（精确等于 root 的先于祖先目录），取最新；
 *   ③ 一条自己的都没有 ⇒ **返回 null**（调用方去新建；**绝不借用户的会话**）；
 *   ④ `opts.borrow` —— 允许"随便借一条"的兜底（只有 `boot` 用它：那一步只 `read` 配置文件，
 *      不扫描、不订阅、不发指令 —— 借谁的都不影响结果）。借的顺序：cwd 覆盖 → 当前选中 → 最近更新。
 */
export function pickIndexSession(
	rows: SessionRow[],
	srWs: string,
	opts?: { cachedId?: string; allowForeign?: boolean; archived?: ArchivedIds; borrow?: boolean },
): SessionPick | null {
	const o = opts || {};
	const live = withoutArchived(rows || [], o.archived);
	if (live.length === 0) return null;

	// ⓪ 只有"标题是我的"才算自己的（所有权凭据①）
	const own = live.filter((r) => isIndexTitle(titleOf(r)));
	// 自己的里面，还得**能列出 sr 根**（`list` 限定在会话工作区内，见文件头）——这是"可用"，
	// 与"所有权"是两回事
	const able = srWs ? own.filter((r) => containsPath(r.cwd, srWs)) : own;

	// ① 缓存（所有权凭据②：自己写的缓存；它只决定"用自己的哪一条"）
	if (o.cachedId) {
		const hit = able.filter((r) => r.id === o.cachedId)[0];
		if (hit) return { id: hit.id, source: "cache", row: hit, others: Math.max(0, able.length - 1) };
	}

	// ② 标题认领
	if (able.length > 0) {
		const pool = srWs ? preferExactRoot(able, srWs) : able;
		const best = newest(pool);
		if (best) return { id: best.id, source: "title", row: best, others: Math.max(0, able.length - 1) };
	}

	// ③ 自己的那条存在、但列不出 sr 根（例如工作区换过地方）⇒ 也返回 null（去新建）：
	//    认它 = 看板必然 0 个功能（静默坏掉），比多一条会话糟得多。
	if (!(o.borrow || o.allowForeign)) return null;

	// ④ 借用（boot 专用）
	if (o.cachedId) {
		const hit = live.filter((r) => r.id === o.cachedId)[0];
		if (hit) return { id: hit.id, source: "cache", row: hit };
	}
	if (srWs) {
		const inside = live.filter((r) => containsPath(r.cwd, srWs));
		if (inside.length > 0) {
			const best = newest(preferExactRoot(inside, srWs));
			if (best) return { id: best.id, source: "cwd", row: best };
		}
	}
	const mains = live.filter((r) => r.main);
	if (mains.length > 0) {
		const best = newest(mains);
		if (best) return { id: best.id, source: "main", row: best };
	}
	const best = newest(live);
	if (best) return { id: best.id, source: "recent", row: best };
	return null;
}

/** sr 配置的默认文件名（相对"工作区根"）。 */
export const SR_CONFIG_REL = "\\.agents\\skills\\sr-askme\\config.local.json";

/**
 * 候选配置路径：每个候选根一个**绝对路径**，最后兜一条**相对路径**
 * （相对路径由 host 按会话 cwd 解析 —— 那是 0.1.5 时代唯一能用的那条，留着当兜底）。
 *
 * ★ 浏览器半侧收不到插件 config（开发笔记坑 7），所以 `configPath` 在浏览器里是空的，
 *   绝对路径只能自己按"候选根"拼 —— 候选根来自工作区列表 / 会话 cwd / 默认根。
 */
export function configPathCandidates(roots: unknown[]): string[] {
	const out: string[] = [];
	const seen: Record<string, true> = {};
	for (const raw of roots || []) {
		if (raw === null || raw === undefined) continue;
		const base = String(raw).replace(/[\\/]+$/, "");
		if (base === "") continue;
		const abs = base + SR_CONFIG_REL;
		const key = normPath(abs);
		if (seen[key]) continue;
		seen[key] = true;
		out.push(abs);
	}
	/**
	 * ★ 6.0.0：配置的正经落点是**用户目录** `%USERPROFILE%\.dsh\sr-workbench\config.local.json`，
	 *   但那台机器上的家目录**浏览器里拿不到**（宿主注入的 boot 载荷里没有）——
	 *   所以面板认路靠 profile 行里那条 `configPath`（支持按 id 覆盖，README 有写）。
	 *   这里只留**相对回退**：老位置还认（存量机器不至于突然读不到），另加一条 `.dsh` 相对路径
	 *   （对"会话 cwd 就在用户目录下"这种少见情形有用）。
	 */
	out.push(".agents/skills/sr-askme/config.local.json");
	out.push(".dsh/sr-workbench/config.local.json");
	return out;
}

/** localStorage 里记"这条工作区用哪条索引会话"的键（只在组合根里读写）。 */
export function indexCacheKey(): string {
	return "sr-wb.index.v1";
}

/**
 * 索引会话的缓存条目。
 *
 * ★ `mine` 是**所有权凭据**的一部分，别小看这一个布尔（工单 07 第 3 条）：
 *   旧版本（工单 32）在"cwd 覆盖 sr 根"命中时也会 `cacheWrite(root, hit.id)` ——
 *   也就是说用户机器上的旧缓存**可能正指着用户自己的会话**。新代码只认 `mine: true`
 *   （由自己创建成功后写入）的条目，于是旧缓存自动作废，不需要用户手清 localStorage。
 */
export interface IndexCacheEntry {
	srWs: string;
	sid: string;
	/** 这条缓存是"面板自己建完写下的"（`true`）——旧版本写的不带这个标记 */
	mine: boolean;
	/** 建的时候用的标题（只是给人看的线索，认领仍以**列表现场读到的标题**为准） */
	title?: string;
}

/** 缓存原文 → 条目；坏 JSON / 形状不对 → `null`（一律当成"没有缓存"，绝不抛）。 */
export function indexCacheParse(raw: unknown): IndexCacheEntry | null {
	if (typeof raw !== "string" || raw === "") return null;
	try {
		const v = JSON.parse(raw) as Record<string, unknown> | null;
		if (!v || typeof v !== "object") return null;
		const sid = typeof v.sid === "string" ? v.sid : "";
		if (sid === "") return null;
		return {
			srWs: typeof v.srWs === "string" ? v.srWs : "",
			sid: sid,
			mine: v.mine === true,
			title: typeof v.title === "string" ? v.title : ""
		};
	} catch (e) {
		return null;
	}
}

/** 写一条缓存（**只有自己建完才调它** —— 这就是 `mine` 的来源）。 */
export function indexCacheSerialize(srWs: unknown, sid: unknown, title?: unknown): string {
	const e: IndexCacheEntry = {
		srWs: String(srWs === null || srWs === undefined ? "" : srWs),
		sid: String(sid === null || sid === undefined ? "" : sid),
		mine: true,
		title: String(title === null || title === undefined ? "" : title)
	};
	return JSON.stringify(e);
}

/**
 * 缓存里这条**能不能当所有权凭据**。
 * ★ 只有 `mine: true` 才算（旧版本写的不算 —— 它可能是借来的用户会话）。
 */
export function indexCacheOwned(entry: IndexCacheEntry | null | undefined): boolean {
	return !!(entry && entry.mine === true && entry.sid !== "");
}

/** 旧缓存作废时的那句话（说清"不是你的会话被删了"，而是"那条不是我的"）。 */
export const FOREIGN_CACHE_NOTE =
	"上次记的索引会话不是面板自己建的（旧版本曾按「cwd 覆盖」借用过你的会话）：这条缓存已作废，" +
	"这次重新认领或新建一条属于面板的索引会话。";


/** `session.rename` 的标题：带工作区名，便于人一眼看出这条会话是干什么的。 */
export function indexTitleFor(srWs: unknown): string {
	const base = normPath(srWs).split("\\").filter(Boolean).pop() || "";
	return base ? INDEX_TITLE + "（" + base + "）" : INDEX_TITLE;
}

// ════════════════════════════════════════════════════════════════════════════
// 工作会话（工单 15）—— 「该功能的专属工作会话」怎么认、怎么不重复建
// ════════════════════════════════════════════════════════════════════════════

/**
 * 工作会话的标题（认领凭据）。
 * ★ 与索引会话（`策划工作台·索引`）**分开**：索引会话的 cwd 是 SR workspace 根、只负责扫描；
 *   工作会话的 cwd 是 `features\<主题>\`、只负责干活（规格「三层会话」）。
 */
export const WORK_TITLE = "策划工作台·工作";

/** 功能主题 = 功能目录名（`features\<主题>\` 的最后一段）。空值一律给空串。 */
export function featureTopicOf(root: unknown): string {
	return normPath(root).split("\\").filter(Boolean).pop() || "";
}

/** 标题是不是本工作台的工作会话（按前缀认领，允许尾部再带说明）。 */
export function isWorkTitle(t: unknown): boolean {
	return typeof t === "string" && t.indexOf(WORK_TITLE) === 0;
}

/** 工作会话该有的标题：`策划工作台·工作（联盟悬赏）`。 */
export function workTitleFor(root: unknown): string {
	const topic = featureTopicOf(root);
	return topic ? WORK_TITLE + "（" + topic + "）" : WORK_TITLE;
}

/**
 * 挑一条**该功能的**工作会话。
 *
 * 顺序（前一条命中就不再往下走）：
 *   ⓪ `opts.archived` —— **先剔掉已归档的那些**：这条会话是**要被发指令**的，
 *      用户看不见它 = 指令发进去了、界面什么也没有（2026-09-30 实测缺陷）。不传 = 旧行为；
 *   ① `opts.cachedId` —— 面板上次给这个功能用的那条，**且 cwd 就是功能根**；
 *   ② 标题认领 —— 标题以 `WORK_TITLE` 开头，**且 cwd 就是功能根**（自己建的会话，清缓存也能认回）；
 *   ③ 没有 → 返回 null（调用方去建；建完一定 `rename` 成 `workTitleFor(root)`，下次就靠 ② 认回来）。
 *
 * ★ 为什么**不**像索引会话那样兜一条"cwd 落在功能根里的任意会话"：
 *   工作会话会被面板**发指令**（索引会话只被读）。认一条用户自己的会话 = 往用户的对话里插活，
 *   正是用户故事 23 要避免的（"我的对话不被工作任务的来回打断"）。
 *   所以这里只认"我们自己的凭据"：缓存里的 id，或我们命名过的标题。
 * ★ 为什么 cwd 必须**恰好等于**功能根（不是 contains）：工作会话的 cwd = 功能文件夹本身；
 *   落在别处（比如 SR 根、别的功能）说明它不是这个功能的工作会话。
 */
export function pickWorkSession(
	rows: SessionRow[],
	featureRoot: unknown,
	opts?: { cachedId?: string; archived?: ArchivedIds },
): SessionPick | null {
	const o = opts || {};
	const root = normPath(featureRoot);
	if (root === "") return null;
	const live = withoutArchived(rows || [], o.archived).filter((r) => samePath(r.cwd, root));
	if (live.length === 0) return null;

	// ① 缓存
	if (o.cachedId) {
		const hit = live.filter((r) => r.id === o.cachedId)[0];
		if (hit) return { id: hit.id, source: "cache", row: hit, others: Math.max(0, live.length - 1) };
	}

	// ② 标题认领（同 cwd 下可能有多条历史，取最近更新的那条）
	const named = live.filter((r) => isWorkTitle(titleOf(r)));
	const best = newest(named);
	if (best) return { id: best.id, source: "title", row: best, others: Math.max(0, named.length - 1) };
	return null;
}

/**
 * localStorage 里记"每个功能用哪条工作会话"的键（只在组合根里读写）。
 * ★ 与索引会话的键分开：索引会话一条工作区一个，工作会话**一个功能一条**，所以值是一张表。
 */
export function workCacheKey(): string {
	return "sr-wb.work.v1";
}

/** 缓存原文（可能是坏 JSON / 空）→ 表。坏值一律当空表，绝不抛。 */
function workCacheTable(raw: unknown): Record<string, string> {
	if (typeof raw !== "string" || raw === "") return {};
	try {
		const v = JSON.parse(raw) as Record<string, unknown> | null;
		if (!v || typeof v !== "object") return {};
		const out: Record<string, string> = {};
		for (const k of Object.keys(v)) {
			const one = v[k];
			if (typeof one === "string" && one !== "") out[k] = one;
		}
		return out;
	} catch (e) {
		return {};
	}
}

/** 这张表里，这个功能用的是哪条工作会话（没有 → 空串）。 */
export function workCacheGet(raw: unknown, featureRoot: unknown): string {
	const root = normPath(featureRoot);
	if (root === "") return "";
	return workCacheTable(raw)[root] || "";
}

/** 写回一条（返回**新的**缓存原文；组合根负责 `setItem`）。 */
export function workCachePut(raw: unknown, featureRoot: unknown, sid: unknown): string {
	const root = normPath(featureRoot);
	const t = workCacheTable(raw);
	if (root !== "" && typeof sid === "string" && sid !== "") t[root] = sid;
	return JSON.stringify(t);
}

/** 删掉一条（会话失效自愈时用；返回新的缓存原文）。 */
export function workCacheDrop(raw: unknown, featureRoot: unknown): string {
	const root = normPath(featureRoot);
	const t = workCacheTable(raw);
	if (root !== "") delete t[root];
	return JSON.stringify(t);
}

// ════════════════════════════════════════════════════════════════════════════
// 权限预设（工单 07 第 7 条）—— 建完工作会话要能改到「完全权限」，并且**能读回来**
// ════════════════════════════════════════════════════════════════════════════

/**
 * 「完全权限」的机器值。
 * 依据：`dsh-permission-presets/lib/index.js:151-156`（presets 里的 `danger-full-access`
 * = sandbox `danger-full-access` + approval `never`），客户端标签见
 * `dsh-client-ui-permission-presets/lib/client.js:231`（`FULL_ACCESS_PRESET`）。
 */
export const PERMISSION_FULL = "danger-full-access";

/**
 * 切预设的**唯一**通道：官方注册的斜杠命令 `/permission <preset>`。
 *
 * ★ 为什么是命令而不是某个 remote 方法：`dsh-permission-presets` 只对外暴露一个 remote
 *   （`permissionPresets/catalog`，见 `.../typert.remote-client.js`）——**没有 set 方法**；
 *   官方自己切预设就是那条命令（`lib/index.js:207-226` 注册 `permission` 命令，
 *   官方 plan 插件也是这么发命令的：`dsh-client-ui-plan/lib/client.js:704`
 *   `remote.commands.execute(sessionId, "/plan off", [])`）。
 */
export function permissionCommandLine(preset: unknown): string {
	const p = typeof preset === "string" && preset !== "" ? preset : PERMISSION_FULL;
	return "/permission " + p;
}

/** 这条会话**当前**是不是「完全权限」——`true` 才需要动手；读不到（`""`）一律不动。 */
export function needsFullAccess(preset: unknown): boolean {
	return typeof preset === "string" && preset !== "" && preset !== PERMISSION_FULL;
}

export interface PermissionPlan {
	/** 要不要发那条命令 */
	needed: boolean;
	preset: string;
	/** 为什么（机器口径，测试与报告用） */
	why: string;
	/** 给人看的一句话（空 = 不用说什么） */
	note: string;
}

/**
 * 由 `remote.permissionPresets.catalog()` 的返回（`{ options, defaultOptions, defaultPreset }`，
 * 形状见 `dsh-permission-presets/lib/typert.remote-client.js`）决定**要不要切**。
 *
 * ★ 为什么以"进程默认预设"为准：新会话是**播种**默认预设的
 *   （`lib/index.js:198-201` `ctx.on("session/created", pinInitialPermission)`），
 *   所以默认已是完全权限时，新工作会话建出来就是完全权限，**面板不需要再切**——
 *   这时如实说一句"本机默认就是完全权限"，而不是多发一条命令装样子。
 * ★ 读不到（catalog 不可用 / 形状变了）时**按最坏情况切一次**：宁可在日志里多一条命令，
 *   也不要让"配置支线写 config_root / gtgenerator 工作目录"被沙箱拦下来。
 */
export function permissionPlanOf(catalog: unknown): PermissionPlan {
	const obj = catalog && typeof catalog === "object" ? (catalog as { defaultPreset?: unknown }) : null;
	const def = obj && typeof obj.defaultPreset === "string" ? obj.defaultPreset : "";
	if (def === PERMISSION_FULL) {
		return {
			needed: false, preset: PERMISSION_FULL, why: "default=" + PERMISSION_FULL,
			note: "本机 profile 的默认权限预设已是「完全权限」（permission.defaultPreset = " +
				PERMISSION_FULL + "）：新建的会话本身就是完全权限，不用再切。"
		};
	}
	if (def === "") {
		return {
			needed: true, preset: PERMISSION_FULL, why: "unreadable",
			note: "读不到本机的默认权限预设（`permissionPresets.catalog` 不可用或形状变了）：" +
				"按最坏情况给这条工作会话切一次「完全权限」。"
		};
	}
	return {
		needed: true, preset: PERMISSION_FULL, why: "default=" + def,
		note: "本机默认权限预设是「" + def + "」，不是完全权限：这条工作会话已切成「完全权限」——" +
			"否则功能文件夹之外的产出（配置支线写 config_root、gtgenerator 工作目录）会被拦。"
	};
}

/**
 * 切完之后那句话（含**读回**证据）。
 * @param execOk   命令本身成功没有
 * @param execText 命令返回的人话（`preset danger-full-access` / 错误文本）
 * @param readback 重新拉列表读回的该会话预设（`permissions.currentValue`，读不到 = `""`）
 */
export function permissionResultNote(execOk: boolean, execText: unknown, readback: unknown): string {
	const want = PERMISSION_FULL;
	const got = typeof readback === "string" ? readback : "";
	const text = String(execText === null || execText === undefined ? "" : execText);
	if (!execOk) {
		return "没能把这条工作会话切到完全权限（" + (text || "命令失败") + "）：" +
			"功能文件夹之外的产出可能被拦 —— 在左侧点开这条会话，手动发 `/permission " + want + "` 即可。";
	}
	if (got === want) return "已把这条工作会话切成「完全权限」（读回 permissions = " + got + "）。";
	if (got !== "") {
		return "切权限的命令返回成功，但读回仍是「" + got + "」（不是完全权限）：" +
			"以读回为准，功能文件夹之外的产出可能被拦。";
	}
	return "已发切换命令（返回：" + (text || "无文本") + "），但**读不回**当前预设：" +
		"如果产物被拦，在左侧点开这条会话手动发 `/permission " + want + "`。";
}

