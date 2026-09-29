/**
 * 产物分类（功能 = 目录；sub 目录本身即答案）
 *
 * ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
 *   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
 * 新结构按子目录归桶；gdd\ 内部再按文件名细分（artifactBucket）。旧结构前缀表只减不增。
 */

// ── 产物分类（设计 §3.2：**功能 = 目录**）──────────────────────────
//   产物落在 `features\<主题>\` 的**子目录**里，所以分类就是"看子目录"——零猜测。
//   `artifactBucket()` 是给 `gdd\` 内部用的：那一个子目录里混着成稿/定稿/审查/宣讲 HTML，
//   得按文件名再分一次。
//   ★ 这一层存在的意义：**别再往兼容层加东西**。
//     新结构 `features\<主题>\`：按**子目录**分类，零猜测（目录本身就是答案）；
//     旧结构（平铺的 proposals/analysis/decisions/evidence）：按**文件名前缀**分类 +
//     `topicOf` 派生主题 —— 这是**兼容层，只减不增**。
//   两种结构经这里产出**同一组桶**，下游（阶段条 / 产物页签 / 计数）不用分叉。
//
//   ⚠️ 2026-09-29 实测缺口：原实现只认 `concept-triage_ / feature-concept_ / sr-gdd-handoff_`
//      三个前缀，于是 sr-analysis 的**体验报告 / 问题卡 / 复刻规格被静默丢弃**，
//      `evidence\` 目录更是整个没扫 —— 竞品分析只剩"交接 JSON"能被看见。
//   ★ `source\` —— **所有发给 agent 的源文件**（2026-09-29 你定义）：
//      分析用的截图 / 录屏 / PV、旧文档原件、外部交付包（UE 交互交付物）…
//      它是**输入**；`evidence\` 是分析**产出**的证据（抽帧 / 索引 / 时间戳账本 / readback）——
//      两者是"喂进去的原料"与"做出来的证据"，不能混。
//   ✗ `assets\` 不要：线框图跟着定稿走（`gdd\UI\`），没有独立的素材目录需求。
const DIR_BUCKET = {
	analysis: "analysis", gdd: "gdd", decisions: "decisions",
	evidence: "evidence", source: "source", delivery: "delivery"
};
/** 桶 → byTopic 里的数组字段名（没有字段的进 others） */
const BUCKET_FIELD = {
	final: "finals", review: "reviews", speech: "speeches",
	// ★ analysis 桶落到 `concept` 字段：**沿用旧字段名**，免得阶段条 / 产物页签 / PipelinePanel
	//   跟着改一遍。含义已从"3 种概念产物"扩为**全部头脑风暴产物**（6 种 analysis 产出）。
	analysis: "concept",
	evidence: "evidence", decisions: "decisions", source: "source",
	draft: "drafts", gdd: "drafts"
};
/** 旧结构：文件名前缀 → 桶。sr-* 各 skill 的产出全在这里 */
const PREFIX_BUCKET = [
	["concept-triage_", "analysis"], ["feature-concept_", "analysis"],
	["experience-report_", "analysis"], ["issue-cards_", "analysis"],
	["replication-spec_", "analysis"], ["sr-gdd-handoff_", "analysis"],
	["evidence-index_", "evidence"], ["calibration_", "evidence"],
	["readback_", "evidence"], ["decision_", "decisions"],
	["smoke_", "others"], ["write_CS-", "others"]
];
/** 文件名 → 产物桶。**旧结构用**；新结构的 gdd\ 子目录里也要再细分，所以也会用到 */
function artifactBucket(name) {
	const n = String(name || "");
	if (!n) return "others";
	if (/_定稿\.md$/i.test(n)) return "final";
	if (/_定稿_审查\.md$/i.test(n) || /_审查\.md$/i.test(n)) return "review";
	if (/_宣讲_.*\.html$/i.test(n)) return "speech";
	if (/_宣讲_.*\.content\.json$/i.test(n)) return "speechSrc";   // 派生件，不单独显示
	if (/_修订点\.md$/i.test(n)) return "gdd";
	for (const pk of PREFIX_BUCKET) if (n.indexOf(pk[0]) === 0) return pk[1];
	if (/\.md$/i.test(n)) return "draft";
	return "others";
}

export { DIR_BUCKET, BUCKET_FIELD, PREFIX_BUCKET, artifactBucket };
