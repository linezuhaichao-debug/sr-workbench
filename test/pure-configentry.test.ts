/** 配置向导的纯逻辑判据。 */
import assert from "node:assert/strict";
import test from "node:test";

import {
	buildConfigInstruction, configIncomplete, CONFIG_FIELDS, looksAbsolutePath, looksFeatureDir, pointerCandidates, pointerPathOf,
	validateConfigValues, workspaceMissing
} from "../src/pure/configentry.ts";

test("字段清单：两个必填（工作区 / 工程）+ 两个选填", () => {
	assert.deepEqual(CONFIG_FIELDS.map((f) => f.key), ["sr_workspace", "sr_project", "config_root", "gtgenerator_workdir"]);
	assert.deepEqual(CONFIG_FIELDS.filter((f) => f.required).map((f) => f.key), ["sr_workspace", "sr_project"]);
});

test("绝对路径形状：认 D:\\ 与 UNC，不认相对的与随手打的", () => {
	assert.equal(looksAbsolutePath("D:\\TimeMachine"), true);
	assert.equal(looksAbsolutePath("d:/time machine"), true, "正斜杠也认（写盘时由会话转成原生分隔符）");
	assert.equal(looksAbsolutePath("\\\\nas\\share"), true, "UNC 认");
	assert.equal(looksAbsolutePath("TimeMachine"), false);
	assert.equal(looksAbsolutePath(".\\relative"), false);
	assert.equal(looksAbsolutePath("C:"), false, "只有盘符不算");
	assert.equal(looksAbsolutePath(""), false);
	assert.equal(looksAbsolutePath(null), false);
});

test("校验：必填缺失与形状不对都要逐条说出来", () => {
	const empty = validateConfigValues({});
	assert.equal(empty.ok, false);
	assert.deepEqual(empty.issues.map((i) => i.key), ["sr_workspace", "sr_project"], "空表只报两个必填");
	const bad = validateConfigValues({ sr_workspace: "随便写的", sr_project: "D:\\Proj" });
	assert.equal(bad.ok, false);
	assert.equal(bad.issues.length, 1);
	assert.ok(bad.issues[0].message.includes("绝对路径"), bad.issues[0].message);
	const good = validateConfigValues({ sr_workspace: "D:\\WS", sr_project: "D:\\Proj", config_root: "", gtgenerator_workdir: "" });
	assert.equal(good.ok, true, "选填留空不拦");
});

test("必填齐不齐（面板决定进不进向导的判据）", () => {
	assert.equal(configIncomplete(null), true);
	assert.equal(configIncomplete({}), true);
	assert.equal(configIncomplete({ sr_workspace: "D:\\WS" }), true, "缺工程也算不齐");
	assert.equal(configIncomplete({ sr_workspace: "D:\\WS", sr_project: "D:\\P" }), false);
	assert.equal(configIncomplete({ sr_workspace: "D:\\WS", sr_project: "D:\\P", config_root: "" }), false, "选填空着也算齐");
});

test("面板的硬判据：只有工作区锚点缺了才进向导（缺 sr_project 不接管界面）", () => {
	assert.equal(workspaceMissing(null), true);
	assert.equal(workspaceMissing({}), true);
	assert.equal(workspaceMissing({ sr_workspace: "  " }), true, "只有空白也算缺");
	assert.equal(workspaceMissing({ sr_workspace: "D:\\WS" }), false);
	assert.equal(workspaceMissing({ sr_workspace: "D:\\WS", sr_project: "" }), false, "缺 sr_project 不是硬条件（那是技能侧的要求）");
	assert.equal(configIncomplete({ sr_workspace: "D:\\WS" }), true, "技能侧口径仍然要求 sr_project");
});

test("指针文件：跟着工作区根走，去重去空", () => {
	assert.equal(pointerPathOf("D:\\WS"), "D:\\WS\\.dsh\\sr-workbench.path");
	assert.equal(pointerPathOf("D:\\WS\\"), "D:\\WS\\.dsh\\sr-workbench.path", "尾部分隔符要吃掉");
	assert.equal(pointerPathOf(""), "");
	assert.deepEqual(pointerCandidates(["D:\\WS", "D:\\WS\\", "E:\\Other", "", null]), [
		"D:\\WS\\.dsh\\sr-workbench.path",
		"E:\\Other\\.dsh\\sr-workbench.path"
	]);
});

test("指针候选：用户填的 sr_workspace 优先，功能目录一律排除", () => {
	// 面板把"功能目录"也当成工作区根过（用户侧边栏里就有"联盟讨伐"这个工作区）——
	// 那会把 .dsh 写进 features\<主题>\，被面板如实列成"不是 4 个桶的目录"（用户问过这个）。
	assert.equal(looksFeatureDir("D:\\WS\\features\\联盟讨伐"), true);
	assert.equal(looksFeatureDir("D:\\WS\\features\\联盟讨伐\\"), true);
	assert.equal(looksFeatureDir("D:\\WS"), false);
	assert.equal(looksFeatureDir("D:\\WS\\features"), false, "features 这一层本身还算根");
	const c = pointerCandidates(["D:\\WS\\features\\联盟讨伐", "D:\\WS"], "D:\\WS");
	assert.equal(c[0], "D:\\WS\\.dsh\\sr-workbench.path", "用户填的那个排第一");
	assert.equal(c.length, 1, "功能目录被排除 ⇒ 与第一个重复后只剩一条");
	const c2 = pointerCandidates(["D:\\WS\\features\\X", "E:\\Other"], "D:\\WS");
	assert.deepEqual(c2, ["D:\\WS\\.dsh\\sr-workbench.path", "E:\\Other\\.dsh\\sr-workbench.path"]);
});

test("写配置指令：内容、落点、指针、回报格式都要说清", () => {
	const t = buildConfigInstruction({
		values: { sr_workspace: "D:\\WS", sr_project: "D:\\Proj", config_root: "D:\\Cfg", gtgenerator_workdir: "" },
		configPathHint: "",
		pointerPaths: ["D:\\WS\\.dsh\\sr-workbench.path"],
		stamp: "20261009"
	});
	assert.ok(t.includes("写本机配置"));
	assert.ok(t.includes('"sr_workspace": "D:\\\\WS"') || t.includes('"sr_workspace": "D:\\WS"'), "JSON 里要有工作区路径");
	assert.ok(t.includes("configured_at"), "要带 configured_at");
	assert.ok(t.includes("$env:USERPROFILE\\.dsh\\sr-workbench\\config.local.json"), "没有 configPath 提示时写用户目录默认位");
	assert.ok(t.includes("D:\\WS\\.dsh\\sr-workbench.path"), "要写指针文件");
	assert.ok(t.includes("`OK <配置绝对路径>`"), "要给一行回报格式");
	assert.ok(t.includes("New-Item"), "要允许它建工作区目录");
	// 有 configPath 时逐字用它，不再提用户目录
	const t2 = buildConfigInstruction({ values: { sr_workspace: "D:\\WS", sr_project: "D:\\P" }, configPathHint: "D:\\Cfg\\config.local.json", pointerPaths: [], stamp: "20261009" });
	assert.ok(t2.includes("D:\\Cfg\\config.local.json"));
	assert.equal(t2.includes("$env:USERPROFILE"), false, "有 configPath 就不该再提默认位");
	assert.equal(t2.includes("指针文件"), false, "没给指针路径就不提指针");
});
