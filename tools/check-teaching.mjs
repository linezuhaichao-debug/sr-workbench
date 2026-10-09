/**
 * ── 技能用法数据的判据（T0）────────────────────────────────────────────────
 *
 * 查四件事：
 *   ① 真 `apply()` 之后**注册了那条路由**（`exact /sr-workbench/teaching.json`）；
 *   ② 真调一次 handler：HTTP 200 + JSON 能解析 + **内容齐**（主线 ≥4 步、速查 ≥8 行、
 *      两个规则节、教学卡 ≥8 张）且 `problems` 为空；
 *   ③ **主线里提到的技能必须有出处**（在速查表或"独立技能"那句里找得到）——
 *      否则弹窗会出现"无出处的技能"，用户照着敲就是无效调用；
 *   ④ 没有 `webServer` 服务时：**不许炸**，且必须记一条 INFO 说清"这一版拿不到"。
 *
 * ★ 为什么用真 `apply()`：判据要盯"发出去的那份产物"，不是源码 —— 同 check-host-skills。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = path.join(REPO, "lib", "index.js");
const ROUTE = "/sr-workbench/teaching.json";

const problems = [];
const ok = (m) => console.log("  ✓ " + m);

if (!fs.existsSync(ARTIFACT)) {
	console.error("✗ 没有产物：" + ARTIFACT + "（先 npm run build）");
	process.exit(1);
}
const mod = await import("file:///" + ARTIFACT.replace(/\\/g, "/"));

/** 造一个假 ctx：只给技能注册 + webServer + logger，记下拿到了什么。 */
function makeCtx(withWeb) {
	const seen = { skills: [], routes: [], logs: [] };
	const ctx = {
		skills: { register: (s) => seen.skills.push(s) },
		get: (n) => (withWeb && n === "webServer" ? { register: (r) => { seen.routes.push(r); return () => {}; } } : undefined),
		effect: () => {},
		logger: { info: (m) => seen.logs.push("INFO " + m), warn: (m) => seen.logs.push("WARN " + m) }
	};
	return { ctx, seen };
}

// ① 注册路由
const a = makeCtx(true);
mod.apply(a.ctx, {});
const route = a.seen.routes.filter((r) => r.path === ROUTE)[0];
if (!route) problems.push("没注册 " + ROUTE + "（注册到的路由：" + a.seen.routes.map((r) => r.path).join("、") + "）");
else if (route.kind !== "exact") problems.push(ROUTE + " 的 kind 应当是 exact，实际 " + route.kind);
else ok("注册了路由 " + route.kind + " " + ROUTE);

// ② 真调 handler
if (route) {
	const chunks = [];
	const res = { writeHead: (c, h) => { res.code = c; res.headers = h; }, end: (b) => chunks.push(b) };
	let err = null;
	try { await route.handler({}, res); } catch (e) { err = e; }
	if (err) problems.push("handler 抛了：" + err.message);
	else {
		if (res.code !== 200) problems.push("HTTP 应当是 200，实际 " + res.code);
		if (!/application\/json/.test(String(res.headers && res.headers["Content-Type"]))) problems.push("Content-Type 不是 JSON");
		if (String(res.headers && res.headers["Cache-Control"]) !== "no-store") problems.push("应当 no-store（技能改了要立刻能看见）");
		let j = null;
		try { j = JSON.parse(chunks.join("")); } catch (e) { problems.push("响应不是合法 JSON：" + e.message); }
		if (j) {
			if (j.ok !== true) problems.push("ok 应当是 true" + (j.problems && j.problems.length ? "（problems：" + j.problems.join("；") + "）" : ""));
			if (!(j.steps || []).length || j.steps.length < 4) problems.push("主线步骤应当 ≥4，实际 " + (j.steps || []).length);
			if (!(j.routes || []).length || j.routes.length < 8) problems.push("速查表应当 ≥8 行，实际 " + (j.routes || []).length);
			if ((j.rules || []).length !== 2) problems.push("规则节应当是 2 个（产出落盘 + 数值铁律），实际 " + (j.rules || []).length);
			if (!(j.cards || []).length || j.cards.length < 8) problems.push("教学卡应当 ≥8 张，实际 " + (j.cards || []).length);
			if ((j.problems || []).length) problems.push("解析有问题：" + j.problems.join("；"));
			// ③ 主线提到的技能必须有出处
			const source = (j.routes || []).map((r) => r.skill).join(" ") + " " + (j.standalone || "") + " " + (j.cards || []).map((c) => "/" + c.id).join(" ");
			const mentioned = new Set();
			for (const s of j.steps || []) for (const m of String(s.text).matchAll(/`(\/sr-[a-z-]+)`/g)) mentioned.add(m[1]);
			const orphan = [...mentioned].filter((x) => source.indexOf(x) < 0);
			if (orphan.length) problems.push("主线提到但没有出处的技能：" + orphan.join("、"));
			if (problems.length === 0) {
				ok(`数据齐：主线 ${j.steps.length} 步 · 速查 ${j.routes.length} 行 · 规则 ${j.rules.length} 节 · 教学卡 ${j.cards.length} 张 · 无 problems`);
				ok("主线提到的 " + mentioned.size + " 个技能都有出处（速查表 / 独立技能 / 教学卡）");
			}
		}
	}
}

// ④ 没有 webServer：不许炸，且要说清
const b = makeCtx(false);
let threw = null;
try { mod.apply(b.ctx, {}); } catch (e) { threw = e; }
if (threw) problems.push("没有 webServer 时 apply 抛了：" + threw.message);
else if (!b.seen.logs.some((l) => l.indexOf("没有 webServer") >= 0)) problems.push("没有 webServer 时应当记一条 INFO 说清（不许静默）");
else if (b.seen.skills.length === 0) problems.push("没有 webServer 时**技能本身仍要注册**（技能与弹窗数据互不依赖）");
else ok("没有 webServer 时不炸、如实记日志、技能照常注册（" + b.seen.skills.length + " 个）");

if (problems.length) {
	console.error("\n✗ 技能用法判据未通过：");
	for (const p of problems) console.error(" - " + p);
	process.exit(1);
}
console.log("✓ 通过：技能用法数据（路由 / 内容齐 / 出处可查 / 无 webServer 也不炸）");
