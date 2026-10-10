import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
//#region src/pure/skillmeta.ts
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
/** 解析一份 SKILL.md；解析不出来返回 `null`。 */
function parseSkillFile(text, fallbackName) {
	const s = String(text === null || text === void 0 ? "" : text);
	const m = FRONTMATTER.exec(s);
	if (!m) return null;
	const fm = {};
	for (const line of m[1].split(/\r?\n/)) {
		const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
		if (!kv) continue;
		let v = kv[2].trim();
		if (v.startsWith("\"") && v.endsWith("\"") || v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
		fm[kv[1]] = v;
	}
	const name = (fm.name || fallbackName || "").trim();
	if (name === "") return null;
	const disabled = /^(true|yes|1)$/i.test(String(fm["disable-model-invocation"] || ""));
	return {
		name,
		description: String(fm.description || "").replace(/\s+/g, " ").trim(),
		body: s.slice(m[0].length),
		invocation: {
			modelInvocable: !disabled,
			userInvocable: true
		}
	};
}
//#endregion
//#region src/index.js
/**
* 宿主半侧（Node ESM 入口，构建成 `lib/index.js`）—— **技能随插件走，包内就是唯一那份**。
*
* ── 这一版为什么改（2026-10-09，用户口径）────────────────────────────────────
*   上一版把 SKILL.md **正文内联**进 `lib/index.js`，兄弟资源（references / scripts / tools）
*   留给磁盘的 `.agents\skills`。用户一句话点破：**references 才是技能的精华** ——
*   于是"只有正文"的那份等于 11 个空壳（实测：11 个技能**每个**都有兄弟资源）。
*   而且同事的插件行不带 config，宿主半侧找不到他工作区的技能目录 ⇒ `resourceBase` 只能落 `opaque`，
*   也就是说**旧设计对同事本来就是坏的**。
*
*   这一版：技能源码落在**插件仓库的 `skills/`**（随 tgz 分发），`apply()` 时
*     ① 从 `<包根>/skills/<名>/SKILL.md` 读正文（运行时读，不再内联）；
*     ② `resourceBase` 直接指 `<包根>/skills/<名>` ⇒ **正文与 references 同源同包**，谁都读得到。
*   ⇒ 同事只装这一个包，`/sr-*` 就是**完整可用**的；用户自己也只维护这一份（改完重启 DSH 生效）。
*
* ── 不做的事 ──────────────────────────────────────────────────────────────
*   · **不** `provide` 任何服务；**不**写任何文件（写盘是技能里 agent 的事）。
*   · **不**去猜磁盘技能根：技能的唯一出处就是包内 `skills/`（磁盘上若还有同名技能，
*     它按 `dsh-skill-filesystem` 的 rank（project-agents 200 < bundled 600）自然赢 —— 那是宿主规则，不归这里管）。
*
* ── 排障 ─────────────────────────────────────────────────────────────────
*   契约里的技能一个都没注册？先看 `<包根>/skills/` 在不在（`npm pack` 的 `files` 里必须含 `skills`），
*   再看日志里那行 `[sr-workbench] 随包注册…`。
*/
/** 要求 `ctx.skills`（`@deepseek-ai/dsh-skill` 的注册表服务）；插件行落在宿主 ⇒ 注册进 global 层。 */
const inject = ["skills"];
/** 技能目录名前缀（只收 `sr-*`）。 */
const PREFIX = "sr-";
/** 本文件所在包的根目录（`lib/index.js` 的上一级）。 */
function packageRootOf(moduleUrl) {
	return path.resolve(path.dirname(fileURLToPath(moduleUrl)), "..");
}
/** 包内技能根。 */
function skillsRootOf(pkgRoot) {
	return path.join(pkgRoot, "skills");
}
/**
* 扫一个技能根 → 可注册的技能数组 + **如实报出来的问题**（缺 frontmatter / 读不动 / 没正文…）。
* 导出是为了让仓内用例能在临时目录上钉住"缺东西时不注册"这条，而不必动真包。
* @param root 技能根（通常是 `<包根>/skills`）
*/
function loadBundledSkills(root) {
	const skills = [];
	const problems = [];
	let entries = [];
	try {
		entries = fs.readdirSync(root, { withFileTypes: true });
	} catch (e) {
		return {
			skills,
			problems: ["技能根读不到：" + root + "（" + String(e && e.code || e) + "）"]
		};
	}
	for (const e of entries.filter((d) => d.isDirectory() && d.name.startsWith(PREFIX)).sort((a, b) => a.name < b.name ? -1 : 1)) {
		const dir = path.join(root, e.name);
		const file = path.join(dir, "SKILL.md");
		let text = "";
		try {
			text = fs.readFileSync(file, "utf8");
		} catch (err) {
			problems.push(e.name + "：没有 SKILL.md（" + String(err && err.code || err) + "）");
			continue;
		}
		const parsed = parseSkillFile(text, e.name);
		if (parsed === null) {
			problems.push(e.name + "：SKILL.md 读不出 frontmatter（缺 `name`？）—— **不注册**，宁缺勿假");
			continue;
		}
		if (parsed.body.trim() === "") {
			problems.push(e.name + "：SKILL.md 只有 frontmatter、没有正文 —— **不注册**");
			continue;
		}
		skills.push({
			name: parsed.name,
			description: parsed.description,
			content: parsed.body,
			invocation: parsed.invocation,
			/** 正文与兄弟资源同在一个目录 ⇒ 模型读 references 走这里。 */
			resourceBase: {
				kind: "directory",
				path: dir
			},
			dir
		});
	}
	return {
		skills,
		problems
	};
}
/**
* 注册全部随包技能（正文 + `resourceBase` 都指向包内 `skills/<名>/`）。
* @param {any} ctx cordis 上下文（需要 `skills` 服务）
* @param {{ skillsRoot?: unknown } | undefined} config 宿主行 config（`skillsRoot` 只作排障用的覆盖项）
*/
function apply(ctx, config) {
	const override = config && typeof config.skillsRoot === "string" && config.skillsRoot.trim() !== "" ? config.skillsRoot : "";
	const root = override !== "" ? path.resolve(override) : skillsRootOf(packageRootOf(import.meta.url));
	const { skills, problems } = loadBundledSkills(root);
	for (const s of skills) ctx.skills.register({
		name: s.name,
		description: s.description,
		content: s.content,
		source: "bundled",
		invocation: s.invocation,
		resourceBase: s.resourceBase
	});
	const modelVisible = skills.filter((s) => s.invocation.modelInvocable).length;
	const bodyBytes = skills.reduce((a, s) => a + Buffer.byteLength(s.content, "utf8"), 0);
	ctx.logger?.info?.(`[sr-workbench] 随包注册 ${skills.length} 个 sr 技能（模型可见 ${modelVisible} · 用户专用 ${skills.length - modelVisible}）· 正文 ${(bodyBytes / 1024).toFixed(1)} KB · 技能根 ${root}` + (problems.length ? ` · ⚠ ${problems.length} 个没注册：${problems.join("；")}` : ""));
	if (skills.length === 0) ctx.logger?.warn?.(`[sr-workbench] 一个技能都没注册 —— 检查 ${root} 是否存在、以及 package.json 的 files 里有没有 "skills"（打包漏了就会这样）`);
	/**
	* ★ 技能用法**不再需要宿主路由**（用户口径：这是纯静态的使用说明，不该要"网站地址"）。
	*   内容改为构建期生成快照 `src/generated/teaching.js`，面板直接 import —— 零网络、零基址。
	*   判据 `npm run check:teaching`：快照与技能一致 / 内容齐 / 出处可查 / 产物里不许再有这条路由。
	*/
}
//#endregion
export { apply, inject, loadBundledSkills, packageRootOf, skillsRootOf };
