/**
 * 「新建之后，侧边栏为什么还看不见」—— 把"该补调哪几个**官方客户端**方法"变成纯函数。
 *
 * ── 缺陷（2026-09-30 用户实测）──────────────────────────────────────────────
 *   面板在「定稿」页签按下「发到工作会话」时，走的是**裸 Remote**：
 *     `remote.workspace.create({path})` → `remote.session.create({workspaceId, agentPreset})`
 *     → `remote.session.rename(...)`。
 *   后端全对（会话真的建了、指令也发出去了），但**侧边栏当时看不见**这个新工作区分组与
 *   新会话行，按 F5 刷新之后才出现。
 *
 * ── 根因：绕过了官方客户端那两个"一次调用就把结果并进 store"的入口 ─────────────
 *   · 工作区分组来自侧边栏读的 **workspaces store**（`ClientWorkspaceModel`）。它的合并只发生在
 *     **客户端服务**那一层（`dsh-api-workspace-controller/lib/client.js`）：
 *       `WorkspaceController.create`(:393) → `ClientWorkspaceModel.create`(:51)
 *         → `upsert(result.value.workspace)`(:53/287)
 *     裸 `remote.workspace.create` 只把结果**返回**给调用方，没人往 store 里合并。
 *   · 会话行来自 **sessions store**（`SessionListState = {ids, byId, phase, projectionsBySession}`）。
 *     官方建会话走 `ClientSessions.create`(:3324) → `SessionManager.create`(:2678) 里的
 *     `recordMutation({kind:"placeholder"})`(:2688) + `projectList()`；
 *     store 的**全量重拉**口子是 `ClientSessions.refresh`(:3258) → `SessionManager.refreshList`(:2603)
 *     （`session.list` 拉一次基线，连 `projections.values.title` 一起装上）。
 *     裸 `remote.session.create` / `remote.session.rename` **同样不碰**这两个 store。
 *   ⇒ 官方「新会话」按钮之所以建完立刻看得见，就是因为它走的是上面那条**客户端服务**的路：
 *     `dsh-client-ui-workspace/lib/client.js:846 startSession` → `:824 openWorkspace`
 *     → `:789 connectWorkspace` → `:800 reuseOrCreateBlank` → `:808 this.sessions.create({workspaceId})`。
 *
 * ── 本模块只回答一件事：这次该补调哪几个官方方法、哪个做不到 ────────────────────
 *   IO 全留在组合根（`src/client.js` 的 `syncSidebarStores`）：这里不碰 ctx / remote / store。
 *   逐条用例在 `test/pure-storemerge.test.ts`。
 */

/**
 * 官方客户端 store 两个入口在不在（组合根用 `ctx.get` 探；探不到就如实降级）。
 * ★ 用 `ctx.get` 而不是 `inject`：写成 inject 的话，只要这两个服务没被提供，
 *   **整个插件就不激活（面板消失）**——见 `src/client.js` 顶部那段说明。
 */
export interface SidebarStoreServices {
	/** `ctx.get("workspaces")` 拿得到，且有 `create()` —— 把工作区行并进 store 的唯一官方入口 */
	workspaces: boolean;
	/** `ctx.get("sessions")` 拿得到，且有 `refresh()` —— 重拉会话基线的官方入口 */
	sessions: boolean;
}

export interface SidebarSyncInput {
	/**
	 * 新建会话所在的目录（工作区分组按它认领）。
	 * `""` = 这条会话没有工作区归属（会落进「未分组」）——那就没有"要重新解析的工作区行"。
	 */
	path: string;
	services: SidebarStoreServices;
}

/** 一次"补合并"要调的官方方法（按顺序执行；名字同时用于日志与证据）。 */
export type SidebarSyncStep = "workspaces.create" | "sessions.refresh";

export interface SidebarSyncPlan {
	/** 要重新解析（= 把最新视图并进 store）的工作区路径；`""` = 跳过这一步 */
	resolvePath: string;
	/** 要不要重拉会话基线 */
	refreshSessions: boolean;
	/** 实际要调的方法名（有序） */
	steps: SidebarSyncStep[];
	/** 做不到的部分如实说（给用户看的一句话；都做得到就是空数组） */
	notes: string[];
}

/** 取不到 workspaces 客户端服务时的那句话（面板照实说，不装"已经即时生效"）。 */
export const NO_WORKSPACES_SERVICE =
	"取不到官方 workspaces 客户端服务：新工作区分组这次不会即时出现在侧边栏（要刷新页面）。";

/** 取不到 sessions 客户端服务时的那句话。 */
export const NO_SESSIONS_SERVICE =
	"取不到官方 sessions 客户端服务：新会话行这次不会即时出现在侧边栏（要刷新页面）。";

/**
 * 算出"建完之后补哪几刀"。
 *
 * 顺序是**刻意**的：先把工作区行解析回来（分组与它的 `sessionIds` 到位），再重拉会话基线
 * —— 反过来会出现一瞬间"会话已在 store 里、但没有任何分组认领它"的「未分组」闪一下。
 */
export function planSidebarSync(input: SidebarSyncInput): SidebarSyncPlan {
	const path = typeof input.path === "string" ? input.path.trim() : "";
	const services = input.services || { workspaces: false, sessions: false };
	const resolvePath = path !== "" && services.workspaces === true ? path : "";
	const refreshSessions = services.sessions === true;

	const steps: SidebarSyncStep[] = [];
	if (resolvePath !== "") steps.push("workspaces.create");
	if (refreshSessions) steps.push("sessions.refresh");

	const notes: string[] = [];
	if (path !== "" && services.workspaces !== true) notes.push(NO_WORKSPACES_SERVICE);
	if (services.sessions !== true) notes.push(NO_SESSIONS_SERVICE);

	return { resolvePath, refreshSessions, steps, notes };
}

/**
 * 这一步自己**需不需要**出手（一看就懂的自查口，组合根与测试都用它）：
 * 一条都不用调 = 这次没什么可合并的（例如两个服务都取不到）。
 */
export function sidebarSyncNeeded(plan: SidebarSyncPlan): boolean {
	return plan.steps.length > 0;
}
