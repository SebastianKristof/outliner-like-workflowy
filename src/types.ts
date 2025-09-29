export type ItemId = string;

export interface Item {
  id: ItemId;
  text: string;
  checked: boolean;
  note?: string;
  children: ItemId[];
  parentId?: ItemId;
}

export interface DocSnapshot {
  rootIds: ItemId[];
  items: Record<ItemId, Item>;
}

export interface SelectionState {
  anchorId: ItemId;
  mode: 'caret' | 'item' | 'subtree';
  caretOffset?: number;
}

export interface UIState {
  collapsed: Record<ItemId, boolean>;
  selection?: SelectionState;
  notesOpen: Record<ItemId, boolean>;
}

export interface HistoryState {
  past: DocSnapshot[];
  present: DocSnapshot;
  future: DocSnapshot[];
  lastTextChange?: number;
}

export interface OutlinerState {
  doc: DocSnapshot;
  ui: UIState;
  history: HistoryState;
}
