/**
 * 工单 05 · 「技能随包注册」的仓内断言（不需要 dsh 就能跑的判据）。
 *
 * 分两层：
 *   ① **生成物**（`src/generated/skills.ts`）—— 12 条 / 10 模型可见 + 2 用户专用 /
 *      `config.local.json` 之类的私有值一个都没进包 / manifest 与 SKILLS 自洽；
 *   ② **宿主半侧**（`src/index.js`）—— `apply` 真的会逐条 `ctx.skills.register`，
 *      `source:'bundled'`、两个用户专用的 `modelInvocable=false`、无兄弟资源的不挂 `resourceBase`、
 *      磁盘技能根找不到时**如实**落成 `{kind:'opaque'}`（不假装资源可用）。
 *
 * 真机那条（cwd 无技能目录时 catalog 里出现 sr-*）在 `01-evidence\run-verify05.ps1 -Arm plugin`，
 * 这里测不到——如实声明，别当全覆盖。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SKILLS, SKILLS_MANIFEST } from "../src/generated/skills.ts";
import { apply, inject, resolveResourceBase } from "../src/index.js";

const ROOT = path.resolve(import.meta.dirname, "..");

/** 造一个只记调用的假 ctx（不需要 cordis）。 */
function fakeCtx() {
	const registered: any[] = [];
	return {
		registered,
		ctx: {
			skills: { register: (skill: any) => { registered.push(skill); return () => {}; } },
			logger: { info: () => {}, warn: () => {}, error: () => {} },
		},
	};
}

/** 跑一次 apply，返回注册进去的技能定义。env / config 由调用方决定。 */
function registerAll(config?: any) {
	const { ctx, registered } = fakeCtx();
	apply(ctx, config);
	return registered;
}

test("生成物：12 个 sr 技能，10 个模型可见 + 2 个用户专用", () => {
	assert.equal(SKILLS.length, 12);
	assert.equal(SKILLS_MANIFEST.files.length, 12);
	const names = SKILLS.map((s) => s.name);
	assert.deepEqual(names, [...names].sort(), "技能名应有序（生成器按目录名排序）");
	for (const name of names) assert.match(name, /^sr-[a-z0-9]+(-[a-z0-9]+)*$/, "技能名必须是 kebab-case：" + name);

	const modelVisible = SKILLS.filter((s) => s.invocation.modelInvocable).map((s) => s.name);
	const userOnly = SKILLS.filter((s) => !s.invocation.modelInvocable).map((s) => s.name);
	assert.equal(modelVisible.length, 10, "模型可见的应是 10 个（与实测 catalog 的 sr-* 数量一致）");
	assert.deepEqual(userOnly, ["sr-config-heroskill", "sr-gdd-html"], "这两个是 disable-model-invocation 的用户专用技能");
	for (const s of SKILLS) {
		assert.equal(s.invocation.userInvocable, true, s.name + " 用户必须仍然能 /名字 调用");
		assert.equal(s.source, "bundled", s.name + " 的 source 必须是 dsh-skill 现成的 'bundled'");
		assert.ok(s.description.length > 0, s.name + " 必须有 description");
		assert.ok(s.content.length > 1000, s.name + " 的正文不该是空壳");
	}
});

test("生成物：正文总量与 manifest 自洽，且私有文件值没进包", () => {
	const bodyBytes = SKILLS.reduce((a, s) => a + Buffer.byteLength(s.content, "utf8"), 0);
	assert.equal(bodyBytes, SKILLS_MANIFEST.bodyBytes, "SKILLS 正文字节数应等于 manifest.bodyBytes");
	assert.ok(bodyBytes > 100 * 1024 && bodyBytes < 200 * 1024, "正文应在 118.7 KB 量级，实测 " + (bodyBytes / 1024).toFixed(1) + " KB");

	// manifest 每条都要有源 SKILL.md 的 sha256（漂移判据的原料）
	for (const f of SKILLS_MANIFEST.files) {
		assert.match(f.skillMd, /^[0-9a-f]{64}$/, f.id + " 的 sha256 形状不对");
		assert.ok(f.bytes > 0 && f.resourceBytes >= 0);
	}

	// 兄弟资源**没有**进包（方案 A）：不得出现 references/ 里的私有文件名与 toolkit 之类的大件
	const raw = fs.readFileSync(path.join(ROOT, "src", "generated", "skills.ts"), "utf8");
	assert.equal(raw.includes("decision.schema.json\":"), false, "兄弟文件不该被序列化进包");
	assert.equal(/\.local\.json":/.test(raw) && raw.includes("config.local.json\":"), false, "config.local.json 的字段不该进包");
});

test("宿主半侧：apply 逐条注册，形状与 dsh-skill 的 register() 契约一致", () => {
	assert.deepEqual(inject, ["skills"], "必须声明依赖 ctx.skills（宿主行 ⇒ 注册进 global 层）");
	const config = { configPath: "C:\\nope\\config.local.json", projectRoot: "C:\\nope" };
	const registered = registerAll(config);

	assert.equal(registered.length, SKILLS.length, "包里有几条就要注册几条");
	assert.deepEqual(registered.map((s) => s.name), SKILLS.map((s) => s.name));
	for (const skill of registered) {
		assert.equal(typeof skill.name, "string");
		assert.ok(skill.description.length > 0, skill.name + " 缺 description（register 会抛）");
		assert.equal(typeof skill.content, "string");
		assert.ok(skill.content.length > 1000, skill.name + " 的正文没跟着注册走");
		assert.equal(skill.source, "bundled");
		assert.equal(typeof skill.invocation.modelInvocable, "boolean");
		assert.equal(typeof skill.invocation.userInvocable, "boolean");
		assert.equal("provider" in skill, false, "provider 留给注册表默认的 runtime provider");
	}
	// 注册的正文与生成物**逐字一致**（不是截断/转义过的副本）
	const byName = new Map(SKILLS.map((s) => [s.name, s]));
	for (const skill of registered) assert.equal(skill.content, byName.get(skill.name)!.content, skill.name + " 的正文与生成物不一致");
});

test("宿主半侧：两个用户专用技能仍注册，但 modelInvocable=false", () => {
	const registered = registerAll({});
	const hero = registered.find((s) => s.name === "sr-config-heroskill");
	const gddHtml = registered.find((s) => s.name === "sr-gdd-html");
	assert.ok(hero && gddHtml, "两个用户专用技能也必须注册（否则用户 /名字 调不到）");
	assert.deepEqual(hero.invocation, { modelInvocable: false, userInvocable: true });
	assert.deepEqual(gddHtml.invocation, { modelInvocable: false, userInvocable: true });
});

test("resourceBase：磁盘技能根在 ⇒ directory；根不在/该技能不在 ⇒ 如实 opaque；无兄弟资源 ⇒ 不挂字段", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "srwb-skills-"));
	try {
		// ① 磁盘根存在（造一个只有 sr-analysis 目录的假技能根）
		fs.mkdirSync(path.join(tmp, "sr-analysis"), { recursive: true });
		const withDisk = registerAll({ skillsRoot: tmp });
		const analysis = withDisk.find((s) => s.name === "sr-analysis");
		assert.equal(analysis.resourceBase.kind, "directory");
		assert.equal(analysis.resourceBase.path, path.join(tmp, "sr-analysis"));
		// 磁盘根在、但这个技能的目录不在 ⇒ opaque（不假装可用）
		const askme = withDisk.find((s) => s.name === "sr-askme");
		assert.equal(askme.resourceBase.kind, "opaque", "磁盘上没有这个技能的兄弟资源时必须 opaque");
		assert.match(askme.resourceBase.description, /不可用|没有随包/, "opaque 说明要如实讲清资源不可用");

		// ② 完全没有磁盘根：直接钉住纯函数这一支（真机上 .agents\\skills 一直在，走不到这里）
		const noRoot = resolveResourceBase(undefined, "sr-askme");
		assert.equal(noRoot.kind, "opaque");
		assert.equal(resolveResourceBase(tmp, "sr-askme").kind, "opaque", "根在、技能目录不在，同样 opaque");
		assert.equal(resolveResourceBase(path.join(tmp, "missing-root"), "sr-analysis").kind, "opaque");

		// ③ 本身就是纯正文的技能不挂 resourceBase（没什么可解析的）
		const figma = withDisk.find((s) => s.name === "sr-figma-design-system");
		assert.equal("resourceBase" in figma, false, "没有兄弟资源的技能不该造 resourceBase 字段");
		assert.equal(resolveResourceBase(tmp, "sr-figma-design-system"), undefined);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("磁盘技能根解析顺序：config.skillsRoot 优先，都不存在时回落到构建期记录的源目录", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "srwb-root-"));
	const prevEnv = process.env.SR_SKILLS_ROOT;
	try {
		fs.mkdirSync(path.join(tmp, "sr-askme"), { recursive: true });
		// config 给的根赢（哪怕 env / 构建期源目录也在）
		process.env.SR_SKILLS_ROOT = path.join(tmp, "missing");
		const viaConfig = registerAll({ skillsRoot: tmp }).find((s) => s.name === "sr-askme");
		assert.equal(viaConfig.resourceBase.kind, "directory");
		assert.equal(viaConfig.resourceBase.path, path.join(tmp, "sr-askme"));

		// env 顶上（config 没给 skillsRoot 时）
		process.env.SR_SKILLS_ROOT = tmp;
		const viaEnv = registerAll({}).find((s) => s.name === "sr-askme");
		assert.equal(viaEnv.resourceBase.kind, "directory");
		assert.equal(viaEnv.resourceBase.path, path.join(tmp, "sr-askme"));

		// 只给 projectRoot（本机 web profile 的 sr-workbench 行就是这样）⇒ 走 <projectRoot>/.agents/skills
		process.env.SR_SKILLS_ROOT = path.join(tmp, "missing");
		const projRoot = path.join(tmp, "proj");
		fs.mkdirSync(path.join(projRoot, ".agents", "skills", "sr-askme"), { recursive: true });
		const viaProjectRoot = registerAll({ projectRoot: projRoot }).find((s) => s.name === "sr-askme");
		assert.equal(viaProjectRoot.resourceBase.kind, "directory");
		assert.equal(viaProjectRoot.resourceBase.path, path.join(projRoot, ".agents", "skills", "sr-askme"));
		// 但 skillsRoot 仍然优先于 projectRoot
		const both = registerAll({ skillsRoot: tmp, projectRoot: projRoot }).find((s) => s.name === "sr-askme");
		assert.equal(both.resourceBase.path, path.join(tmp, "sr-askme"), "skillsRoot 应优先于 projectRoot 推导");

		// config 与 env 都不存在 ⇒ 回落到构建期记录的源目录：本机存在就是 directory，
		// 分发到没有技能目录的机器上就是 opaque —— 两种都对，这里如实按磁盘现状断言。
		process.env.SR_SKILLS_ROOT = path.join(tmp, "missing");
		const fallback = registerAll({ skillsRoot: path.join(tmp, "missing") }).find((s) => s.name === "sr-askme");
		const diskRootExists = fs.existsSync(path.join(SKILLS_MANIFEST.source, "sr-askme"));
		assert.equal(fallback.resourceBase.kind, diskRootExists ? "directory" : "opaque");
		assert.equal(fallback.resourceBase.path === undefined, !diskRootExists);
	} finally {
		if (prevEnv === undefined) delete process.env.SR_SKILLS_ROOT;
		else process.env.SR_SKILLS_ROOT = prevEnv;
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

/**
 * ★ 产物级判据（"12 条技能真的内联进了 lib/index.js"）**不在这里**：`npm run verify` 的顺序是
 *   test → lint → build:safe，测试跑在构建**之前**，对着上一轮的产物断言只会得到假红。
 *   它挂在构建之后：`tools/check-host-skills.mjs`（build:safe 第③步，不过就还原 lib/）。
 */

