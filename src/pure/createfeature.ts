/**
 * 新建功能（工单 22）—— **一个动作**：目录 + 六个桶 + 身份声明 + 专属工作区。
 *
 * ── 面板在这条路上的分工（本票的核心口径）────────────────────────────────────
 *   · 面板**不写盘**（`CONTEXT.md`「面板只读 / agent 执行」·`spec.md` Out of Scope「编辑文件」）：
 *     它做的是 ① 读事实 ② 把主题名校验干净 ③ 算好身份 ④ 把"要建什么"组装成一条**能直接照做**的
 *     指令（含逐字的 `feature.json` 与一段一把做完的脚本）⑤ 发出去 ⑥ **回读核对**。
 *   · 因此"不产生半成品"有两条落点：
 *       ① **先校验后创建** —— 校验不过就**一个字节都不写、连指令都不发**（面板侧可以断言的硬事实）；
 *       ② 建的动作在指令里被要求**要么全成、要么把这次建的删干净**（脚本里带 catch + 自清理，
 *          本票的 harness 把那段脚本原样跑过一遍，见报告）。
 *   · 回读核对不是可选项：`feature.json` 出现 + 六个桶齐全 + id 与面板算好的**逐字一致**，
 *     才算"建好了"；不一致就如实说（不装成功）。
 *
 * 纯函数：零依赖、零 IO。
 */

import { FEATURE_ID_RE, identityClash, identityJsonText, identityOf, type IdentityHolder, type IdentityView, nameKey, nextFeatureId } from "./featureid.ts";

/**
 * 六个桶的**规范顺序**：进（`source`）→ 出（`analysis` / `gdd` / `delivery`）→ 留痕（`decisions` / `evidence`）。
 * ★ 语义出处：`CONTEXT.md:20-28`（产物桶）+ `spec.md:137`。**顺序就是给人看的顺序**，
 *   所以它写在这里；与 `DIR_BUCKET` 的键集必须一致（`test/pure-createfeature.test.ts` 钉住这条，防两处漂移）。
 */
export const BUCKET_ORDER = ["source", "analysis", "gdd", "delivery", "decisions", "evidence"];

/** 每个桶在指令里的"装什么"（给 agent 看的一句话；语义抄 `CONTEXT.md`，不另立口径）。 */
export const BUCKET_MEANING: Record<string, string> = {
	source: "喂进去的原料（截图 / 录屏 / PV / 旧文档原件 / 外部交付包）",
	analysis: "做出来的分析产物（体验报告 / 问题卡 / 复刻规格 / 竞品分析…）",
	gdd: "成稿 / 定稿 / 定稿审查 / 界面图（定稿的 ASCII 图与 UI 图都在这）",
	delivery: "交付物（宣讲 HTML / AI 读版 / 下游交付包）",
	decisions: "过程留痕：决策（Human Gate 的结构化记录）",
	evidence: "过程留痕：证据（抽帧 / 索引 / 时间戳账本 / readback）"
};

/**
 * 主题名的长度上限（**本票定的工作台口径**，不是 Windows 的物理极限——单段 255）。
 * 理由：主题名是"标签"，要能在一张卡、一行页签、一条指令里读完整；64 个字足够，
 * 而且它必须**明确写在这里**（写在报告里），免得校验变成"说不清的规则"。
 */
export const TOPIC_MAX = 64;

/** Windows 目录名不允许的字符（`\ / : * ? " < > |`）与不可见控制字符。 */
const TOPIC_ILLEGAL = /[\\/:*?"<>|]/;
const TOPIC_CONTROL = /[\u0000-\u001f\u007f]/;

/** Windows 保留设备名（不分大小写；`CON.txt` 这种带扩展名的形式同样保留）。`COM0`/`LPT0` **不是**保留名。 */
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
 *   · 工作台口径：长度 ≤ `TOPIC_MAX`；首尾空白与内部合法（但首尾空白拒绝而不是静默裁掉——
 *     "你看到的目录名必须就是你输的名字"）。
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
		return topicBad("dot", "「" + raw + "」是目录名里的保留记号，不能当主题名。",
			"换一个名字。");
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

/** 新建前要读的**事实**（全部来自只读通道：列目录 + 读身份声明 + 客户端 store 里的工作区表）。 */
export interface NewFeatureFacts {
	/** `features\` 下**已存在**的目录名（不过滤噪音——目录存在就不能往里建东西） */
	dirNames: string[];
	/** 已认出身份的功能（用于"这个名字是不是别人的身份/别名"） */
	features: IdentityHolder[];
	/** DSH 已登记的工作区路径（用于"这个路径是不是已经登记过"） */
	wsPaths: string[];
	/** 今天：`YYYYMMDD`（进 id） */
	compact: string;
	/** 今天：`YYYY-MM-DD`（进 `created`） */
	created: string;
	/** sr 工作区根（绝对路径；拿不到就没法算 root） */
	srWs?: string;
}

export interface NewFeaturePlan {
	ok: boolean;
	code: string;
	topic: string;
	root: string;
	id: string;
	created: string;
	/** 身份声明的**逐字文本**（写盘的那一份） */
	json: string;
	/** 要发出去的指令正文（面板上"看将要发出去的指令"展开的就是它，逐字同一份） */
	instruction: string;
	/** 不 ok 时的人话 */
	message: string;
	/** 不 ok 时的下一步 */
	next: string;
}

/** 路径归一（比对用：大小写不敏感、分隔符统一、去尾斜杠） */
function pathKey(p: unknown): string {
	return String(p === null || p === undefined ? "" : p)
		.replace(/[\\/]+/g, "\\")
		.replace(/\\+$/, "")
		.toLowerCase();
}

/** 功能根：`<srWs>\features\<主题>`（与看板/详情同一拼法——`srWs + "/features/" + topic`，Windows 两种分隔符都认） */
export function featureRootFor(srWs: unknown, topic: string): string {
	const base = String(srWs === null || srWs === undefined ? "" : srWs).replace(/[\\/]+$/, "");
	return base + "/features/" + String(topic);
}

/**
 * 校验 + 算身份 + 组装指令（**一次算完**：面板显示的就是这里算出来的，发出去的也是它）。
 *
 * 四种拒绝（工单第 3 条逐条对应）：
 *   `topic-*`         主题名本身不合法（非法字符 / 保留名 / 结尾点号 / 超长 / 空）
 *   `dir-exists`      目录已存在（`features\<主题>\` 已经在了）
 *   `name-taken`      已存在同标识：这个名字已是**另一个功能的 `name` 或 `aliases`**
 *   `workspace-taken` 这个路径上**已经登记过一个工作区**
 */
export function planNewFeature(topic: unknown, facts: NewFeatureFacts, srWs?: string): NewFeaturePlan {
	const t = String(topic === null || topic === undefined ? "" : topic);
	const base = String(srWs || (facts && facts.srWs) || "");
	const root = featureRootFor(base, t);
	const bad = (code: string, message: string, next: string): NewFeaturePlan => ({
		ok: false, code: code, topic: t, root: root, id: "", created: (facts && facts.created) || "",
		json: "", instruction: "", message: message, next: next
	});

	const c = checkTopicName(t);
	if (!c.ok) return bad(c.code, c.message, c.next);

	if (base.trim() === "") {
		return bad("no-anchor", "没读到 sr 工作区锚点（sr 配置里的 sr_workspace）。",
			"先确认 sr 配置能读到（`.agents\\skills\\sr-askme\\config.local.json`），再刷新面板重试。");
	}

	const key = nameKey(t);
	for (const d of (facts && facts.dirNames) || []) {
		if (nameKey(d) === key) {
			return bad("dir-exists", "`features\\" + d + "\\` 已经有这个目录了（目录存在就是功能）。",
				"要在这个功能上干活，直接在看板上点它的「详情 ›」；要建**新**功能，换个名字。");
		}
	}

	const clash = (facts && facts.features) ? identityClash(facts.features, t) : null;
	if (clash) {
		const other = clash.identity.name || clash.topic;
		const aliases = clash.identity.aliases.length ? "（别名：" + clash.identity.aliases.join("、") + "）" : "";
		return bad("name-taken",
			"「" + t + "」已经是另一个功能的身份名或别名：" + other + aliases + "，目录 `features\\" + clash.topic + "\\`。",
			"改名是正常业务，所以工作台**按身份认功能**、不按目录名 —— 确认是同一个功能就直接进它的详情；是另一个功能就换个名字。");
	}

	const rootKey = pathKey(root);
	for (const p of (facts && facts.wsPaths) || []) {
		if (pathKey(p) === rootKey) {
			return bad("workspace-taken", "已经有一个工作区登记在 `" + root + "` 这个路径上了。",
				"先确认那个目录在不在：在的话直接用它（刷新面板就会扫到），不在的话在侧边栏把那个工作区删掉再建。");
		}
	}

	const takenIds: string[] = [];
	for (const f of ((facts && facts.features) || [])) {
		if (f && f.identity && f.identity.present && FEATURE_ID_RE.test(f.identity.feature_id)) takenIds.push(f.identity.feature_id);
	}
	const id = nextFeatureId(takenIds, (facts && facts.compact) || "");
	const created = (facts && facts.created) || "";
	const json = identityJsonText(id, t, created);
	return {
		ok: true, code: "", topic: t, root: root, id: id, created: created, json: json,
		instruction: buildCreateInstruction({ srWs: base, root: root, topic: t, id: id, created: created, json: json }),
		message: "", next: ""
	};
}

/** 按名字找一个"已经是别人身份"的功能 —— 只有一份实现（`featureid.identityClash`）。 */

export interface CreateInstructionInput {
	srWs: string;
	root: string;
	topic: string;
	id: string;
	created: string;
	json: string;
}

/**
 * 发给 agent 的指令正文。
 *
 * 口径（与 `instruction.ts` 同一套"说到不用再找"）：**建哪儿**（绝对路径）+ **建成什么形状**
 * （六个桶逐条 + 逐字的 `feature.json`）+ **一把做完的脚本** + **规矩**（已存在就停、失败删干净、别动别的）。
 * ★ 未定之数一个都不留：桶名、文件名、JSON 内容、日期、id 全是算好的。
 */
export function buildCreateInstruction(input: CreateInstructionInput): string {
	const L: string[] = [];
	const root = input.root;
	const featuresDir = String(input.srWs || "").replace(/[\\/]+$/, "") + "\\features";
	L.push("## 新建功能：" + input.topic);
	L.push("工作台已经把校验做完了（名字合法、没有重名、没有同标识冲突）。请**一次建全**下面这份形状 —— 别分步、别留半个目录。");
	L.push("");
	L.push("① 目录（在 `" + featuresDir + "\\` 下新建这一个功能目录，桶名逐字如下）");
	L.push("    " + root + "\\");
	for (const b of BUCKET_ORDER) {
		L.push("      " + b + "\\" + "　← " + (BUCKET_MEANING[b] || ""));
	}
	L.push("");
	L.push("② 身份声明（逐字写进 `" + root + "\\feature.json`，UTF-8 **无 BOM**，末尾留一个换行）");
	L.push("```json");
	for (const line of String(input.json || "").replace(/\n$/, "").split("\n")) L.push(line);
	L.push("```");
	L.push("");
	L.push("③ 一把做完（PowerShell 7，照抄执行即可；上面①②的内容都在这段里）");
	L.push("```powershell");
	for (const line of scaffoldScript(root, input.json).split("\n")) L.push(line);
	L.push("```");
	L.push("");
	L.push("规矩：");
	L.push("· `" + root + "\\` **现在不该存在**。若已存在：**别覆盖、别删它**，直接回报 `REFUSED 目录已存在`。");
	L.push("· 身份声明里的 `feature_id` 若已被别的功能占用，脚本会回报 `REFUSED feature_id 已被占用` —— 这时**别再建**，回报它就行。");
	L.push("· 任何一步失败：把**这次建的东西**（功能目录 + 六个桶 + `feature.json`）删干净，**别留半个目录**。");
	L.push("· 别动别的功能目录，别改 sr 工作区里的其它文件。");
	L.push("· 跑完回报一行：`已建立 " + input.topic + "（feature_id=" + input.id + "，六个桶 + feature.json）`。");
	return L.join("\n");
}

/**
 * 一把做完的脚本（**幂等的前提是不存在**：目标已存在就拒绝，而不是往里写）。
 *
 * 四段：① 目标目录已存在 → `REFUSED`，exit 3（**什么都不写**）；
 *       ①' 算好的 `feature_id` 已被**别的功能**占用（例如两个面板同时新建）→ `REFUSED`，exit 3
 *          —— 身份是唯一的，宁可让人重来，也不许两个功能共用一个 id；
 *       ② 建目录 → 六个桶 → 写 `feature.json`；③ 任一步抛错 → 删掉这次建的功能目录 → `FAILED-CLEANED`，exit 1。
 * 退出码是给 agent/人读的信号：0 成功 / 1 失败已清理 / 3 拒绝（已存在或 id 被占）。
 */
export function scaffoldScript(root: string, jsonText: string, buckets?: string[]): string {
	const q = (s: unknown) => "'" + String(s === null || s === undefined ? "" : s).replace(/'/g, "''") + "'";
	const list = (buckets && buckets.length ? buckets : BUCKET_ORDER).map(q).join(", ");
	const body = String(jsonText || "").replace(/\r\n/g, "\n").replace(/\n$/, "");
	const L: string[] = [];
	L.push("$root = " + q(root));
	L.push("$buckets = " + list);
	L.push("$json = @'");
	for (const line of body.split("\n")) L.push(line);
	L.push("'@");
	L.push("if (Test-Path -LiteralPath $root) { Write-Output ('REFUSED 目录已存在：' + $root); exit 3 }");
	// ★ id 的唯一性由这里兜住：扫一遍兄弟功能目录的身份声明，撞上就拒绝（不产生两个同 id 的功能）
	L.push("$fid = ($json | ConvertFrom-Json).feature_id");
	L.push("$dup = $false");
	L.push("Get-ChildItem -LiteralPath (Split-Path -Path $root -Parent) -Directory -ErrorAction SilentlyContinue | ForEach-Object {");
	L.push("  $f = Join-Path $_.FullName 'feature.json'");
	L.push("  if (Test-Path -LiteralPath $f) { try { if ((Get-Content -LiteralPath $f -Raw | ConvertFrom-Json).feature_id -eq $fid) { $dup = $true } } catch { } }");
	L.push("}");
	L.push("if ($dup) { Write-Output ('REFUSED feature_id 已被占用：' + $fid); exit 3 }");
	L.push("$made = $false");
	L.push("try {");
	L.push("  New-Item -ItemType Directory -Path $root -ErrorAction Stop | Out-Null");
	L.push("  $made = $true");
	L.push("  foreach ($b in $buckets) { New-Item -ItemType Directory -Path (Join-Path $root $b) -ErrorAction Stop | Out-Null }");
	L.push("  Set-Content -LiteralPath (Join-Path $root 'feature.json') -Value $json -Encoding utf8NoBOM -ErrorAction Stop");
	L.push("  Write-Output ('OK ' + $root)");
	L.push("} catch {");
	L.push("  if ($made) { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue }");
	L.push("  Write-Output ('FAILED-CLEANED ' + $_.Exception.Message)");
	L.push("  exit 1");
	L.push("}");
	return L.join("\n");
}

/** 回读一次拿到的东西（面板的**窄轮询**：列一下功能根 + 读一下 `feature.json`，两次调用） */
export interface CreatedReadBack {
	/** 功能根里的条目名（`null` = 目录还不存在） */
	entries: string[] | null;
	/** `feature.json` 的文本（读不到 = `null`） */
	identityText: string | null;
	/** 面板算好的 id（核对"写进去的是不是这一个"） */
	expectId?: string;
}

export interface CreatedVerdict {
	state: "absent" | "dir-only" | "partial" | "done" | "identity-mismatch";
	/** 还缺哪些桶 */
	missing: string[];
	identity: IdentityView | null;
	/** 界面上那一句进度（人话，不含机器口径） */
	progress: string;
	note: string;
}

/**
 * 建完之后**回读核对**（不装成功）：
 *   桶齐不齐、`feature.json` 认不认得出、id 与面板算好的**逐字是不是同一个**。
 * 五种状态：`absent`（还没出现）/ `dir-only`（只有目录）/ `partial`（缺桶或缺身份）/
 * `done`（都对上了）/ `identity-mismatch`（有身份但 id 不是算好的那个 —— 绝不当作建好）。
 */
export function verifyCreated(rb: CreatedReadBack): CreatedVerdict {
	const id = rb && rb.identityText !== null && rb.identityText !== undefined ? rb.identityText : null;
	if (!rb || rb.entries === null || rb.entries === undefined) {
		return {
			state: "absent", missing: BUCKET_ORDER.slice(), identity: null,
			progress: "已看到：功能目录 —（还在建）", note: "功能目录还没有出现"
		};
	}
	const have: Record<string, true> = {};
	for (const n of rb.entries) have[String(n).toLowerCase()] = true;
	const missing = BUCKET_ORDER.filter((b) => !have[b.toLowerCase()]);
	const hasJson = have["feature.json"] === true;
	const identity = identityOf(id, "");
	const progress = "已看到：功能目录 ✓ ／ 六个桶 " + (BUCKET_ORDER.length - missing.length) + "/" + BUCKET_ORDER.length +
		" ／ 身份声明 " + (identity.present ? "✓" : (hasJson ? "形状不对" : "—"));
	if (!hasJson || !identity.present) {
		const onlyDir = missing.length === BUCKET_ORDER.length && !hasJson;
		const lacks: string[] = [];
		if (missing.length) lacks.push(missing.join("、") + " 桶");
		if (!hasJson) lacks.push("feature.json");
		else if (!identity.present) lacks.push("可用的身份声明");
		return {
			state: onlyDir ? "dir-only" : "partial", missing: missing, identity: identity.present ? identity : null,
			progress: progress,
			note: onlyDir ? "功能目录已出现，桶与身份声明还在路上" : "还没建全：缺 " + lacks.join("、")
		};
	}
	if (missing.length) {
		return {
			state: "partial", missing: missing, identity: identity, progress: progress,
			note: "身份声明在了，但还缺 " + missing.join("、") + " 桶"
		};
	}
	const expect = String((rb && rb.expectId) || "");
	if (expect !== "" && identity.feature_id !== expect) {
		return {
			state: "identity-mismatch", missing: [], identity: identity, progress: progress,
			note: "身份声明里的 feature_id 是 " + identity.feature_id + "，面板算好的是 " + expect +
				" —— 建出来的东西和这条指令不是同一份，别当成建好了"
		};
	}
	return { state: "done", missing: [], identity: identity, progress: progress, note: "六个桶 + 身份声明都在" };
}

/** 卡片上那一行人话（**"新建、还没有任何产物"要看得出来**） */
export function cardStateOf(f: any): { line: string; tone: string } {
	const n = (v: unknown) => (typeof v === "number" ? v : 0);
	const files = (f && f.files) || {};
	const bare = n(f && f.finals) + n(f && f.reviews) + n(f && f.speeches) + n(f && f.decisions) +
		n(f && f.evidence) + n(f && f.sources) + n(f && f.others) +
		((files.concept || []).length) + ((files.draft || []).length) === 0;
	const finalActive = !!(f && f.status === "active");
	if (!f || !f.latestFinal) {
		return bare
			? { line: "还没有原料 —— 往 source\\ 放素材，或从「头脑风暴」开始", tone: "new" }
			: { line: "卡在：尚未出定稿", tone: "muted" };
	}
	return finalActive
		? { line: "已定稿 · 可交程序", tone: "ok" }
		: { line: "最终版状态：" + ((f && f.status) || "?"), tone: "muted" };
}

/** 桶缺了就说（只在真缺时说；正常功能一个字都不多说） */
export function bucketsNote(f: any): string {
	const missing = (f && f.bucketsMissing) || [];
	if (!missing.length) return "";
	return "桶没建全：缺 " + missing.join("、") + " —— 让工作会话补齐，或删掉这个目录重建。";
}

/** 已交给工作会话那一句（面板原样显示） */
export function createSentNotice(topic: string): string {
	return "已交给工作会话建立「" + topic + "」：功能目录 + 六个桶 + 身份声明。建好后面板会自己出现这张卡（不用刷新）。";
}

/** 建好了那一句（含"怎么删"——面板不写盘，也删不了盘） */
export function createDoneNotice(topic: string, id: string, root: string): string {
	return "建好了：「" + topic + "」（feature_id=" + id + "）· 六个桶 + 身份声明都在 · " +
		"已登记为它的专属工作区、工作会话也建好了。要撤掉就删掉这个目录：" + root + "（面板只读，删不了它）。";
}

/** 还没建完那一句（如实说看到什么 + 下一步） */
export function createTimeoutNotice(topic: string, verdict: { progress?: string } | null, sid: string): string {
	const v = verdict || {};
	return "还在等「" + topic + "」：" + (v.progress || "已看到：什么都没看到") + "。下一步：① 点「打开工作会话」看它跑到哪了" +
		(sid ? "（就是刚收到这条指令的那条）" : "") +
		"；② 让它把缺的补齐（指令原文就在那条会话里）；要重来就先删掉这个目录再建。";
}

/** 不再等那一句 */
export function createCancelNotice(topic: string, verdict: { progress?: string } | null): string {
	return "不再盯着「" + topic + "」了" + (verdict && verdict.progress ? "（" + verdict.progress + "）" : "") +
		"。它建好了的话，点「刷新看板」就能看到这张卡。";
}
