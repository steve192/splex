export type DetailActionState = "archived" | "deleted" | "editable";

export function detailActionState({
  archived,
  deleted
}: {
  archived: boolean;
  deleted: boolean;
}): DetailActionState {
  if (deleted) return "deleted";
  return archived ? "archived" : "editable";
}
