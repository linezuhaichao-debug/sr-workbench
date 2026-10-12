/**
 * 产物 `lib/index.js`（宿主半侧）的**构建后**判据 —— 工单 05。
 *
 * 为什么单独一条、而且挂在 build 之后：`src/generated/skills.ts` 是**入库产物**，但它要**内联进
 * `lib/index.js`** 才真的随包走。这里在**真的构建完之后**把产物 import 进来、拿假 ctx 跑一遍
  * `apply`，钉住"11 条 sr 技能真的在产物里"（否则路径算错 / 打包漏 skills 就静默一条都没有，
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
/**
 * **纯文本技能**：本来就只有 SKILL.md，没有 references。
 * （署名文件 `CONTRIBUTORS` 已被用户删掉，这两个技能因此变成 0 兄弟资源 —— 显式写出来。）
 * 名单外的技能没有兄弟资源 ⇒ 仍然红。
 */
const PROSE_ONLY = ["sr-gdd-fix", "sr-gdd-review"];

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
check("注册条数必须是 11", () => assert.equal(registered.length, 11));
check("每条都要有 source='bundled' / 非空 description / 非空正文", () => {
	for (const s of registered) {
		assert.equal(s.source, "bundled", s.name + " 的 source 不是 bundled");
		assert.ok(s.description.length > 0, s.name + " 缺 description");
		assert.ok(s.content.length > 1000, s.name + " 的正文是空壳（多半被 DCE 吃了）");
		assert.equal(typeof s.invocation.modelInvocable, "boolean", s.name + " 的 invocation 形状不对");
	}
});
check("模型可见 9 个 + 用户专用 2 个（两个 user-only 必须在册且 modelInvocable=false）", () => {
	const modelVisible = registered.filter((s) => s.invocation.modelInvocable).map((s) => s.name);
	assert.equal(modelVisible.length, 9, "模型可见的应为 9 个，实际 " + modelVisible.length);
	const userOnly = registered.filter((s) => !s.invocation.modelInvocable).map((s) => s.name).sort();
	// 顺序按 code point 排序：'sr-gdd-html' < 'sr-gdd-ue'（h < u）。
	// ★ 名字必须是小写 kebab-case —— DSH 的 runtime 注册只收 /^[a-z0-9]+(?:-[a-z0-9]+)*$/，
	//   写成 `sr-gdd-UE` 会让**整批** 11 条一起注册失败（2026-10-12 实测）。
	assert.deepEqual(userOnly, ["sr-gdd-html", "sr-gdd-ue"]);
	for (const s of registered.filter((x) => !x.invocation.modelInvocable)) {
		assert.equal(s.invocation.userInvocable, true, s.name + " 用户必须仍可 /名字 调用");
	}
});
check("正文合计与磁盘上那 11 份 SKILL.md 同量级（证明整批正文都在产物里）", () => {
	/**
	 * ★ 原来这里写死"~120.9 KB（>110KB 且 <130KB）"—— 2026-10-10 把 sr-askme 的使用教学
	 *   搬出 SKILL.md 之后，正文合计掉到 108.8 KB，于是**判据红了而东西是好的**。
	 *   写死的量级本来就是这个毛病：它盯的是"那个数字"，不是"正文在不在"。
	 *   ⇒ 改成**跟磁盘对**：注册的正文是各自 SKILL.md 的尾部（frontmatter 不带进来），
	 *     所以总量应当略小于磁盘上这批 SKILL.md 的字节数，且不能小太多。
	 */
	const total = registered.reduce((a, s) => a + Buffer.byteLength(s.content, "utf8"), 0);
	const onDisk = registered.reduce((a, s) => a + fs.statSync(path.join(s.resourceBase.path, "SKILL.md")).size, 0);
	const kb = (n) => (n / 1024).toFixed(1) + " KB";
	assert.ok(total <= onDisk, "正文合计 " + kb(total) + " 比磁盘上的 SKILL.md 合计 " + kb(onDisk) + " 还大 —— 形状不对");
	assert.ok(total > onDisk * 0.8, "正文合计 " + kb(total) + " 远小于磁盘上的 " + kb(onDisk) + "（多半被 DCE 吃了，或漏了技能）");
});
check("单文件产物：不该留 ../src/generated 的相对 import", () => {
	const text = fs.readFileSync(ARTIFACT, "utf8");
	assert.equal(/from\s*["'][^"']*generated\//.test(text), false, "generated/ 早该删干净，不该还有引用");
});
/**
 * ★ 6.0.0 的要点：正文与 references **同源同包**。
 *   正文是 `apply()` 时从 `<包根>/skills/<名>/SKILL.md` **读**出来的，不是构建期抄的副本 ——
 *   所以这里逐条核对：resourceBase 指包内、那份 SKILL.md 存在、且注册的正文与它尾部逐字一致。
 *   （旧设计只嵌正文、资源留磁盘，等于一堆空壳 —— 用户点破的就是这条。）
 */
check("resourceBase 指向包内 skills\\，且正文与该文件逐字一致", () => {
	const root = path.join(REPO, "skills");
	for (const s of registered) {
		assert.ok(s.resourceBase && s.resourceBase.kind === "directory", s.name + " 的 resourceBase 应为目录");
		assert.equal(path.resolve(s.resourceBase.path).indexOf(path.resolve(root)), 0, s.name + " 的 resourceBase 指到了包外：" + s.resourceBase.path);
		const file = path.join(s.resourceBase.path, "SKILL.md");
		assert.ok(fs.existsSync(file), s.name + " 的 resourceBase 目录里没有 SKILL.md：" + file);
		assert.ok(fs.readFileSync(file, "utf8").endsWith(s.content), s.name + " 注册的正文与包内 SKILL.md 不一致");
	}
});
check("兄弟资源真的在包内目录里（references 才是技能的精华）", () => {
	for (const s of registered) {
		// ★ 纯文本技能（本来只有 SKILL.md）放行 —— 名单与 check-bundled-skills.mjs 一致
		if (PROSE_ONLY.indexOf(s.name) >= 0) continue;
		const dir = s.resourceBase.path;
		const sub = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() || e.name !== "SKILL.md");
		assert.ok(sub.length > 0, s.name + " 除 SKILL.md 外没有任何兄弟资源");
	}
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
