/**
 * Layout of Publish — composition only. The header (title, view switcher
 * Calendar · List · Board, "+ New Post") and the toolbar are rendered by
 * `page.tsx` (T-286), because they depend on the URL view state, which a
 * layout cannot read. Old sub-routes redirect to `/publish`.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
