/**
 * 路径归一（迁移自 legacy/test-toabs.js 的 7 个用例 + 那个真实 bug 的复现）。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { toAbs } from "../src/pure/path.ts";

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
