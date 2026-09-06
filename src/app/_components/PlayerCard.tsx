import type { MaskedPlayer } from '../../lib/use-room'

export function PlayerCard({
  player,
  isMe,
  onClick,
  selected,
}: {
  player: MaskedPlayer
  isMe: boolean
  onClick?: () => void
  selected?: boolean
}) {
  const dead = !player.isAlive
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'w-full rounded-2xl p-4 text-left',
        dead ? 'bg-slate-900 opacity-55' : 'bg-slate-800',
        isMe ? 'ring-2 ring-sky-400' : '',
        selected ? 'ring-2 ring-red-400' : '',
      ].join(' ')}
    >
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <span>
          {player.name}
          {isMe && ' (คุณ)'}
        </span>
        {player.isGm && (
          <span className="rounded-full bg-sky-400 px-2 py-0.5 text-xs text-slate-900">GM</span>
        )}
        {dead && (
          <span className="rounded-full bg-red-400 px-2 py-0.5 text-xs text-slate-900">
            ตายแล้ว
          </span>
        )}
        {!player.connected && <span className="text-xs">หลุด</span>}
      </div>

      {player.word === null ? (
        <div className="text-3xl font-bold tracking-[0.3em] text-slate-600">? ? ?</div>
      ) : (
        <div className="text-3xl font-bold">{player.word}</div>
      )}
    </Tag>
  )
}
