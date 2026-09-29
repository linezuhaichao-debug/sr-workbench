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
