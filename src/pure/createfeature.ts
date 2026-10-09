/**
 * 新建功能（v5 口径）—— 校验主题名、算出**要建什么**，仅此而已。
 *
 * ── v5 与 v4 的分工变化（一句话：面板终于能自己写盘了）──────────────────────
 * v4：面板在 Remote 层**没有写能力**（只有读 + 目录级操作），所以"新建"只能组装一条指令
 *     发给 agent，再由 agent 用 PowerShell 把目录建出来；于是有了 `feature.json` 身份声明、
 *     一段逐字的脚手架脚本、以及"回读核对"。
 * v5：DSH 的 `uiWorkspace.createDirectory(parent, name)` 就是**建目录**的原语
 *     （宿主 `directoryPicker` 的 browse 后端，直接 `mkdir` 一级），面板直接建：
 *
 *       ① `<SR 工作区>\features\<主题>\`            ← 建一个目录
 *       ② 里面 4 个桶：evidence / analysis / gdd / decisions
 *
 *     全部本地完成，**不发指令、不经过 AI、不写任何文件内容**（决策记录.md 由会话里的
 *     agent 在第一次决策时按格式创建 —— 那是它该干的事，见操作文档 §决策记录）。
 *     代价：不再有 `feature.json`。**功能的身份就是目录名** —— 改名就换身份，
 *     这是 v5 明确接受的取舍（要改名请在面板外改，并同步侧边栏工作区）。
 *
 * 纯函数、零 IO、零时钟（`compact` / `created` 由调用方给）。
 */

import { BUCKETS, BUCKET_MEANING } from "./buckets.ts";
/**
 * 主题名的长度上限（**工作台口径**，不是 Windows 的物理极限——单段 255）。
 * 理由：主题名是"标签"，要能在一张卡、一行页签、一条指令里读完整。
 */
export const TOPIC_MAX = 64;

/** Windows 目录名不允许的字符（`\ / : * ? " < > |`）与不可见控制字符。 */
const TOPIC_ILLEGAL = /[\\/:*?"<>|]/;
const TOPIC_CONTROL = /[\u0000-\u001f\u007f]/;
/** Windows 保留设备名（不分大小写；`CON.txt` 这种带扩展名的形式同样保留）。 */
const TOPIC_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export interface TopicCheck {
	ok: boolean;
	code: string;
	message: string;
	next: string;
}

const topicOk = (): TopicCheck => ({ ok: true, code: "", message: "", next: "" });
const topicBad = (code: string, message: string, next: string): TopicCheck => ({ ok: false, code: code, message: message, next: next });

/**
 * 主题名合法性（**真实约束，不发明**）：
 *   · Windows 目录名限制：非法字符 / 保留设备名 / 结尾的空格或点（Win32 会悄悄去掉）/ `.` `..` / 控制字符；
 *   · 工作台口径：长度 ≤ `TOPIC_MAX`；首尾空白**拒绝**而不是静默裁掉 ——
 *     "你看到的目录名必须就是你输的名字"。
 * 返回的是**给人看的一句话 + 下一步**（面板原样显示，不另写话术）。
 */
export function checkTopicName(topic: unknown): TopicCheck {
	const raw = String(topic === null || topic === undefined ? "" : topic);
	if (raw.trim() === "") {
		return topicBad("empty", "还没输主题名。",
			"输入一个主题名 —— 它会成为 `features\\<主题>\\` 这个目录名，例如 `联盟讨伐`。");
	}
	if (raw !== raw.trim()) {
		return topicBad("padded", "主题名首尾有空白。",
			"Windows 会把首尾的空格/点悄悄去掉，目录名就和你输的不一样了 —— 去掉再提交（名字中间的空格没问题）。");
	}
	if (TOPIC_CONTROL.test(raw)) {
		return topicBad("control", "主题名里有不可见字符（控制字符）。",
			"删掉它重输 —— 这种字符在资源管理器里看不出来，却会写进目录名。");
	}
	const bad = TOPIC_ILLEGAL.exec(raw);
	if (bad) {
		return topicBad("illegal", "主题名里有 Windows 目录名不允许的字符：「" + bad[0] + "」（不允许的是 \\ / : * ? \" < > |）。",
			"换成不含这些字符的名字（用「-」或中文顿号代替即可）。");
	}
	if (raw === "." || raw === "..") {
		return topicBad("dot", "「" + raw + "」是目录名里的保留记号，不能当主题名。", "换一个名字。");
	}
	if (/[. ]$/.test(raw)) {
		return topicBad("padded", "主题名以「" + raw.slice(-1) + "」结尾。",
			"Windows 会把结尾的空格/点悄悄去掉，目录名就和你输的不一样了 —— 去掉再提交。");
	}
	if (TOPIC_RESERVED.test(raw)) {
		return topicBad("reserved", "「" + raw + "」是 Windows 的保留设备名（CON / PRN / AUX / NUL / COM1-9 / LPT1-9）。",
			"换一个名字 —— 用保留设备名建目录，系统会认不出来。");
	}
	if ([...raw].length > TOPIC_MAX) {
		return topicBad("too-long", "主题名 " + [...raw].length + " 个字，超过工作台的口径（≤ " + TOPIC_MAX + "）。",
			"取一个短一点的主题名（它要能在一张卡和一行页签里读完整）。");
	}
	return topicOk();
}

/** 新建前要读的**事实**（全部来自只读通道：列目录 + 客户端 store 里的工作区表）。 */
export interface NewFeatureFacts {
	/** `features\` 下**已存在**的目录名（不过滤噪音 —— 目录存在就不能往里建东西）。 */
	dirNames: string[];
	/** DSH 已登记的工作区路径（用于"这个路径是不是已经登记过"）。 */
	wsPaths: string[];
	/** SR 工作区根（绝对路径；拿不到就没法算 root）。 */
	srWs?: string;
}

export interface NewFeaturePlan {
	ok: boolean;
	code: string;
	topic: string;
	/** 功能根（绝对路径，`<SR 工作区>\features\<主题>`）。 */
	root: string;
	/** 桶名（**顺序即创建顺序**，取自 `./buckets.ts`）。 */
	buckets: string[];
	/** 建不 ok 时的人话。 */
	message: string;
	/** 建不 ok 时的下一步。 */
	next: string;
}

/** 路径归一（比对用：大小写不敏感、分隔符统一、去尾斜杠）。 */
export function pathKey(p: unknown): string {
	return String(p === null || p === undefined ? "" : p)
		.replace(/[\\/]+/g, "\\")
		.replace(/\\+$/, "")
		.toLowerCase();
}

/**
 * 功能根：`<srWs>\features\<主题>`（与看板 / 详情**同一拼法**）。
 * ★ 分隔符统一成 `\`：这串路径会显示在卡片、页签、错误话术里，也直接喂给
 *   `workspace.create` / `session.create`（Windows 两种都认，但**显示出来要是一个样子**）。
 */
export function featureRootFor(srWs: unknown, topic: string): string {
	const base = String(srWs === null || srWs === undefined ? "" : srWs).replace(/[\\/]+$/, "");
	return base + "\\features\\" + String(topic);
}

/**
 * 校验 + 算路径（**一次算完**：面板显示的就是这里算出来的，建的就是它）。
 *
 * 三种拒绝：
 *   `topic-*`         主题名本身不合法（非法字符 / 保留名 / 结尾点号 / 超长 / 空）
 *   `no-anchor`       拿不到 SR 工作区锚点（那就不知道往哪儿建）
 *   `dir-exists`      目录已存在（`features\<主题>\` 已经在了 —— 改名不改身份，所以直接进它）
 *   `workspace-taken` 这个路径上**已经登记过一个工作区**（先确认那个目录在不在）
 */
export function planNewFeature(topic: unknown, facts: NewFeatureFacts, srWs?: string): NewFeaturePlan {
	const t = String(topic === null || topic === undefined ? "" : topic);
	const base = String(srWs || (facts && facts.srWs) || "");
	const root = featureRootFor(base, t);
	const bad = (code: string, message: string, next: string): NewFeaturePlan => ({
		ok: false, code: code, topic: t, root: root, buckets: BUCKETS.slice(), message: message, next: next
	});

	const c = checkTopicName(t);
	if (!c.ok) return bad(c.code, c.message, c.next);

	if (base.trim() === "") {
		return bad("no-anchor", "没读到 SR 工作区锚点（sr 配置里的 sr_workspace）。",
			"先确认 sr 配置能读到（`.agents\\skills\\sr-askme\\config.local.json`），再刷新面板重试。");
	}

	const key = nameKey(t);
	for (const d of (facts && facts.dirNames) || []) {
		if (nameKey(d) === key) {
			return bad("dir-exists", "`features\\" + d + "\\` 已经有这个目录了（**目录存在就是功能**）。",
				"要在这个功能上干活，直接在看板上点它的卡片；要建**新**功能，换个名字。");
		}
	}

	const rootKey = pathKey(root);
	for (const p of (facts && facts.wsPaths) || []) {
		if (pathKey(p) === rootKey) {
			return bad("workspace-taken", "已经有一个工作区登记在 `" + root + "` 这个路径上了。",
				"先确认那个目录在不在：在就用它（刷新面板就会扫到），不在的话在侧边栏把那个工作区删掉再建。");
		}
	}

	return { ok: true, code: "", topic: t, root: root, buckets: BUCKETS.slice(), message: "", next: "" };
}

/** 目录名比对键（Windows：大小写不敏感、去尾空格与点）。 */
export function nameKey(p: unknown): string {
	return String(p === null || p === undefined ? "" : p).replace(/[. ]+$/, "").trim().toLowerCase();
}

/** 建目录时"这个目录该装什么"的一句话（界面显示；来源只有 `BUCKET_MEANING`）。 */
export function bucketHint(b: unknown): string {
	return BUCKET_MEANING[String(b == null ? "" : b)] || "";
}

/** 会话标题（工作会话的**认领凭据**，与 `sessionpick.workTitleFor` 同口径）。 */
export function sessionTitleFor(topic: unknown): string {
	return "策划工作台·工作（" + (String(topic == null ? "" : topic).trim() || "?") + "）";
}

// ════════════════════════════════════════════════════════════════════════════
// 建目录：三条路（2026-10-09 实测缺陷换来的）
// ════════════════════════════════════════════════════════════════════════════
/**
 * ★ 为什么要有这一整块：**`uiWorkspace.createDirectory` 在 Windows 上不存在。**
 *
 * DSH 的目录选择器由 `dsh-host-directory-picker-auto` 在**启动时**选后端，规则是：
 * `bindHost !== "127.0.0.1"` → browse；SSH 启动 → browse；**`platform === "win32"` → native**；
 * linux 要有 `DISPLAY`/`WAYLAND_DISPLAY` 且有 zenity/kdialog 才 native。
 * 而 `createDirectory` 在宿主侧被 `requireCapability("browse", "createDirectory")` 挡着 ——
 * 于是 **Windows 环回部署（桌面版与 `dsh web` 都算）只有 native，没有 createDirectory**，
 * 报错原文：`directory-picker/unavailable: directoryPicker.createDirectory needs the browse
 * capability; the composed picker serves "native"`。
 *
 * 客户端能碰到的写盘通道只有三条，所以这里按顺序退：
 *   ① `uiWorkspace.createDirectory`（browse 后端才有的快路）；
 *   ② **让会话跑一条 PowerShell**（`New-Item -ItemType Directory -Force`，幂等）—— 通用；
 *   ③ 都不行 ⇒ 把**逐字命令**给用户，让他手工建；面板检测到"只有 4 个桶的空脚手架"会接着往下走。
 *
 * 判定"这是不是空脚手架"的判据在 `isBareScaffold`：**只有 4 个桶目录、一个文件都没有**。
 * 那样才允许"跳过建目录、直接建工作区与会话" —— 有内容就说明是**真功能**，照旧拒绝重名。
 */

/** 要建的目录（**顺序即创建顺序**：父目录在前）。`features\` 本身也算一个。 */
export function scaffoldDirsOf(srWs: unknown, topic: unknown): string[] {
	const base = String(srWs === null || srWs === undefined ? "" : srWs).replace(/[\\/]+$/, "");
	const t = String(topic === null || topic === undefined ? "" : topic);
	const root = base + "\\features\\" + t;
	return [base + "\\features"].concat(BUCKETS.map((b) => root + "\\" + b));
}

/**
 * 空脚手架判据：目录里**只有 4 个桶**（都是目录）、**一个文件都没有**、没有别的目录。
 * 空目录也算（建到一半的真实现状）。
 */
export function isBareScaffold(entries: Array<{ name: string; type: string }> | null | undefined): boolean {
	const list = Array.isArray(entries) ? entries : [];
	const buckets = BUCKETS.map((b) => b.toLowerCase());
	for (const e of list) {
		const n = String((e && e.name) || "").toLowerCase();
		if (!n) return false;
		if (String((e && e.type) || "") !== "directory") return false;   // 有文件 ⇒ 不是空脚手架
		if (buckets.indexOf(n) < 0) return false;                        // 有别的目录 ⇒ 不是
	}
	return true;
}

/**
 * 让会话建目录的**指令正文**（发给索引会话；正文里不留未定之数）。
 * 只做一件事：`New-Item -ItemType Directory -Force` 那几行，跑完回报一行。
 */
export function buildScaffoldInstruction(srWs: unknown, topic: unknown): string {
	const t = String(topic === null || topic === undefined ? "" : topic);
	const dirs = scaffoldDirsOf(srWs, t);
	const L: string[] = [];
	L.push("【新建功能 · 只建目录】请**只做这一件事**：建出下面这些目录（已存在的跳过），然后回报一行。");
	L.push("");
	L.push("要建的目录（逐字，共 " + dirs.length + " 个）：");
	for (const d of dirs) L.push("  " + d);
	L.push("");
	L.push("怎么建（PowerShell，`-Force` 幂等、已存在不报错；只跑这一段，不要写脚本文件）：");
	L.push("```powershell");
	L.push("$dirs = @(");
	for (const d of dirs) L.push("  '" + d.replace(/'/g, "''") + "'");
	L.push(")");
	L.push("New-Item -ItemType Directory -Force -Path $dirs | Out-Null");
	L.push("```");
	L.push("");
	L.push("规矩：");
	L.push("· **不要**往里面写任何文件（决策记录由功能的工作会话在第一次决策时创建）。");
	L.push("· **不要**动这 " + dirs.length + " 个目录以外的任何东西；这个功能目录现在不该存在内容。");
	L.push("· 跑完**只回报一行**：`OK " + dirs[dirs.length - 1] + "` 或 `FAILED <原因>`。");
	L.push("· 面板会自己回读核对，你不用汇报目录树。");
	return L.join("\n");
}

/** 三条路都走不通时给用户的**逐字命令**（复制即用；建完再点一次〔建立〕）。 */
export function manualScaffoldCommand(srWs: unknown, topic: unknown): string {
	const dirs = scaffoldDirsOf(srWs, topic);
	const L: string[] = [];
	L.push("$dirs = @(");
	for (const d of dirs) L.push("  '" + d.replace(/'/g, "''") + "'");
	L.push(")");
	L.push("New-Item -ItemType Directory -Force -Path $dirs | Out-Null");
	return L.join("\n");
}

/** 建之前那一句（面板原样显示）。 */
export function createPendingNotice(topic: string): string {
	return "正在建「" + topic + "」：功能目录 → 4 个桶 → 注册专属工作区 → 建工作会话（策划模式）。全程本地完成，不发任何指令。";
}

/** 建好了那一句（含怎么撤 —— 面板只建不删）。 */
export function createDoneNotice(topic: string, root: string, sid: string): string {
	return "建好了：「" + topic + "」· 4 个桶（evidence / analysis / gdd / decisions）都在 · 已登记为它的专属工作区" +
		(sid ? " · 工作会话已建好（策划模式）" : " · 工作会话没建起来（见下）") +
		"。要撤掉就删掉这个目录：" + root + "（面板只建不删）。";
}

/** 只建到一半那一句（如实说建到哪一步、下一步怎么办）。 */
export function createPartialNotice(topic: string, root: string, done: string[], failed: string, why: string): string {
	return "「" + topic + "」只建了一半：已经建好 " + (done.length ? done.join("、") : "（无）") +
		"；卡在 " + failed + "（" + why + "）。下一步：① 去 " + root + " 看看实际建出了什么；" +
		"② 缺的桶手工补建（或删掉这个目录在面板上重新新建）；③ 面板不会替你把已建的东西删掉。";
}
