import { aadsUnitId } from '../lib/site'
import { t } from '../lib/i18n'

// A-ADS adaptive banner. Renders nothing until VITE_AADS_UNIT_ID is set.
export default function AdSlot({ className = '' }: { className?: string }) {
  if (!aadsUnitId) return null
  return <aside className={`ad-slot ${className}`.trim()} aria-label={t('Publicidad')}>
    <span className="ad-slot-label">{t('Publicidad')}</span>
    <iframe
      data-aa={aadsUnitId}
      src={`https://acceptable.a-ads.com/${aadsUnitId}/?size=Adaptive`}
      title={t('Publicidad')}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      style={{ border: 0, padding: 0, width: '100%', maxWidth: 728, height: 90, overflow: 'hidden', display: 'block', margin: '0 auto', background: 'transparent' }}
    />
  </aside>
}
