/**
 * 产物 `lib/index.js`（宿主半侧）的**构建后**判据 —— 工单 05。
 *
 * 为什么单独一条、而且挂在 build 之后：`src/generated/skills.ts` 是**入库产物**，但它要**内联进
 * `lib/index.js`** 才真的随包走。这里在**真的构建完之后**把产物 import 进来、拿假 ctx 跑一遍
 * `apply`，钉住"12 条技能真的在产物里"（否则打包器一 DCE / 一改配置就静默丢正文，
 * 而源码和测试都还是绿的）。
 *
 * 它**不**替代真机验收（`01-evidence\run-verify05.ps1 -Arm plugin`）：这里没有 cordis、没有
 * dsh-skill 注册表，只证明"注册调用发出了、形状对、正文在"。
 *
 * 跑法：`node tools/check-host-skills.mjs`（`npm run build:safe` 的第③步会跑它）
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = path.join(REPO, "lib", "index.js");

const problems = [];
const check = (label, fn) => {
	try {
		fn();
	} catch (e) {
		problems.push(label + "：" + String((e && e.message) || e));
	}
};

let mod;
try {
	mod = await import(pathToFileURL(ARTIFACT).href);
} catch (e) {
	console.error("[check:host-skills] ✗ 产物无法 import：" + String((e && e.message) || e));
	process.exit(1);
}

/** 只记调用的假 ctx（不引 cordis）。 */
const registered = [];
const fakeCtx = {
	skills: {
		register(skill) {
			registered.push(skill);
			return () => {};
		},
	},
	logger: { info: () => {}, warn: () => {}, error: () => {} },
};

check("inject 必须是 ['skills']", () => assert.deepEqual(mod.inject, ["skills"]));
check("必须导出 apply", () => assert.equal(typeof mod.apply, "function"));
check("apply 不能抛错", () => mod.apply(fakeCtx, {}));
check("注册条数必须是 12", () => assert.equal(registered.length, 12));
check("每条都要有 source='bundled' / 非空 description / 非空正文", () => {
	for (const s of registered) {
		assert.equal(s.source, "bundled", s.name + " 的 source 不是 bundled");
		assert.ok(s.description.length > 0, s.name + " 缺 description");
		assert.ok(s.content.length > 1000, s.name + " 的正文是空壳（多半被 DCE 吃了）");
		assert.equal(typeof s.invocation.modelInvocable, "boolean", s.name + " 的 invocation 形状不对");
	}
});
check("模型可见 10 个 + 用户专用 2 个（两个 user-only 必须在册且 modelInvocable=false）", () => {
	const modelVisible = registered.filter((s) => s.invocation.modelInvocable).map((s) => s.name);
	assert.equal(modelVisible.length, 10, "模型可见的应为 10 个，实际 " + modelVisible.length);
	const userOnly = registered.filter((s) => !s.invocation.modelInvocable).map((s) => s.name).sort();
	assert.deepEqual(userOnly, ["sr-config-heroskill", "sr-gdd-html"]);
	for (const s of registered.filter((x) => !x.invocation.modelInvocable)) {
		assert.equal(s.invocation.userInvocable, true, s.name + " 用户必须仍可 /名字 调用");
	}
});
check("正文合计应 ~118.7 KB（证明整批正文都在产物里）", () => {
	const total = registered.reduce((a, s) => a + Buffer.byteLength(s.content, "utf8"), 0);
	assert.ok(total > 110 * 1024 && total < 130 * 1024, "正文合计 " + (total / 1024).toFixed(1) + " KB，不在预期量级");
});
check("单文件产物：不该留 ../src/generated 的相对 import", () => {
	const text = fs.readFileSync(ARTIFACT, "utf8");
	assert.equal(/from\s*["'][^"']*generated\//.test(text), false, "generated/ 应被内联，不该留相对 import");
	assert.ok(text.includes("sr-gdd-html"), "产物里应能找到技能名");
});

if (problems.length > 0) {
	console.error("\n✗ [check:host-skills] 产物未过判据：\n - " + problems.join("\n - "));
	process.exit(1);
}
console.error(
	"\n✓ [check:host-skills] 产物通过：lib/index.js 注册 " + registered.length + " 条，" +
		"模型可见 " + registered.filter((s) => s.invocation.modelInvocable).length + " 条，" +
		"正文合计 " + (registered.reduce((a, s) => a + Buffer.byteLength(s.content, "utf8"), 0) / 1024).toFixed(1) + " KB",
);
