'use client';

type DeleteNoteButtonProps = {
  title: string;
};

export function DeleteNoteButton({ title }: DeleteNoteButtonProps) {
  return (
    <button
      type="submit"
      className="text-red-700 hover:underline"
      onClick={(event) => {
        if (!window.confirm(`确定删除《${title}》吗？此操作无法撤销。`)) {
          event.preventDefault();
        }
      }}
    >
      删除
    </button>
  );
}
