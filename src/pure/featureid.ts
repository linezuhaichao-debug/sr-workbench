/**
 * 功能身份声明（`features\<主题>\feature.json`）—— 形状、解析、`feature_id` 生成规则。
 *
 * ★ 权威：`spec.md:131-137`（**只放身份不放进度**：`{ feature_id, name, aliases[], created }`）
 *   与 `ADR 0002`（`feature_id` **终身不变**；目录名只是标签——改名是正常业务：
 *   神话宝库 → 诸神降临、联盟悬赏 → 联盟讨伐）。
 * ★ `feature_id` 的规则（本票定、写进报告）：`feat-<yyyymmdd>-<序号>` ——
 *   · **可读**：一眼看出"哪天建的第几个功能"；
 *   · **ASCII**：`[a-z0-9-]`，任何系统/命令行都不用转义；
 *   · **终身不变 + 与目录名解耦**：**不含主题名**，所以改名不会让 id 过期；
 *   · **冲突处理**：生成前扫已有 id，取"同一日期里最大的序号 + 1"，撞号就顺延（见 `nextFeatureId`）。
 * ★ 改名的动作只动 `name` / `aliases`，**不动 `feature_id`**（那是工单 29）。
 *
 * 纯函数：零依赖、零 IO（`eslint.config.js` 的 `src/pure/**` 白名单）。
 */

/** 身份声明的字段名（写盘与读回都用它——只有一份拼写）。 */
export interface FeatureIdentity {
	feature_id: string;
	name: string;
	aliases: string[];
	created: string;
}

/** `feature_id` 的形状：`feat-20261008-001`（序号至少 3 位，超过 999 自动变 4 位）。 */
export const FEATURE_ID_RE = /^feat-(\d{8})-(\d{3,})$/;

/** id 的固定前缀（`feat`）——它是 id 的自解释部分，改名不带它走。 */
export const FEATURE_ID_PREFIX = "feat";

/** 当天日期的写法：`YYYYMMDD`（id 里用） */
export function compactDate(d: Date | number | string): string {
	const t = dateParts(d);
	return t.y + t.m + t.d;
}

/** 当天日期的写法：`YYYY-MM-DD`（`created` 字段用） */
export function dashedDate(d: Date | number | string): string {
	const t = dateParts(d);
	return t.y + "-" + t.m + "-" + t.d;
}

function dateParts(d: Date | number | string): { y: string; m: string; d: string } {
	const dt = d instanceof Date ? d : new Date(d);
	const p = (n: number) => (n < 10 ? "0" : "") + n;
	return { y: String(dt.getFullYear()), m: p(dt.getMonth() + 1), d: p(dt.getDate()) };
}

/** 拼一个 id：`feat-20261008-003`（序号不足 3 位左补 0）。 */
export function featureIdOf(compact: string, seq: number): string {
	const n = Math.max(1, Math.trunc(Number(seq) || 1));
	const s = String(n);
	return FEATURE_ID_PREFIX + "-" + String(compact) + "-" + (s.length >= 3 ? s : "000".slice(s.length) + s);
}

/**
 * 下一个可用的 `feature_id`。
 *
 * 规则（**冲突处理就在这三行里**）：
 *   ① 只看**同一天**已用的 id（别的日期段互不干扰）；
 *   ② 取其中最大的序号 + 1；
 *   ③ 候选若被占（例如迁移带进来的同号），顺延到下一个空号——
 *      **绝不静默复用别人的 id**（那会把两个功能的历史接在一起）。
 *
 * @param taken 工作区里已有的全部 `feature_id`（读不到身份声明的功能没有 id，不参与）
 * @param compact 当天日期 `YYYYMMDD`
 */
export function nextFeatureId(taken: unknown, compact: string): string {
	const day = String(compact || "");
	const used: Record<string, true> = {};
	let max = 0;
	for (const raw of (Array.isArray(taken) ? taken : [])) {
		const id = String(raw || "").trim();
		if (id === "") continue;
		const low = id.toLowerCase();
		used[low] = true;
		// ★ id 的规范写法是小写；这里**连大小写一起认**（免得"FEAT-…"这种脏数据被漏掉、
		//   于是把 001 又发一次给另一个功能 —— 那会把两个功能的历史接在一起）
		const m = FEATURE_ID_RE.exec(low);
		if (m && m[1] === day) max = Math.max(max, Number(m[2]) || 0);
	}
	let seq = max + 1;
	for (let guard = 0; guard < 10000; guard++) {
		const cand = featureIdOf(day, seq);
		if (!used[cand.toLowerCase()]) return cand;
		seq += 1;
	}
	return featureIdOf(day, seq);
}

/** id 给人看的一句话（新建表单上预览的就是它）。 */
export function featureIdNote(id: string): string {
	return "将写入 feature_id：" + id + "（可读、ASCII、终身不变 —— 以后改名叫什么都还是它）";
}

/** 身份声明的逐字文本（**默认缩进 2 空格 + 末尾一个换行**；写盘的就是这一段）。 */
export function identityJsonText(id: string, name: string, created: string, aliases?: string[]): string {
	const obj: FeatureIdentity = {
		feature_id: String(id || ""),
		name: String(name || ""),
		aliases: (aliases || []).map((a) => String(a)),
		created: String(created || "")
	};
	return JSON.stringify(obj, null, 2) + "\n";
}

/** 深一层：把一个 json 值收成身份声明；形状不对返回 `null`（**不猜、不补**）。 */
export function parseIdentityValue(v: unknown): FeatureIdentity | null {
	if (!v || typeof v !== "object") return null;
	const o = v as Record<string, unknown>;
	const id = typeof o.feature_id === "string" ? o.feature_id.trim() : "";
	const name = typeof o.name === "string" ? o.name.trim() : "";
	const created = typeof o.created === "string" ? o.created.trim() : "";
	const aliases = Array.isArray(o.aliases)
		? o.aliases.filter((a) => typeof a === "string" && a.trim() !== "").map((a) => String(a).trim())
		: [];
	if (id === "" || name === "") return null;
	return { feature_id: id, name: name, aliases: aliases, created: created };
}

/** 文本 → 身份声明（JSON 解析失败返回 `null`）。 */
export function parseIdentity(text: string | null | undefined): FeatureIdentity | null {
	if (text === null || text === undefined) return null;
	const t = String(text).replace(/^\uFEFF/, "").trim();
	if (t === "") return null;
	try {
		return parseIdentityValue(JSON.parse(t));
	} catch (e) {
		return null;
	}
}

/**
 * 面板这一侧对"身份"的读法（**优雅退化**的落点，本票第 4 条）：
 * 没有 `feature.json` / 读不出来 / id 形状不对 —— 都**如实标注**、按目录名认功能，
 * **不假装有 id，也不报错**（真实数据现状：4 个功能目录一个都没有身份声明，迁移票 21 才补）。
 */
export interface IdentityView {
	/** 有没有认出身份（false = 按目录名认功能） */
	present: boolean;
	/** 为什么没有（`missing` / `unreadable` / `bad-id`） */
	reason: string;
	feature_id: string;
	name: string;
	aliases: string[];
	created: string;
	/** 界面上那一句（如实、不含机器口径） */
	note: string;
}

export function identityOf(text: string | null | undefined, topic: string): IdentityView {
	const t = String(topic || "");
	const absent = (reason: string, note: string): IdentityView => ({
		present: false, reason: reason, feature_id: "", name: t, aliases: [], created: "", note: note
	});
	if (text === null || text === undefined || String(text).trim() === "") {
		return absent("missing", "没有身份声明（按目录名认功能）");
	}
	const v = parseIdentity(text);
	if (!v) return absent("unreadable", "身份声明读不出来（不是合法 JSON，或缺 feature_id / name）——按目录名认功能");
	if (!FEATURE_ID_RE.test(v.feature_id)) {
		return absent("bad-id", "身份声明里的 feature_id 形状不对（" + v.feature_id + "，应为 feat-YYYYMMDD-序号）——按目录名认功能");
	}
	return {
		present: true, reason: "", feature_id: v.feature_id, name: v.name,
		aliases: v.aliases, created: v.created,
		note: "身份 " + v.feature_id
	};
}

/** 界面上给"身份"的那一句话（看板卡与详情头都用它，口径只有一份）。 */
export function identityLabel(v: IdentityView | null | undefined): string {
	if (!v) return "没有身份声明";
	return v.present ? "身份 " + v.feature_id : v.note;
}

/** 名字归一（比对"是不是同一个名字"用；Windows 目录名大小写不敏感） */
export function nameKey(s: unknown): string {
	return String(s === null || s === undefined ? "" : s).trim().toLowerCase();
}

/** 一个功能声明过的全部名字（`name` + `aliases`） */
export function namesOf(v: { name?: string; aliases?: string[] } | null | undefined): string[] {
	if (!v) return [];
	const out: string[] = [];
	for (const n of [v.name].concat(v.aliases || [])) {
		const s = String(n === null || n === undefined ? "" : n).trim();
		if (s !== "") out.push(s);
	}
	return out;
}

/** 一个功能的身份视图（看板/详情用的形状：主题 = 目录名，identity 由 feature.json 读来） */
export interface IdentityHolder {
	topic: string;
	identity: IdentityView;
	/** 功能根（绝对路径；看板给的那一份，仅用于提示里说清"在哪个目录"） */
	root?: string;
}

/**
 * 「已存在同标识」的判据：**输入的主题名是不是已经是某个功能的身份名或别名**
 * （大小写不敏感 —— Windows 目录名就是这样）。
 * 命中时返回那个功能（提示里要说清"是哪个功能的哪个名字"），否则 `null`。
 */
export function identityClash(features: IdentityHolder[] | null | undefined, topic: string): IdentityHolder | null {
	const key = nameKey(topic);
	if (key === "") return null;
	for (const f of (features || [])) {
		if (!f || !f.identity || !f.identity.present) continue;
		for (const n of namesOf(f.identity)) {
			if (nameKey(n) === key) return f;
		}
	}
	return null;
}
