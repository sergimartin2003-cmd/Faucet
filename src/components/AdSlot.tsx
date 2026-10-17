import { aadsUnitId } from '../lib/site'
import { t } from '../lib/i18n'

// A-ADS adaptive banner. Renders nothing until VITE_AADS_UNIT_ID (or an explicit unit) is set.
export default function AdSlot({ className = '', unit }: { className?: string; unit?: string | null }) {
  const unitId = unit?.replace(/\D/g, '') || aadsUnitId
  if (!unitId) return null
  return <aside className={`ad-slot ${className}`.trim()} aria-label={t('Publicidad')}>
    <span className="ad-slot-label">{t('Publicidad')}</span>
    <iframe
      data-aa={unitId}
      src={`https://acceptable.a-ads.com/${unitId}/?size=Adaptive`}
      title={t('Publicidad')}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      style={{ border: 0, padding: 0, width: '100%', maxWidth: 728, height: 90, overflow: 'hidden', display: 'block', margin: '0 auto', background: 'transparent' }}
    />
  </aside>
}
