import { useFaucetState } from '../../lib/queries'

// Points balance shared by the top bar, the overview and the casino.
export function useFaucetStatus() {
  const query = useFaucetState()
  return { ...query, points: query.data?.points ?? null }
}
