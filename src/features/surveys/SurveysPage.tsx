import { useState } from 'react'
import { Check, ClipboardList, Clock } from 'lucide-react'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, ProgressBar, Skeleton } from '../../ui'
import { useToast } from '../../ui/toastContext'
import { earnErrorMessage, useStartSurvey, useSubmitSurvey, useSurveys, type SurveyDetail } from '../../lib/queries'
import { EmailNotice, LoadError } from '../earn/EarnNotice'
import '../earn/earn.css'

const SCALE_LABELS = ['1', '2', '3', '4', '5']

function SurveyRunner({ survey, onExit }: { survey: SurveyDetail; onExit: () => void }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const submit = useSubmitSurvey()
  const toast = useToast()
  const total = survey.questions.length
  const question = survey.questions[step]
  const selected = answers[step]
  const last = step === total - 1

  const finish = () => {
    submit.mutate({ slug: survey.slug, answers }, {
      onSuccess: (result) => {
        toast(result.awarded ? `+${result.reward} puntos por completar la encuesta` : 'Esta encuesta ya estaba completada.', result.awarded ? 'success' : 'info')
        onExit()
      },
    })
  }

  return <Card>
    <div className="quiz">
      <div className="quiz-top"><span>{survey.title}</span><span className="mono-num">{step + 1} / {total}</span></div>
      <ProgressBar value={((step + (selected === undefined ? 0 : 1)) / total) * 100} label="Progreso de la encuesta" />
      <h2 className="quiz-prompt">{question.prompt}</h2>
      <div className={question.kind === 'scale' ? 'scale-row' : 'quiz-options'}>
        {question.options.map((option, index) => <button key={option} type="button" className={`quiz-option${selected === index ? ' is-selected' : ''}`} onClick={() => setAnswers((current) => { const next = [...current]; next[step] = index; return next })}>
          {question.kind === 'scale' ? <span>{SCALE_LABELS[index] ?? index + 1}<small style={{ display: 'block', opacity: .7 }}>{option}</small></span> : <><span className="key">{String.fromCharCode(65 + index)}</span>{option}</>}
        </button>)}
      </div>
      {submit.isError && <Alert tone="error">{earnErrorMessage(submit.error)}</Alert>}
      <div className="row-between">
        <Button variant="ghost" onClick={step === 0 ? onExit : () => setStep(step - 1)}>{step === 0 ? 'Cancelar' : 'Anterior'}</Button>
        {last
          ? <Button variant="primary" disabled={selected === undefined || answers.length < total} loading={submit.isPending} onClick={finish}>Enviar y cobrar</Button>
          : <Button variant="primary" disabled={selected === undefined} onClick={() => setStep(step + 1)}>Siguiente</Button>}
      </div>
    </div>
  </Card>
}

export default function SurveysPage() {
  const surveys = useSurveys()
  const start = useStartSurvey()
  const [active, setActive] = useState<SurveyDetail | null>(null)
  const toast = useToast()

  const open = (slug: string) => start.mutate(slug, {
    onSuccess: setActive,
    onError: (error) => toast(earnErrorMessage(error), 'error'),
  })

  const done = surveys.data?.filter((survey) => survey.completed).length ?? 0

  return <>
    <PageHeader title="Encuestas" description="Responde con sinceridad: no hay respuestas correctas. Cada encuesta se completa una sola vez y paga al enviarla." />
    <EmailNotice />
    {active
      ? <SurveyRunner key={active.slug} survey={active} onExit={() => setActive(null)} />
      : <>
        {surveys.isError && <LoadError error={surveys.error} />}
        {surveys.data && surveys.data.length > 0 && <Alert tone="info">{done} de {surveys.data.length} encuestas completadas. Se exige un tiempo mínimo de lectura por pregunta.</Alert>}
        {surveys.isLoading
          ? <div className="earn-list"><Skeleton height={190} /><Skeleton height={190} /><Skeleton height={190} /></div>
          : surveys.data && (surveys.data.length === 0
            ? <EmptyState icon={<ClipboardList size={22} />} title="No hay encuestas disponibles" description="Vuelve pronto: se añaden nuevas con regularidad." />
            : <div className="earn-list">
              {surveys.data.map((survey) => <article key={survey.slug} className={`earn-item${survey.completed ? ' is-done' : ''}`}>
                <div className="earn-meta"><Badge tone={survey.completed ? 'success' : 'accent'}>{survey.completed ? 'Completada' : 'Disponible'}</Badge><span className="row-inline"><Clock size={12} /> ~{survey.est_minutes} min</span><span>{survey.question_count} preguntas</span></div>
                <h3>{survey.title}</h3>
                <p>{survey.description}</p>
                <div className="earn-foot">
                  <span className="earn-reward">+{survey.reward} pts</span>
                  {survey.completed ? <span className="earn-meta"><Check size={14} /> Cobrada</span> : <Button variant="primary" size="sm" loading={start.isPending && start.variables === survey.slug} onClick={() => open(survey.slug)}>Empezar</Button>}
                </div>
              </article>)}
            </div>)}
      </>}
  </>
}
