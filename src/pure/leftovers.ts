/**
 * 残留（功能被**手工删掉**之后，工作区登记 / 工作会话 / 面板自己的记忆还留着它的痕迹）
 * —— 判据在这里，动作在组合根。
 *
 * ── 为什么要有这一块（2026-10-13 用户实测）──────────────────────────────────
 *   「新建功能」建的不只是一个目录：面板还会给功能**注册专属工作区**、建一条**工作会话**，
 *   再往 `localStorage` 里记一条"这个功能用哪条会话"。用户嫌麻烦，直接在资源管理器里
 *   把 `features\<主题>\` 删掉 —— 于是那三样**都不会跟着走**。
 *   用户原话：「我手动删了功能，这个没有清理吗。需要优化一下」。
 *
 * ── 判据：**看磁盘，不看看板**（踩过两次才定下来的）────────────────────────
 *   「残留 = 这些痕迹指向的功能目录**已经不在了**」—— 判据是**磁盘事实**，
 *   而不是"它没出现在看板的这一份快照里"。这条区别是硬的：
 *
 *   · 看板（扫 `features\` 得到的列表）与侧边栏 store（工作区 / 会话快照）是**两个数据源，
 *     更新时序不一样**。新建功能时 `syncSidebarStores` 会**当场**把新工作区并进 store，
 *     而看板要等 `refresh()` 之后的下一次请求才含它 —— 中间那个窗口里，
 *     「新工作区 + 旧看板」和「孤儿工作区」在数据上完全一样。
 *   · 真踩过两次：① 视图校验拿旧看板误报「上次打开的功能没找到」；
 *     ② 这一块的清理拿旧看板判残留 ⇒ **把面板自己刚建出来的工作区登记删掉、刚建的会话归档掉**
 *     （用户实测：「又新建了一个 测试用例，这次只创建出文件夹，工作区没创建」）。
 *     补一句"等看板刷新到最新一轮"的守卫**也不够** —— 触发清理的那次重渲染来自 store 更新，
 *     那时 `rev` 还没动，守卫根本看不到差别。
 *   · 改成"目录确实不在磁盘上"之后，这个窗口**天然不存在**：目录就在那儿，谁都判不出残留。
 *
 * ── 边界（这一块只算"该清哪些"，不碰任何东西）──────────────────────────────
 *   · **只认面板自己造的**：工作会话要有「策划工作台·工作（…）」这个标题**并且** cwd 落在
 *     `<SR 工作区>\features\` 下；工作区要**路径**落在同一个 `features\` 下。
 *     别人的会话 / 别处的工作区一律不判（哪怕它们也"看起来没用"）。
 *   · 两种动作都**不碰文件**：`workspace.archiveSession` 是侧边栏归档（可取消归档），
 *     `workspace.delete` 的宿主口径是
 *     "Delete one Workspace registration **without deleting its directory or Sessions**"。
 *   · **探测不可用就不判**：`features\` 根都列不出来时，"列不出来"和"确实没有了"分不清 ——
 *     调用方在做这个自检之前不许给 `gone`。
 */

import { archivedIdSet } from "./sessionpick.ts";

/** 工作会话的标题前缀（**认领凭据**，与 `createfeature.sessionTitleFor` 同一口径）。 */
export const WORK_SESSION_TITLE = "策划工作台·工作（";
/** 功能目录所在的层级：`<SR 工作区>\features\<主题>`。 */
const FEATURES_SEG = "features";

/** 标题 → 主题（不是「策划工作台·工作（X）」这个形状就给空串）。 */
export function workTopicOfTitle(title: unknown): string {
	const t = String(title === null || title === undefined ? "" : title).trim();
	if (t.indexOf(WORK_SESSION_TITLE) !== 0) return "";
	if (t.charAt(t.length - 1) !== "）") return "";
	return t.slice(WORK_SESSION_TITLE.length, -1).trim();
}

/**
 * 绝对路径 → 主题：只认 `<SR 工作区>\features\<主题>` 的**直接子目录**。
 * 大小写不敏感、分隔符两种都吃（Windows）；层级不对、或只有 `features\` 本身 ⇒ 空串。
 */
export function featureTopicOfPath(srWs: unknown, p: unknown): string {
	const base = String(srWs === null || srWs === undefined ? "" : srWs).replace(/[\\/]+$/, "").replace(/\//g, "\\");
	const full = String(p === null || p === undefined ? "" : p).replace(/[\\/]+$/, "").replace(/\//g, "\\");
	if (base === "" || full === "") return "";
	if (full.toLowerCase().indexOf(base.toLowerCase() + "\\") !== 0) return "";
	const rest = full.slice(base.length + 1).split("\\");
	if (rest.length !== 2) return "";
	if (rest[0].toLowerCase() !== FEATURES_SEG) return "";
	return rest[1].trim();
}

export interface LeftoverSession {
	id: string;
	topic: string;
	title: string;
}

export interface LeftoverWorkspace {
	id: string;
	topic: string;
	path: string;
}

export interface Leftovers {
	/** 这一轮能不能判（不可信时 `sessions` / `workspaces` 一律空表）。 */
	cleanable: boolean;
	/** 不可信时的一句人话（可信时是空串）。 */
	why: string;
	sessions: LeftoverSession[];
	workspaces: LeftoverWorkspace[];
	/** 涉及的主题（去重）—— 调用方拿它去探测"这些目录还在不在"。 */
	topics: string[];
}

export interface LeftoversInput {
	/** 看板认到的 SR 工作区根。 */
	srWs: unknown;
	/**
	 * 侧边栏的**已归档**会话集（官方 workspaces 快照的 `archivedSessionIds`）。
	 *
	 * ★ 必须给，而且**拿不到就不许清** —— 归档**不会**让会话从 `remote.session.list` 里消失
	 *  （列表不按归档过滤，只是官方侧边栏把它藏起来；`SessionListRequest` 只有可选 cursor）。
	 *   不看它，同一批会话会被反复归档、反复报数（用户原话「这什么玩意 怎么一直在」）。
	 *   与 `sessionpick.ts` 同一条纪律：`[]` = 明确知道一条都没归档；拿不到 = 如实降级。
	 */
	archived: unknown;
	/** 会话行（`remote.session.list` 或客户端 store，字段名见 `SessionRow`）。 */
	sessions: unknown;
	/** 侧边栏的工作区行（官方 workspaces 快照的 `items`）。 */
	workspaces: unknown;
	/**
	 * 这个主题的功能目录**确实不在磁盘上**吗（调用方探测后给的回调）。
	 * **不给 / 拿不准 ⇒ 一律当"还在"**（宁可这轮不干活，也不要删错）。
	 */
	gone?: (topic: string) => boolean;
}

/** 形状筛选（判据本体）：只认面板自己造的那些痕迹。 */
function shapePick(o: LeftoversInput, onlyMissing: boolean): Leftovers {
	const none = (why: string): Leftovers => ({ cleanable: false, why: why, sessions: [], workspaces: [], topics: [] });

	const srWs = String(o.srWs === null || o.srWs === undefined ? "" : o.srWs).replace(/[\\/]+$/, "");
	if (srWs === "") return none("没读到 SR 工作区锚点，这轮不判残留。");
	const archived = archivedIdSet(o.archived);
	if (archived === null) {
		return none("拿不到侧边栏的「已归档」集（官方 workspaces 快照里没有 archivedSessionIds），这轮不判残留 —— 否则已经归档过的会被反复再归档。");
	}
	const gone = typeof o.gone === "function" ? o.gone : () => false;
	const keep = (topic: string) => !onlyMissing || gone(topic) === true;

	const sessions: LeftoverSession[] = [];
	const seenSession = new Set<string>();
	for (const r of (Array.isArray(o.sessions) ? o.sessions : [])) {
		const id = String((r && r.id) || "");
		if (id === "" || seenSession.has(id)) continue;
		if (archived.has(id)) continue;                              // 已经归档过的：它在列表里照样出现，但不是残留了
		const topic = workTopicOfTitle(r && r.title);
		if (topic === "") continue;
		if (featureTopicOfPath(srWs, r && r.cwd) === "") continue;   // ★ cwd 也要落在 features\ 下：标题可以手抄，路径不会
		if (!keep(topic)) continue;
		seenSession.add(id);
		sessions.push({ id: id, topic: topic, title: String((r && (r.title || r.display)) || "") });
	}

	const workspaces: LeftoverWorkspace[] = [];
	const seenWs = new Set<string>();
	for (const w of (Array.isArray(o.workspaces) ? o.workspaces : [])) {
		/**
		 * ★ 工作区行的 id 字段叫 **`workspaceId`**（官方 `WorkspaceSnapshot.items` 那一行就是
		 *   `{ workspaceId, path, title, … }`，见 `dsh-api-workspace-controller` 的 create 结果）。
		 *   宽容地也认 `id`，但**以 workspaceId 为准** —— 认错字段的后果是"永远判不出残留"，
		 *   也就是这一整块静默失效（比报错难查得多）。
		 */
		const id = String((w && (w.workspaceId || w.id)) || "");
		if (id === "" || seenWs.has(id)) continue;
		const topic = featureTopicOfPath(srWs, w && w.path);
		if (topic === "") continue;
		if (!keep(topic)) continue;
		seenWs.add(id);
		workspaces.push({ id: id, topic: topic, path: String((w && w.path) || "") });
	}

	const seenTopic = new Set<string>();
	const topics: string[] = [];
	for (const t of sessions.map((s) => s.topic).concat(workspaces.map((w) => w.topic))) {
		const k = t.toLowerCase();
		if (seenTopic.has(k)) continue;
		seenTopic.add(k);
		topics.push(t);
	}
	return { cleanable: true, why: "", sessions: sessions, workspaces: workspaces, topics: topics };
}

/**
 * **候选**：只按形状筛，不看目录在不在。
 * 调用方拿 `topics` 去探测磁盘，再用 `leftoversOf` 收口（两步走 —— 探测是 IO，纯层不碰）。
 */
export function leftoverCandidates(input: LeftoversInput): Leftovers {
	return shapePick(input || ({} as LeftoversInput), false);
}

/**
 * 残留 = 候选 ∩「那个功能目录确实不在了」。
 * **不给 `gone` 就等于一个都不判**（安全默认：宁可不干活，也不要删错）。
 */
export function leftoversOf(input: LeftoversInput): Leftovers {
	const o = input || ({} as LeftoversInput);
	if (typeof o.gone !== "function") {
		const c = shapePick(o, false);
		return {
			cleanable: c.cleanable,
			why: c.why || "没给「功能目录还在不在」的探测结果，这轮不判残留。",
			sessions: [], workspaces: [], topics: []
		};
	}
	return shapePick(o, true);
}
