import { useEffect, useState } from 'react'
import { ArrowRight, Clock, Droplets, Plus } from 'lucide-react'
import Link from '../lib/Link'
import { t } from '../lib/i18n'
import { siteName } from '../lib/site'
import { CURRENCY_NAMES, FAUCET_CURRENCIES, formatCoin, formatSatoshi, usePublicFaucets, type FaucetCurrency } from '../lib/faucets'
import { Badge, EmptyState, Skeleton } from '../ui'
import PublicLayout from './PublicLayout'
import './faucets.css'

const intervalLabel = (minutes: number) => (minutes % 60 === 0 ? t('cada {n} h', { n: minutes / 60 }) : t('cada {n} min', { n: minutes }))

export default function FaucetDirectory() {
  const [currency, setCurrency] = useState<FaucetCurrency | ''>('')
  const faucets = usePublicFaucets(currency)

  useEffect(() => { document.title = t('Faucets de criptomonedas · {site}', { site: siteName }) }, [])

  return <PublicLayout>
    <section className="landing-container faucet-directory">
      <header className="faucet-directory-head">
        <div>
          <span className="faucet-eyebrow">{t('Pagos instantáneos con FaucetPay')}</span>
          <h1>{t('Faucets de criptomonedas')}</h1>
          <p>{t('Reclama crypto gratis en las faucets de nuestra comunidad. Cada pago llega al momento a tu cuenta de FaucetPay.')}</p>
        </div>
        <Link to="/dashboard/faucets" className="btn btn-primary"><Plus size={16} />{t('Crear mi faucet')}</Link>
      </header>

      <div className="faucet-filters" role="tablist" aria-label={t('Moneda')}>
        <button type="button" role="tab" className="tab" aria-selected={currency === ''} onClick={() => setCurrency('')}>{t('Todas')}</button>
        {FAUCET_CURRENCIES.map((code) => <button key={code} type="button" role="tab" className="tab" aria-selected={currency === code} onClick={() => setCurrency(code)} title={CURRENCY_NAMES[code]}>{code}</button>)}
      </div>

      {faucets.isLoading ? <div className="faucet-grid">{Array.from({ length: 6 }, (_, key) => <Skeleton key={key} height={170} style={{ borderRadius: 14 }} />)}</div>
        : !faucets.data?.length ? <div className="card card-pad"><EmptyState icon={<Droplets size={22} />} title={t('Todavía no hay faucets aquí')} description={t('Sé el primero: crea tu faucet en dos minutos con tu cuenta de FaucetPay.')}
          action={<Link to="/dashboard/faucets" className="btn btn-primary btn-sm">{t('Crear mi faucet')}</Link>} /></div>
          : <div className="faucet-grid">{faucets.data.map((faucet) => <Link key={faucet.slug} to={`/f/${faucet.slug}`} className={`faucet-card${faucet.featured ? ' is-featured' : ''}`}>
            <div className="faucet-card-top">
              <span className="faucet-coin">{faucet.currency}</span>
              {faucet.featured && <Badge tone="accent">{t('Destacada')}</Badge>}
              {!faucet.funded && <Badge tone="warning">{t('Sin fondos')}</Badge>}
            </div>
            <h3>{faucet.name}</h3>
            {faucet.description && <p>{faucet.description}</p>}
            <div className="faucet-card-reward">{formatCoin(faucet.reward, faucet.currency)}</div>
            <div className="faucet-card-foot">
              <span><Clock size={13} />{intervalLabel(faucet.interval_minutes)}</span>
              <span>{t('{n} pagos', { n: formatSatoshi(faucet.claims_count) })}</span>
              <ArrowRight size={14} />
            </div>
          </Link>)}</div>}
      <p className="faucet-note">{t('Cada faucet la gestiona su creador y se paga desde su propia cuenta de FaucetPay. {site} no custodia esos fondos.', { site: siteName })}</p>
    </section>
  </PublicLayout>
}
