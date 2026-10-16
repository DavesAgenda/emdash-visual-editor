// visual-editor: trusted native EmDash plugin that adds a Squarespace-style page editor to the admin
// (admin page "/" -> /_emdash/admin/plugins/visual-editor/). No hooks, no routes, no storage:
// it saves through EmDash's own content API, so drafts, revisions and permissions are EmDash's.
import { definePlugin } from "emdash";
export const VE_ID = "visual-editor";
export function createPlugin() {
	return definePlugin({
		id: VE_ID, version: "1.0.0", capabilities: [],
		admin: { pages: [{ path: "/", label: "Visual editor", icon: "paint-brush" }] },
	} as any);
}
export default createPlugin;
