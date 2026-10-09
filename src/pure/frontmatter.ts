/**
 * markdown 顶部 frontmatter 的**简单标量**解析（唯一出处）。
 *
 * ★ v5 从 `finalgdd.ts` 拆出来：定稿的大纲树 / 引用图 / V 校验随「定稿修订工作面」一起删掉了，
 *   但**头脑风暴的两种固定格式**（`legacy-analysis_*` / `human-note_*`）仍然要读 frontmatter
 *   （`doc_type` / `topic` / `source` / `confidence` / `author`）—— 所以这一段必须留着，
 *   并且只能有**一份**实现。
 *
 * 纯函数、零依赖、零 IO。
 */

/** 解析 md 顶部 frontmatter 的简单标量字段（`---` 包起来的 `key: value`）。没有就返回 `null`。 */
export function parseFrontmatter(text: unknown): Record<string, string> | null {
	const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text == null ? "" : text));
	if (!m) return null;
	const out: Record<string, string> = {};
	for (const line of m[1].split(/\r?\n/)) {
		const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
		if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
	}
	return out;
}
