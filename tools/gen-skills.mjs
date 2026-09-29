#!/usr/bin/env node
/**
 * 构建期技能快照生成器（工单 05）—— 由 `outputs\.scratch\策划工作台\05-gen-skills.mjs`
 * **原样 adopted 进仓库**（那份已在 scratch 里验证通过：12 个技能 / 正文 118.7 KB /
 * 逐字与源 SKILL.md 一致 / `config.local.json` 一个字段都没进包），只做三处仓库化改造：
 *   ① `--from` 默认值改成"仓库上一级的 `.agents\skills`"（本机即 `D:\TimeMachine\.agents\skills`，
 *      也就是今天工作会话真正加载的那一份；**不是** `sr-team-skills`——两份已漂移，见工单要点 §4）；
 *   ② 新增 `--check`：只比对、不写盘，供构建门发现"包内正文与磁盘正文漂移"；
 *   ③ manifest 每条补 `resourceBytes`（兄弟资源体积），让"只嵌正文 ≠ 技能完整可用"在产物里看得见。
 *
 * 用法：
 *   node tools/gen-skills.mjs                                # 干看：只打印清单与体积
 *   node tools/gen-skills.mjs --out src/generated/skills.ts   # 生成 TS 模块（npm run gen:skills）
 *   node tools/gen-skills.mjs --check                         # 漂移比对（npm run check:skills）
 *   node tools/gen-skills.mjs --from D:\path\to\skills --out …
 *
 * 口径（与 `05-implementation-notes.md` 一致）：
 *  - **只嵌 SKILL.md 正文**（+ frontmatter 派生的 name/description/invocation），
 *    兄弟资源（references/ tools/ resources/）**不进包**；有兄弟资源的技能如实报出来（含体积），
 *    因为"只嵌正文 ≠ 技能完整可用"这件事必须让 05 的选择看得见。
 *  - `config.local.json` 以及任何 `*.local.json` **绝不打包**（本机私有；`sr-askme` 第 0 步会检查它、缺失就问）。
 *  - 产出 `invocation`：frontmatter 里 `disable-model-invocation: true` ⇒ `{modelInvocable:false, userInvocable:true}`，
 *    否则 `{modelInvocable:true, userInvocable:true}`（照 dsh-skill 的 SkillInvocationPolicy）。
 *  - 产出**来源清单**（每个源 SKILL.md 的 sha256 + 字节数），否则包内正文与磁盘正文会静默漂移。
 *
 * ★ 漂移比对（`--check`）**只比技能载荷**，不比 manifest 里的 `source` / `generatedAt`：
 *   前者是本机绝对路径、后者是时间戳，都不该被当成漂移。判据 = `SKILLS[]` 逐字段相等 +
 *   manifest 每条源文件的 sha256/字节数相等。源目录不存在时**跳过**（分发场景下同事机器上
 *   本来就没有 `.agents\skills`，此时以入库产物为准）——这一点是刻意的，写进 README。
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const REPO = path.resolve(import.meta.dirname, "..");
const argv = process.argv.slice(2);
const getArg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const hasFlag = (n) => argv.includes(n);

/**
 * 默认技能源：**仓库上一级的 `.agents\skills`**（本机 = `D:\TimeMachine\.agents\skills`）。
 * 刻意写成"相对仓库"，免得把本机绝对路径焊死在脚本里；换机器/换工作区只要布局相同就仍然对。
 */
const DEFAULT_FROM = path.resolve(REPO, "..", ".agents", "skills");
const FROM = path.resolve(getArg("--from", DEFAULT_FROM));
const OUT = getArg("--out", null);
const CHECK = hasFlag("--check");
const PREFIX = getArg("--prefix", "sr-");

if (CHECK && OUT === null) {
	console.error("--check 需要同时给 --out <已入库的 skills.ts>（要比对的那一份）");
	process.exit(2);
}

function frontmatter(text) {
	const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	const fm = {};
	if (!m) return { fm, body: text, raw: "" };
	for (const line of m[1].split(/\r?\n/)) {
		const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!kv) continue;
		let v = kv[2].trim();
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
		fm[kv[1]] = v;
	}
	return { fm, body: text.slice(m[0].length), raw: m[1] };
}

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const isLocalPrivate = (name) => /\.local\.json$/i.test(name);

// ── 源目录不存在：生成模式是错误，比对模式只跳过（分发场景的正常情况）────────
if (!fs.existsSync(FROM)) {
	if (CHECK) {
		console.log("[check:skills] 技能源目录不存在，跳过漂移比对：" + FROM);
		console.log("[check:skills] （随包正文以入库的 " + path.relative(REPO, path.resolve(OUT)) + " 为准；分发到没有 .agents\\skills 的机器上就是这种情形）");
		process.exit(0);
	}
	console.error("技能源目录不存在：" + FROM + "\n用 --from <目录> 指定，或确认仓库上一级有 .agents\\skills");
	process.exit(1);
}

/** 扫描技能源，产出「要进包的东西」+「如实报出来的东西」。 --check 与 --out 共用这一份逻辑。 */
function collect() {
	const dirs = fs.readdirSync(FROM, { withFileTypes: true })
		.filter((e) => e.isDirectory() && e.name.startsWith(PREFIX))
		.map((e) => e.name).sort();

	const skills = [];
	const report = [];
	let excludedPrivate = 0;

	for (const d of dirs) {
		const dir = path.join(FROM, d);
		const skillFile = path.join(dir, "SKILL.md");
		if (!fs.existsSync(skillFile)) { report.push({ id: d, error: "没有 SKILL.md" }); continue; }
		const text = fs.readFileSync(skillFile, "utf8");
		const { fm, body } = frontmatter(text);
		const name = fm.name || d;
		const description = (fm.description || "").replace(/\s+/g, " ").trim();
		const disabled = /^(true|yes|1)$/i.test(String(fm["disable-model-invocation"] || ""));
		const invocation = { modelInvocable: !disabled, userInvocable: true };

		// 兄弟资源（不含 SKILL.md 自身、不含私有 config）
		const resources = [];
		const walk = (p, rel) => {
			for (const e of fs.readdirSync(p, { withFileTypes: true })) {
				const q = path.join(p, e.name);
				const r = rel ? rel + "/" + e.name : e.name;
				if (e.isDirectory()) { walk(q, r); continue; }
				if (r === "SKILL.md") continue;
				if (isLocalPrivate(e.name)) { excludedPrivate++; continue; }
				const b = fs.readFileSync(q);
				resources.push({ rel: r, bytes: b.length, sha256: sha(b) });
			}
		};
		walk(dir, "");

		const bodyBytes = Buffer.byteLength(body, "utf8");
		skills.push({
			name, description, content: body, invocation,
			source: "bundled",
			_dir: d,
			_skillFileBytes: Buffer.byteLength(text, "utf8"),
			_bodyBytes: bodyBytes,
			_resources: resources,
			_sha256: sha(Buffer.from(text, "utf8")),
		});
		report.push({
			id: d, name, disabledModelInvocation: disabled,
			skillMdBytes: Buffer.byteLength(text, "utf8"), bodyBytes,
			resourceFiles: resources.length,
			resourceBytes: resources.reduce((a, x) => a + x.bytes, 0),
			descLen: description.length,
		});
	}
	return { skills, report, excludedPrivate };
}

/** 进包载荷：**只有这四个字段 + source**（与生成物里的 SKILLS[] 逐字段对应）。 */
const payloadOf = (s) => ({ name: s.name, description: s.description, content: s.content, invocation: s.invocation, source: s.source });

/** 渲染 skills.ts 全文。同一份源 + 同一个 stamp ⇒ 同一串字节（漂移判据靠这个）。 */
function renderTs({ skills, report }, stamp) {
	const manifest = {
		generatedAt: stamp,
		source: FROM,
		generator: "tools/gen-skills.mjs",
		bodyBytes: skills.reduce((a, s) => a + s._bodyBytes, 0),
		files: report.filter((r) => !r.error).map((r) => {
			const s = skills.find((x) => x._dir === r.id);
			return {
				id: r.id,
				name: r.name,
				modelInvocable: !r.disabledModelInvocation,
				skillMd: s._sha256,
				bytes: r.skillMdBytes,
				resources: r.resourceFiles,
				resourceBytes: r.resourceBytes,
			};
		}),
	};
	return [
		"// ⚠️ 本文件由 `tools/gen-skills.mjs` **构建期生成**，不要手改（改了下一次 `npm run gen:skills` 就冲掉）。",
		"// 源：" + FROM,
		"// 生成时间：" + manifest.generatedAt,
		"// 口径：只嵌 SKILL.md 正文；兄弟资源（references/tools/resources）**不进包**；*.local.json 一律排除。",
		"// 漂移判据：`npm run check:skills` 比对 SKILLS[] 与 SKILLS_MANIFEST.files 的 sha256（已接进 build:safe）。",
		"export interface BundledSkill { name: string; description: string; content: string; invocation: { modelInvocable: boolean; userInvocable: boolean }; source: 'bundled'; }",
		"export const SKILLS: BundledSkill[] = " + JSON.stringify(skills.map(payloadOf), null, 1) + ";",
		"export const SKILLS_MANIFEST = " + JSON.stringify(manifest, null, 1) + " as const;",
		"",
	].join("\n");
}

const collected = collect();
const { skills, report, excludedPrivate } = collected;

// ── 清单（干看 / 生成 / 比对都打印同一份，便于对报告取数）────────────────────
console.log("技能源：" + FROM);
console.log("按钮名以 " + PREFIX + " 开头、且有 SKILL.md 的技能：" + skills.length + " 个 · 排除的私有文件 " + excludedPrivate + " 个（*.local.json）\n");
console.log("| 技能 | 模型可见 | SKILL.md 字节 | 正文字节 | 兄弟资源(个/字节) | description 长度 |");
console.log("|---|---|---|---|---|---|");
for (const r of report) {
	if (r.error) { console.log("| " + r.id + " | — | ❌ " + r.error + " | | | |"); continue; }
	console.log("| " + r.name + " | " + (r.disabledModelInvocation ? "❌ 用户专用" : "✅") + " | " + r.skillMdBytes + " | " + r.bodyBytes + " | " + r.resourceFiles + " / " + r.resourceBytes + " | " + r.descLen + " |");
}
const totalBody = skills.reduce((a, s) => a + s._bodyBytes, 0);
const totalRes = report.reduce((a, r) => a + (r.resourceBytes || 0), 0);
const modelOnly = skills.filter((s) => s.invocation.modelInvocable).length;
console.log("\n合计：正文 " + totalBody + " 字节（" + (totalBody / 1024).toFixed(1) + " KB）· 兄弟资源 " + totalRes + " 字节（" + (totalRes / 1024 / 1024).toFixed(2) + " MB，**不进包**）");
console.log("模型可见 " + modelOnly + " 个 · 用户专用 " + (skills.length - modelOnly) + " 个：" + skills.filter((s) => !s.invocation.modelInvocable).map((s) => s.name).join(", "));

// ── 模式①：漂移比对（只读）────────────────────────────────────────────────
if (CHECK) {
	const outPath = path.resolve(OUT);
	if (!fs.existsSync(outPath)) {
		console.error("\n✗ 漂移比对失败：入库的生成物不存在 → " + outPath + "（跑 npm run gen:skills）");
		process.exit(1);
	}
	let existing;
	try {
		existing = await import(pathToFileURL(outPath).href);
	} catch (e) {
		console.error("\n✗ 漂移比对失败：生成物无法 import（语法坏或被手改坏了）→ " + String(e && e.message || e));
		process.exit(1);
	}
	const problems = [];
	const fresh = skills.map(payloadOf);
	const old = Array.isArray(existing.SKILLS) ? existing.SKILLS : [];
	if (old.length !== fresh.length) problems.push("技能条数：入库 " + old.length + " ≠ 源 " + fresh.length);
	const oldByName = new Map(old.map((s) => [s.name, s]));
	for (const s of fresh) {
		const o = oldByName.get(s.name);
		if (o === undefined) { problems.push("源里有、包里没有：" + s.name); continue; }
		if (o.content !== s.content) problems.push("正文漂移：" + s.name + "（正文 sha256 " + sha(Buffer.from(o.content, "utf8")).slice(0, 12) + " ≠ " + sha(Buffer.from(s.content, "utf8")).slice(0, 12) + "）");
		if (o.description !== s.description) problems.push("description 漂移：" + s.name);
		if (o.invocation?.modelInvocable !== s.invocation.modelInvocable || o.invocation?.userInvocable !== s.invocation.userInvocable) problems.push("invocation 漂移：" + s.name);
		if (o.source !== "bundled") problems.push("source 不是 bundled：" + s.name + " = " + String(o.source));
	}
	for (const o of old) if (!fresh.some((s) => s.name === o.name)) problems.push("包里有、源里没有（技能被删/改名？）：" + o.name);

	// manifest 的每文件 sha256 也要对得上（只看源内容，不看 source/generatedAt 这类本机值）
	const oldFiles = new Map((existing.SKILLS_MANIFEST?.files ?? []).map((f) => [f.id, f]));
	for (const s of skills) {
		const o = oldFiles.get(s._dir);
		if (o === undefined) { problems.push("manifest 缺条目：" + s._dir); continue; }
		if (o.skillMd !== s._sha256) problems.push("源 SKILL.md sha256 漂移：" + s._dir + "（manifest " + String(o.skillMd).slice(0, 12) + " ≠ 磁盘 " + s._sha256.slice(0, 12) + "）");
		if (o.bytes !== s._skillFileBytes) problems.push("源 SKILL.md 字节数漂移：" + s._dir);
	}

	if (problems.length > 0) {
		console.error("\n✗ 漂移比对未通过（" + problems.length + " 项）——入库的技能正文与磁盘上的 " + FROM + " 已经不一致：");
		for (const p of problems) console.error("  - " + p);
		console.error("\n修法：`npm run gen:skills`（重生成入库产物）→ 看 git diff 确认只动了该动的 → 提交。");
		process.exit(1);
	}
	console.log("\n✓ 漂移比对通过：" + skills.length + " 个技能的正文/description/invocation 与源 SKILL.md 的 sha256 全部一致（入库产物 " + path.relative(REPO, outPath) + "）。");
	process.exit(0);
}

// ── 模式②：生成（写盘）────────────────────────────────────────────────────
if (OUT) {
	const outPath = path.resolve(OUT);
	// 重生成时**沿用已入库文件里的 generatedAt**：只改内容、不改时间戳，git diff 才读得懂。
	let stamp = new Date().toISOString();
	if (fs.existsSync(outPath)) {
		const prev = /"generatedAt":\s*"([^"]+)"/.exec(fs.readFileSync(outPath, "utf8"));
		if (prev) stamp = prev[1];
	}
	const ts = renderTs(collected, stamp);
	const changed = !fs.existsSync(outPath) || fs.readFileSync(outPath, "utf8") !== ts;
	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	fs.writeFileSync(outPath, ts, "utf8");
	console.log("\n" + (changed ? "已生成（内容有变化）" : "已生成（与原有内容逐字节相同）") + "：" + outPath + "（" + Buffer.byteLength(ts, "utf8") + " 字节）");
}
