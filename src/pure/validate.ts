/**
 * 决策记录契约校验（JSON Schema 的实用子集）
 *
 * ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
 *   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
 * required / enum / const / pattern / minItems / 数组元素 pattern / additionalProperties。
 */

/**
 * 按 schema 校验一条决策记录（JSON Schema 的实用子集：
 * required / enum / const / pattern / minItems / 数组元素 pattern / additionalProperties）
 */
function validateDecision(doc, schema) {
	const issues = [];
	const push = (field, value, rule) => issues.push({ field: field, value: value, rule: rule });
	if (!schema) return issues;
	const P = schema.properties || {};
	for (const k of (schema.required || [])) {
		if (doc[k] === undefined) push(k, "(缺失)", "必填字段缺失");
	}
	for (const k of Object.keys(P)) {
		const spec = P[k];
		const v = doc[k];
		if (v === undefined) continue;
		if (spec.const !== undefined && v !== spec.const) push(k, JSON.stringify(v), "必须为 " + JSON.stringify(spec.const));
		if (spec.enum && spec.enum.indexOf(v) < 0) push(k, JSON.stringify(v), "枚举外 · 合法值：" + spec.enum.join(" / "));
		if (spec.pattern && typeof v === "string" && !(new RegExp(spec.pattern)).test(v)) push(k, JSON.stringify(v), "不匹配 " + spec.pattern);
		if (spec.minItems !== undefined && Array.isArray(v) && v.length < spec.minItems) {
			push(k, v.length + " 条", "少于下限 minItems: " + spec.minItems);
		}
		const itemPat = spec.items && spec.items.pattern;
		if (itemPat && Array.isArray(v)) {
			for (const item of v) {
				if (typeof item === "string" && !(new RegExp(itemPat)).test(item)) {
					push(k, JSON.stringify(item), "元素不匹配 " + itemPat);
				}
			}
		}
	}
	if (schema.additionalProperties === false) {
		for (const k of Object.keys(doc)) {
			if (!P[k]) push(k, JSON.stringify(doc[k]).slice(0, 40), "schema 未声明的字段（additionalProperties: false）");
		}
	}
	return issues;
}

export { validateDecision };
