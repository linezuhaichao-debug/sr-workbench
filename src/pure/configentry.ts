/**
 * 配置向导的**纯逻辑**（无 IO、无 React）：
 *   · 四个字段的校验（哪些必填、路径形状像不像本机绝对路径）；
 *   · **指针文件**的路径与判据 —— 面板在浏览器里拿不到 `%USERPROFILE%`，
 *     所以让会话写完配置后把**配置的绝对路径**写进 `<工作区根>\.dsh\sr-workbench.path`，
 *     面板读这个相对路径就知道配置在哪（用户口径：A 方案）。
 *   · 交给会话的**写配置指令**正文（逐字，含要写什么、写哪、以及必须回报什么）。
 *
 * ★ 字段口径的权威是技能里的 `config.local.example.json`（`skills/sr-askme/`）。
 *   面板认这四个字段是为了**先校验再发指令**；指令里仍然要求会话**照 example 校对字段形状**，
 *   所以权威没有被复制成第二份判断 —— 面板只做"必填与像不像路径"这一层。
 */

/** 配置里的四个字段（顺序即界面顺序；`required` 是本机跑起来的最小集）。 */
export const CONFIG_FIELDS = [
	{ key: "sr_workspace", label: "策划工作区", required: true, hint: "放功能目录的根：下面会有 features\\<主题>\\" },
	{ key: "sr_project", label: "Unity 工程", required: true, hint: "游戏工程目录（sr 系列读它做对照）" },
	{ key: "config_root", label: "策划配置目录", required: false, hint: "配置表所在目录（只有 /sr-config 用得到）" },
	{ key: "gtgenerator_workdir", label: "GTGenerator 工作目录", required: false, hint: "可选；不填就由技能自己问" }
] as const;

/** 指针文件：相对**工作区根**（面板知道工作区根，所以能读它）。 */
export const POINTER_REL = ".dsh\\sr-workbench.path";

/** 一个工作区根 → 指针文件的绝对路径。 */
export function pointerPathOf(root: unknown): string {
	const base = String(root === null || root === undefined ? "" : root).replace(/[\\/]+$/, "");
	return base === "" ? "" : base + "\\" + POINTER_REL;
}

/**
 * 这像不像**工作区根**（而不是某个功能目录）。
 * 判据：路径末尾是不是 `features\<主题>` 这一层 —— 指针文件**不能**写进功能目录，
 * 那会污染功能目录（面板会把它如实列成"不是 4 个桶的目录"）。
 */
export function looksFeatureDir(root: unknown): boolean {
	const s = String(root === null || root === undefined ? "" : root).replace(/[\\/]+$/, "");
	return /[\\/]features[\\/][^\\/]+$/i.test(s);
}

/**
 * 指针候选：**先放用户刚填的 `sr_workspace`**（那是确定的工作区根），再放其余已知根里
 * **像工作区根的**（功能目录一律排除）。
 */
export function pointerCandidates(roots: unknown[], srWorkspace?: unknown): string[] {
	const out: string[] = [];
	const seen: Record<string, true> = {};
	const push = (raw: unknown, skipFeatureDir: boolean) => {
		const s = raw === null || raw === undefined ? "" : String(raw);
		if (skipFeatureDir && looksFeatureDir(s)) return;
		const p = pointerPathOf(s);
		if (p === "") return;
		const k = p.toLowerCase();
		if (seen[k]) return;
		seen[k] = true;
		out.push(p);
	};
	push(srWorkspace, false);            // 用户填的那个：无条件收
	for (const r of roots || []) push(r, true);   // 其余：功能目录不要
	return out;
}

/**
 * 像不像一条**本机绝对路径**（Windows：`D:\...` 或 UNC `\\server\share`；也接受正斜杠写法）。
 * ★ 只做形状判断，**不判存在性** —— 存在性只有会话那边能验（它才有文件系统）。
 */
export function looksAbsolutePath(v: unknown): boolean {
	const s = String(v === null || v === undefined ? "" : v).trim();
	if (s === "") return false;
	if (/^[A-Za-z]:[\\/]/.test(s)) return true;
	if (/^\\\\[^\\/]+[\\/][^\\/]+/.test(s)) return true;
	return false;
}

/** 一条字段的问题（空 = 没问题）。 */
export interface FieldIssue {
	key: string;
	message: string;
}

/** 校验整张表：必填没填 / 形状不像绝对路径。 */
export function validateConfigValues(values: Record<string, unknown>): { ok: boolean; issues: FieldIssue[] } {
	const issues: FieldIssue[] = [];
	for (const f of CONFIG_FIELDS) {
		const raw = String((values || {})[f.key] === null || (values || {})[f.key] === undefined ? "" : (values || {})[f.key]).trim();
		if (raw === "") {
			if (f.required) issues.push({ key: f.key, message: f.label + " 必填" });
			continue;
		}
		if (!looksAbsolutePath(raw)) issues.push({ key: f.key, message: f.label + " 要填本机绝对路径（如 D:\\...）" });
	}
	return { ok: issues.length === 0, issues: issues };
}

/** 交给会话的**写配置指令**（逐字；会话是唯一写盘者）。 */
export function buildConfigInstruction(input: {
	values: Record<string, unknown>;
	/** 面板能读到的候选配置路径（profile 行 configPath 优先；空则让会话写用户目录默认位）。 */
	configPathHint?: string;
	/** 已知工作区根（会话写完配置后，把"配置在哪"写进这些根下的指针文件）。 */
	pointerPaths: string[];
	/** 生成的当天 `YYYYMMDD`。 */
	stamp: string;
}): string {
	const v = input.values || {};
	const lines: string[] = [];
	lines.push("【策划工作台 · 写本机配置】请**只做这一件事**：把下面这份配置写到本机，然后回报一行。");
	lines.push("");
	lines.push("配置内容（JSON，字段形状照技能目录里的 `config.local.example.json` 校对）：");
	lines.push("```json");
	lines.push(JSON.stringify({
		sr_workspace: String(v.sr_workspace || "").trim(),
		sr_project: String(v.sr_project || "").trim(),
		config_root: String(v.config_root || "").trim(),
		gtgenerator_workdir: String(v.gtgenerator_workdir || "").trim(),
		configured_at: input.stamp
	}, null, 2));
	lines.push("```");
	lines.push("");
	lines.push("写到哪：");
	if (input.configPathHint) {
		lines.push("  " + input.configPathHint);
		lines.push("  （这是面板配好的路径，逐字用）");
	} else {
		lines.push("  `$env:USERPROFILE\\.dsh\\sr-workbench\\config.local.json`");
		lines.push("  （目录不存在先建；这是**本机私有**文件，不要放进任何技能目录 —— 技能随插件在 node_modules 下，放那儿升级即丢）");
	}
	lines.push("");
	if (input.pointerPaths.length > 0) {
		lines.push("再把**配置的绝对路径**（就是你刚写的那个文件的完整路径）写进下面这些指针文件，每行一个：");
		for (const p of input.pointerPaths) lines.push("  " + p);
		lines.push("（每个文件只写一行：那个绝对路径。目录不存在先建。面板靠它认路 —— 浏览器里拿不到家目录。）");
		lines.push("");
	}
	lines.push("还要做的：");
	lines.push("· 若 `sr_workspace` 目录不存在就建出来（`New-Item -ItemType Directory -Force`）。");
	lines.push("· **不要**改动配置里没有的键；**不要**动别的目录。");
	lines.push("· 跑完**只回报一行**：`OK <配置绝对路径>` 或 `FAILED <原因>`。");
	return lines.join("\n");
}

/**
 * **面板的硬判据**：工作区锚点有没有。
 *
 * ★ 只有它是硬要求 —— 面板列卡片、读决策、看产物全靠它。
 *   `sr_project` / `config_root` 是**技能侧**的要求（缺了技能会问），
 *   面板不该因为缺它们就把整个界面换成向导（2026-10-09 实测：那会把新建功能一起挡掉）。
 */
export function workspaceMissing(cfg: unknown): boolean {
	const c = (cfg || {}) as Record<string, unknown>;
	return String(c.sr_workspace === null || c.sr_workspace === undefined ? "" : c.sr_workspace).trim() === "";
}

/**
 * 配置里的必填字段齐不齐（技能侧口径：`sr_workspace` + `sr_project`）。
 * 面板用它生成**提示**（缺哪个就报哪个），不用它决定要不要进向导。
 */
export function configIncomplete(cfg: unknown): boolean {
	const c = (cfg || {}) as Record<string, unknown>;
	for (const f of CONFIG_FIELDS) {
		if (!f.required) continue;
		if (String(c[f.key] === null || c[f.key] === undefined ? "" : c[f.key]).trim() === "") return true;
	}
	return false;
}
