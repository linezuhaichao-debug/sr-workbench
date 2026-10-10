/**
 * 生成 `src/generated/teaching.js` —— 技能用法弹窗的**静态数据快照**。
 *
 * ── 为什么是快照，而不是让面板去 HTTP 取 ────────────────────────────────────
 *   用户一句话点破：**这是一份纯静态的使用说明** —— 内容就是包内 `skills/sr-askme/` 的几个文件，
 *   面板拿到的永远是同一份。为它起一条 HTTP 路由、还要面板去猜"网站地址"，是**多余的机制**
 *   （多一条路由、多一处失败面、还要处理 origin 不一致 —— 实测就撞上了 404）。
 *   ⇒ 改为：构建期把解析结果写成模块，面板 `import` 直接用。零网络、零基址。
 *
 * ── 唯一来源不变 ──────────────────────────────────────────────────────────
 *   快照是**从技能文件生成的**，不是手写副本；`npm run check:teaching` 会断言
 *   "快照 == 现读技能文件的解析结果"，谁改了技能忘了重新生成，门就会红。
 *
 * 用法：`npm run gen:teaching`
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseTeaching } from "../src/pure/teaching.ts";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASKME = path.join(REPO, "skills", "sr-askme");
const OUT = path.join(REPO, "src", "generated", "teaching.js");

/** 现读技能素材并解析（生成与判据都用这一个函数 —— 判据才有意义）。 */
export function parseFromSkills() {
	const skillMd = fs.readFileSync(path.join(ASKME, "SKILL.md"), "utf8");
	const cardsDir = path.join(ASKME, "references", "teaching");
	const cards = fs.existsSync(cardsDir)
		? fs.readdirSync(cardsDir).filter((n) => n.endsWith(".md")).map((n) => ({
			rel: "references/teaching/" + n,
			text: fs.readFileSync(path.join(cardsDir, n), "utf8")
		}))
		: [];
	return parseTeaching({ skillMd: skillMd, cards: cards });
}

/** 生成模块源码（确定性输出：同一份技能 ⇒ 逐字节相同的文件）。 */
export function renderModule(model) {
	return [
		"/**",
		" * ★ 本文件由 `npm run gen:teaching` **生成**，不要手改。",
		" *   来源：包内 `skills/sr-askme/`（`SKILL.md` 的教学节 + `references/teaching/*.md`）。",
		" *   判据：`npm run check:teaching` 会断言它与现读技能文件的解析结果一致。",
		" */",
		"export const TEACHING = " + JSON.stringify(model, null, "\t") + ";",
		""
	].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const model = parseFromSkills();
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	const next = renderModule(model);
	const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
	fs.writeFileSync(OUT, next, "utf8");
	const same = prev === next;
	console.log(
		"[gen:teaching] " + (same ? "逐字节相同（技能没变）" : "已更新") +
		` · 主线 ${model.steps.length} 步 · 速查 ${model.routes.length} 行 · 规则 ${model.rules.length} 节 · 教学卡 ${model.cards.length} 张` +
		(model.problems.length ? ` · ⚠ ${model.problems.join("；")}` : "")
	);
	if (!model.ok) process.exit(1);
}
