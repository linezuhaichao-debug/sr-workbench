/**
 * 宿主版本串 → **时间**（工单 25 · V11 升级的地基）
 *
 * ── 为什么要解析一个"不透明"的串 ─────────────────────────────────────────────
 * 工单 16 立的纪律是「`version` 是不透明串，面板从不解析它」——**这条纪律本身没变**：
 * 面板仍然不拿它当"内容标识"用（指纹、自激防护那一侧照旧只比对、不解析）。
 * 但工单 25 要回答一个问题：**"审查报告是不是比定稿旧"**。DSH 的**列举通道**只有
 * `name` / `type` / `size?`（`WorkspaceDirectoryEntry`）——**不给 mtime**；
 * 唯一可能带时间的就是 `stat` 的 `version`。于是本票先实测它到底是不是含时间（见下）。
 *
 * ── 实测（2026-09-30 · `_25-stat-probe.mjs` / `_25-stat-evidence.txt`）──────────
 * 装在盘上的官方实现是**唯一**口径（面板拿到的就是它产出的）：
 *
 *   `dsh-fs-local/lib/index.js` :144
 *     /** Opaque version token from high-resolution identity and freshness metadata. *\/
 *     function versionOf(info) {
 *       return FsVersion(`${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`);
 *     }
 *   `dsh-api-workspace-files/lib/types/index.js` :371
 *     statOf(target, info) → { absolutePath, version: info.version, bytes: info.size }
 *
 * 真机上对 7 个真实文件逐个比对：版本串的 5 段与 node `statSync(p,{bigint:true})` 的
 * `dev / ino / size / mtimeNs / ctimeNs` **逐字段全等**，第 4 段换算出的人类时间 = 文件的 mtime。
 * ⇒ 第 4 段就是 **mtime 纳秒**。
 *
 * ── 因此本模块的口径 ────────────────────────────────────────────────────────
 * · **认不出来就返回 `null` / `0`**，绝不猜 —— 上层据此如实说"面板看不到时间"
 *   （`finalgate.ts` 的 `unknown-time` 分支就是这么用的：判不了 ⇒ **不默认它有效**）。
 * · 只认**严格 5 段十进制**：少一段、多一段、带 `dev` 这种非数字前缀，一律当作不认识。
 *   理由：这个形状是官方**私有**约定（源码注释自称 opaque），跨版本可能变；宁可判不了，
 *   也不要拿半个串去猜出一个错的时间——那会让"报告比定稿旧"变成一句假话。
 * · `mtimeNs` 是 19 位（~1.79e18），超出 `Number.MAX_SAFE_INTEGER` ⇒ **按字符串截掉后 6 位**
 *   得到毫秒（13 位，安全），不走浮点除法、不用 BigInt（浏览器半侧不引入新依赖）。
 */

/** 版本串的形状：`dev:ino:size:mtimeNs:ctimeNs`（全是十进制，不含正负号） */
const STAMP_RE = /^(\d{1,20}):(\d{1,20}):(\d{1,20}):(\d{1,20}):(\d{1,20})$/;

/** 合理区间（ms）：2000-01-01 ~ 2100-01-01 —— 明显不是文件时间的（比如全 0）一律不认 */
const MS_MIN = 946684800000;
const MS_MAX = 4102444800000;

export interface Stamp {
	/** 纳秒（原始串，保留字符串形式：19 位超过安全整数） */
	ns: string;
	/** epoch 毫秒（整数） */
	ms: number;
	/** 其余三段，供排障时核对（面板不据此判任何事） */
	dev: string;
	ino: string;
	size: string;
	ctimeNs: string;
}

/**
 * 解析一个版本串 → `Stamp`；**认不出来返回 `null`**（不抛错、不猜）。
 *
 * @param version - 宿主 `stat` / `read` / change 帧里的 `version`
 */
function stampOf(version: unknown): Stamp | null {
	const s = String(version == null ? "" : version);
	const m = STAMP_RE.exec(s);
	if (!m) return null;
	const ns = m[4];
	// ns → ms：直接砍掉后 6 位（ns 是 19 位，砍完 13 位，稳稳在安全整数内）
	const msPart = ns.length > 6 ? ns.slice(0, ns.length - 6) : "0";
	const ms = Number(msPart);
	if (!Number.isFinite(ms) || ms < MS_MIN || ms > MS_MAX) return null;
	return { ns: ns, ms: ms, dev: m[1], ino: m[2], size: m[3], ctimeNs: m[5] };
}

/**
 * 版本串 → epoch 毫秒；**认不出来给 `0`**（= "面板看不到时间"，不是 1970 年）。
 * 上层用 `> 0` 判"这份文件的时间拿到了没有"。
 */
function mtimeOf(version: unknown): number {
	const st = stampOf(version);
	return st ? st.ms : 0;
}

/** epoch 毫秒 → `2026-09-30 13:17`（本地时区，人话）；拿到 0 / 非法值给空串（不编时间） */
function atText(ms: unknown): string {
	const n = Number(ms);
	if (!Number.isFinite(n) || n <= 0) return "";
	const d = new Date(n);
	if (isNaN(d.getTime())) return "";
	const p = (x: number) => (x < 10 ? "0" : "") + x;
	return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

export { STAMP_RE, MS_MIN, MS_MAX, stampOf, mtimeOf, atText };
