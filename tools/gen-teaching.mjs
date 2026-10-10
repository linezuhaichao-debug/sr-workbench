/**
 * 生成 `src/generated/teaching.js` —— 技能用法弹窗的**静态数据快照**。
 *
 * ── 为什么是快照，而不是让面板去 HTTP 取 ────────────────────────────────────
 *   用户一句话点破：**这是一份纯静态的使用说明** —— 内容就是包内 `skills/sr-askme/` 的那个文件，
 *   面板拿到的永远是同一份。为它起一条 HTTP 路由、还要面板去猜"网站地址"，是**多余的机制**
 *   （多一条路由、多一处失败面、还要处理 origin 不一致 —— 实测就撞上了 404）。
 *   ⇒ 改为：构建期把**那份 md 的字节**写成模块，面板 `import` 直接用。零网络、零基址。
 *
 * ── 8.0.0 的机制变化：**不再解析** ──────────────────────────────────────────
 *   上一版把 SKILL.md 的「二、使用教学」解析成 steps / routes / rules / cards 四个数组，
 *   面板再按字段自己排版。解析器本身就是几轮 bug 的来源（表头与分隔行、子项归属、
 *   速查表三列各一小摊特例），而用户要的只有一句：**按 md 渲染，尤其表格**。
 *   ⇒ 现在快照里只有 `markdown`（整份字节）与 `source`（它在包内的相对路径），
 *     排版交给面板的 md 渲染器（`src/pure/mdview.ts` + `src/ui/mdview.js`）。
 *
 * ── 唯一来源不变 ──────────────────────────────────────────────────────────
 *   快照是**从技能文件生成的**，不是手写副本；`npm run check:teaching` 会断言
 *   "快照 == 现读那份 md 的字节"，谁改了技能忘了重新生成，门就会红。
 *   ★ 快照里**不放生成时间**：那会让"技能没变"也每次产生 diff，而这套体系靠
 *     "逐字节相同"来判断有没有漂移（日期在 git 里）。
 *
 * 用法：`npm run gen:teaching`
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** 教学正文的**唯一来源**（包内相对路径，也是快照里 `source` 的值）。 */
export const TEACHING_REL = "skills/sr-askme/references/使用说明.md";
const TEACHING_MD = path.join(REPO, "skills", "sr-askme", "references", "使用说明.md");
const OUT = path.join(REPO, "src", "generated", "teaching.js");

/** 现读那份 md（生成与判据都用这一个函数 —— 判据才有意义）。 */
export function readTeachingMd() {
	return fs.readFileSync(TEACHING_MD, "utf8");
}

/** 快照模型：**整份 md** + 它的来源路径。没有解析结果，也就没有解析失败这一说。 */
export function snapshotOf() {
	return { markdown: readTeachingMd(), source: TEACHING_REL };
}

/** 生成模块源码（确定性输出：同一份 md ⇒ 逐字节相同的文件）。 */
export function renderModule(model) {
	return [
		"/**",
		" * ★ 本文件由 `npm run gen:teaching` **生成**，不要手改。",
		" *   来源：包内 `" + TEACHING_REL + "`（整份 md，原样）。",
		" *   判据：`npm run check:teaching` 断言 `markdown` 与那个文件的**字节**一致。",
		" */",
		"export const TEACHING = " + JSON.stringify(model, null, "\t") + ";",
		""
	].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const model = snapshotOf();
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	const next = renderModule(model);
	const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
	fs.writeFileSync(OUT, next, "utf8");
	const tables = (model.markdown.match(/^\s*\|[\s:|-]+\|\s*$/gm) || []).length;
	console.log(
		"[gen:teaching] " + (prev === next ? "逐字节相同（md 没变）" : "已更新") +
		` · ${TEACHING_REL} · ${Buffer.byteLength(model.markdown, "utf8")} 字节 · 表格 ${tables} 个`
	);
}
