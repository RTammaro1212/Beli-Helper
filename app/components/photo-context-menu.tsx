import type { PhotoContextMenuState } from "../lib/photo-types";

type PhotoContextMenuProps = {
  menu: PhotoContextMenuState;
  onSplit: (clusterId: string, photoId: string) => void;
};

export function PhotoContextMenu({ menu, onSplit }: PhotoContextMenuProps) {
  return (
    <div
      className="fixed z-[60] min-w-[212px] bg-neutral-200 p-2 font-sans text-neutral-950"
      role="menu"
      tabIndex={-1}
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        className="w-full bg-transparent px-3 py-3 text-left text-sm text-neutral-950 transition-colors hover:bg-neutral-50 focus:bg-neutral-50"
        type="button"
        role="menuitem"
        onClick={() => onSplit(menu.clusterId, menu.photoId)}
      >
        Split into separate meal
      </button>
    </div>
  );
}
