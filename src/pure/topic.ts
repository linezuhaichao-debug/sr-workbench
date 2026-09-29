/**
 * 文件名 → 功能主题（去重是这段的核心）
 *
 * ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
 *   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
 * 同一功能的不同阶段/版本收敛到同一个键；配置表文件名也走这里。
 */

const PREFIXES = [
	"sr-gdd-handoff_", "concept-triage_", "feature-concept_", "experience-report_",
	"issue-cards_", "replication-spec_", "evidence-index_", "calibration_",
	"smoke_", "readback_", "decision_", "write_CS-"
];
/** 尾部噪音后缀（成对剥，直到剥不动） */
const TAIL = /[_\-\s]*(定稿_审查|定稿|审查|宣讲|修订点|UIUE|UI|md版本|人读版|设计稿)$/;

/**
 * 从文件名派生功能主题。目标：同一功能的不同阶段/版本**收敛到同一个键**。
 * `联盟悬赏_20260921_定稿.md` / `联盟悬赏（联盟boss）.txt` / `联盟悬赏-md版本.rar` → 联盟悬赏
 * `readback_A079_神话宝库_20260916.md` / `smoke_英雄圣物_20260923.png` → 神话宝库 / 英雄圣物
 */
function topicOf(name) {
	// ① 去全部扩展名（.content.json 这类多段也要去干净）
	let s = String(name).replace(/(\.[A-Za-z0-9]+)+$/, "");
	// ② 去已知前缀
	for (const p of PREFIXES) { if (s.startsWith(p)) { s = s.slice(p.length); break; } }
	// ③ 去表号前缀 A079_ / B008-
	s = s.replace(/^[AB]\d{3}[_\-]/, "");
	// ④ 截到第一个日期之前
	const d = s.search(/[_\-\s]\d{8}(?:[_\-\s.]|$)/);
	if (d > 0) s = s.slice(0, d);
	// ⑤ 去括号补充（（联盟boss）这类）
	s = s.replace(/[（(][^）)]*[）)]/g, "");
	// ⑥ 循环剥尾部噪音后缀
	let prev;
	do { prev = s; s = s.replace(TAIL, ""); } while (s !== prev);
	return s.replace(/[_\-\s]+$/, "").trim();
}

/** 明显的噪音主题（脚本名、编号、过短）——不当作功能 */
function isNoise(t) {
	if (!t || t.length <= 1) return true;
	if (/^\d/.test(t)) return true;
	if (/^(CS|DEC|EVD|ASM|EXP|GATE|WRUN|LRN|VOI|ISSUE)[-_]/i.test(t)) return true;
	if (/^[A-Za-z]{1,2}$/.test(t)) return true;
	return false;
}

/** 文件名里的日期 YYYYMMDD（没有则空串） */
function dateOf(name) {
	const m = /(\d{8})/.exec(String(name));
	return m ? m[1] : "";
}

export { PREFIXES, TAIL, topicOf, isNoise, dateOf };
