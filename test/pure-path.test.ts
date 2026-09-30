/**
 * 路径归一（迁移自 legacy/test-toabs.js 的 7 个用例 + 那个真实 bug 的复现）。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { featureRootOf, toAbs } from "../src/pure/path.ts";

const CWD = "D:\\TimeMachine";

test("toAbs：7 个真实用例（含用户报过的重复前缀 bug）", () => {
	const cases: [string, string, string][] = [
		["绝对路径（正斜杠）不得重复前缀", "D:\\TimeMachine\\GameDesignOS\\workspace/proposals/联盟悬赏_20260923_定稿.md", "D:\\TimeMachine\\GameDesignOS\\workspace\\proposals\\联盟悬赏_20260923_定稿.md"],
		["绝对路径（全反斜杠）保持", "D:\\TimeMachine\\GameDesignOS\\workspace\\proposals\\a.md", "D:\\TimeMachine\\GameDesignOS\\workspace\\proposals\\a.md"],
		["相对路径用 cwd 前缀", "GameDesignOS/workspace/proposals/a.md", "D:\\TimeMachine\\GameDesignOS\\workspace\\proposals\\a.md"],
		["UNC 路径不上前缀", "\\\\server\\share\\a.md", "\\\\server\\share\\a.md"],
		["驱动器根开始", "D:/TimeMachine/a.md", "D:\\TimeMachine\\a.md"],
		["空串", "", ""],
		["POSIX 绝对路径不上前缀", "/foo/bar", "/foo/bar"],
	];
	for (const [label, rel, want] of cases) assert.equal(toAbs(CWD, rel), want, label);
});

test("toAbs：cwd 带尾部分隔符不产生双分隔符", () => {
	assert.equal(toAbs("D:\\TimeMachine\\", "GameDesignOS/a.md"), "D:\\TimeMachine\\GameDesignOS\\a.md");
});

test("复现用户报的那条：绝对路径不会被二次前缀", () => {
	const bug = toAbs(CWD, "D:\\TimeMachine\\GameDesignOS\\workspace/proposals/联盟悬赏_20260923_定稿.md");
	assert.equal(bug.split("D:\\TimeMachine").length, 2, "只应出现一次 D:\\TimeMachine：" + bug);
	assert.equal(bug.includes("/"), false, "Windows 路径里的 / 应归一成 \\：" + bug);
});

test("featureRootOf：从定稿路径算出功能根（工作会话的 cwd，工单 15）", () => {
	const SR = "D:\\TimeMachine\\GameDesignOS\\workspace";
	const f = SR + "\\features\\联盟悬赏\\gdd\\联盟悬赏_20260923_定稿.md";
	assert.equal(featureRootOf(f), SR + "\\features\\联盟悬赏");
	// 分隔符混着来也认（面板给的是绝对路径，历史上出现过混合分隔符）
	assert.equal(featureRootOf(f.replace(/\\/g, "/")), SR + "\\features\\联盟悬赏");
	// 不在 gdd 下（例如分析产物）→ 退成它所在目录，不当成功能根
	assert.equal(featureRootOf(SR + "\\features\\联盟悬赏\\analysis\\拆解.md"), SR + "\\features\\联盟悬赏\\analysis");
	// 嵌套 gdd 取**最后**一个
	assert.equal(featureRootOf("D:\\x\\gdd\\a\\gdd\\b.md"), "D:\\x\\gdd\\a");
	// 目录形态（无扩展名）与空值
	assert.equal(featureRootOf(SR + "\\features\\联盟悬赏\\gdd\\"), SR + "\\features\\联盟悬赏");
	assert.equal(featureRootOf(""), "");
	assert.equal(featureRootOf(null), "");
	assert.equal(featureRootOf(undefined), "");
	assert.equal(featureRootOf("b.md"), "");
});
