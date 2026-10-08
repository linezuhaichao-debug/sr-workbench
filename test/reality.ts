/**
 * 真实工作区的**磁盘真值** —— 独立口径，只走 `node:fs`（不经过 port、不经过加载层）。
 *
 * ── 为什么要有这个文件 ────────────────────────────────────────────────
 * `test/**` 里原先有一批断言写死"面板读到 N 个文件"（例如讨伐 27 个产物、决策记录 4 份）。
 * 那个 N 是**真数据的快照**，不是规格：用户按设计做一个**正确的动作**就会把它打红 ——
 *   · 把外部交付包归位到 `features\<主题>\source\UE交付_<日期>\`（设计 §4.3.5 的归档位）
 *     ⇒ 讨伐 27 → 32（+5 个包内文件；`截图\` 那一层是更深的层，面板只列两层）；
 *   · 再走一次真人门 ⇒ 决策记录 4 → 5；
 *   · 提交一张界面图 ⇒ `gdd\UI\` 7 → 8。
 * 测试于是变成"数据不许动"的看门人，而不是"面板读得对"的证明 —— 这不是我们想要的。
 *
 * ── 改成的写法 ────────────────────────────────────────────────────────
 * 「面板读到的 == **同一时刻**直接从磁盘按同一口径算出来的」：
 *   · 口径（两层 + 更深的层如实报出来）在这里**独立**实现一遍；
 *   · 六个桶 → 含义是**规格常量**（设计 §4.1 的产物桶定义），写在 `BUCKET_MEANING` 里，
 *     与 `src/pure/artifacts.ts` 的 `BUCKET_GROUPS` 对表（有专门的用例钉住这张表）。
 * 数据怎么变都成立，而"静默丢文件 / 凭空造条目"照样红 —— 严格性不降反升
 * （现在是逐条对名单，不只是对数）。
 */

import fs from "node:fs";
import path from "node:path";

/**
 * ★ **规格常量，不是真数据快照**：六个标准产物桶 → 含义（设计 §4.1）。
 *   `source` 喂进去的原料 / `analysis`·`gdd`·`delivery` 做出来的产物 /
 *   `decisions`·`evidence` 过程留痕。
 */
export const BUCKET_MEANING: Record<string, string> = {
	source: "in",
	analysis: "out",
	gdd: "out",
	delivery: "out",
	decisions: "trace",
	evidence: "trace",
};

/** 六个标准桶（面板上的显示顺序，规格常量） */
export const BUCKETS: string[] = ["source", "analysis", "gdd", "delivery", "decisions", "evidence"];

/** 相对路径统一成正斜杠（面板与 `allPaths` 的口径） */
function relOf(abs: string): string {
	return abs.split(path.sep).join("/");
}

/** 列一层目录里的**文件**名（目录不存在给空数组，与加载层的 `optional` 容错同口径） */
export function fileNames(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir, { withFileTypes: true })
		.filter((d) => d.isFile())
		.map((d) => d.name)
		.sort();
}

/** 列一层目录里的**子目录**名 */
export function dirNames(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort();
}

/** 功能根下**所有层**的文件（相对功能根、正斜杠、已排序）—— 对账用的"磁盘实际" */
function allFiles(root: string): string[] {
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
			const abs = path.join(dir, d.name);
			if (d.isDirectory()) walk(abs);
			else out.push(relOf(path.relative(root, abs)));
		}
	};
	if (fs.existsSync(root)) walk(root);
	return out.sort();
}

/** 一个相对路径的层数（`a.md`=0 层目录 · `source/a.md`=1 · `source/UE交付_x/a.md`=2） */
function depthOf(rel: string): number {
	return rel.split("/").length - 1;
}

/**
 * 面板**声明会列出来**的那两层：功能根散文件 + 桶里的文件 + 桶的子目录里的文件。
 * 这就是 `scanFeatureListing` 的列举深度（`allPaths` 应该与它逐条相等）。
 */
export function shallowFiles(root: string): string[] {
	return allFiles(root).filter((p) => depthOf(p) <= 2);
}

/** 比声明深度**更深**的文件（面板不列，但必须被 `notes` 点名"未展开"） */
export function deepFiles(root: string): string[] {
	return allFiles(root).filter((p) => depthOf(p) > 2);
}

/**
 * 「未展开更深一层：<桶>/<子目录>（还有 N 个子目录）」—— 与
 * `src/load/feature.ts` 的 `deepDirs` 同形（第二层目录只要有**子目录**就报，哪怕里面是空的）。
 */
export function deepDirNotes(root: string): string[] {
	const out: string[] = [];
	for (const d1 of dirNames(root)) {
		for (const d2 of dirNames(path.join(root, d1))) {
			const deeper = dirNames(path.join(root, d1, d2));
			if (deeper.length) out.push(d1 + "/" + d2 + "（还有 " + deeper.length + " 个子目录）");
		}
	}
	return out.sort();
}

/** 某个桶**两层内**的文件（相对功能根、正斜杠） */
export function bucketFiles(root: string, bucket: string): string[] {
	return shallowFiles(root).filter((p) => p.split("/")[0] === bucket);
}

/** 功能根下的散文件（"未归桶"那一组） */
export function rootFiles(root: string): string[] {
	return shallowFiles(root).filter((p) => !p.includes("/"));
}

/** 按桶口径重算 `{in, out, trace, other}`（`other` = 非桶目录 + 功能根散文件） */
export function bucketCounts(root: string): Record<string, number> {
	const counts: Record<string, number> = { in: 0, out: 0, trace: 0, other: 0 };
	for (const p of shallowFiles(root)) {
		const seg = p.split("/")[0];
		const meaning = p.includes("/") ? BUCKET_MEANING[seg] : undefined;
		counts[meaning || "other"] += 1;
	}
	return counts;
}

/** `features\` 下的功能主题（目录即功能；`isNoise` 的排除由调用方做，这里只给目录名） */
export function topicDirs(featuresRoot: string): string[] {
	return dirNames(featuresRoot);
}

/** 某目录下符合某个文件名判据的文件（默认按名倒序，与台账的显示口径一致） */
export function namesMatching(dir: string, re: RegExp, desc = false): string[] {
	const hit = fileNames(dir).filter((n) => re.test(n));
	return desc ? hit.slice().sort().reverse() : hit;
}

/** 计划外的更深的层：把 `deepFiles` 逐条归到"被点名的那个第二层目录"上 */
export function deepParentOf(rel: string): string {
	return rel.split("/").slice(0, 2).join("/");
}
