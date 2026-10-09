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
//#region src/pure/teaching.ts
/** 取某一节（`## 二、使用教学` 这类二级标题）的正文；取不到返回空串。 */
function sectionOf(md, heading) {
	const lines = String(md || "").split(/\r?\n/);
	const start = lines.findIndex((l) => l.trim() === heading.trim());
	if (start < 0) return "";
	const lvl = (lines[start].match(/^#+/) || ["##"])[0].length;
	const out = [];
	for (let i = start + 1; i < lines.length; i++) {
		const m = lines[i].match(/^(#+)\s/);
		if (m && m[1].length <= lvl) break;
		out.push(lines[i]);
	}
	return out.join("\n").trim();
}
/** 取三级标题（`### 速查表…`）的正文。 */
function subSectionOf(md, prefix) {
	const lines = String(md || "").split(/\r?\n/);
	const start = lines.findIndex((l) => l.startsWith("### ") && l.slice(4).trim().startsWith(prefix));
	if (start < 0) return "";
	const out = [];
	for (let i = start + 1; i < lines.length; i++) {
		if (/^#{1,3}\s/.test(lines[i])) break;
		out.push(lines[i]);
	}
	return out.join("\n").trim();
}
/** 解析主线：`**主线**：…` 之后那串 `1. **标题**：正文`（正文可续行，直到下一个编号项）。 */
function parseSteps(section) {
	const lines = String(section || "").split(/\r?\n/);
	const at = lines.findIndex((l) => /^\*\*主线\*\*/.test(l.trim()));
	if (at < 0) return [];
	const out = [];
	let cur = null;
	for (let i = at + 1; i < lines.length; i++) {
		const line = lines[i];
		const m = /^(\d+)\.\s+\*\*(.+?)\*\*\s*[：:]?\s*(.*)$/.exec(line.trim());
		if (m) {
			if (cur) out.push({
				n: cur.n,
				title: cur.title,
				text: cur.text.trim()
			});
			cur = {
				n: Number(m[1]),
				title: m[2].trim(),
				text: m[3]
			};
			continue;
		}
		if (cur === null) continue;
		if (/^\*\*[^*]+\*\*/.test(line.trim()) && !/^\s{2,}/.test(line)) break;
		if (line.trim() === "" && (lines[i + 1] || "").trim() !== "" && !/^\s{2,}/.test(lines[i + 1] || "") && !/^[-*\d]/.test((lines[i + 1] || "").trim())) break;
		cur.text += "\n" + line;
	}
	if (cur) out.push({
		n: cur.n,
		title: cur.title,
		text: cur.text.trim()
	});
	return out;
}
/** 解析速查表：`| 你想做什么 | 用哪个 |` 的数据行。 */
function parseRoutes(section) {
	const out = [];
	for (const line of String(section || "").split(/\r?\n/)) {
		const t = line.trim();
		if (!t.startsWith("|")) continue;
		const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
		if (cells.length < 2) continue;
		const want = cells[0];
		const skill = cells[1];
		if (want === "" || skill === "" || /^-+$/.test(want) || /^-+$/.test(skill)) continue;
		if (want.indexOf("你想做什么") === 0) continue;
		out.push({
			want: want.replace(/^["「]|["」]$/g, ""),
			skill
		});
	}
	return out;
}
/** 解析「独立技能」那一句（原文，供界面照抄）。 */
function parseStandalone(section) {
	for (const line of String(section || "").split(/\r?\n/)) if (/^\*\*独立技能\*\*/.test(line.trim())) return line.trim();
	return "";
}
/** 从一张教学卡里取标题（第一个 `# `）。 */
function cardTitleOf(text, fallback) {
	for (const line of String(text || "").split(/\r?\n/)) {
		const m = /^#\s+(.+)$/.exec(line.trim());
		if (m) return m[1].trim();
	}
	return fallback;
}
/** 总入口：把 SKILL.md 正文 + 教学卡列表解析成模型。 */
function parseTeaching(input) {
	const md = String((input || {}).skillMd || "");
	const problems = [];
	const teach = sectionOf(md, "## 二、使用教学");
	if (teach === "") problems.push("SKILL.md 里找不到「## 二、使用教学」这一节");
	const steps = parseSteps(teach);
	if (steps.length === 0) problems.push("主线那串编号项解析不出来（在「推荐用法」小标题之后）");
	const routes = parseRoutes(subSectionOf(md, "速查表"));
	if (routes.length === 0) problems.push("速查表解析不出来（### 速查表… 下面的表格）");
	const rules = [];
	const deposit = subSectionOf(md, "产出落盘位置");
	if (deposit !== "") rules.push({
		title: "产出落盘位置",
		body: deposit
	});
	else problems.push("找不到「产出落盘位置」这一节");
	const iron = subSectionOf(md, "数值铁律");
	if (iron !== "") rules.push({
		title: "数值铁律",
		body: iron
	});
	else problems.push("找不到「数值铁律」这一节");
	const cards = (input.cards || []).map((c) => {
		const id = String(c.rel || "").replace(/^.*[\\/]/, "").replace(/\.md$/i, "");
		return {
			id,
			title: cardTitleOf(c.text, id),
			body: String(c.text || ""),
			rel: String(c.rel || "")
		};
	}).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	if (cards.length === 0) problems.push("一张教学卡都没读到（references/teaching/*.md）");
	return {
		ok: steps.length > 0 && routes.length > 0,
		steps,
		standalone: parseStandalone(teach),
		routes,
		rules,
		cards,
		problems
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
	* ── 技能用法数据（面板弹窗读的那一页）──────────────────────────────────
	*
	* ★ 为什么由**宿主半侧**递：面板只有"借会话读绝对路径"这一种读文件能力，
	*   而技能在 `<某个 node_modules>/dsh-client-ui-sr-workbench/skills/…` —— 面板不知道这个路径，
	*   也不该猜（和 `%USERPROFILE%` 是同一类问题）。宿主这里本来就知道包根。
	*
	* ★ `webServer` 走**可选访问**（`ctx.get`）而不是写进 `inject`：
	*   写进去就成了硬依赖 —— 没有 web 服务器的场合（如 headless profile）会连技能都注册不了。
	*   拿不到就跳过并说清原因（面板那边会显示"这一版拿不到技能用法"，不假装）。
	*/
	const disposers = [];
	try {
		const webServer = typeof ctx.get === "function" ? ctx.get("webServer") : void 0;
		if (!webServer || typeof webServer.register !== "function") ctx.logger?.info?.("[sr-workbench] 没有 webServer 服务 ⇒ 技能用法弹窗的数据这一版拿不到（技能本身不受影响）");
		else {
			disposers.push(webServer.register({
				kind: "exact",
				path: "/sr-workbench/teaching.json",
				/**
				* 每次请求**现读**（不缓存）：技能改了 → 重开弹窗即变，与"改 references 即生效"一致。
				* 只读包内 `skills/sr-askme/` 下的固定文件，不接受任何路径参数（无穿越面）。
				*/
				handler: (req, res) => {
					let payload;
					try {
						const askme = path.join(root, "sr-askme");
						const skillMd = fs.readFileSync(path.join(askme, "SKILL.md"), "utf8");
						const cardsDir = path.join(askme, "references", "teaching");
						const model = parseTeaching({
							skillMd,
							cards: fs.existsSync(cardsDir) ? fs.readdirSync(cardsDir).filter((n) => n.endsWith(".md")).map((n) => ({
								rel: "references/teaching/" + n,
								text: fs.readFileSync(path.join(cardsDir, n), "utf8")
							})) : []
						});
						payload = Object.assign({ source: askme }, model);
					} catch (e) {
						payload = {
							ok: false,
							steps: [],
							standalone: "",
							routes: [],
							rules: [],
							cards: [],
							problems: ["读不到技能素材：" + String(e && e.message || e)]
						};
					}
					const body = JSON.stringify(payload);
					try {
						res.writeHead(200, {
							"Content-Type": "application/json; charset=utf-8",
							"Cache-Control": "no-store",
							"Content-Length": Buffer.byteLength(body, "utf8")
						});
						res.end(body);
					} catch (e) {}
				}
			}));
			ctx.logger?.info?.("[sr-workbench] 技能用法数据：/sr-workbench/teaching.json（面板弹窗读它）");
		}
	} catch (e) {
		ctx.logger?.warn?.("[sr-workbench] 注册技能用法路由失败：" + String(e && e.message || e));
	}
	if (disposers.length > 0 && typeof ctx.effect === "function") ctx.effect(() => () => {
		for (const d of disposers) try {
			d();
		} catch (e) {}
	});
}
//#endregion
export { apply, inject, loadBundledSkills, packageRootOf, skillsRootOf };
