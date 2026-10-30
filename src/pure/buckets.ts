/**
 * 目录契约与产物分类（v5 口径）—— **一个功能 = 一个目录，目录里只有 4 个桶**。
 *
 *     features\<主题>\
 *     ├─ evidence\    【原始件 + 过程证据】外部送进来的一切 · 抽帧 · 校准流水
 *     ├─ analysis\    【头脑风暴的内容】AI 分析产物 ← 面板「头脑风暴」模块读它
 *     ├─ gdd\         【设计正文与交付物】成稿 · 定稿 · 宣讲 HTML
 *     │   └─ assets\images\   【定稿正文内联的图片】gdd 下**唯一**图片位（不列进产物列表）
 *     └─ decisions\   【人要读的记录】决策记录.md（一个功能**只有一个**决策文件）
 *
 * 判据（谁产生 / 给谁看）：
 *   evidence = **进来的原件**；analysis = **想出来的内容**；gdd = **写出来的正文**；
 *   decisions = **定下来的事**。
 *
 * ★ 相对 v4 的两处变化（这就是本票的目录契约）：
 *   ① `source\` 并入 `evidence\`，`delivery\` 并入 `gdd\` —— 六个桶减成四个
 *      （"原料"与"证据"本来就是一件事：都是外部来的原件）；
 *   ② `gdd\` 内部**只按文件名分档**（成稿 / 定稿 / UE 界面稿 / 宣讲 HTML），
 *      其余（审查 / 修订点 / 定稿 HTML 派生件 / 各种源数据 / 认不出来的）如实进「其它」，**一个都不丢**。
 *
 * 纯函数、零 IO。
 */

/** 4 个桶（**顺序即界面顺序**：进 → 想 → 写 → 定）。 */
export const BUCKETS = ["evidence", "analysis", "gdd", "decisions"] as const;

/** 桶 → 一句话含义（建目录时的提示语、检索结果、操作文档都引这一份）。 */
export const BUCKET_MEANING: Record<string, string> = {
	evidence: "原始件 + 过程证据（截图 / 录屏 / 旧文档原件 / 外部交付包 / 抽帧 / 校准流水）",
	analysis: "头脑风暴的内容（体验报告 / 问题卡 / 复刻规格 / 概念稿 / 旧文档分析 / 人工补充）",
	gdd: "设计正文与交付物（成稿 / 定稿 / UE 界面稿 / 宣讲 HTML）",
	decisions: "决策记录（一个功能只有一个决策文件：决策记录.md）"
};

/** 桶 → 界面短标签。 */
export const BUCKET_LABEL: Record<string, string> = {
	evidence: "证据",
	analysis: "头脑风暴",
	gdd: "设计正文",
	decisions: "决策记录"
};

/** 是不是 4 个标准桶之一（大小写不敏感 —— Windows 目录名如此）。 */
export function isBucket(name: unknown): boolean {
	const n = String(name == null ? "" : name).toLowerCase();
	return (BUCKETS as readonly string[]).indexOf(n) >= 0;
}

/**
 * `gdd\` 内部按文件名分档（**唯一**允许按文件名分类的地方 —— 它是一个混装目录）。
 * 返回值 → 显示标签见 `GDD_KIND_LABEL`。
 *
 *   draft 成稿 · final 定稿 · ue UE 界面稿 · speech 宣讲 HTML
 *   ueSrc UE 源数据 · speechSrc 宣讲源数据
 *   review 审查 · fixpoints 修订点 · finalHtml 定稿 HTML（派生件）· others 其它
 */
export function gddKindOf(name: unknown): string {
	const n = String(name == null ? "" : name);
	if (!n) return "others";
	if (/_定稿_审查\.md$/i.test(n) || /_审查\.md$/i.test(n)) return "review";
	// ★ 2026-10-28：定稿正式名 = `AI读版策划案_<功能名>_正式版.md`。
	//   `_定稿.md` 是改名前的旧名，只作历史遗留继续认（同归 final，不另立一类）。
	if (/_正式版\.md$/i.test(n)) return "final";
	if (/_定稿\.md$/i.test(n)) return "final";
	if (/_定稿\.html?$/i.test(n)) return "finalHtml";
	if (/_修订点\.md$/i.test(n)) return "fixpoints";
	// ★ 2026-10-13：sr-gdd-ue 的产物（界面 UE 规则 HTML + 它的可复跑源）
	if (/_UE\.html$/i.test(n)) return "ue";
	if (/_UE\.content\.json$/i.test(n)) return "ueSrc";
	if (/_宣讲(_.*)?\.html$/i.test(n)) return "speech";
	// ★ 宣讲稿的源数据：旧的 content.json（`<主题>_宣讲.content.json`）与新的草稿 md（`<主题>_宣讲.md`）
	//   —— 后者必须拦在 `/\.md$/ → draft` 之前，否则一份草稿会被算成「成稿」。
	if (/_宣讲(_.*)?\.content\.json$/i.test(n)) return "speechSrc";
	if (/_宣讲\.md$/i.test(n)) return "speechSrc";
	if (/\.md$/i.test(n)) return "draft";
	return "others";
}

export const GDD_KIND_LABEL: Record<string, string> = {
	draft: "成稿",
	final: "定稿",
	ue: "UE 界面稿",
	speech: "宣讲 HTML",
	speechSrc: "宣讲源数据",
	review: "审查",
	fixpoints: "修订点",
	finalHtml: "定稿 HTML",
	others: "其它"
};

/**
 * 面板「最终产物」模块的分类（v5 用户口径：头脑风暴的产物、成稿、定稿、html 宣讲稿；
 * 2026-10-09 追加 **配置表**）。`key` 就是界面分组键；`other` 是兜底组（**默认折叠**，
 * 只为"一个文件都不许静默丢"存在）。
 */
/**
 * 六个产物类 + **过程留痕**（不列进列表，只报数）+ 兜底「其它」。
 * `dir` 是**规范落点**：组里没文件时组头就显示它，有文件时改显示文件**实际**所在的桶（见 `artifacts.ts`）。
 *
 * ★ `trace` 这一项与其余不同：`featureArtifacts` **不把它做成列表里的组**
 *   （用户口径 2026-10-12：留痕留着、但策划工作台不显示），
 *   它的 `label` / `note` 只服务于页签底部那一行报数小字。
 */
export const OUTPUT_GROUPS = [
	{ key: "brainstorm", label: "头脑风暴的产物", dir: "analysis", note: "analysis\\ 里的全部内容（体验报告 / 问题卡 / 复刻规格 / 概念稿 / 旧文档分析 / 人工补充）" },
	{ key: "draft", label: "成稿", dir: "gdd", note: "gdd\\<主题>_成稿.md —— 只含纯规则与设计（**不带日期**；日期在历史版本后缀里）" },
	{ key: "final", label: "定稿", dir: "gdd", note: "gdd\\AI读版策划案_<功能名>_正式版.md —— 供程序使用的那一份（正文内联图片在 gdd\\assets\\images\\）" },
	{ key: "ue", label: "UE 界面稿", dir: "gdd", note: "gdd\\<主题>_UE.html —— 给 UE/UI 同事看的界面与交互规则（**不带日期**；日期在历史版本后缀里）" },
	{ key: "speech", label: "宣讲稿", dir: "gdd", note: "gdd\\<主题>_宣讲.html —— 定稿整份的宣讲稿网页，开会 / 评审用（**不带日期**；日期在历史版本后缀里）" },
	{ key: "config", label: "配置表", dir: "gdd", note: "配置这条线的交付物：运行时表本体（.xlsx / .xlsm / .csv）。变更集与读回验收报告属过程留痕，面板只报数、不列出" },
	{ key: "trace", label: "过程留痕", dir: "gdd", note: "变更集（CS-*.yaml）/ 读回验收报告 / 审查报告 / 修订点清单 —— **不在上面列出**，只在页签底部报数（文件都在 gdd\\，要看就点〔打开路径〕）" },
	{ key: "other", label: "其它（不属上面几类）", dir: "", note: "定稿 HTML 派生件 / 界面图 / 宣讲源数据 / UE 源数据 / 认不出名字的文件 —— 如实列出，不丢" }
] as const;

/**
 * 这是不是**配置这条线**的产物（头脑风暴工作面剔除 + 「最终产物 › 配置表」分类的判据）。
 *
 * 认三类：
 *   · `CS-<YYYYMMDD>-<NNN>.yaml` —— change set（变更集）
 *   · `*_读回验收报告*.md` —— 读回验收报告
 *   · `.xlsx` / `.xlsm` / `.csv` —— 运行时配置表文件本体
 *
 * ★ 口径上这类文件**只该落在 `gdd\`**（`analysis\` 只放头脑风暴产物）。
 *   判据仍**按内容认、不按目录认**，理由是：万一哪个 agent 写错了桶，
 *   它也得归到「配置表」、而不是掉进「头脑风暴的产物」里冒充分析结论 ——
 *   归错类比看不见更糟。落点对不对是另一件事（那是纪律，不是分类）。
 *
 * ★ 两个消费者，语义不同，别再各写一份（2026-10-09 就因为这个文件里藏了第二份判据，
 *   改了 `outputGroupOf` 却一点效果都没有）：
 *   ① `load/feature.ts` 的 `pushAnalysis` —— 这些文件**不进头脑风暴**；
 *   ② `outputGroupOf` —— 其中**表本体**进「配置表」类；变更集与验收报告是**留痕**，
 *      由 `traceArtifactOf` 先一步拦下（见下）。
 */
export function configArtifactOf(name: unknown): boolean {
	const n = String(name == null ? "" : name);
	if (!n) return false;
	if (/^CS-\d{8}-\d+\.ya?ml$/i.test(n)) return true;
	if (/_读回验收报告.*\.md$/i.test(n)) return true;
	if (/\.(xlsx|xlsm|csv)$/i.test(n)) return true;
	return false;
}

/**
 * 这是不是**产物历史版本**（`<原名去扩展名>_<YYYYMMDD>_<序号>.<ext>`，如 `A079-联盟讨伐_20261012_1.xlsx`）。
 *
 * 口径的唯一权威是 `skills/sr-askme/references/version-history.md`
 * （用户口径 2026-10-12：**每次产物的修改都留下历史版本**，按 `<日期>_<序号>` 区分）。
 *
 * ★ 判据：**去掉全部扩展名**之后，名字尾部是 `_<8 位日期>_<数字>`。
 *   · `联盟讨伐_20260918.md`（原名里带日期、**但没有序号**）**不**匹配 ⇒ 它还是成稿，不被误判；
 *   · `.content.json` 这类多段扩展名先去掉再判（与 `topic.ts` 的 `topicOf` 同口径）。
 *
 * ★ 这条**必须在分类里最先判**（见 `traceKindOf` 与 `outputGroupOf`）：
 *   `联盟讨伐_20261010_定稿_20261012_1.md` 已经**不再匹配** `_定稿.md` 了 ——
 *   不先拦就会被算成一份**成稿**；`A079-联盟讨伐_20261012_1.xlsx` 会被算成**另一张配置表**。
 */
export function historyVersionOf(name: unknown): boolean {
	const n = String(name == null ? "" : name);
	if (!n) return false;
	return /_\d{8}_\d+$/.test(n.replace(/(\.[A-Za-z0-9]+)+$/, ""));
}

/**
 * 历史版本 → 它的**当前版名字**（去掉 `_<8 位日期>_<序号>` 那一段，扩展名原样保留）；
 * 不是历史版本时**原样返回**。`x.content_20261012_1.json` → `x.content.json`。
 *
 * ★ 用途：**历史版本要归它当前版所在的那一类**（用户口径 2026-10-12：
 *   "我就是为了在最终产物里看历史版本才改这个的"）——
 *   所以 `联盟讨伐_定稿_20261012_1.md` 进「定稿」类、与当前定稿并列，而不是被另立一类或被藏起来。
 */
export function currentNameOf(name: unknown): string {
	const n = String(name == null ? "" : name);
	const m = /^(.*)_\d{8}_\d+((?:\.[A-Za-z0-9]+)+)$/.exec(n);
	return m ? m[1] + m[2] : n;
}

/**
 * 留痕细分 —— **只服务页签底部那句报数**。不是留痕时返回空串。
 *
 * 认四类（`TRACE_KIND_LABEL` 的**键顺序**就是报数顺序，别随手调）：
 *   changeset 变更集 · readback 读回验收报告 · review 审查报告 · fixpoints 修订点清单
 *
 * ★ **历史版本不在其中**（2026-10-12 口径改）：它是**产物**、不是留痕 ——
 *   由 `historyVersionOf` 单独认，分类时先还原成当前版名、跟着当前版进同一类（见 `outputGroupOf`）。
 */
export function traceKindOf(name: unknown): string {
	const n = String(name == null ? "" : name);
	if (!n) return "";
	if (/^CS-\d{8}-\d+\.ya?ml$/i.test(n)) return "changeset";
	if (/_读回验收报告.*\.md$/i.test(n)) return "readback";
	if (/_定稿_审查\.md$/i.test(n) || /_审查\.md$/i.test(n)) return "review";
	if (/_修订点\.md$/i.test(n)) return "fixpoints";
	return "";
}

/**
 * 这是不是**过程留痕**（不是产物 —— 上不了「最终产物」列表）。
 *
 * ★ 判据就是 `traceKindOf`，**只有一份**；这里只是给"是非题"一个名字。
 *
 * ★ 它们**仍在「一个文件都不许静默丢」的范围里**：面板不列出来，
 *   但在页签底部**如实报数**（用户口径 2026-10-12：留痕该留、但策划工作台不显示 ——
 *   它们是过程档案，不是这个功能产出的东西）。
 *   `featureArtifacts` 返回的 `trace` 就是这一笔账，`total + trace.count` 必须等于两个桶的全部文件。
 */
export function traceArtifactOf(name: unknown): boolean {
	return traceKindOf(name) !== "";
}

/** 留痕细分 → 界面短标签（底部报数用；**键顺序即报数顺序**）。 */
export const TRACE_KIND_LABEL: Record<string, string> = {
	changeset: "变更集",
	readback: "读回验收报告",
	review: "审查报告",
	fixpoints: "修订点清单"
};

/**
 * 一个产物（在哪个桶、叫什么名字）→ 面板分类键。
 *   · **历史版本先还原成当前版名**（`currentNameOf`）⇒ 它跟当前版进**同一类**
 *     （定稿的旧版进「定稿」、表的旧版进「配置表」）—— 这是用户要看的"这类里全不全"；
 *   · 过程留痕（`traceArtifactOf`）—— 变更集 / 验收报告 / 审查报告 / 修订点，不进产物类；
 *   · 配置表这条线的产物**按内容认**（`configArtifactOf`）—— 它在哪个桶都算配置表；
 *   · `analysis\` 下的其余文件（含子目录里的）都算头脑风暴产物；
 *   · `gdd\` 下按 `gddKindOf` 分：成稿 / 定稿 / 宣讲 HTML，其余进 other；
 *   · 其它桶（evidence / decisions）不进「最终产物」模块 —— 它们各有各的模块。
 */
export function outputGroupOf(dir: unknown, name: unknown): string {
	const d = String(dir == null ? "" : dir).toLowerCase();
	const base = currentNameOf(name);
	if (traceArtifactOf(base)) return "trace";
	if (configArtifactOf(base)) return "config";
	if (d === "analysis") return "brainstorm";
	if (d === "gdd") {
		const k = gddKindOf(base);
		if (k === "draft") return "draft";
		if (k === "final") return "final";
		if (k === "speech") return "speech";
		if (k === "ue") return "ue";
		return "other";
	}
	return "other";
}

/** 分类键 → 显示信息（界面不自己写标签）。 */
export function outputGroupInfo(key: unknown): { key: string; label: string; note: string } {
	const k = String(key == null ? "" : key);
	const g = OUTPUT_GROUPS.filter((x) => x.key === k)[0];
	return g ? { key: g.key, label: g.label, note: g.note } : { key: k, label: k, note: "" };
}
