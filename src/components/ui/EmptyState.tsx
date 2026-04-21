interface Props {
  emoji?: string
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ emoji = '📭', title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
      <span className="text-4xl">{emoji}</span>
      <p className="font-medium text-gray-700 mt-1">{title}</p>
      {description && <p className="text-sm text-gray-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
