/**
 * 目录契约与产物分类（v5 口径）—— **一个功能 = 一个目录，目录里只有 4 个桶**。
 *
 *     features\<主题>\
 *     ├─ evidence\    【原始件 + 过程证据】外部送进来的一切 · 抽帧 · 校准流水
 *     ├─ analysis\    【头脑风暴的内容】AI 分析产物 ← 面板「头脑风暴」模块读它
 *     ├─ gdd\         【设计正文与交付物】成稿 · 定稿 · 宣讲 HTML
 *     └─ decisions\   【人要读的记录】决策记录.md（一个功能**只有一个**决策文件）
 *
 * 判据（谁产生 / 给谁看）：
 *   evidence = **进来的原件**；analysis = **想出来的内容**；gdd = **写出来的正文**；
 *   decisions = **定下来的事**。
 *
 * ★ 相对 v4 的两处变化（这就是本票的目录契约）：
 *   ① `source\` 并入 `evidence\`，`delivery\` 并入 `gdd\` —— 六个桶减成四个
 *      （"原料"与"证据"本来就是一件事：都是外部来的原件）；
 *   ② `gdd\` 内部**只按文件名分三档面板产物**（成稿 / 定稿 / 宣讲 HTML），
 *      其余（审查 / 修订点 / 定稿 HTML 派生件 / 认不出来的）如实进「其它」，**一个都不丢**。
 *
 * 纯函数、零 IO。
 */

/** 4 个桶（**顺序即界面顺序**：进 → 想 → 写 → 定）。 */
export const BUCKETS = ["evidence", "analysis", "gdd", "decisions"] as const;

/** 桶 → 一句话含义（建目录时的提示语、检索结果、操作文档都引这一份）。 */
export const BUCKET_MEANING: Record<string, string> = {
	evidence: "原始件 + 过程证据（截图 / 录屏 / 旧文档原件 / 外部交付包 / 抽帧 / 校准流水）",
	analysis: "头脑风暴的内容（体验报告 / 问题卡 / 复刻规格 / 概念稿 / 旧文档分析 / 人工补充）",
	gdd: "设计正文与交付物（成稿 / 定稿 / 宣讲 HTML）",
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
 *   draft 成稿 · final 定稿 · speech 宣讲 HTML · speechSrc 宣讲源数据
 *   review 审查 · fixpoints 修订点 · finalHtml 定稿 HTML（派生件）· others 其它
 */
export function gddKindOf(name: unknown): string {
	const n = String(name == null ? "" : name);
	if (!n) return "others";
	if (/_定稿_审查\.md$/i.test(n) || /_审查\.md$/i.test(n)) return "review";
	if (/_定稿\.md$/i.test(n)) return "final";
	if (/_定稿\.html?$/i.test(n)) return "finalHtml";
	if (/_修订点\.md$/i.test(n)) return "fixpoints";
	if (/_宣讲_.*\.html$/i.test(n)) return "speech";
	if (/_宣讲_.*\.content\.json$/i.test(n)) return "speechSrc";
	if (/\.md$/i.test(n)) return "draft";
	return "others";
}

export const GDD_KIND_LABEL: Record<string, string> = {
	draft: "成稿",
	final: "定稿",
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
 * 五个产物类 + 兜底「其它」。`dir` 是**规范落点**：组里没文件时组头就显示它，
 * 有文件时改显示文件**实际**所在的桶（见 `artifacts.ts`）。
 */
export const OUTPUT_GROUPS = [
	{ key: "brainstorm", label: "头脑风暴的产物", dir: "analysis", note: "analysis\\ 里的全部内容（体验报告 / 问题卡 / 复刻规格 / 概念稿 / 旧文档分析 / 人工补充）" },
	{ key: "draft", label: "成稿", dir: "gdd", note: "gdd\\<主题>_<日期>.md —— 只含纯规则与设计" },
	{ key: "final", label: "定稿", dir: "gdd", note: "gdd\\*_定稿.md —— 供程序使用的那一份" },
	{ key: "speech", label: "HTML 宣讲稿", dir: "gdd", note: "gdd\\*_宣讲_<日期>.html —— 宣讲用的网页" },
	{ key: "config", label: "配置表", dir: "gdd", note: "配置这条线的交付物：运行时表（.xlsx / .xlsm / .csv）、change set（CS-*.yaml）、读回验收报告" },
	{ key: "other", label: "其它（不属上面五类）", dir: "", note: "审查 / 修订点 / 定稿 HTML 派生件 / 认不出名字的文件 —— 如实列出，不丢" }
] as const;

/**
 * 这是不是**配置表这条线**的产物（「最终产物 › 配置表」分类的判据）。
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
 * 一个产物（在哪个桶、叫什么名字）→ 面板分类键。
 *   · 配置表这条线的产物**先按内容认**（`configArtifactOf`）—— 它在哪个桶都算配置表；
 *   · `analysis\` 下的其余文件（含子目录里的）都算头脑风暴产物；
 *   · `gdd\` 下按 `gddKindOf` 分：成稿 / 定稿 / 宣讲 HTML，其余进 other；
 *   · 其它桶（evidence / decisions）不进「最终产物」模块 —— 它们各有各的模块。
 */
export function outputGroupOf(dir: unknown, name: unknown): string {
	const d = String(dir == null ? "" : dir).toLowerCase();
	if (configArtifactOf(name)) return "config";
	if (d === "analysis") return "brainstorm";
	if (d === "gdd") {
		const k = gddKindOf(name);
		if (k === "draft") return "draft";
		if (k === "final") return "final";
		if (k === "speech") return "speech";
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
