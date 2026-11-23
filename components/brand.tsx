import Link from "next/link"
import { ChevronsUp } from "lucide-react"

export function Brand() {
  return <Link className="brand" href="/" aria-label="LevelUp beranda">
    <span className="brand-mark"><ChevronsUp size={28} strokeWidth={2.8} /></span>
    <span>Level<span>Up</span></span>
  </Link>
}
