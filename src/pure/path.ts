/**
 * 路径归一：相对路径 → 绝对路径
 *
 * ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
 *   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
 * rel 可能已经是绝对路径（openPath 存的是绝对路径），无条件前缀 cwd 会拼出 `D:\X/D:\X\…`。
 */

function toAbs(cwd, rel) {
	if (!rel) return "";
	let p = String(rel);
	const isWinAbs = /^[A-Za-z]:[\\/]/.test(p);
	const isAbs = isWinAbs || /^[\\/]/.test(p) || /^\\\\/.test(p);
	if (!isAbs) p = (cwd ? String(cwd).replace(/[\\/]+$/, "") + "\\" : "") + p;
	if (isWinAbs || /^[A-Za-z]:/.test(p)) p = p.replace(/\//g, "\\");
	return p;
}

export { toAbs };

/**
 * 从定稿的绝对路径算出**功能根**（`features\<主题>\`）—— 工作会话的 cwd（工单 15）。
 *
 * 只有一种结构：`<功能根>\gdd\<文件>`（CONTEXT.md 的产物桶：`gdd\` 是"出"的桶）。
 * 所以规则是：**最后一个 `gdd` 段之前的全部**。找不到 `gdd` 段（或它后面没有文件）时
 * 退成"文件所在目录"——宁可退，也不要因为形状不合预期就返回空。
 *
 * ★ 为什么不让调用方自己 `dirname` 两次：那样"功能根"就有两处判据了（本仓库的规矩：
 *   判据只有一份）。真实调用方（面板）另有 `detail.root` 更权威，这个函数是**兜底**。
 */
function featureRootOf(filePath: unknown): string {
	if (filePath === null || filePath === undefined) return "";
	const p = String(filePath).replace(/\//g, "\\").replace(/\\+$/, "");
	if (p === "") return "";
	const parts = p.split("\\");
	// 末尾必须是文件；否则按目录处理
	const isDir = !/\.[^\\]*$/.test(parts[parts.length - 1] || "");
	const end = isDir ? parts.length : parts.length - 1;
	if (end <= 0) return "";
	for (let i = end - 1; i >= 1; i--) {
		if (parts[i].toLowerCase() === "gdd") return parts.slice(0, i).join("\\");
	}
	return parts.slice(0, end).join("\\");
}

export { featureRootOf };

