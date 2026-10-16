/**
 * 新建功能的纯逻辑（v5）：主题名校验 + "要建什么"的计划 + 界面话术。
 *
 * ★ 建目录的**三条路**也在这份里（`scaffoldDirsOf` / `isBareScaffold` / `buildScaffoldInstruction` /
 *   `manualScaffoldCommand`）—— 因为 `uiWorkspace.createDirectory` **在 Windows 上不存在**
 *   （目录选择器 auto 规则：`win32 → native`，而它被 `requireCapability("browse")` 挡着）。
 *   那一整节的判据与理由写在源码里，这里只钉行为。
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
	bucketHint, buildScaffoldInstruction, checkTopicName, createDoneNotice, createPartialNotice,
	featureRootFor, isBareScaffold, manualScaffoldCommand, nameKey, pathKey, planNewFeature,
	scaffoldDirsOf, sessionTitleFor, TOPIC_MAX
} from "../src/pure/createfeature.ts";

const SR = "D:\\TimeMachine\\GameDesignOS\\workspace";

test("主题名：合法的那些", () => {
	for (const t of ["联盟讨伐", "BOSS 血量共享", "A-1", "神话宝库 v2"]) {
		assert.equal(checkTopicName(t).ok, true, t);
	}
});

test("主题名：每一种拒绝都给出**人话 + 下一步**", () => {
	const cases: Array<[string, string]> = [
		["", "empty"],
		["   ", "empty"],
		[" 联盟讨伐", "padded"],
		["联盟讨伐 ", "padded"],
		["联盟讨伐.", "padded"],
		["a\\b", "illegal"],
		["a/b", "illegal"],
		["a:b", "illegal"],
		["a?b", "illegal"],
		["a*b", "illegal"],
		["a\"b", "illegal"],
		["a<b", "illegal"],
		["a>b", "illegal"],
		["a|b", "illegal"],
		["a\u0001b", "control"],
		[".", "dot"],
		["..", "dot"],
		["CON", "reserved"],
		["con.txt", "reserved"],
		["COM1", "reserved"],
		["lpt9", "reserved"],
		["长".repeat(TOPIC_MAX + 1), "too-long"]
	];
	for (const [t, code] of cases) {
		const c = checkTopicName(t);
		assert.equal(c.ok, false, JSON.stringify(t));
		assert.equal(c.code, code, JSON.stringify(t));
		assert.ok(c.message.length > 0, "要有给人看的一句话");
		assert.ok(c.next.length > 0, "要有下一步：" + JSON.stringify(t));
	}
	// COM0 / LPT0 **不是**保留名
	assert.equal(checkTopicName("COM0").ok, true);
	assert.equal(checkTopicName("长".repeat(TOPIC_MAX)).ok, true);
});

test("功能根：与看板 / 详情同一拼法", () => {
	assert.equal(featureRootFor(SR, "联盟讨伐"), SR + "\\features\\联盟讨伐");
	assert.equal(featureRootFor(SR + "\\", "联盟讨伐"), SR + "\\features\\联盟讨伐");
});

test("计划：合法名字 → 根 + 4 个桶（顺序即创建顺序）", () => {
	const p = planNewFeature("联盟讨伐", { dirNames: ["别的功能"], wsPaths: [], srWs: SR });
	assert.equal(p.ok, true);
	assert.equal(p.root, SR + "\\features\\联盟讨伐");
	assert.deepEqual(p.buckets, ["evidence", "analysis", "gdd", "decisions"]);
	assert.equal(p.message, "");
	assert.equal(p.next, "");
});

test("计划：四种拒绝", () => {
	const bad = (topic: string, facts: any, code: string) => {
		const p = planNewFeature(topic, Object.assign({ dirNames: [], wsPaths: [], srWs: SR }, facts));
		assert.equal(p.ok, false);
		assert.equal(p.code, code);
		assert.ok(p.message.length > 0 && p.next.length > 0, "拒绝也要给人话与下一步");
		return p;
	};
	bad("a\\b", {}, "illegal");
	bad("联盟讨伐", { srWs: "" }, "no-anchor");
	// 目录已存在（大小写 / 尾点不敏感，照 Windows 的规矩）
	bad("联盟讨伐", { dirNames: ["联盟讨伐"] }, "dir-exists");
	bad("联盟讨伐", { dirNames: ["联盟讨伐."] }, "dir-exists");
	// 该路径上已登记过工作区
	const p = bad("联盟讨伐", { wsPaths: [(SR + "/features/联盟讨伐").replace(/\//g, "\\").toUpperCase()] }, "workspace-taken");
	assert.ok(p.next.includes("刷新"), "要告诉人下一步怎么做");
});

test("路径比对：大小写不敏感、分隔符统一、去尾斜杠", () => {
	assert.equal(pathKey("D:\\A\\B\\"), "d:\\a\\b");
	assert.equal(pathKey("D:/A/B"), "d:\\a\\b");
	assert.equal(nameKey("联盟讨伐."), nameKey("联盟讨伐"));
	assert.equal(nameKey(" ABC "), "abc");
});

test("界面话术：建好那一句**只说结果**（用户口径「只要说一下 4 个桶」）", () => {
	assert.ok(bucketHint("decisions").includes("决策记录"));
	assert.equal(bucketHint("没这个桶"), "");
	assert.equal(sessionTitleFor("联盟讨伐"), "策划工作台·工作（联盟讨伐）");

	const done = createDoneNotice("联盟讨伐", "sid-1");
	assert.ok(done.includes("联盟讨伐") && done.includes("4 个桶"), "要点名功能与桶：" + done);
	assert.ok(done.includes("工作会话"), "要如实说工作区 / 工作会话就绪了：" + done);
	// ★ 2026-10-13 用户口径：「这些不是用户需要看的，删掉后面这些」——
	//   撤销办法（删目录）、绝对路径、归档可取消那一套都不该占着每次新建后的提示。
	for (const noise of ["要撤掉", "删掉这个目录", "已归档", "D:\\"]) {
		assert.equal(done.includes(noise), false, "这句里不该出现「" + noise + "」：" + done);
	}
	assert.ok(createDoneNotice("X", "").includes("没建起来"), "工作会话没建起来时要如实说（那不是噪音）");

	assert.ok(createPartialNotice("X", "D:\\X", ["features\\"], "gdd\\", "已存在").includes("gdd\\"));
});

// ════════════════════════════════════════════════════════════════════════════
// 建目录的三条路（Windows 上 `createDirectory` 不存在 —— 2026-10-09 实测缺陷）
// ════════════════════════════════════════════════════════════════════════════

test("要建哪些目录：features\\ 在最前，然后功能目录的 4 个桶（顺序即创建顺序）", () => {
	assert.deepEqual(scaffoldDirsOf(SR, "联盟讨伐"), [
		SR + "\\features",
		SR + "\\features\\联盟讨伐\\evidence",
		SR + "\\features\\联盟讨伐\\analysis",
		SR + "\\features\\联盟讨伐\\gdd",
		SR + "\\features\\联盟讨伐\\decisions"
	]);
	assert.equal(scaffoldDirsOf(SR + "\\", "X")[0], SR + "\\features");
});

test("空脚手架判据：只有桶目录才认；**有文件就不是**（那是真功能）", () => {
	const d = (name: string) => ({ name: name, type: "directory" });
	const f = (name: string) => ({ name: name, type: "file" });
	assert.equal(isBareScaffold([]), true, "空目录算（建到一半的现状）");
	assert.equal(isBareScaffold(["evidence", "analysis", "gdd", "decisions"].map(d)), true);
	assert.equal(isBareScaffold([d("Evidence"), d("ANALYSIS")]), true, "大小写不敏感（Windows）");
	assert.equal(isBareScaffold([d("evidence"), f("联盟讨伐_20260923_定稿.md")]), false, "有文件 ⇒ 真功能");
	assert.equal(isBareScaffold([d("evidence"), d("source")]), false, "有别的目录 ⇒ 不是我们建的脚手架");
	assert.equal(isBareScaffold([{ name: "", type: "directory" }]), false, "空名字不认");
	assert.equal(isBareScaffold(null), true);
});

test("发给会话的建目录指令：逐字命令 + 列全目录 + 写清三条规矩", () => {
	const text = buildScaffoldInstruction(SR, "联盟讨伐");
	assert.ok(text.includes("只建目录"));
	for (const d of scaffoldDirsOf(SR, "联盟讨伐")) assert.ok(text.includes(d), "要列全：" + d);
	assert.ok(text.includes("New-Item -ItemType Directory -Force -Path $dirs"), "要给逐字命令");
	assert.ok(text.includes("幂等"), "要说清 -Force 幂等");
	assert.ok(text.includes("不要") && text.includes("写任何文件"), "不许写文件");
	assert.ok(text.includes("OK " + SR + "\\features\\联盟讨伐\\decisions"), "要给一行回报格式");
	assert.ok(buildScaffoldInstruction(SR, "Bob's 功能").includes("Bob''s 功能\\decisions'"), "单引号要按 PowerShell 转义（''）");
});

test("手工命令：复制即用（\$dirs 数组 + 一条 New-Item），不夹别的", () => {
	const cmd = manualScaffoldCommand(SR, "联盟讨伐");
	assert.ok(cmd.startsWith("$dirs = @("));
	assert.ok(cmd.trimEnd().endsWith("New-Item -ItemType Directory -Force -Path $dirs | Out-Null"));
	assert.equal(cmd.split("\n").filter((l) => l.includes("New-Item")).length, 1);
	for (const d of scaffoldDirsOf(SR, "联盟讨伐")) assert.ok(cmd.includes("'" + d + "'"));
});
