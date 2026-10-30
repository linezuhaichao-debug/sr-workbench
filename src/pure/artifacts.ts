/**
 * 「最终产物」模块的数据模型（v5 口径）。
 *
 * 面板留这几类（用户口径）：
 *   ① 头脑风暴的产物 —— `analysis\` 里的剩余内容
 *   ② 成稿 —— `gdd\<主题>.md`（不带日期）
 *   ③ 定稿 —— `gdd\AI读版策划案_<功能名>_正式版.md`（改名前的 `gdd\*_定稿.md` 仍按后缀认，历史遗留照样归类）
 *   ④ HTML 宣讲稿 —— `gdd\*_宣讲_<日期>.html`
 *   ⑤ 配置表 —— 表本体（`.xlsx|.xlsm|.csv`）
 * 其余（定稿 HTML 派生件 / 界面图 / 宣讲源数据 / 认不出名字的）如实进「其它」组，
 * **默认折叠**、一个都不静默丢 —— 这是本仓库的老纪律（「一个文件都不许静默丢」）。
 *
 * ★ **过程留痕不算产物**（用户口径 2026-10-12）：变更集 `CS-*.yaml`、读回验收报告、
 *   审查报告、修订点清单**不上列表**，只在页签底部**报数**（见 `trace`）——
 *   留痕该留（它们是"这张表为什么长这样"的唯一账本），但工作台要回答的是
 *   "这个功能产出了什么"，过程档案不是产物。
 *   纪律不变：**`total + trace.count` 必须等于两个桶里的全部文件**。
 *
 * ★ 判据**只有一份**：全在 `./buckets.ts` 的 `outputGroupOf`（含"留痕先拦"与"配置表按内容认"）。
 *   这里**不再自己判一次** —— 2026-10-09 就因为这个文件里藏了第二份判据，
 *   改了 `outputGroupOf` 却一点效果都没有（配置表分类不生效），白查了半天。
 *
 * 纯函数、零 IO：目录列举由 `../load/feature.ts` 读进来。
 */

import { gddKindOf, historyVersionOf, outputGroupOf, OUTPUT_GROUPS, traceKindOf, TRACE_KIND_LABEL } from "./buckets.ts";
import { dateOf } from "./topic.ts";

/** 一个目录的列举结果（`listDir` 的直接产物 + 再下一层）。 */
export interface DirListing {
	/** 该目录下的直接文件名。 */
	files?: string[];
	/** 子目录名 → 里面的文件名（只展开一层：`gdd/UI`、`analysis/<子目录>`）。 */
	nested?: Record<string, string[]>;
}

export interface FeatureListing {
	/** `analysis\` 的列举。 */
	analysis?: DirListing;
	/** `gdd\` 的列举。 */
	gdd?: DirListing;
}

/** 一个产物条目。 */
export interface ArtifactFile {
	name: string;
	/** 相对功能根的路径（正斜杠）—— 打开文件用。 */
	rel: string;
	/** 所在桶（`analysis` / `gdd` / …）。 */
	dir: string;
	/** 再下一层目录名（`gdd/UI` 时是 `UI`），没有就是空串。 */
	subdir: string;
	/** 分类键（`brainstorm` / `draft` / `final` / `speech` / `other`）。 */
	group: string;
	/** gdd 细分的显示标签（只有 gdd 有；其余空串）。 */
	kindLabel: string;
	/** 面板上那一句注解（`〔当前〕` / `〔历史版本〕`）。 */
	note: string;
	/**
	 * 这是不是**产物历史版本**（`<当前版名>_<YYYYMMDD>_<序号>`）。
	 * ★ 它**仍然进它当前版所在的那一类**（用户口径 2026-10-12："我就是要看历史版本"）——
	 *   这个字段只用来分组内排序与标注，**不用来把它藏起来**。
	 */
	isHistory: boolean;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** 列举 → 条目数组（`dir` = 桶名）。 */
function filesOf(dir: string, listing: DirListing | undefined): ArtifactFile[] {
	const d = listing || {};
	const out: ArtifactFile[] = [];
	const add = (name: string, sub: string) => {
		const rel = sub ? dir + "/" + sub + "/" + name : dir + "/" + name;
		// ★ 分类**只问 `buckets.ts`**（含"配置表按内容认"与"历史版本还原成当前版名"），这里不自己判
		const group = outputGroupOf(dir, name);
		out.push({
			name: name,
			rel: rel,
			dir: dir,
			subdir: sub,
			group: group,
			kindLabel: dir === "gdd" && group === "other" ? kindLabelOf(name) : "",
			note: "",
			isHistory: historyVersionOf(name)
		});
	};
	for (const n of d.files || []) add(n, "");
	for (const sub of Object.keys(d.nested || {}).sort()) for (const n of (d.nested || {})[sub] || []) add(n, sub);
	return out;
}

function kindLabelOf(name: string): string {
	// gdd 里落进 other 的那些，标签用**细分名**（审查 / 修订点 / 定稿 HTML / 各种源数据）——比"其它"有信息量
	return labelOfKind(gddKindOf(name));
}

function labelOfKind(k: string): string {
	const m: Record<string, string> = {
		review: "审查", fixpoints: "修订点", finalHtml: "定稿 HTML", speechSrc: "宣讲源数据", ueSrc: "UE 源数据", others: "其它"
	};
	return m[k] || "其它";
}

/**
 * 组内排序：
 *   · **当前版永远排第一**，它的**历史版本按名字倒序**跟在后面（`_20261012_2` 在 `_20261012_1` 前面）——
 *     用户口径 2026-10-12：历史版本要在「最终产物」里看得见，且当前那一份要一眼找到；
 *   · 成稿 / 定稿的当前版按**文件名日期倒序**（同一天多个主题时新的在前），同日期按名字；
 *   · 其余按相对路径。
 */
function sortGroup(key: string, files: ArtifactFile[]): ArtifactFile[] {
	const cur = files.filter((f) => !f.isHistory);
	const old = files.filter((f) => f.isHistory);
	let curSorted: ArtifactFile[];
	if (key === "draft" || key === "final") {
		curSorted = cur.slice().sort((a, b) => {
			const da = dateOf(a.name);
			const db = dateOf(b.name);
			if (da !== db) return da < db ? 1 : -1;
			return cmp(a.rel, b.rel);
		});
	} else {
		curSorted = cur.slice().sort((a, b) => cmp(a.rel, b.rel));
	}
	/** 历史版本：按相对路径**倒序**（同一天序号大的在前，隔天的按日期新的在前）。 */
	const oldSorted = old.slice().sort((a, b) => cmp(b.rel, a.rel));
	return curSorted.concat(oldSorted);
}

/** 面板「最终产物」里的一个分类（`dynamic` 只在真有话说时才非空）。 */
export interface OutputGroup {
	key: string;
	label: string;
	/** 这一类**永远成立**的说明（界面收进 tooltip，不占位置）。 */
	note: string;
	/** 这一组**现在**的状况（如「现有 2 份定稿…」）；空串 = 没什么可说。 */
	dynamic: string;
	/** 这一类的桶名（`analysis` / `gdd`；`other` 是混装的，给空串）。 */
	dir: string;
	count: number;
	files: ArtifactFile[];
}

/**
 * 过程留痕那一笔账 —— **不在面板列表里**，只给页签底部那一行小字用。
 *
 * 它存在的理由与「其它」组一样：**一个文件都不许静默丢**。
 * 区别是「其它」还默认折叠地列着，留痕连列都不列 —— 所以必须**报数**，
 * 而且要能被核验：`total + count` == 两个桶里的全部文件。
 */
export interface TraceSummary {
	/** 留痕件数（**不计入** `total`）。 */
	count: number;
	/** 一句话明细，如「3 份变更集 · 2 份读回验收报告」；没有留痕时是空串。 */
	summary: string;
	/** 留痕文件（带 `rel`，将来若要"点开看"直接用）。 */
	files: ArtifactFile[];
	/** 留痕的相对路径（核验"一个都不丢"用）。 */
	allPaths: string[];
}

/** 留痕 → 一句话明细（按 `TRACE_KIND_LABEL` 的键顺序，跳过 0 的那些）。 */
function traceSummaryOf(files: ArtifactFile[]): string {
	const n: Record<string, number> = {};
	for (const f of files) {
		const k = traceKindOf(f.name);
		if (k) n[k] = (n[k] || 0) + 1;
	}
	const parts: string[] = [];
	for (const k of Object.keys(TRACE_KIND_LABEL)) if (n[k]) parts.push(n[k] + " 份" + TRACE_KIND_LABEL[k]);
	return parts.join(" · ");
}

/**
 * 列举 → 产物组 + 留痕账。
 *
 * @returns `{ groups, counts, total, allPaths, trace }`
 *   · `groups` 恒含五个产物类 + `other`（空组也在，count 为 0 —— 人一眼看得出"这一类还没有"）；
 *     **过程留痕不成组**（`OUTPUT_GROUPS` 里 `trace` 那一项只服务 `trace.summary` 的措辞）；
 *   · `total` = 面板列出的条目总数（**不含**留痕，也**不含** evidence / decisions 桶）；
 *   · **`total + trace.count` == 这两个桶里的全部文件**（一个都不丢）。
 */
export function featureArtifacts(input: FeatureListing): {
	groups: OutputGroup[];
	counts: Record<string, number>;
	total: number;
	allPaths: string[];
	trace: TraceSummary;
} {
	const inp = input || {};
	const all: ArtifactFile[] = filesOf("analysis", inp.analysis).concat(filesOf("gdd", inp.gdd));
	const traceFiles = sortGroup("trace", all.filter((f) => f.group === "trace"));
	const groups: OutputGroup[] = OUTPUT_GROUPS
		.filter((g) => g.key !== "trace")
		.map((g) => {
			const files = sortGroup(g.key, all.filter((f) => f.group === g.key));
			/**
			 * `dir` = 这一类**实际**落在哪个桶（面板只显示这个短标签，长说明收进 tooltip）。
			 * ★ 由**文件本身**算，不写死 —— 万一有文件落错了桶（比如配置交付物写进了 `analysis\`），
			 *   组头照样如实显示它真正在哪，不替它粉饰。跨目录时按出现顺序列全（用 " · " 连起来）。
			 *
			 * ★ 空组（`定稿` / `HTML 宣讲稿` 这类还没产出的）**回退到这一类该在的桶**
			 *   （`OUTPUT_GROUPS[].dir` 是**规范落点**，不是猜）—— 用户实测指出：
			 *   空的「定稿」「HTML 宣讲稿」组头没有路径，而其它组都有，看着像坏了。
			 *   语义仍是清楚的：**有文件时显示实际位置，没有文件时显示该放哪里**。
			 */
			const dirs: string[] = [];
			for (const f of files) if (f.dir && dirs.indexOf(f.dir) < 0) dirs.push(f.dir);
			return {
				key: g.key, label: g.label, note: g.note, dynamic: "",
				dir: dirs.length > 0 ? dirs.join(" · ") : g.dir, count: files.length, files: files
			};
		});
	const counts: Record<string, number> = {};
	const allPaths: string[] = [];
	let total = 0;
	for (const g of groups) {
		counts[g.key] = g.count;
		total += g.count;
		for (const f of g.files) allPaths.push(f.rel);
	}
	/** ★ 留痕也进 `counts`（dashboard 的卡片与详情页仍走同一份计数），但它**不在 `groups` 里**。 */
	counts.trace = traceFiles.length;
	const tracePaths: string[] = traceFiles.map((f) => f.rel);
	return {
		groups: groups,
		counts: counts,
		total: total,
		allPaths: allPaths,
		trace: {
			count: traceFiles.length,
			summary: traceSummaryOf(traceFiles),
			files: traceFiles,
			allPaths: tracePaths
		}
	};
}

/**
 * 给每一组标**当前版**与**历史版本**（用户口径 2026-10-12：历史版本要在「最终产物」里看得见）。
 *
 * ★ 只在**这一组真有历代版本**时才标 —— 没有历史版本的组满屏「当前」是噪音。
 *   当前那一份标 `〔当前〕`，其余（`<当前版名>_<日期>_<序号>`）标 `〔历史版本〕`。
 *   旧口径那套「最新定稿 / 更早的一版」随之退休：定稿现在只有一份（名字固定、不带日期）。
 */
export function annotateCurrent(groups: OutputGroup[]): void {
	for (const g of groups) {
		// ★ 只在**真有**历代版本时才加注：没有旧版的组一个注都不加（满屏「当前」是噪音）
		if (g.files.length === 0 || !g.files.some((f) => f.isHistory)) continue;
		for (const f of g.files) f.note = f.isHistory ? "〔历史版本〕" : "〔当前〕";
		/**
		 * ★ **不再写 `dynamic` 那行小字**（2026-10-12 用户实测反馈"这个是什么意思"）。
		 *   原来写的是「另有 N 份历史版本（每次改之前留的档）—— 当前这一份在最上面」，两个毛病：
		 *   ① **"另有"暗示没列出来**，可它就在下面列着、还带着〔历史版本〕标签 —— 措辞与事实相反；
		 *   ② 组头已经写着"N 件"、排序也不言自明（当前版永远第一行）⇒ 整句是重复。
		 *   "怎么退回上一版"写在操作文档 §4.4 与 `sr-askme/references/version-history.md`，不占这里的位置。
		 */
	}
}
