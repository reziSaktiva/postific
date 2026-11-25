import { redirect } from "next/navigation";

import { BoardScreen } from "../../board/components/BoardScreen";
import {
  getPublishRequestContext,
  loadBoardColumns,
} from "./publish-list-pages";

/**
 * Board view of the Publish page (T-290, S-008, S-009). Composition only:
 * the first page and true total of each column, with card thumbnails, from
 * `loadBoardColumns` (`PublishingService.listBoardColumns`); the next pages
 * of a column load through `GET /api/publish/board` (hard rules 3 and 5).
 */
export async function BoardView() {
  const context = await getPublishRequestContext();
  if (!context) {
    redirect("/login");
  }
  const { columns, thumbnails } = await loadBoardColumns(context);
  return <BoardScreen columns={columns} thumbnails={thumbnails} />;
}
