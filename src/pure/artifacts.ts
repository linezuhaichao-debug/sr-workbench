/**
 * 「最终产物」模块的数据模型（v5 口径）。
 *
 * 面板留这几类（用户口径）：
 *   ① 头脑风暴的产物 —— `analysis\` 里的剩余内容
 *   ② 成稿 —— `gdd\<主题>_<日期>.md`
 *   ③ 定稿 —— `gdd\*_定稿.md`
 *   ④ HTML 宣讲稿 —— `gdd\*_宣讲_<日期>.html`
 *   ⑤ 配置表 —— 配置这条线的交付物（`CS-*.yaml` / `*_读回验收报告.md` / `.xlsx|.xlsm|.csv`）
 * 其余（审查 / 修订点 / 定稿 HTML 派生件 / 界面图目录 / 认不出名字的）如实进「其它」组，
 * **默认折叠**、一个都不静默丢 —— 这是本仓库的老纪律（「一个文件都不许静默丢」）。
 *
 * ★ 判据**只有一份**：全在 `./buckets.ts` 的 `outputGroupOf`（含"配置表按内容认、不绑目录"）。
 *   这里**不再自己判一次** —— 2026-10-09 就因为这个文件里藏了第二份判据，
 *   改了 `outputGroupOf` 却一点效果都没有（配置表分类不生效），白查了半天。
 *
 * 纯函数、零 IO：目录列举由 `../load/feature.ts` 读进来。
 */

import { gddKindOf, outputGroupOf, OUTPUT_GROUPS } from "./buckets.ts";
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
	/** 面板上那一句注解（如「最新定稿」）。 */
	note: string;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** 列举 → 条目数组（`dir` = 桶名）。 */
function filesOf(dir: string, listing: DirListing | undefined): ArtifactFile[] {
	const d = listing || {};
	const out: ArtifactFile[] = [];
	const add = (name: string, sub: string) => {
		const rel = sub ? dir + "/" + sub + "/" + name : dir + "/" + name;
		// ★ 分类**只问 `buckets.ts`**（含"配置表按内容认"），这里不自己判
		const group = outputGroupOf(dir, name);
		out.push({
			name: name,
			rel: rel,
			dir: dir,
			subdir: sub,
			group: group,
			kindLabel: dir === "gdd" && group === "other" ? kindLabelOf(name) : "",
			note: ""
		});
	};
	for (const n of d.files || []) add(n, "");
	for (const sub of Object.keys(d.nested || {}).sort()) for (const n of (d.nested || {})[sub] || []) add(n, sub);
	return out;
}

function kindLabelOf(name: string): string {
	const k = gddKindOf(name);
	// gdd 里落进 other 的那些，标签用**细分名**（审查 / 修订点 / 定稿 HTML / 其它）——比"其它"有信息量
	return k === "speechSrc" ? "宣讲源数据" : labelOfKind(k);
}

function labelOfKind(k: string): string {
	const m: Record<string, string> = {
		review: "审查", fixpoints: "修订点", finalHtml: "定稿 HTML", speechSrc: "宣讲源数据", others: "其它"
	};
	return m[k] || "其它";
}

/**
 * 组内排序：
 *   · 成稿 / 定稿按**文件名日期倒序**（新的在前 —— 与"最新定稿"口径一致），同日期按名字；
 *   · 其余按相对路径。
 */
function sortGroup(key: string, files: ArtifactFile[]): ArtifactFile[] {
	if (key === "draft" || key === "final") {
		return files.slice().sort((a, b) => {
			const da = dateOf(a.name);
			const db = dateOf(b.name);
			if (da !== db) return da < db ? 1 : -1;
			return cmp(a.rel, b.rel);
		});
	}
	return files.slice().sort((a, b) => cmp(a.rel, b.rel));
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
 * 列举 → 四个产物组（`other` 组只在真有条目时才出现）。
 *
 * @returns `{ groups, counts, total }`
 *   · `groups` 恒含前四类（空组也在，count 为 0 —— 人一眼看得出"这一类还没有"）；
 *   · `total` = 面板列出的条目总数（**不含** evidence / decisions 桶）。
 */
export function featureArtifacts(input: FeatureListing): {
	groups: OutputGroup[];
	counts: Record<string, number>;
	total: number;
	allPaths: string[];
} {
	const inp = input || {};
	const all: ArtifactFile[] = filesOf("analysis", inp.analysis).concat(filesOf("gdd", inp.gdd));
	const groups: OutputGroup[] = OUTPUT_GROUPS.map((g) => {
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
	return { groups: groups, counts: counts, total: total, allPaths: allPaths };
}

/**
 * 给定稿组标「最新定稿」/「历史版本」（**只按文件名日期**，不做 frontmatter 校验 —— 面板不再替定稿门背书）。
 * 多份同日期时并列标「最新定稿」并在组说明里如实说，不假装只有一份。
 */
export function annotateFinals(groups: OutputGroup[]): void {
	for (const g of groups) {
		if (g.key !== "final" || g.files.length === 0) continue;
		const newest = dateOf(g.files[0].name);
		const tied = g.files.filter((f) => dateOf(f.name) === newest).length;
		for (const f of g.files) f.note = dateOf(f.name) === newest ? (tied > 1 ? "最新（同日多份）" : "最新定稿") : "历史版本";
		if (g.files.length > 1) {
			// ★ 只把"这一组现在什么状况"放进 `dynamic`（界面上一行小字）；
			//   `note` 是那一类**永远成立**的说明，收进 tooltip，不占位置。
			g.dynamic = "现有 " + g.files.length + " 份，按文件名日期标最新的那" +
				(tied > 1 ? "几份（有 " + tied + " 份同日）" : "一份") + " —— 哪一份真的有效要问定稿门（面板不替它背书）。";
		}
	}
}
