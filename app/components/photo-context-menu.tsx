import type { PhotoContextMenuState } from "../lib/photo-types";

type PhotoContextMenuProps = {
  menu: PhotoContextMenuState;
  onSplit: (clusterId: string, photoId: string) => void;
};

export function PhotoContextMenu({ menu, onSplit }: PhotoContextMenuProps) {
  return (
    <div
      className="fixed z-[60] min-w-[212px] bg-[#f2f6f1] p-1 font-sans"
      role="menu"
      tabIndex={-1}
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        className="w-full bg-transparent px-3 py-2 text-left text-sm text-[#1b241c] transition-opacity hover:bg-[#d9f5dc] hover:opacity-80"
        type="button"
        role="menuitem"
        onClick={() => onSplit(menu.clusterId, menu.photoId)}
      >
        Split into separate meal
      </button>
    </div>
  );
}
