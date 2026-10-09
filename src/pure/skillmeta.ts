/**
 * SKILL.md 的 frontmatter 解析（**纯函数**，零 IO）。
 *
 * ★ 为什么搬到运行时：技能改成"随插件分发、直接从包内目录读"之后，正文不再是构建期内联的常量，
 *   而是在 `apply()` 时从 `<包根>/skills/<名>/SKILL.md` 读出来 —— 需要一份解析器在运行时用。
 *   同一份判据先前在 `tools/gen-skills.mjs`（构建期）里，现在只留这一份。
 *
 * 支持到什么程度（**只做这些，多余的语法一律不猜**）：
 *   · 开头 `---` 包住的 `键: 值` 行；值两侧的成对引号去掉；
 *   · `description` 里的连续空白折成一个空格（与 dsh-skill 的展示口径一致）；
 *   · `disable-model-invocation: true|yes|1` ⇒ `modelInvocable: false`；
 *   · 没有 frontmatter、或没有 `name` ⇒ 返回 `null`（调用方**跳过并不注册**，不当成空名技能）。
 *
 * 明确不支持（真出现再说，别静默猜）：嵌套结构、多行 `>-` 折叠块、数组。
 */

export interface SkillInvocation {
	modelInvocable: boolean;
	userInvocable: boolean;
}

export interface ParsedSkill {
	name: string;
	description: string;
	/** SKILL.md 去掉 frontmatter 之后的正文（原样，不动空白）。 */
	body: string;
	invocation: SkillInvocation;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

/** 解析一份 SKILL.md；解析不出来返回 `null`。 */
export function parseSkillFile(text: unknown, fallbackName?: string): ParsedSkill | null {
	const s = String(text === null || text === undefined ? "" : text);
	const m = FRONTMATTER.exec(s);
	if (!m) return null;
	const fm: Record<string, string> = {};
	for (const line of m[1].split(/\r?\n/)) {
		const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
		if (!kv) continue;
		let v = kv[2].trim();
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
		fm[kv[1]] = v;
	}
	const name = (fm.name || fallbackName || "").trim();
	if (name === "") return null;
	const disabled = /^(true|yes|1)$/i.test(String(fm["disable-model-invocation"] || ""));
	return {
		name: name,
		description: String(fm.description || "").replace(/\s+/g, " ").trim(),
		body: s.slice(m[0].length),
		invocation: { modelInvocable: !disabled, userInvocable: true }
	};
}
