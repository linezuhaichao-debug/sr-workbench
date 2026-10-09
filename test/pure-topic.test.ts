/**
 * 主题派生（迁移自 legacy/test-topic.js：那份靠"哨兵字符串切片 + new Function"从 client.js 里抽代码，
 * 现在改成直接 import）。
 *
 * ★ v5：产物分类（`artifactBucket` / `DIR_BUCKET` / `BUCKET_FIELD`）随 v4 的六桶口径一起删除 ——
 *   新的目录契约与细分判据在 `test/pure-buckets.test.ts` 里钉住。
 *
 * 断言跑的是**真实文件名**：`features\**`、工作区根、`planner\策划配置` 的实际文件名。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { dateOf, isNoise, topicOf } from "../src/pure/topic.ts";
import { WORKSPACE, PLANNER_CONFIG_DIR, requireRealData } from "./paths.ts";

function namesIn(dir: string, out: string[], depth: number): void {
	let rows: fs.Dirent[] = [];
	try {
		rows = fs.readdirSync(dir, { withFileTypes: true });
	} catch (e) {
		return;
	}
	for (const d of rows) {
		if (d.isFile()) out.push(d.name);
		else if (depth > 0) namesIn(path.join(dir, d.name), out, depth - 1);
	}
}

function realNames(): string[] {
	const out: string[] = [];
	namesIn(path.join(WORKSPACE, "features"), out, 3);
	namesIn(WORKSPACE, out, 0);
	for (const d of ["proposals", "analysis", "decisions", "evidence", "inbox"]) namesIn(path.join(WORKSPACE, d), out, 0);
	namesIn(PLANNER_CONFIG_DIR, out, 0);
	return Array.from(new Set(out)).sort();
}

/** 只从**配置目录**列到的名字（与上面那个"哪里都扫"的清单分开 —— 见下面那条断言）。 */
function configDirNames(): string[] {
	const out: string[] = [];
	namesIn(PLANNER_CONFIG_DIR, out, 0);
	return Array.from(new Set(out)).sort();
}

/** `features\<主题>\<桶>\` 下那些表文件（`.xlsx` / `.xlsm` / `.csv`），按桶归堆。 */
function featureTableFiles(): Array<{ rel: string; bucket: string }> {
	const out: Array<{ rel: string; bucket: string }> = [];
	const feats = path.join(WORKSPACE, "features");
	let topics: fs.Dirent[] = [];
	try {
		topics = fs.readdirSync(feats, { withFileTypes: true });
	} catch (e) {
		return out;
	}
	for (const t of topics) {
		if (!t.isDirectory()) continue;
		let buckets: fs.Dirent[] = [];
		try {
			buckets = fs.readdirSync(path.join(feats, t.name), { withFileTypes: true });
		} catch (e) {
			continue;
		}
		for (const b of buckets) {
			if (!b.isDirectory()) continue;
			let files: fs.Dirent[] = [];
			try {
				files = fs.readdirSync(path.join(feats, t.name, b.name), { withFileTypes: true });
			} catch (e) {
				continue;
			}
			for (const f of files) {
				if (f.isFile() && /\.(xlsx|xlsm|csv)$/i.test(f.name) && f.name.indexOf("~$") !== 0) {
					out.push({ rel: "features\\" + t.name + "\\" + b.name + "\\" + f.name, bucket: b.name });
				}
			}
		}
	}
	return out;
}

test("主题派生：同一功能的不同阶段/版本收敛到同一个键", () => {
	requireRealData();
	// 定稿 / 中文名 / 压缩包 / 前缀带编号 —— 全是真实出现过的文件名形态
	assert.equal(topicOf("联盟悬赏_20260923_定稿.md"), "联盟悬赏");
	assert.equal(topicOf("联盟悬赏_20260921_定稿_审查.md"), "联盟悬赏");
	assert.equal(topicOf("联盟悬赏（联盟boss）.txt"), "联盟悬赏");
	assert.equal(topicOf("联盟悬赏-md版本.rar"), "联盟悬赏");
	assert.equal(topicOf("readback_A079_神话宝库_20260916.md"), "神话宝库");
	assert.equal(topicOf("smoke_英雄圣物_20260923.png"), "英雄圣物");
	assert.equal(topicOf("A079-联盟悬赏.xlsx"), "联盟悬赏");
});

test("噪音主题不当作功能（脚本名 / 编号 / 过短）", () => {
	assert.equal(isNoise(topicOf("write_CS-20260920-001.py")), true);
	assert.equal(isNoise("A"), true);
	assert.equal(isNoise("1"), true);
	assert.equal(isNoise("联盟悬赏"), false);
});

test("dateOf 取文件名里的 8 位日期", () => {
	assert.equal(dateOf("联盟悬赏_20260923_定稿.md"), "20260923");
	assert.equal(dateOf("A079-联盟悬赏.xlsx"), "");
});

test("真实文件名清单：每个都能派生主题，且没有把配置表当成功能", () => {
	requireRealData();
	const names = realNames();
	assert.ok(names.length > 100, "真实文件名应超过 100 个，实际 " + names.length);
	const topics = new Map<string, string[]>();
	for (const n of names) {
		const t = topicOf(n);
		if (!t) continue;
		if (!topics.has(t)) topics.set(t, []);
		(topics.get(t) as string[]).push(n);
	}
	// 四个真实功能都在（功能 = 目录）
	for (const t of ["联盟悬赏", "神话宝库", "英雄圣物", "诸神降临"]) {
		assert.ok(topics.has(t), "应派生出来自真实文件名的主题：" + t);
	}
	// 配置表只作属性，不创建功能
	// ★ 原断言有两处错：① 正则 `/\.xlsm?$/i` = "xls" + 可选 m，**漏掉 .xlsx**（真表里 55 个是 .xlsx）；
	//   ② 阈值 >50 是猜的。
	// ★ 2026-10-08：Excel **打开着**工作簿时会在同目录留隐藏锁文件 `~$<原表名>.xlsm`（实测 165 字节）——
	//   它匹配表名正则却不是配置数据，会让这条计数随机 +1（用户当场就开着 `A002-货物道具表.xlsm`）。
	//   产品侧（`load/dashboard.ts`）同样排除了它；这里跟着排除。
	// ★ 2026-10-08 之后的加固：条数**不写死**（原为 84 / 29）—— 加一张配置表是**正确动作**，不该红。
	//   改成与**同一时刻**从配置目录重算的真值比（逐条对名单），少列 / 多列一个才红。
	const configTableNames = (list: string[]) => list.filter((n) => /\.xlsx?m?$/i.test(n) && n.indexOf("~$") !== 0);
	/**
	 * ★ 口径改了（2026-10-09）：**新建的运行时表只落 `<功能目录>\gdd\`**，由用户手动放进配置目录。
	 *   所以"工作区里扫到的所有表名"**不再**等于"配置目录里的表"——`features\联盟讨伐\gdd\A079-联盟悬赏.xlsx`
	 *   就是第一份这样的产物（用户还没搬）。原来那条断言因此过期：它比的是"哪里都扫"的清单。
	 *   现在分开比：**只拿配置目录列到的名字**与磁盘比（判的是"列举不漏不重"），
	 *   再单独钉新口径（功能目录里的表只许在 `gdd\`）。
	 */
	const configNames = configTableNames(configDirNames());
	const configNamesEverywhere = configTableNames(names);
	const onDisk = configTableNames(fs.readdirSync(PLANNER_CONFIG_DIR));
	/**
	 * ★ 下界只用来判"目录读得到、不是空的"，**不写死真实条数** —— 加一张配置表是**正确动作**。
	 *   原先写 `>= 84`，其实是**被一张错位的表撑起来的**：`features\联盟讨伐\gdd\A079-联盟悬赏.xlsx`
	 *   混进了"哪里都扫"的清单（配置目录里当时只有 83 张）。口径改了之后清单分开算，这条就露馅了。
	 *   真值一致性由下面那条 `deepEqual` 负责（逐条对名单）。
	 */
	assert.ok(configNames.length >= 50, "配置目录（策划配置）里应当有几十张表，实际 " + configNames.length);
	assert.deepEqual(configNames.slice().sort(), onDisk.slice().sort(), "配置目录列到的表文件 == 该目录里同一时刻的那些");
	assert.equal(
		configNames.filter((n) => /\.xlsm$/i.test(n)).length,
		onDisk.filter((n) => /\.xlsm$/i.test(n)).length,
		"其中 .xlsm 的份数也要与磁盘一致",
	);
	// 新口径：功能目录里可以有**还没搬进配置目录**的表 —— 但它只许待在 `gdd\`
	for (const f of featureTableFiles()) {
		assert.equal(
			f.bucket, "gdd",
			"功能目录里的表文件只许在 gdd\\（新建表落这里，再由人手动搬）：" + f.rel
		);
	}
	assert.ok(configNamesEverywhere.length >= configNames.length, "哪里都扫的清单至少含配置目录那份");
	assert.ok(configNames.every((n) => topicOf(n).length > 0));
});
