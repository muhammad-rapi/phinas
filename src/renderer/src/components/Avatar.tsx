/** A round avatar: the profile photo when there is one, otherwise the first letter of the name. */
export function Avatar({ name, src, className }: { name: string; src?: string | null; className: string }): React.JSX.Element {
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  if (src) {
    return <span className={`${className} avatar-photo`} style={{ backgroundImage: `url("${src}")` }} role="img" aria-label={name} />
  }
  return (
    <span className={className} aria-hidden="true">
      {initial}
    </span>
  )
}
